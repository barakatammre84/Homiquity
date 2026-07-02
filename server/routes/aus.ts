import type { Express } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import {
  loanApplications,
  users,
  verificationReports,
} from "@shared/schema";
import { requireRole } from "../auth";
import {
  buildCommitmentLetter,
  parsePlaidAssetReport,
  submitToDU,
} from "../services/ausSubmission";

/**
 * AUS orchestration routes: Plaid asset webhook ingestion and GSE (Fannie DU)
 * casefile submission. See server/services/ausSubmission.ts for the vendor
 * adapters and simulation gates.
 */

const plaidAssetsWebhookSchema = z.object({
  webhook_type: z.literal("ASSETS").optional(),
  webhook_code: z.string().optional(), // PRODUCT_READY
  asset_report_id: z.string().min(1).optional(),
  asset_report_token: z.string().min(1),
  // Homiquity-specific correlation hint (set when we create the asset report)
  application_id: z.string().min(1),
  days_requested: z.number().int().positive().optional(),
});

const submitGseSchema = z.object({
  applicationId: z.string().min(1),
});

export function registerAusRoutes(app: Express) {
  /**
   * Plaid asset-report webhook. Unauthenticated by nature (Plaid calls it),
   * so: CSRF-exempt (see app.ts), optionally guarded by a shared secret
   * (PLAID_WEBHOOK_SECRET), and it only ever writes verification metadata —
   * never returns borrower data to the caller.
   */
  app.post("/api/webhooks/plaid-assets", async (req, res) => {
    try {
      const secret = process.env.PLAID_WEBHOOK_SECRET;
      if (secret && req.headers["x-webhook-secret"] !== secret) {
        return res.status(401).json({ error: "Invalid webhook secret" });
      }

      const parsed = plaidAssetsWebhookSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid webhook payload", details: parsed.error.flatten().fieldErrors });
      }
      const { asset_report_token, asset_report_id, application_id, days_requested } = parsed.data;

      const [application] = await db
        .select({ id: loanApplications.id, userId: loanApplications.userId })
        .from(loanApplications)
        .where(eq(loanApplications.id, application_id))
        .limit(1);
      if (!application) {
        // Acknowledge so Plaid stops retrying, but flag the orphan loudly.
        console.error(`[aus] plaid-assets webhook for unknown application ${application_id}`);
        return res.status(202).json({ received: true, matched: false });
      }

      const report = await parsePlaidAssetReport(asset_report_token);

      const [inserted] = await db
        .insert(verificationReports)
        .values({
          applicationId: application.id,
          userId: application.userId,
          provider: "plaid",
          reportType: "voa",
          voaReportId: asset_report_id ?? report.assetReportId,
          providerRequestId: report.assetReportId,
          status: "completed",
          daysRequested: days_requested ?? 90,
          gseEligible: true,
          institutionCount: report.institutionCount,
          accountCount: report.accountCount,
          totalBalance: report.totalBalance.toFixed(2),
          completedAt: new Date(),
          expiresAt: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
        })
        .returning({ id: verificationReports.id });

      console.error(
        `[aus] VOA stored for application ${application.id}: ${report.accountCount} accounts, ` +
          `$${report.totalBalance.toLocaleString()} total, trend=${report.transactionTrend}` +
          (report.simulated ? " (simulated)" : ""),
      );

      // Re-run the pre-underwriting validator now that verified assets exist —
      // this is where the asset-to-income reserves check gets real data.
      try {
        const { runPreUnderwriting } = await import("../services/preUnderwriting");
        await runPreUnderwriting(application.id, "voa_received");
      } catch (preUwErr) {
        console.error("[aus] Pre-underwriting re-evaluation failed (non-fatal):", preUwErr);
      }

      return res.status(200).json({
        received: true,
        matched: true,
        verificationReportId: inserted.id,
        simulated: report.simulated,
      });
    } catch (error) {
      console.error("[aus] plaid-assets webhook error:", error);
      return res.status(500).json({ error: "Failed to process asset report webhook" });
    }
  });

  /**
   * Submit the casefile to Fannie Mae DU (12.1-shaped), parse Day 1 Certainty,
   * persist findings, and return a structured commitment letter.
   */
  app.post(
    "/api/underwrite/submit-gse",
    requireRole("lo", "loa", "processor", "underwriter", "admin"),
    async (req, res) => {
      try {
        const parsed = submitGseSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
        }
        const { applicationId } = parsed.data;

        const [application] = await db
          .select()
          .from(loanApplications)
          .where(eq(loanApplications.id, applicationId))
          .limit(1);
        if (!application) return res.status(404).json({ error: "Application not found" });

        const [borrower] = await db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, application.userId))
          .limit(1);

        // Latest validated verification reports (relief layers).
        const latestReport = (reportType: string) =>
          db
            .select()
            .from(verificationReports)
            .where(
              and(
                eq(verificationReports.applicationId, applicationId),
                eq(verificationReports.reportType, reportType),
                eq(verificationReports.status, "completed"),
              ),
            )
            .orderBy(desc(verificationReports.completedAt))
            .limit(1);
        const [[voa], [voie]] = await Promise.all([latestReport("voa"), latestReport("voie")]);

        const purchasePrice = application.purchasePrice ? Number(application.purchasePrice) : 0;
        const downPayment = application.downPayment ? Number(application.downPayment) : 0;
        const loanAmount = Math.max(0, purchasePrice - downPayment);
        if (loanAmount <= 0 || purchasePrice <= 0) {
          return res.status(422).json({
            error: "Application is missing purchase price / down payment — cannot build a DU casefile.",
          });
        }
        const monthlyIncome = application.annualIncome ? Number(application.annualIncome) / 12 : null;
        const dti =
          monthlyIncome && application.monthlyDebts
            ? Number((Number(application.monthlyDebts) / monthlyIncome).toFixed(4))
            : null;

        const findings = await submitToDU({
          applicationId,
          loanAmount,
          propertyValue: purchasePrice,
          creditScore: application.creditScore,
          dti,
          voaReportId: voa?.voaReportId ?? null,
          voieReportId: voie?.voieReportId ?? null,
          auditCopyToken: voa?.auditCopyToken ?? null,
        });

        // Persist findings onto the application…
        await db
          .update(loanApplications)
          .set({
            ausCasefileId: findings.casefileId,
            ausRecommendation: findings.recommendation,
            ausSubmittedAt: new Date(),
            ausFindings: findings,
            d1cAssetsRelief: findings.day1Certainty.assets.relief,
            d1cIncomeRelief: findings.day1Certainty.income.relief,
            d1cEmploymentRelief: findings.day1Certainty.employment.relief,
          })
          .where(eq(loanApplications.id, applicationId));

        // …and mark the consumed reports GSE-eligible/ineligible per findings.
        const reliefByReportId: Array<[string | undefined, boolean]> = [
          [voa?.id, findings.day1Certainty.assets.relief],
          [voie?.id, findings.day1Certainty.income.relief || findings.day1Certainty.employment.relief],
        ];
        for (const [reportId, relief] of reliefByReportId) {
          if (reportId) {
            await db
              .update(verificationReports)
              .set({ gseEligible: relief, updatedAt: new Date() })
              .where(eq(verificationReports.id, reportId));
          }
        }

        const commitmentLetter = buildCommitmentLetter({
          applicationId,
          borrowerName: [borrower?.firstName, borrower?.lastName].filter(Boolean).join(" ") || "Borrower",
          propertyAddress: application.propertyAddress,
          loanAmount,
          propertyValue: purchasePrice,
          findings,
        });

        console.error(
          `[aus] DU casefile ${findings.casefileId} for ${applicationId}: ${findings.recommendation} ` +
            `(D1C assets=${findings.day1Certainty.assets.relief} income=${findings.day1Certainty.income.relief} ` +
            `employment=${findings.day1Certainty.employment.relief})${findings.simulated ? " (simulated)" : ""}`,
        );
        return res.json({
          casefileId: findings.casefileId,
          recommendation: findings.recommendation,
          day1Certainty: findings.day1Certainty,
          findings,
          commitmentLetter,
        });
      } catch (error) {
        console.error("[aus] submit-gse error:", error);
        return res.status(500).json({ error: "GSE submission failed" });
      }
    },
  );
}
