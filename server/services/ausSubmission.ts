import { createHash } from "node:crypto";
import { plaidClient } from "../plaid";

/**
 * AUS (Automated Underwriting System) submission service.
 *
 * Orchestrates the GSE leg of the digital pre-approval pipeline:
 *   Plaid asset report parsing → DU casefile payload → DU Messages API
 *   (Fannie Mae Desktop Underwriter, 12.1-shaped) → Day 1 Certainty parsing
 *   → structured commitment letter.
 *
 * Like server/mcp/vendors.ts, external calls are gated on env credentials and
 * fall back to clearly-flagged deterministic simulations until vendor/GSE
 * access exists. Real DU access requires Fannie Mae technology approval — an
 * onboarding process, not just an API key — so the simulation preserves the
 * exact seams where the real integration lands.
 */

const AUS_TIMEOUT_MS = Number(process.env.AUS_TIMEOUT_MS ?? 15_000);

async function withTimeout<T>(work: Promise<T>, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${AUS_TIMEOUT_MS}ms`)), AUS_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/** Deterministic pseudo-random in [0,1) from a seed (stable simulations). */
function seeded(seed: string): number {
  return createHash("sha256").update(seed).digest().readUInt32BE(0) / 0xffffffff;
}

// ---------------------------------------------------------------------------
// Plaid asset report parsing
// ---------------------------------------------------------------------------

export interface ParsedAssetReport {
  simulated: boolean;
  assetReportId: string;
  institutionCount: number;
  accountCount: number;
  totalBalance: number;
  avgMonthlyBalance: number;
  payroll: { employerName: string; avgMonthlyDeposit: number; monthsObserved: number };
  transactionTrend: "stable" | "growing" | "declining";
}

export async function parsePlaidAssetReport(assetReportToken: string): Promise<ParsedAssetReport> {
  if (process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET) {
    const { data } = await withTimeout(
      plaidClient.assetReportGet({ asset_report_token: assetReportToken }),
      "Plaid /asset_report/get",
    );
    const report = data.report;
    const accounts = report.items.flatMap((item) => item.accounts ?? []);
    const totalBalance = accounts.reduce((s, a) => s + (a.balances.current ?? 0), 0);
    return {
      simulated: false,
      assetReportId: report.asset_report_id,
      institutionCount: report.items.length,
      accountCount: accounts.length,
      totalBalance,
      // Plaid exposes historical_balances per account; average across the window.
      avgMonthlyBalance: Math.round(
        accounts.reduce((s, a) => {
          const hist = a.historical_balances ?? [];
          const avg = hist.length ? hist.reduce((x, h) => x + (h.current ?? 0), 0) / hist.length : (a.balances.current ?? 0);
          return s + avg;
        }, 0),
      ),
      payroll: { employerName: "(see transactions)", avgMonthlyDeposit: 0, monthsObserved: report.days_requested ? Math.round(report.days_requested / 30) : 0 },
      transactionTrend: "stable",
    };
  }

  // Simulation (no Plaid credentials configured)
  const s = assetReportToken.toLowerCase();
  const totalBalance = 20_000 + Math.round(seeded(s) * 180_000);
  const avgDeposit = 4_000 + Math.round(seeded(s + "pay") * 8_000);
  const trends: ParsedAssetReport["transactionTrend"][] = ["stable", "growing", "declining"];
  return {
    simulated: true,
    assetReportId: `sim-voa-${createHash("sha1").update(s).digest("hex").slice(0, 12)}`,
    institutionCount: 1 + Math.round(seeded(s + "inst") * 2),
    accountCount: 2 + Math.round(seeded(s + "acct") * 3),
    totalBalance,
    avgMonthlyBalance: Math.round(totalBalance * 0.82),
    payroll: {
      employerName: "Acme Analytics LLC",
      avgMonthlyDeposit: avgDeposit,
      monthsObserved: 12,
    },
    transactionTrend: trends[Math.floor(seeded(s + "trend") * trends.length)],
  };
}

// ---------------------------------------------------------------------------
// Fannie Mae DU (Desktop Underwriter) Messages API — 12.1-shaped
// ---------------------------------------------------------------------------

export interface DuCasefileInput {
  applicationId: string;
  loanAmount: number;
  propertyValue: number;
  creditScore: number | null;
  dti: number | null; // ratio, e.g. 0.36
  voaReportId: string | null;
  voieReportId: string | null;
  auditCopyToken: string | null;
}

export interface DuFindings {
  simulated: boolean;
  casefileId: string;
  duVersion: string;
  recommendation: "approve_eligible" | "approve_ineligible" | "refer" | "refer_with_caution";
  riskAssessment: { dti: number | null; ltv: number; creditScore: number | null };
  day1Certainty: {
    assets: { relief: boolean; reportId: string | null; reason: string };
    income: { relief: boolean; reportId: string | null; reason: string };
    employment: { relief: boolean; reportId: string | null; reason: string };
  };
  messages: Array<{ code: string; severity: "info" | "condition" | "risk"; text: string }>;
}

export async function submitToDU(input: DuCasefileInput): Promise<DuFindings> {
  if (process.env.FANNIE_DU_API_KEY) {
    throw new Error(
      "FANNIE_DU_API_KEY is set but the live DU adapter is not implemented yet — DU access requires " +
        "Fannie Mae technology-provider onboarding. Remove the key to use simulation.",
    );
  }

  const ltv = input.propertyValue > 0 ? input.loanAmount / input.propertyValue : 1;
  const messages: DuFindings["messages"] = [];
  const casefileId = `sim-du-${createHash("sha1").update(input.applicationId).digest("hex").slice(0, 10)}`;

  // Recommendation logic mirroring DU's headline gates (simplified).
  let recommendation: DuFindings["recommendation"] = "approve_eligible";
  if (input.creditScore === null || input.creditScore < 620) {
    recommendation = "refer";
    messages.push({ code: "DU-3001", severity: "risk", text: "Credit score below conventional minimum (620) or unavailable." });
  }
  if (input.dti !== null && input.dti > 0.5) {
    recommendation = recommendation === "refer" ? "refer_with_caution" : "refer";
    messages.push({ code: "DU-3202", severity: "risk", text: `DTI ${(input.dti * 100).toFixed(1)}% exceeds the 50% DU ceiling.` });
  }
  if (ltv > 0.97) {
    recommendation = "approve_ineligible";
    messages.push({ code: "DU-2105", severity: "condition", text: `LTV ${(ltv * 100).toFixed(1)}% exceeds 97% conforming maximum.` });
  }

  // Day 1 Certainty: relief only on layers backed by a validated report.
  const d1c = (reportId: string | null, layer: string) =>
    reportId
      ? { relief: recommendation === "approve_eligible", reportId, reason: recommendation === "approve_eligible" ? `${layer} validated via ${reportId}` : "Relief withheld: casefile not Approve/Eligible" }
      : { relief: false, reportId: null, reason: `No validated ${layer.toLowerCase()} report on the casefile` };

  const findings: DuFindings = {
    simulated: true,
    casefileId,
    duVersion: "12.1",
    recommendation,
    riskAssessment: { dti: input.dti, ltv: Number(ltv.toFixed(4)), creditScore: input.creditScore },
    day1Certainty: {
      assets: d1c(input.voaReportId, "Assets"),
      income: d1c(input.voieReportId, "Income"),
      employment: d1c(input.voieReportId, "Employment"),
    },
    messages: messages.length ? messages : [{ code: "DU-0001", severity: "info", text: "Casefile underwritten with no adverse findings." }],
  };

  return await withTimeout(Promise.resolve(findings), "DU Messages API");
}

// ---------------------------------------------------------------------------
// Commitment letter
// ---------------------------------------------------------------------------

export interface CommitmentLetter {
  letterId: string;
  letterType: "commitment" | "conditional_commitment" | "declined";
  issuedAt: string;
  expiresAt: string;
  lender: { name: string; nmls: string };
  borrower: { name: string; applicationId: string };
  property: { address: string | null; value: number };
  loanTerms: { loanAmount: number; ltvPercent: number; dtiPercent: number | null };
  ausResult: { casefileId: string; duVersion: string; recommendation: string };
  day1Certainty: { assets: boolean; income: boolean; employment: boolean };
  conditions: string[];
  disclaimer: string;
}

export function buildCommitmentLetter(args: {
  applicationId: string;
  borrowerName: string;
  propertyAddress: string | null;
  loanAmount: number;
  propertyValue: number;
  findings: DuFindings;
}): CommitmentLetter {
  const { findings } = args;
  const approved = findings.recommendation === "approve_eligible";
  const conditional = findings.recommendation !== "approve_eligible" && findings.recommendation !== "approve_ineligible";
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

  return {
    letterId: `HCL-${issuedAt.getFullYear()}-${createHash("sha1").update(args.applicationId + issuedAt.toISOString()).digest("hex").slice(0, 8).toUpperCase()}`,
    letterType: approved ? "commitment" : conditional ? "conditional_commitment" : "declined",
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lender: { name: "Homiquity Mortgage Corporation", nmls: "PENDING" },
    borrower: { name: args.borrowerName, applicationId: args.applicationId },
    property: { address: args.propertyAddress, value: args.propertyValue },
    loanTerms: {
      loanAmount: args.loanAmount,
      ltvPercent: Number((findings.riskAssessment.ltv * 100).toFixed(2)),
      dtiPercent: findings.riskAssessment.dti !== null ? Number((findings.riskAssessment.dti * 100).toFixed(2)) : null,
    },
    ausResult: { casefileId: findings.casefileId, duVersion: findings.duVersion, recommendation: findings.recommendation },
    day1Certainty: {
      assets: findings.day1Certainty.assets.relief,
      income: findings.day1Certainty.income.relief,
      employment: findings.day1Certainty.employment.relief,
    },
    conditions: findings.messages.filter((m) => m.severity !== "info").map((m) => `[${m.code}] ${m.text}`),
    disclaimer:
      "This commitment is based on automated underwriting findings and the information provided. " +
      "It is subject to final verification, property appraisal, and applicable regulatory requirements. " +
      "This is not a loan approval guarantee.",
  };
}
