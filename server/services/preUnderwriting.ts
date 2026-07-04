import { createHash } from "crypto";
import { db } from "../db";
import { creditPulls, loanApplications, verificationReports } from "@shared/schema";
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

import type { IncomeSourceEntry } from "@shared/schema";
import { toNum as toNumber } from "@shared/lib/number";
import { COMPANY_CONFIG } from "../config/company";
import {
  adjustLiabilities,
  assessIncomeSeasoning,
  calculateRentalIncomeOffsets,
  computeDti,
  computeWhatIfPayoff,
  detectSignificantDeposits,
  SEASONING_FULL_MONTHS,
  STANDARD_DTI_CEILING,
  type DepositoryTransaction,
  type Tradeline,
} from "./underwritingNuance";

export const RESERVES_MONTHS_THRESHOLD = 2;

// Assumption used for the reserves estimate before a rate is locked. Matches
// the funnel's advisory math: 30-year amortization + 1.25%/yr tax & insurance.
const ASSUMED_ANNUAL_RATE = 0.07;
const TAX_INSURANCE_ANNUAL_PCT = 0.0125;

export type PreUwFlagCode =
  | "LOW_RESERVES_WARNING"
  | "COMPLEX_INCOME_CHECK"
  | "INCOME_SEASONING"
  | "VERIFIED_DEBT_DTI"
  | "LARGE_DEPOSIT_SOURCING"
  | "RENTAL_INCOME_OFFSET";

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
  /** Supplementary income sources from intake (seasoning check, B3-3.2). */
  incomeSources?: IncomeSourceEntry[] | null;
  /** Verified liability ledger from the latest soft pull (B3-6-05 math). */
  tradelines?: Tradeline[] | null;
  /** Depository transactions from the latest VOA (B3-4.3-04 sourcing). */
  transactions?: DepositoryTransaction[] | null;
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

  // --- Income seasoning (Fannie B3-3.2): supplementary income needs 24 months
  // of history; 12–24 months only with compensating factors. -----------------
  const seasoning = assessIncomeSeasoning(input.incomeSources);
  if (seasoning.unseasonedSources.length > 0 || seasoning.conditionalSources.length > 0) {
    const worst = [...seasoning.unseasonedSources, ...seasoning.conditionalSources].sort(
      (a, b) => a.months - b.months,
    )[0];
    const blocking = seasoning.unseasonedSources.length > 0;
    flags.push({
      code: "INCOME_SEASONING",
      severity: blocking ? "blocking" : "warning",
      reason: blocking
        ? `Your ${worst.type.replace(/_/g, " ")} income has ${worst.months} months of history — standard guidelines require ${SEASONING_FULL_MONTHS} months before it can count toward qualifying. We can still qualify you on your other income.`
        : `Your ${worst.type.replace(/_/g, " ")} income has ${worst.months} months of history — between 12 and ${SEASONING_FULL_MONTHS} months it can count only with strong compensating factors, which your tax returns document.`,
      requiredDocs: [
        {
          documentType: "tax_return",
          description: "Last two years of federal tax returns (1040s) covering the supplementary income",
        },
        { documentType: "business_license", description: "Business license or contract evidencing the income's continuity" },
      ],
      metrics: {
        shortestSeasoningMonths: worst.months,
        conditionalSources: seasoning.conditionalSources.length,
        unseasonedSources: seasoning.unseasonedSources.length,
      },
    });
  }

  // --- Sleeper debt (Fannie B3-6-05): deferred student loans at 1% of balance
  // plus newly opened tradelines, recomputed against the 43% DTI ceiling. ----
  const income = toNumber(input.annualIncome);
  if (input.tradelines && input.tradelines.length > 0 && !isNaN(income) && income > 0) {
    const adjustment = adjustLiabilities(input.tradelines);
    const grossMonthly = income / 12;
    const piti = !isNaN(price) && !isNaN(down) ? estimateMonthlyPITI(price, down) : 0;
    const dti = computeDti(adjustment.adjustedMonthlyDebt, piti, grossMonthly);
    const hasHiddenDebt =
      adjustment.deferredStudentLoanImputed > 0 || adjustment.newTradelines.length > 0;
    if (hasHiddenDebt && dti > STANDARD_DTI_CEILING) {
      const whatIf = computeWhatIfPayoff(
        input.tradelines,
        adjustment.adjustedMonthlyDebt,
        piti,
        grossMonthly,
      );
      flags.push({
        code: "VERIFIED_DEBT_DTI",
        severity: "warning",
        reason:
          `Your verified credit file includes ${adjustment.deferredStudentLoans.length > 0 ? "deferred student loans (qualified at 1% of balance)" : ""}` +
          `${adjustment.deferredStudentLoans.length > 0 && adjustment.newTradelines.length > 0 ? " and " : ""}` +
          `${adjustment.newTradelines.length > 0 ? "recently opened credit lines" : ""}` +
          ` that raise your qualifying debt-to-income to ${(dti * 100).toFixed(1)}% — above the ${(STANDARD_DTI_CEILING * 100).toFixed(0)}% standard ceiling.` +
          (whatIf
            ? ` Paying off your ${whatIf.creditor} balance of $${Math.round(whatIf.balance).toLocaleString()} before closing would bring it back to ${(whatIf.dtiAfterPayoff * 100).toFixed(1)}%.`
            : ""),
        requiredDocs: whatIf
          ? [{ documentType: "other", description: `Payoff confirmation for ${whatIf.creditor} (balance ~$${Math.round(whatIf.balance).toLocaleString()})` }]
          : [{ documentType: "letter_of_explanation", description: "Letter of explanation for the recently opened credit lines" }],
        metrics: {
          adjustedDti: Number((dti * 100).toFixed(2)),
          adjustedMonthlyDebt: Number(adjustment.adjustedMonthlyDebt.toFixed(2)),
          deferredImputed: Number(adjustment.deferredStudentLoanImputed.toFixed(2)),
          newTradelines: adjustment.newTradelines.length,
          ...(whatIf ? { whatIfPayoffBalance: whatIf.balance, whatIfDti: Number((whatIf.dtiAfterPayoff * 100).toFixed(2)) } : {}),
        },
      });
    }
  }

  // --- Large-deposit sourcing (Fannie B3-4.3-04): single deposits over 50% of
  // monthly qualifying income must be documented. ----------------------------
  if (!isNaN(income) && income > 0) {
    const deposits = detectSignificantDeposits(input.transactions, income / 12);
    if (deposits.length > 0) {
      const largest = deposits.sort((a, b) => b.amount - a.amount)[0];
      flags.push({
        code: "LARGE_DEPOSIT_SOURCING",
        severity: "warning",
        reason: `We noticed a deposit of $${Math.round(largest.amount).toLocaleString()} on ${largest.date}. Deposits above 50% of monthly income ($${Math.round(largest.threshold).toLocaleString()}) must be sourced — a gift letter if it came from family, or documentation of the sale/transfer otherwise.`,
        requiredDocs: [
          { documentType: "gift_letter", description: "Signed gift letter + donor's transfer confirmation (if the funds were a gift)" },
          { documentType: "other", description: "Sourcing documentation (e.g., vehicle sale settlement, transfer records) otherwise" },
        ],
        metrics: { depositAmount: largest.amount, threshold: largest.threshold, depositCount: deposits.length },
      });
    }
  }

  // --- Rental income calculation (Fannie B3-3.1-08): 75% of gross rent, net
  // of the property's PITIA, per rental property declared at intake. --------
  const rentalProperties = (input.incomeSources ?? [])
    .filter((s) => s.type === "rental")
    .flatMap((s) => s.rentalProperties ?? []);
  const rentalOffsets = calculateRentalIncomeOffsets(rentalProperties);
  if (rentalOffsets.length > 0) {
    const totalQualifying = rentalOffsets.reduce((sum, r) => sum + r.qualifyingRentalIncome, 0);
    const totalNetOffset = rentalOffsets.reduce((sum, r) => sum + r.netOffset, 0);
    flags.push({
      code: "RENTAL_INCOME_OFFSET",
      severity: "warning",
      reason:
        `We applied a 25% vacancy/expense factor to your reported rental income (standard guidelines): ` +
        `$${Math.round(totalQualifying).toLocaleString()}/month qualifying across ${rentalOffsets.length} propert${rentalOffsets.length === 1 ? "y" : "ies"}, ` +
        (totalNetOffset >= 0
          ? `net of the property payment this adds $${Math.round(totalNetOffset).toLocaleString()}/month toward your qualifying income.`
          : `net of the property payment this adds $${Math.round(Math.abs(totalNetOffset)).toLocaleString()}/month to your qualifying debt.`) +
        ` Please upload the executed lease agreement(s) and your most recent Schedule E to document rental history.`,
      requiredDocs: [
        { documentType: "lease_agreement", description: "Executed lease agreement for each rental property" },
        { documentType: "tax_return", description: "Most recent Schedule E (Form 1040) documenting rental history" },
      ],
      metrics: {
        propertyCount: rentalOffsets.length,
        totalQualifyingRentalIncome: Number(totalQualifying.toFixed(2)),
        totalNetOffset: Number(totalNetOffset.toFixed(2)),
      },
    });
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
    switch (f.code) {
      case "COMPLEX_INCOME_CHECK":
        return "Because you're self-employed, lenders need to see your business income history. To proceed with your loan, please upload your last two years of federal tax returns (1040s) and a year-to-date profit & loss statement.";
      case "INCOME_SEASONING":
      case "VERIFIED_DEBT_DTI":
      case "LARGE_DEPOSIT_SOURCING":
      case "RENTAL_INCOME_OFFSET":
        // These reasons are already written borrower-first with the specific
        // numbers and the resolution path baked in.
        return f.reason;
      default: {
        const months = f.metrics?.monthsOfReserves;
        const monthsLabel =
          months === undefined ? `less than ${RESERVES_MONTHS_THRESHOLD}` : Math.max(months, 0).toFixed(1);
        return `Your linked accounts currently show ${monthsLabel} months of payment reserves after your down payment. This won't stop your application — linking any additional savings, retirement, or brokerage accounts (or documenting gift funds) will strengthen it.`;
      }
    }
  });

  // Configurable so non-production environments never send borrowers to the
  // wrong host; defaults preserve current production behavior.
  const documentsUrl = `${COMPANY_CONFIG.baseUrl}/documents`;

  const subject = "Your Homiquity application: a quick document request";
  const emailText = [
    `Hi ${name},`,
    "",
    // Neutral, factual framing: this is a documentation request, and it must
    // never read as a decision signal in either direction (ECOA/UDAAP).
    "Thanks for your application. Our automated document review found a few items we'll need so nothing slows you down later:",
    "",
    ...explanations.map((e, i) => `${i + 1}. ${e}`),
    "",
    "What to upload:",
    ...uniqueDocs.map((d) => `• ${d}`),
    "",
    `Upload securely in your document center: ${documentsUrl}`,
    "",
    "This is a request for documentation only — not a loan decision. Your file re-checks automatically the moment your documents arrive.",
    "— The Homiquity Team",
  ].join("\n");

  const emailHtml = emailText
    .split("\n")
    .map((line) => (line ? `<p style="margin:4px 0">${line}</p>` : "<br/>"))
    .join("");

  const smsBody = `Homiquity: your loan file needs ${uniqueDocs.length} required document${uniqueDocs.length === 1 ? "" : "s"}. Upload securely: ${documentsUrl}`;

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

  const [[voa], [pull]] = await Promise.all([
    db
      .select({ totalBalance: verificationReports.totalBalance, rawPayload: verificationReports.rawPayload })
      .from(verificationReports)
      .where(
        and(
          eq(verificationReports.applicationId, applicationId),
          eq(verificationReports.reportType, "voa"),
          eq(verificationReports.status, "completed"),
        ),
      )
      .orderBy(desc(verificationReports.completedAt))
      .limit(1),
    db
      .select({ liabilities: creditPulls.liabilities })
      .from(creditPulls)
      .where(and(eq(creditPulls.applicationId, applicationId), eq(creditPulls.status, "completed")))
      .orderBy(desc(creditPulls.completedAt))
      .limit(1),
  ]);

  const flags = derivePreUnderwritingFlags({
    annualIncome: application.annualIncome,
    purchasePrice: application.purchasePrice,
    downPayment: application.downPayment,
    employmentType: application.employmentType,
    verifiedAssetsTotal: voa?.totalBalance ? parseFloat(voa.totalBalance) : null,
    incomeSources: (application.incomeSources as IncomeSourceEntry[] | null) ?? null,
    tradelines: (pull?.liabilities as Tradeline[] | null) ?? null,
    transactions:
      ((voa?.rawPayload as { transactions?: DepositoryTransaction[] } | null)?.transactions as
        | DepositoryTransaction[]
        | undefined) ?? null,
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
