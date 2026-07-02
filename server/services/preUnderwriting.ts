import { createHash } from "crypto";
import { db } from "../db";
import { loanApplications, verificationReports } from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";
import { storage } from "../storage";
import { sendEmail } from "./emailService";

/**
 * Pre-underwriting validator.
 *
 * Runs automatically (1) the moment intake completes and (2) whenever a Plaid
 * VOA report lands via the webhook, comparing self-reported income against
 * VERIFIED assets and raising machine-readable flags on the application
 * (loan_applications.pre_uw_flags).
 *
 * Flags do not gate stages by themselves — the conditions system does that.
 * Where a flag needs teeth (e.g. low reserves), this module materializes an
 * outstanding loan condition, and the existing status mutator
 * (updatePipelineStage behind /api/loan-applications/:id/status, which
 * refuses advancement while checkPipelineProgress reports blockers) enforces
 * it. Self-employed files already receive their 2-year tax-return condition
 * from pipelineEngine at intake; the COMPLEX_INCOME_CHECK flag is the compact
 * marker lenders and the UI can read without scanning conditions.
 *
 * The "frictionless fix": when the flag set changes, the borrower gets one
 * personalized email explaining exactly what is needed (deduplicated via a
 * hash so re-evaluations never re-nag).
 */

export const RESERVES_MONTHS_THRESHOLD = 2;

// Assumption used for the reserves estimate before a rate is locked. Matches
// the funnel's advisory math: 30-year amortization + 1.25%/yr tax & insurance.
const ASSUMED_ANNUAL_RATE = 0.07;
const TAX_INSURANCE_ANNUAL_PCT = 0.0125;

export type PreUwFlagCode = "LOW_RESERVES_WARNING" | "COMPLEX_INCOME_CHECK";

export interface PreUwRequiredDoc {
  documentType: string;
  description: string;
}

export interface PreUwFlag {
  code: PreUwFlagCode;
  severity: "warning" | "blocking";
  reason: string;
  requiredDocs: PreUwRequiredDoc[];
  metrics?: Record<string, number>;
}

export interface PreUwInput {
  annualIncome: string | number | null;
  purchasePrice: string | number | null;
  downPayment: string | number | null;
  employmentType: string | null;
  /** Total balance from the latest completed VOA report; null = not yet verified. */
  verifiedAssetsTotal: number | null;
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return NaN;
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/[,$]/g, ""));
  return isNaN(n) ? NaN : n;
}

/** Estimated PITI on the target home: 30-yr P&I at the assumed rate + tax/ins. */
export function estimateMonthlyPITI(purchasePrice: number, downPayment: number): number {
  const loanAmount = Math.max(purchasePrice - downPayment, 0);
  if (loanAmount <= 0 || purchasePrice <= 0) return 0;
  const monthlyRate = ASSUMED_ANNUAL_RATE / 12;
  const n = 360;
  const pAndI =
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, n)) /
    (Math.pow(1 + monthlyRate, n) - 1);
  const taxAndInsurance = (purchasePrice * TAX_INSURANCE_ANNUAL_PCT) / 12;
  return pAndI + taxAndInsurance;
}

/**
 * Post-closing months of reserves: verified liquid assets left AFTER the down
 * payment, divided by the estimated monthly housing payment.
 */
export function computeMonthsOfReserves(input: {
  verifiedAssetsTotal: number;
  purchasePrice: number;
  downPayment: number;
}): number | null {
  const piti = estimateMonthlyPITI(input.purchasePrice, input.downPayment);
  if (piti <= 0) return null;
  const remaining = input.verifiedAssetsTotal - input.downPayment;
  return remaining / piti;
}

/** Pure flag derivation — same input, same flags. */
export function derivePreUnderwritingFlags(input: PreUwInput): PreUwFlag[] {
  const flags: PreUwFlag[] = [];

  if (input.employmentType === "self_employed") {
    flags.push({
      code: "COMPLEX_INCOME_CHECK",
      severity: "blocking",
      reason:
        "Self-employed income must be documented before approval-grade decisions. Clear-to-close is restricted until the tax-return conditions are fulfilled.",
      requiredDocs: [
        {
          documentType: "tax_return",
          description: "Complete federal tax returns (1040s) for the past 2 years, all schedules",
        },
        {
          documentType: "profit_loss",
          description: "Year-to-date profit and loss statement",
        },
      ],
    });
  }

  const price = toNumber(input.purchasePrice);
  const down = toNumber(input.downPayment);
  if (input.verifiedAssetsTotal !== null && !isNaN(price) && !isNaN(down)) {
    const months = computeMonthsOfReserves({
      verifiedAssetsTotal: input.verifiedAssetsTotal,
      purchasePrice: price,
      downPayment: down,
    });
    if (months !== null && months < RESERVES_MONTHS_THRESHOLD) {
      const piti = estimateMonthlyPITI(price, down);
      flags.push({
        code: "LOW_RESERVES_WARNING",
        severity: "warning",
        reason: `Verified assets cover ${months < 0 ? 0 : months.toFixed(1)} months of the estimated housing payment after the down payment — below the ${RESERVES_MONTHS_THRESHOLD}-month reserve guideline.`,
        requiredDocs: [
          {
            documentType: "bank_statement",
            description:
              "Statements for any additional accounts (savings, retirement, brokerage) not yet linked",
          },
          {
            documentType: "gift_letter",
            description: "Gift letter if a relative is contributing funds",
          },
        ],
        metrics: {
          monthsOfReserves: Number(months.toFixed(2)),
          estimatedMonthlyPayment: Number(piti.toFixed(2)),
          verifiedAssets: input.verifiedAssetsTotal,
          downPayment: down,
        },
      });
    }
  }

  return flags;
}

/** The "frictionless fix": one personalized message instead of an LO email chain. */
export function buildFlagOutreach(
  firstName: string | null | undefined,
  flags: PreUwFlag[],
): { subject: string; emailHtml: string; emailText: string; smsBody: string } | null {
  if (flags.length === 0) return null;
  const name = firstName || "there";

  const docLines = flags.flatMap((f) => f.requiredDocs.map((d) => d.description));
  const uniqueDocs = [...new Set(docLines)];

  const explanations = flags.map((f) => {
    if (f.code === "COMPLEX_INCOME_CHECK") {
      return "Because you're self-employed, lenders need to see your business income history. To proceed with your loan, please upload your last two years of federal tax returns (1040s) and a year-to-date profit & loss statement.";
    }
    const months = f.metrics?.monthsOfReserves;
    const monthsLabel =
      months === undefined ? `less than ${RESERVES_MONTHS_THRESHOLD}` : Math.max(months, 0).toFixed(1);
    return `Your linked accounts currently show ${monthsLabel} months of payment reserves after your down payment. This won't stop your application — linking any additional savings, retirement, or brokerage accounts (or documenting gift funds) will strengthen it.`;
  });

  const subject = "Your Homiquity application: a quick document request";
  const emailText = [
    `Hi ${name},`,
    "",
    "Good news — your application is moving. Our automated review found a couple of items we'll need so nothing slows you down later:",
    "",
    ...explanations.map((e, i) => `${i + 1}. ${e}`),
    "",
    "What to upload:",
    ...uniqueDocs.map((d) => `• ${d}`),
    "",
    "Upload securely in your document center: https://mortgage-stream.vercel.app/documents",
    "",
    "No action is needed beyond the uploads — your file re-checks automatically the moment they arrive.",
    "— The Homiquity Team",
  ].join("\n");

  const emailHtml = emailText
    .split("\n")
    .map((line) => (line ? `<p style="margin:4px 0">${line}</p>` : "<br/>"))
    .join("");

  const smsBody = `Homiquity: your loan file needs ${uniqueDocs.length} document${uniqueDocs.length === 1 ? "" : "s"} (${flags.map((f) => (f.code === "COMPLEX_INCOME_CHECK" ? "2yrs tax returns" : "asset statements")).join(", ")}). Upload securely: https://mortgage-stream.vercel.app/documents`;

  return { subject, emailHtml, emailText, smsBody };
}

function flagsHash(flags: PreUwFlag[]): string {
  return createHash("sha256")
    .update(flags.map((f) => f.code).sort().join("|"))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Evaluate an application, persist the flags, materialize conditions that
 * need teeth, and notify the borrower once per distinct flag set.
 */
export async function runPreUnderwriting(
  applicationId: string,
  trigger: "intake" | "voa_received",
): Promise<{ flags: PreUwFlag[]; notified: boolean }> {
  const [application] = await db
    .select()
    .from(loanApplications)
    .where(eq(loanApplications.id, applicationId))
    .limit(1);
  if (!application) throw new Error(`Application ${applicationId} not found`);

  const [voa] = await db
    .select({ totalBalance: verificationReports.totalBalance })
    .from(verificationReports)
    .where(
      and(
        eq(verificationReports.applicationId, applicationId),
        eq(verificationReports.reportType, "voa"),
        eq(verificationReports.status, "completed"),
      ),
    )
    .orderBy(desc(verificationReports.completedAt))
    .limit(1);

  const flags = derivePreUnderwritingFlags({
    annualIncome: application.annualIncome,
    purchasePrice: application.purchasePrice,
    downPayment: application.downPayment,
    employmentType: application.employmentType,
    verifiedAssetsTotal: voa?.totalBalance ? parseFloat(voa.totalBalance) : null,
  });

  const previous = (application.preUwFlags ?? null) as { notifiedHash?: string } | null;
  const hash = flagsHash(flags);
  const alreadyNotified = previous?.notifiedHash === hash;

  // Give the reserves warning teeth: an outstanding condition (idempotent —
  // pipelineEngine only creates it for LTV > 95%, so check before inserting).
  if (flags.some((f) => f.code === "LOW_RESERVES_WARNING")) {
    const existing = await storage.getLoanConditionsByApplication(applicationId);
    const hasReserveCondition = existing.some(
      (c) => c.requiredDocumentTypes?.includes("reserves_proof") && c.status === "outstanding",
    );
    if (!hasReserveCondition) {
      await storage.createLoanCondition({
        applicationId,
        category: "assets",
        title: "Reserve Funds Verification",
        description: `Verified assets fall below the ${RESERVES_MONTHS_THRESHOLD}-month reserve guideline. Provide additional asset statements or gift documentation.`,
        priority: "prior_to_docs",
        status: "outstanding",
        requiredDocumentTypes: ["reserves_proof"],
        isAutoGenerated: true,
        sourceRule: "PRE_UW_LOW_RESERVES",
      });
    }
  }

  let notified = false;
  if (flags.length > 0 && !alreadyNotified) {
    const borrower = await storage.getUser(application.userId);
    const outreach = buildFlagOutreach(borrower?.firstName, flags);
    if (outreach && borrower) {
      await storage.createNotification({
        userId: borrower.id,
        type: "document_request",
        title: "A few items needed on your application",
        body: outreach.emailText,
        entityType: "loan_application",
        entityId: applicationId,
        metadata: { flags: flags.map((f) => f.code), trigger, sms: outreach.smsBody },
      });
      if (borrower.email) {
        await sendEmail({
          to: borrower.email,
          subject: outreach.subject,
          html: outreach.emailHtml,
          text: outreach.emailText,
        });
      }
      notified = true;
    }
  }

  await db
    .update(loanApplications)
    .set({
      preUwFlags: {
        flags,
        evaluatedAt: new Date().toISOString(),
        trigger,
        notifiedHash: notified || alreadyNotified ? hash : previous?.notifiedHash ?? null,
      },
    })
    .where(eq(loanApplications.id, applicationId));

  await storage.createDealActivity({
    applicationId,
    activityType: "note",
    title: flags.length > 0 ? `Pre-underwriting flags: ${flags.map((f) => f.code).join(", ")}` : "Pre-underwriting check passed",
    description:
      flags.length > 0
        ? flags.map((f) => f.reason).join(" ")
        : `Automated pre-underwriting review found no issues (trigger: ${trigger}).`,
    performedBy: application.userId,
  });

  console.error(
    `[pre-uw] ${applicationId} (${trigger}): ${flags.length === 0 ? "clean" : flags.map((f) => f.code).join(", ")}${notified ? " — borrower notified" : ""}`,
  );

  return { flags, notified };
}
