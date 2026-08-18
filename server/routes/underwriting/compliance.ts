// Underwriting routes: Compliance dashboard.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import { isAdmin } from "@shared/roles";
import type { IStorage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { isInFlightLoanAppStatus, isInternalStaffRole } from "@shared/schema";
import type { User } from "@shared/schema";
import * as creditService from "../../services/creditService";

export function registerComplianceDashboardRoutes(
  app: Express,
  storage: IStorage,
) {
  app.get("/api/compliance/dashboard", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;

      if (!isInternalStaffRole(user.role)) {
        return res.status(403).json({ error: "Only internal staff can view compliance dashboard" });
      }

      let applications: Awaited<ReturnType<typeof storage.getAllLoanApplications>>;

      if (isAdmin(user)) {
        applications = await storage.getAllLoanApplications();
      } else {
        const teamMemberships = await storage.getTeamMembersByUser(user.id);
        applications = teamMemberships
          .map(m => m.application)
          .filter((a): a is NonNullable<typeof a> => a !== null && a !== undefined);
      }

      // Validation worklist: in-flight files plus funded ones — a funded loan
      // still faces GSE delivery, so its MISMO/URLA gaps stay visible. Dead
      // files (denied/withdrawn/expired) and drafts have nothing to validate.
      const activeApps = applications.filter(
        a => isInFlightLoanAppStatus(a.status) || a.status === "funded"
      );

      // Batched (`inArray`) load — the /api/dashboard house pattern. This used
      // to call the single-application validator once per active file, and that
      // validator makes 15 storage reads internally, so a staff dashboard with
      // 100 in-flight files fired ~1,500 queries at the pooler in one burst
      // (CTO_ROADMAP §3.2). It is now a fixed 13 regardless of file count.
      // Scoring is the same function either way, so the verdicts are identical.
      const { validateMISMOCompletenessBatch, toValidationSummary } =
        await import("../../services/mismoValidation");

      const validations = await validateMISMOCompletenessBatch(activeApps);

      // Applications the batch could not score are dropped, exactly as the
      // per-application try/catch dropped them.
      const validResults = activeApps.flatMap((app) => {
        const validation = validations.get(app.id);
        if (!validation) return [];
        return [{
          ...toValidationSummary(validation),
          borrowerName: app.propertyAddress ? `Loan - ${app.propertyAddress}` : `Application ${app.id.slice(0, 8)}`,
          status: app.status,
          loanAmount: app.purchasePrice && app.downPayment
            ? Number(app.purchasePrice) - Number(app.downPayment)
            : null,
        }];
      });

      // ECOA §1002.9 delivery watchdog, read-only view: how many adverse-action
      // notices in this user's visible scope are undelivered and how many have
      // aged into the warning/breach bands. Denied apps are filtered out of
      // `activeApps` above, so this is computed against the full visible set.
      // Read-only classification only — the notification-raising sweep runs from
      // the cron job, never from a dashboard GET.
      const { getUndeliveredAdverseActions } = await import("../../services/creditService");
      const { classifyAdverseActionDelivery } = await import("../../services/adverseActionDelivery");
      const visibleAppIds = new Set(applications.map(a => a.id));
      const undelivered = (await getUndeliveredAdverseActions()).filter(aa =>
        visibleAppIds.has(aa.applicationId),
      );
      const now = new Date();
      let aaWarning = 0;
      let aaBreach = 0;
      for (const aa of undelivered) {
        const c = classifyAdverseActionDelivery(
          { noticeDate: aa.noticeDate, deliveredAt: aa.deliveredAt },
          now,
        );
        if (c === "warning") aaWarning += 1;
        else if (c === "breach") aaBreach += 1;
      }

      res.json({
        total: validResults.length,
        gseReady: validResults.filter(r => r.gseReady).length,
        ulddCompliant: validResults.filter(r => r.ulddCompliant).length,
        needsAttention: validResults.filter(r => r.criticalCount > 0).length,
        applications: validResults,
        adverseActionDelivery: {
          undelivered: undelivered.length,
          warning: aaWarning,
          breach: aaBreach,
        },
      });
    } catch (error) {
      console.error("Compliance dashboard error:", error);
      res.status(500).json({ error: "Failed to load compliance dashboard" });
    }
  });
}
