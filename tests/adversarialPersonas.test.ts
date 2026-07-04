import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import {
  ConsolidatedUnderwritingEngine,
  consolidatedUnderwritingEngine,
  type UnderwritingInput,
} from "../server/underwritingEngine";
import { LookupResolverService, type ValueResolver } from "../server/services/lookupResolver";
import { computeMonthsOfReserves } from "../server/services/preUnderwriting";
import { detectSignificantDeposits, vaRegionForState } from "../server/services/underwritingNuance";
import { CONFORMING_LOAN_LIMIT_2026 } from "../shared/lendingLimits";

// ---------------------------------------------------------------------------
// Adversarial persona regression suite.
//
// Five synthetic borrowers engineered to sit on the engine's seams: negative
// K-1 income, occupancy misrepresentation, exact conforming boundaries, a
// sub-620 credit file, and a VA family of six. Two kinds of tests:
//
//   plain `it`  — pins CURRENT behavior (including crashes and known
//                 miscalculations) so any change is deliberate and visible.
//   `it.fails`  — encodes the CORRECT policy outcome the engine does not yet
//                 produce. The suite stays green today; when a gap is fixed,
//                 vitest reports the test as "expected to fail but passed",
//                 forcing the .fails marker (and this documentation) to be
//                 removed in the same change.
//
// Hermetic: the Postgres-backed LookupResolverService is replaced with an
// in-memory resolver seeded with the exact grid data from
// server/scripts/seedLendingGrids.ts — including its coverage gaps, which are
// themselves under test. Storage and loan pricing are mocked.
// ---------------------------------------------------------------------------

// --- In-memory replica of the seeded lookup grids --------------------------

interface Cell {
  d1Min?: number;
  d1Max?: number;
  d2Min?: number;
  d2Max?: number;
  d3?: string;
  value: number;
}

const GRIDS: Record<string, Cell[]> = {
  CONVENTIONAL_DTI_CAP: [{ value: 43 }],
  CONVENTIONAL_STRETCH_DTI: [{ value: 50 }],
  CONVENTIONAL_LTV_CAP: [{ value: 95 }],
  CONVENTIONAL_FICO_FLOOR: [{ value: 620 }],
  CONFORMING_LOAN_LIMIT: [{ value: CONFORMING_LOAN_LIMIT_2026 }],
  // Occupancy x units max LTV (Fannie Eligibility Matrix). Second homes are
  // 1-unit only; other combinations are intentionally unseeded (out of band).
  CONVENTIONAL_MAX_LTV: [
    { d1Min: 1, d1Max: 1, d3: "PRIMARY", value: 95 },
    { d1Min: 2, d1Max: 2, d3: "PRIMARY", value: 85 },
    { d1Min: 3, d1Max: 3, d3: "PRIMARY", value: 75 },
    { d1Min: 4, d1Max: 4, d3: "PRIMARY", value: 75 },
    { d1Min: 1, d1Max: 1, d3: "SECOND", value: 90 },
    { d1Min: 1, d1Max: 1, d3: "INVESTMENT", value: 85 },
    { d1Min: 2, d1Max: 2, d3: "INVESTMENT", value: 75 },
    { d1Min: 3, d1Max: 3, d3: "INVESTMENT", value: 75 },
    { d1Min: 4, d1Max: 4, d3: "INVESTMENT", value: 75 },
  ],
  HAIRCUT_STOCK_INVESTMENT: [{ value: 60 }],
  HAIRCUT_RETIREMENT: [{ value: 70 }],
  CONVENTIONAL_PMI: [],
  FANNIE_LLPA: [],
  VA_RESIDUAL: [],
};

// CONVENTIONAL_PMI — FICO floor is 620; LTV ceiling is 97.00 (both gaps are
// exercised by personas 3 and 4).
const PMI_FICO_ROWS: Array<[number, number]> = [
  [760, 850], [740, 759], [720, 739], [700, 719], [680, 699], [660, 679], [640, 659], [620, 639],
];
const PMI_LTV_BANDS: Array<{ min: number; max: number; rates: number[] }> = [
  { min: 95.01, max: 97.0, rates: [0.58, 0.7, 0.87, 0.99, 1.21, 1.54, 1.65, 1.86] },
  { min: 90.01, max: 95.0, rates: [0.38, 0.53, 0.66, 0.78, 0.96, 1.28, 1.33, 1.42] },
  { min: 85.01, max: 90.0, rates: [0.28, 0.38, 0.46, 0.54, 0.67, 0.9, 0.94, 1.02] },
  { min: 80.01, max: 85.0, rates: [0.19, 0.23, 0.27, 0.3, 0.38, 0.49, 0.52, 0.58] },
];
for (const band of PMI_LTV_BANDS) {
  band.rates.forEach((rate, i) => {
    GRIDS.CONVENTIONAL_PMI.push({
      d1Min: PMI_FICO_ROWS[i][0], d1Max: PMI_FICO_ROWS[i][1],
      d2Min: band.min, d2Max: band.max, value: rate,
    });
  });
}

// FANNIE_LLPA — FICO 300–850, rounded LTV 0–97.
const LLPA_FICO_SLICES: Array<[number, number]> = [
  [780, 850], [760, 779], [740, 759], [720, 739], [700, 719], [680, 699], [660, 679], [640, 659], [300, 639],
];
const LLPA_LTV_BANDS: Array<{ min: number; max: number; rates: number[] }> = [
  { min: 0, max: 60, rates: [0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { min: 61, max: 70, rates: [0, 0, 0, 0, 0, 0, 0, 0.125, 0.125] },
  { min: 71, max: 75, rates: [0, 0, 0.125, 0.25, 0.375, 0.625, 0.875, 1.125, 1.5] },
  { min: 76, max: 80, rates: [0.375, 0.625, 0.875, 1.0, 1.125, 1.375, 1.75, 2.0, 2.25] },
  { min: 81, max: 85, rates: [0.375, 0.625, 1.0, 1.25, 1.5, 1.625, 1.875, 2.5, 2.875] },
  { min: 86, max: 90, rates: [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.625] },
  { min: 91, max: 95, rates: [0.25, 0.5, 0.625, 0.875, 1.125, 1.375, 1.625, 1.875, 2.25] },
  { min: 96, max: 97, rates: [0.125, 0.25, 0.5, 0.75, 0.875, 1.125, 1.375, 1.5, 1.75] },
];
for (const band of LLPA_LTV_BANDS) {
  band.rates.forEach((rate, i) => {
    GRIDS.FANNIE_LLPA.push({
      d1Min: LLPA_FICO_SLICES[i][0], d1Max: LLPA_FICO_SLICES[i][1],
      d2Min: band.min, d2Max: band.max, value: rate,
    });
  });
}

// VA_RESIDUAL — family sizes 1–5 exactly (dim1Min = dim1Max), loan bands
// [0, 79999] and [80000, 9999999]: both edges are exercised by persona 5.
const VA_TABLE: Record<string, number[]> = {
  NORTHEAST: [450, 755, 909, 1025, 1062],
  MIDWEST: [441, 738, 889, 1003, 1039],
  SOUTH: [441, 738, 889, 1003, 1039],
  WEST: [491, 823, 990, 1117, 1158],
};
const VA_LOW_TABLE: Record<string, number[]> = {
  NORTHEAST: [390, 654, 788, 888, 921],
  MIDWEST: [382, 641, 772, 868, 902],
  SOUTH: [382, 641, 772, 868, 902],
  WEST: [425, 713, 859, 967, 1004],
};
for (const [region, values] of Object.entries(VA_TABLE)) {
  values.forEach((value, i) => {
    GRIDS.VA_RESIDUAL.push({ d1Min: i + 1, d1Max: i + 1, d2Min: 80000, d2Max: 9999999, d3: region, value });
  });
}
for (const [region, values] of Object.entries(VA_LOW_TABLE)) {
  values.forEach((value, i) => {
    GRIDS.VA_RESIDUAL.push({ d1Min: i + 1, d1Max: i + 1, d2Min: 0, d2Max: 79999, d3: region, value });
  });
}

// Mirrors defaultValueResolver's matching and error semantics exactly.
const gridValueResolver: ValueResolver = async (query) => {
  const cells = GRIDS[query.matrixCode];
  if (!cells) {
    throw new Error(
      `CRITICAL COMPLIANCE ERROR: Required matrix configuration [${query.matrixCode}] is missing, expired, or not active`,
    );
  }
  const cell = cells.find((c) => {
    if (query.dim1Value !== undefined) {
      if (c.d1Min !== undefined && c.d1Min > query.dim1Value) return false;
      if (c.d1Max !== undefined && c.d1Max < query.dim1Value) return false;
    }
    if (query.dim2Value !== undefined) {
      if (c.d2Min !== undefined && c.d2Min > query.dim2Value) return false;
      if (c.d2Max !== undefined && c.d2Max < query.dim2Value) return false;
    }
    if (query.dim3Identifier !== undefined && c.d3 !== query.dim3Identifier) return false;
    return true;
  });
  if (!cell) {
    throw new Error(
      `CRITICAL DECISIONING ERROR: Lookup parameters [d1: ${query.dim1Value ?? "N/A"}, d2: ${query.dim2Value ?? "N/A"}, d3: ${query.dim3Identifier ?? "N/A"}] fell outside permitted compliance intervals in active matrix [${query.matrixCode}]`,
    );
  }
  return { value: cell.value, expiresAt: null };
};

const seededResolver = new LookupResolverService({
  stampReader: async () => 1,
  valueResolver: gridValueResolver,
});

function makeEngine(): ConsolidatedUnderwritingEngine {
  const engine = new ConsolidatedUnderwritingEngine();
  (engine as unknown as { resolver: LookupResolverService }).resolver = seededResolver;
  return engine;
}
// The instant-decision orchestrator uses the exported singleton.
(consolidatedUnderwritingEngine as unknown as { resolver: LookupResolverService }).resolver = seededResolver;

// --- Mocks for the instant-decision orchestrator ---------------------------

const mocks = vi.hoisted(() => ({
  getLoanApplication: vi.fn(),
  getEmploymentHistory: vi.fn(),
  getOtherIncomeSources: vi.fn(),
  getUrlaLiabilities: vi.fn(),
  getUrlaAssets: vi.fn(),
  getUrlaPropertyInfo: vi.fn(),
  generateLoanEstimate: vi.fn(),
}));

vi.mock("../server/storage", () => ({ storage: mocks }));
vi.mock("../server/services/loanEstimate", () => ({
  generateLoanEstimate: mocks.generateLoanEstimate,
}));

import { runInstantDecision } from "../server/services/decisionEngine";

function makeApp(overrides: Record<string, unknown> = {}) {
  return {
    id: "app-1",
    userId: "user-1",
    isVeteran: false,
    creditScore: 741,
    purchasePrice: "900000",
    downPayment: "180000",
    propertyValue: "905000",
    propertyState: "TX",
    annualIncome: "0",
    monthlyDebts: "0",
    financialDataProvenance: null,
    ...overrides,
  };
}

function primeOrchestrator(app: Record<string, unknown>, data: {
  employment?: Record<string, unknown>[];
  otherIncome?: Record<string, unknown>[];
  liabilities?: Record<string, unknown>[];
  urlaAssets?: Record<string, unknown>[];
  propertyInfo?: Record<string, unknown>;
  piti?: number;
} = {}) {
  mocks.getLoanApplication.mockResolvedValue(app);
  mocks.getEmploymentHistory.mockResolvedValue(data.employment ?? []);
  mocks.getOtherIncomeSources.mockResolvedValue(data.otherIncome ?? []);
  mocks.getUrlaLiabilities.mockResolvedValue(data.liabilities ?? []);
  mocks.getUrlaAssets.mockResolvedValue(data.urlaAssets ?? []);
  mocks.getUrlaPropertyInfo.mockResolvedValue(data.propertyInfo ?? undefined);
  mocks.generateLoanEstimate.mockResolvedValue({
    projectedPayments: { years1Through5: { estimatedTotal: data.piti ?? 3000 } },
  });
}

function baseConventionalInput(overrides: Partial<UnderwritingInput> = {}): UnderwritingInput {
  return {
    isVeteran: false,
    baseMonthlyIncome: 40000,
    bonusMonthlyIncome: 0,
    existingMonthlyDebts: 0,
    originalLoanAmount: 500000,
    contractSalesPrice: 1_000_000,
    appraisalValue: 1_000_000,
    representativeFico: 780,
    proposedPiti: 4000,
    assets: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// PERSONA 1 — "Marcus Vale": self-employed, four K-1s, negative 2025 net
// income, $2M liquid spike in 2026.
// ===========================================================================
describe("Persona 1 — Marcus Vale (K-1 losses + $2M asset spike)", () => {
  // Two profitable K-1s (+$27,700/mo) and two loss K-1s (−$21,400 rolled-up,
  // −$12,800 itemized). True net qualifying income: −$6,500/mo.
  const valeEmployment = [
    { borrowerSequenceNumber: 1, employer: "Vale Holdings I LLC (K-1)", baseIncome: "18500" },
    { borrowerSequenceNumber: 1, employer: "Vale Holdings II LLC (K-1)", baseIncome: "9200" },
    // Accounting-format negative, rolled-up total only.
    { borrowerSequenceNumber: 1, employer: "Vale RE Partners (K-1)", totalMonthlyIncome: "(21,400)" },
    { borrowerSequenceNumber: 1, employer: "Vale Restaurant Grp (K-1)", baseIncome: "-14800", bonusIncome: "2000" },
  ];
  const valeAssets = [
    // Free-text account type with no brokerage keyword: classifyAsset buckets
    // it as CHECKING_SAVINGS, so it escapes the 60% stock haircut entirely.
    { accountType: "Cash Management Sweep", cashOrMarketValue: "2050000" },
  ];

  it("FIXED(#2): K-1 losses net against income — the negative-net file no longer auto-approves on +$27,700/mo", async () => {
    primeOrchestrator(makeApp(), {
      employment: valeEmployment,
      urlaAssets: valeAssets,
      liabilities: [{ borrowerSequenceNumber: 1, monthlyPayment: "5200", toBePaidOff: false }],
      piti: 6200,
    });
    const d = await runInstantDecision("app-1");

    // Previously: the two losses vanished (NaN-parse + `> 0` guard), income read
    // $27,700 and the file APPROVED. Now net qualifying income is -$6,500/mo, so
    // the file cannot approve — it routes to a self-employed income review.
    expect(d.decision).not.toBe("APPROVED");
    expect(d.status).toBe("NEEDS_MORE_INFO");
    expect(d.missingItems.join(" ")).toMatch(/business losses/i);
  });

  it("FIXED(#2): accounting-format losses parse and net exactly, instead of being deleted", async () => {
    // One profitable K-1 of $40,000/mo plus the same two losses. Net stays
    // positive so a decision is produced and the exact figure is checkable.
    const mixed = [
      { borrowerSequenceNumber: 1, employer: "Vale Anchor LLC (K-1)", baseIncome: "40000" },
      { borrowerSequenceNumber: 1, employer: "Vale RE Partners (K-1)", totalMonthlyIncome: "(21,400)" },
      { borrowerSequenceNumber: 1, employer: "Vale Restaurant Grp (K-1)", baseIncome: "-14800", bonusIncome: "2000" },
    ];
    primeOrchestrator(makeApp(), { employment: mixed, piti: 3000 });
    const d = await runInstantDecision("app-1");

    // base 40,000 − 21,400 − 14,800 = 3,800; variable 2,000; total 5,800.
    expect(d.status).toBe("DECISION_READY");
    expect(d.metrics!.monthlyIncome).toBe(5800);
    // Strictly below the naive positive-only sum ($42,000) the old code used.
    expect(d.metrics!.monthlyIncome).toBeLessThan(42000);
  });

  it("PIN: the $2M 'Cash Management Sweep' is still counted at 100% — no reserve haircut (open finding)", async () => {
    primeOrchestrator(makeApp({ annualIncome: "600000" }), { urlaAssets: valeAssets, piti: 4000 });
    const d = await runInstantDecision("app-1");
    // classifyAsset finds no brokerage/retirement keyword -> CHECKING_SAVINGS,
    // which the engine counts at full value (a stock/retirement haircut would
    // reduce it). Unaffected by #2; belongs to a later asset-classification fix.
    expect(d.metrics!.liquidAssets).toBe(2_050_000);
  });

  it("PIN: the large-deposit detector is blind to positive-convention inflows", () => {
    // underwritingNuance assumes "negative = inflow". A VOA vendor reporting
    // deposits as positive amounts disables B3-4.2-02 sourcing entirely.
    const positiveConvention = detectSignificantDeposits(
      [{ amount: 2_000_000, date: "2026-02-11", description: "WIRE IN" }],
      27700,
    );
    expect(positiveConvention).toHaveLength(0);

    // Control: the same wire in the assumed convention IS flagged.
    const negativeConvention = detectSignificantDeposits(
      [{ amount: -2_000_000, date: "2026-02-11", description: "WIRE IN" }],
      27700,
    );
    expect(negativeConvention).toHaveLength(1);
  });

  it.fails("SPEC: a $2M unsourced wire must be flagged regardless of the vendor's sign convention", () => {
    const deposits = detectSignificantDeposits(
      [{ amount: 2_000_000, date: "2026-02-11", description: "WIRE IN" }],
      27700,
    );
    expect(deposits).toHaveLength(1);
  });

  it.fails("SPEC: instant-decision reserves must match pre-underwriting reserves (net of down payment)", async () => {
    primeOrchestrator(makeApp({ annualIncome: "600000" }), { urlaAssets: valeAssets, piti: 6200 });
    const d = await runInstantDecision("app-1");
    // preUnderwriting subtracts the down payment before dividing by PITI; the
    // instant decision divides the gross balance. Same borrower, two numbers.
    const preUw = computeMonthsOfReserves({
      verifiedAssetsTotal: 2_050_000,
      purchasePrice: 900_000,
      downPayment: 180_000,
    })!;
    expect(d.metrics!.monthsOfReserves).toBeCloseTo(preUw, 0);
  });
});

// ===========================================================================
// PERSONA 2 — "Dana Okafor": address lookup resolves a 4-unit building; the
// application is filed as a single-family primary residence.
// ===========================================================================
describe("Persona 2 — Dana Okafor (multi-unit filed as SFR primary)", () => {
  const fourPlexFinancials = {
    baseMonthlyIncome: 15000,
    existingMonthlyDebts: 1500,
    originalLoanAmount: 666_000,
    contractSalesPrice: 740_000,
    appraisalValue: 740_000,
    representativeFico: 745,
    proposedPiti: 4800,
  } as const;

  it("FIXED(#3b): a 90% LTV 4-unit investment property is REJECTED, not approved on the SFR path", async () => {
    const result = await makeEngine().evaluate(
      baseConventionalInput({ ...fourPlexFinancials, occupancyType: "investment", numberOfUnits: 4 }),
    );
    expect(result.calculatedLtv).toBe(90);
    // Agency caps a 4-unit investment at 75% LTV — 90% is ineligible.
    expect(result.decision).toBe("REJECTED");
    expect(result.rejectionReasons.join(" ")).toMatch(/4-unit investment/);
    expect(result.rejectionReasons.join(" ")).toMatch(/75% maximum/);
    // Nothing was priced on the rejected file.
    expect(result.resolvedPmiMonthlyPremium).toBe(0);
  });

  it("DEFAULT: a consistent misstatement (SFR/1-unit that is really a 4-plex) still approves without more data", async () => {
    // Same financials, occupancy omitted: defaults to 1-unit primary (95% cap),
    // so 90% approves. Catching a MISREPRESENTED type needs the reconciliation
    // layer (declared-vs-observed), which lands in the next commit.
    const result = await makeEngine().evaluate(baseConventionalInput(fourPlexFinancials));
    expect(result.decision).toBe("APPROVED");
  });

  it("FIXED(#3b): the orchestrator pulls occupancy/units from URLA property info and declines the mismatch", async () => {
    primeOrchestrator(makeApp({ annualIncome: "180000" }), {
      piti: 4000,
      propertyInfo: { occupancyType: "investment", numberOfUnits: 4 },
    });
    const d = await runInstantDecision("app-1");
    // loan 720k / value 900k = 80% LTV on a 4-unit investment (75% cap).
    expect(d.status).toBe("DECISION_READY");
    expect(d.decision).toBe("REJECTED");
    expect(d.reasons.join(" ")).toMatch(/4-unit investment/);
  });

  it("PIN: an unparseable appraised value silently collapses to the contract price", async () => {
    primeOrchestrator(makeApp({ propertyValue: "TBD", annualIncome: "180000" }), { piti: 4800 });
    const d = await runInstantDecision("app-1");
    // toNumber("TBD") -> NaN -> falls back to purchasePrice, so the
    // min(contract, appraisal) LTV basis is a no-op: LTV reads exactly 80.
    expect(d.status).toBe("DECISION_READY");
    expect(d.metrics!.ltv).toBe(80);
  });

  it.fails("SPEC: lender matching must gate occupancy on an occupancy field, not propertyType", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../server/services/lenderMatchingEngine.ts"),
      "utf-8",
    );
    // The one occupancy check in the codebase compares product.occupancyTypes
    // ("PRIMARY_RESIDENCE") against activeApp.propertyType ("single_family"):
    // always false for legitimate files, validates occupancy for no one.
    expect(src).not.toMatch(/occupancyTypes\.includes\(activeApp\.propertyType\)/);
  });
});

// ===========================================================================
// PERSONA 3 — "The Boundary Surgeon": engineered to sit exactly on the 2026
// conforming edges (LTV cap, DTI fences, loan-limit seams).
// ===========================================================================
describe("Persona 3 — Boundary Surgeon (exact 2026 conforming limits)", () => {
  // Basis $840k keeps these loans under the conforming limit so the LTV
  // truncation behavior is isolated from the loan-limit rule.
  const cliffInput = (loan: number) =>
    baseConventionalInput({ originalLoanAmount: loan, contractSalesPrice: 840_000, appraisalValue: 840_000 });

  it("PIN: LTV truncation lets a true LTV just over 95% pass the cap", async () => {
    const engine = makeEngine();
    // True LTV 95.0099% floors to 95.00 and PASSES the 95 cap...
    const under = await engine.evaluate(cliffInput(798_083));
    expect(under.calculatedLtv).toBe(95);
    expect(under.decision).toBe("APPROVED");
    // ...while a slightly larger loan (95.01%) is REJECTED.
    const over = await engine.evaluate(cliffInput(798_120));
    expect(over.decision).toBe("REJECTED");
    expect(over.rejectionReasons[0]).toMatch(/exceeds policy ceiling/);
  });

  it.fails("SPEC: a true LTV above the 95% cap must not auto-approve via floor-truncation", async () => {
    const result = await makeEngine().evaluate(cliffInput(798_083));
    expect(result.decision).not.toBe("APPROVED");
  });

  it("PIN: both DTI fences are exclusive — exactly 43.00 auto-approves, exactly 50.00 avoids rejection", async () => {
    const engine = makeEngine();
    const at43 = await engine.evaluate(baseConventionalInput({ baseMonthlyIncome: 10000, proposedPiti: 4300 }));
    expect(at43.calculatedDti).toBe(43);
    expect(at43.decision).toBe("APPROVED"); // not MANUAL_REVIEW: strict `>`

    const above43 = await engine.evaluate(baseConventionalInput({ baseMonthlyIncome: 10000, proposedPiti: 4301 }));
    expect(above43.decision).toBe("MANUAL_REVIEW");

    const at50 = await engine.evaluate(baseConventionalInput({ baseMonthlyIncome: 10000, proposedPiti: 5000 }));
    expect(at50.calculatedDti).toBe(50);
    expect(at50.decision).toBe("MANUAL_REVIEW"); // not REJECTED: strict `>`
  });

  it("FIXED(#1): LTV above the cap resolves to a clean REJECTED instead of crashing the PMI lookup", async () => {
    // Previously: Step 3 queued the "exceeds ceiling" reason, then evaluation
    // continued into the PMI matrix (top band 97.00) and threw, discarding the
    // rejection. Now pricing is skipped for an over-cap loan and the rejection
    // survives.
    const result = await makeEngine().evaluate(baseConventionalInput({ originalLoanAmount: 980_000 }));
    expect(result.decision).toBe("REJECTED");
    expect(result.rejectionReasons[0]).toMatch(/exceeds policy ceiling/);
  });

  it("FIXED(#3): a loan above the conforming limit routes to MANUAL_REVIEW, not an auto-approve", async () => {
    const result = await makeEngine().evaluate(baseConventionalInput({
      originalLoanAmount: 2_900_000, // 3.6x the 2026 one-unit limit
      contractSalesPrice: 4_000_000,
      appraisalValue: 4_000_000,
      proposedPiti: 19_000,
      baseMonthlyIncome: 90_000,
    }));
    // Not a credit decline (a jumbo product may fit) and not a conforming
    // approval it isn't — it goes to the jumbo desk.
    expect(result.decision).toBe("MANUAL_REVIEW");
    expect(result.decision).not.toBe("APPROVED");
  });

  it("FIXED(#3): the codebase agrees on ONE conforming limit (borrowerGraph no longer uses the 2024 value)", () => {
    const graphSrc = fs.readFileSync(path.resolve(__dirname, "../server/services/borrowerGraph.ts"), "utf-8");
    const seedSrc = fs.readFileSync(path.resolve(__dirname, "../server/seedMarketPricing.ts"), "utf-8");
    const seedLimit = Number(seedSrc.match(/const CONFORMING_LIMIT = (\d+)/)?.[1]);
    // Shared constant is the single source of truth, and the rate sheets agree.
    expect(CONFORMING_LOAN_LIMIT_2026).toBe(806_500);
    expect(seedLimit).toBe(CONFORMING_LOAN_LIMIT_2026);
    // The stale 2024 literal (766550) is gone; the borrower graph references the
    // shared constant instead.
    expect(graphSrc).not.toMatch(/766550/);
    expect(graphSrc).toMatch(/CONFORMING_LOAN_LIMIT_2026/);
  });

  it.fails("SPEC: no dead zone between conforming max and jumbo min (fractional amounts near $806,500)", () => {
    const seedSrc = fs.readFileSync(path.resolve(__dirname, "../server/seedMarketPricing.ts"), "utf-8");
    const conformingMax = Number(seedSrc.match(/const CONFORMING_LIMIT = (\d+)/)?.[1]);
    // Jumbo eligibility is seeded as CONFORMING_LIMIT + 1, leaving the open
    // interval (806500, 806501) unpriceable by every product in the market.
    expect(seedSrc).toMatch(/minLoanAmount: CONFORMING_LIMIT \+ 1/);
    const amount = conformingMax + 0.5;
    const fallsInGap = amount > conformingMax && amount < conformingMax + 1;
    expect(fallsInGap).toBe(false);
  });
});

// ===========================================================================
// PERSONA 4 — "The Thin-File Physician": FICO 612, 10% down, high income.
// ===========================================================================
describe("Persona 4 — Thin-File Physician (FICO 612 @ 90% LTV)", () => {
  const physicianInput = baseConventionalInput({
    baseMonthlyIncome: 32_500,
    existingMonthlyDebts: 800,
    originalLoanAmount: 450_000,
    contractSalesPrice: 500_000,
    appraisalValue: 500_000,
    representativeFico: 612,
    proposedPiti: 3_000,
  });

  it("FIXED(#4): sub-620 FICO declines with a credit-score reason instead of crashing the PMI matrix", async () => {
    // The FICO-floor guard runs before any lookup, so a decline-worthy file is
    // REJECTED with a specific reason rather than missing a PMI cell.
    const result = await makeEngine().evaluate(physicianInput);
    expect(result.decision).toBe("REJECTED");
    expect(result.rejectionReasons.join(" ")).toMatch(/credit score/i);
    // Nothing was priced on the rejected file.
    expect(result.resolvedPmiMonthlyPremium).toBe(0);
    expect(result.resolvedLlpafUpfrontFee).toBe(0);
  });

  it("FIXED(#4): the orchestrator returns a clean adverse-action-grade REJECTED, no internal leak", async () => {
    primeOrchestrator(
      makeApp({ creditScore: 612, purchasePrice: "500000", downPayment: "50000", propertyValue: "500000", annualIncome: "390000", monthlyDebts: "800" }),
      { piti: 3000 },
    );
    const d = await runInstantDecision("app-1");
    // Was NEEDS_MORE_INFO leaking "CRITICAL DECISIONING ERROR" (pre-#1), then a
    // generic MANUAL_REVIEW (post-#1). Now it is a specific credit decline.
    expect(d.status).toBe("DECISION_READY");
    expect(d.decision).toBe("REJECTED");
    expect(d.reasons.join(" ")).toMatch(/credit score/i);
    expect(JSON.stringify(d)).not.toMatch(/CRITICAL/);
  });

  it("FIXED(#1): a genuinely uncovered profile (FICO 851) routes to MANUAL_REVIEW, not a crash or a loop", async () => {
    // 851 clears the floor but exceeds the score-grid ceiling (850): a real
    // matrix gap the automated engine cannot price, so it goes to a human
    // (POLICY_OUT_OF_BAND) instead of throwing or looping for documents.
    primeOrchestrator(
      makeApp({ creditScore: 851, purchasePrice: "800000", downPayment: "50000", propertyValue: "800000", annualIncome: "600000" }),
      { piti: 4000 },
    );
    const d = await runInstantDecision("app-1");
    expect(d.status).toBe("DECISION_READY");
    expect(d.decision).toBe("MANUAL_REVIEW");
    expect(JSON.stringify(d)).not.toMatch(/CRITICAL/);
  });

  it("PIN: FICO 851 exceeds the score-grid ceiling at the engine level (out-of-band, open finding)", async () => {
    // The engine still throws for a >850 score; the orchestrator (above) turns
    // that into MANUAL_REVIEW. A dedicated FICO-range validity check is a
    // separate, later concern.
    await expect(
      makeEngine().evaluate(baseConventionalInput({ representativeFico: 851, originalLoanAmount: 750_000 })),
    ).rejects.toThrow(/CRITICAL DECISIONING ERROR/);
  });
});

// ===========================================================================
// PERSONA 5 — "The Reyes Family": VA-eligible, family of six, boundary loan.
// ===========================================================================
describe("Persona 5 — Reyes family (VA, family of 6, $79,999.50 loan)", () => {
  const reyesBase: Partial<UnderwritingInput> = {
    isVeteran: true,
    baseMonthlyIncome: 12_000,
    bonusMonthlyIncome: 0,
    existingMonthlyDebts: 500,
    originalLoanAmount: 300_000,
    contractSalesPrice: 375_000,
    appraisalValue: 375_000,
    representativeFico: 700,
    proposedPiti: 2_200,
    subjectPropertyState: "TX",
    homeSquareFootage: 2_800,
  };

  it("PARTIAL(#1): VA files still dead-end for now, but with borrower-safe copy instead of a leaked internal error", async () => {
    primeOrchestrator(makeApp({ isVeteran: true, annualIncome: "144000" }), { piti: 2200 });
    const d = await runInstantDecision("app-1");
    // The VA-protocol throw is sanitized by describeEngineGap into borrower-safe
    // labels ("Household size", "Home square footage"), so the raw "CRITICAL VA
    // PROTOCOL ERROR" no longer leaks. The dead-end itself needs fix #3 (plumb
    // family size / square footage from intake).
    expect(d.status).toBe("NEEDS_MORE_INFO");
    expect(JSON.stringify(d)).not.toMatch(/CRITICAL/);
    expect(d.missingItems.join(" ")).toMatch(/square footage/i);
  });

  it.fails("SPEC(#3): VA applications must be able to reach a decision through the instant-decision path", async () => {
    primeOrchestrator(makeApp({ isVeteran: true, annualIncome: "144000" }), { piti: 2200 });
    const d = await runInstantDecision("app-1");
    expect(d.status).toBe("DECISION_READY");
  });

  it("PIN: family size 6 falls off the residual matrix (cells cover sizes 1–5 exactly)", async () => {
    await expect(
      makeEngine().evaluate({ ...baseConventionalInput(), ...reyesBase, householdFamilySize: 6 } as UnderwritingInput),
    ).rejects.toThrow(/CRITICAL DECISIONING ERROR.*VA_RESIDUAL/);
  });

  it.fails("SPEC: families larger than 5 must use the +$80/member rule (Pamphlet 26-7), not crash", async () => {
    const result = await makeEngine().evaluate(
      { ...baseConventionalInput(), ...reyesBase, householdFamilySize: 6 } as UnderwritingInput,
    );
    // SOUTH size-5 baseline 1039 + 80 for the sixth member.
    expect(result.requiredResidualIncome).toBe(1119);
  });

  it("PIN: a $79,999.50 loan falls into the $1 gap between the VA loan-amount bands", async () => {
    await expect(
      makeEngine().evaluate({
        ...baseConventionalInput(), ...reyesBase,
        householdFamilySize: 3, originalLoanAmount: 79_999.5,
      } as UnderwritingInput),
    ).rejects.toThrow(/CRITICAL DECISIONING ERROR.*VA_RESIDUAL/);
  });

  it("CONTROL: the same family qualifies cleanly one band edge higher ($80,000)", async () => {
    const result = await makeEngine().evaluate({
      ...baseConventionalInput(), ...reyesBase,
      householdFamilySize: 3, originalLoanAmount: 80_000,
    } as UnderwritingInput);
    expect(result.decision).toBe("APPROVED");
    expect(result.requiredResidualIncome).toBe(889); // SOUTH, size 3
  });

  it("PIN: the two VA region resolvers disagree on malformed state input", async () => {
    // The engine throws on a spelled-out state; the nuance module silently
    // defaults the same input to "south". Same fact, two behaviors.
    await expect(
      makeEngine().evaluate({
        ...baseConventionalInput(), ...reyesBase,
        householdFamilySize: 3, subjectPropertyState: "Texas",
      } as UnderwritingInput),
    ).rejects.toThrow(/CRITICAL COMPLIANCE ERROR.*Texas/);
    expect(vaRegionForState("Texas")).toBe("south");
  });
});
