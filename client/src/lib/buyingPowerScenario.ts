import { paymentFactor } from "@shared/lib/amortization";
// Seed contract between the landing-page Buying Power Estimator and the
// affordability tool (/afford): answers given to the hero widget are never
// asked again. sessionStorage (not localStorage) on purpose — this is an
// anonymous, pre-consent scenario and should die with the tab.

export interface BuyingPowerScenario {
  goal: "first" | "next" | "refi" | "research";
  annualIncome: number;
  monthlyDebts: number;
  downPayment: number;
}

const SCENARIO_KEY = "homiquity:buying-power-scenario";

// Mirrors the conservative heuristics in AffordabilityCheck so the hero
// estimate and the /afford tool never disagree: 28% front-end DTI, 43%
// back-end (no credit score asked at this rung, so use the middle tier),
// 30-yr amortization, 1.1% property tax, 0.5% insurance, 0.5% PMI under
// 20% down. The assumed rate is an internal modeling constant and must
// NEVER be rendered — showing it (or a payment) is a Reg Z §1026.24
// trigger term requiring additional disclosures the marketing surface
// doesn't carry.
const ASSUMED_RATE = 6.75;
const FRONT_END_DTI = 0.28;
const BACK_END_DTI = 0.43;
const TAX_INS_ANNUAL = 0.011 + 0.005;
const PMI_ANNUAL = 0.005;

export function estimateBuyingPower(
  annualIncome: number,
  monthlyDebts: number,
  downPayment: number,
): { low: number; high: number } | null {
  const monthlyIncome = annualIncome / 12;
  const budget = Math.min(
    monthlyIncome * FRONT_END_DTI,
    monthlyIncome * BACK_END_DTI - monthlyDebts,
  );
  if (budget <= 0) return null;

  const kPI = paymentFactor(ASSUMED_RATE, 360); // monthly P&I per $ of loan
  const kTI = TAX_INS_ANNUAL / 12; // monthly tax+insurance per $ of price

  // budget = (price - down) * (kPI + kPMI) + price * kTI, solved for price.
  const solve = (kPMI: number) =>
    (budget + downPayment * (kPI + kPMI)) / (kPI + kPMI + kTI);

  let price = solve(PMI_ANNUAL / 12);
  if (downPayment / price >= 0.2) price = solve(0);
  if (price <= downPayment) return null;

  const roundTo5k = (v: number) => Math.round(v / 5000) * 5000;
  return { low: roundTo5k(price * 0.92), high: roundTo5k(price) };
}

export function saveBuyingPowerScenario(scenario: BuyingPowerScenario): void {
  try {
    sessionStorage.setItem(SCENARIO_KEY, JSON.stringify(scenario));
  } catch {
    // Storage unavailable (private mode quota, etc.) — seeding is best-effort.
  }
}

export function loadBuyingPowerScenario(): BuyingPowerScenario | null {
  try {
    const raw = sessionStorage.getItem(SCENARIO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BuyingPowerScenario>;
    if (
      typeof parsed.annualIncome !== "number" ||
      typeof parsed.monthlyDebts !== "number" ||
      typeof parsed.downPayment !== "number"
    ) {
      return null;
    }
    return parsed as BuyingPowerScenario;
  } catch {
    return null;
  }
}
