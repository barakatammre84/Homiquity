import { db } from "../db";
import { mortgageRates } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "../storage";
import { computeOffers, type BorrowerPricingProfile, type ComputedOffer } from "./pricingAdapter";
import { advertisedAPR } from "./apr";
import { isIntakePaused } from "./maintenanceMode";

const RAPIDAPI_HOSTS = [
  "realty-in-us.p.rapidapi.com",
  "realtor.p.rapidapi.com",
  "us-realtor.p.rapidapi.com",
];

const RATE_PATHS = [
  "/mortgage/v2/check-rates",
  "/v2/mortgage/check-rates",
  "/mortgage/check-rates",
];

interface ApiRate {
  loan_id: string;
  term: number;
  display_name: string;
  is_va_loan: boolean | null;
  is_fixed: boolean;
  rate: number;
}

interface ApiResponse {
  data?: {
    loan_analysis?: {
      market?: {
        mortgage_data?: {
          insurance_rate?: number;
          property_tax_rate?: number;
          average_rates?: Array<{ loan_type: ApiRate }>;
        };
      };
    };
  };
  status?: boolean;
  message?: string;
}

const LOAN_ID_TO_PROGRAM: Record<string, string> = {
  thirty_year_fix: "prog-30yr-fixed",
  twenty_year_fix: "prog-20yr-fixed",
  fifteen_year_fix: "prog-15yr-fixed",
  ten_year_fix: "prog-10yr-fixed",
  thirty_year_fha: "prog-30yr-fha",
  thirty_year_va: "prog-30yr-va",
  five_one_arm: "prog-5-6-arm",
  seven_one_arm: "prog-7-6-arm",
};

export async function fetchLiveRatesFromApi(): Promise<ApiRate[] | null> {
  // Kill switch: while intake is paused, no calls leave for pricing vendors —
  // callers fall back to the simulated survey exactly as if no key were set.
  if (isIntakePaused()) {
    console.log("INTAKE_PAUSED set, skipping live rate vendor fetch");
    return null;
  }
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    console.log("RAPIDAPI_KEY not set, skipping live rate fetch");
    return null;
  }

  for (const host of RAPIDAPI_HOSTS) {
    for (const path of RATE_PATHS) {
      try {
        const response = await fetch(`https://${host}${path}`, {
          headers: {
            "x-rapidapi-key": apiKey,
            "x-rapidapi-host": host,
          },
        });

        if (response.status === 200) {
          const data: ApiResponse = await response.json();
          if (data?.data?.loan_analysis?.market?.mortgage_data?.average_rates) {
            const rates = data.data.loan_analysis.market.mortgage_data.average_rates;
            console.log(`Fetched ${rates.length} live rates from ${host}${path}`);
            return rates.map(r => r.loan_type);
          }
        }
      } catch {
      }
    }
  }

  console.log("Could not fetch live rates from API, using cached rates");
  return null;
}

export async function syncRatesToDatabase(rates: ApiRate[]): Promise<number> {
  let count = 0;
  const now = new Date();

  for (const rate of rates) {
    const programId = LOAN_ID_TO_PROGRAM[rate.loan_id];
    if (!programId) continue;

    const ratePercent = (rate.rate * 100).toFixed(3);
    // Actuarial APR from the representative fee model (services/apr.ts) at
    // the advertised loan amount — never a flat spread over the note rate.
    const surveyLoanAmount = 350000;
    const termMonths = (rate.term || 30) * 12;
    const aprEstimate = advertisedAPR(surveyLoanAmount, rate.rate * 100, termMonths, {
      isFHA: rate.loan_id === "thirty_year_fha",
    }).toFixed(3);

    const existing = await db
      .select()
      .from(mortgageRates)
      .where(eq(mortgageRates.programId, programId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(mortgageRates)
        .set({
          rate: ratePercent,
          apr: aprEstimate,
          effectiveDate: now,
          updatedAt: now,
          isActive: true,
        })
        .where(eq(mortgageRates.id, existing[0].id));
    } else {
      await db.insert(mortgageRates).values({
        programId,
        rate: ratePercent,
        apr: aprEstimate,
        points: "0.00",
        loanAmount: "350000",
        downPaymentPercent: 20,
        creditScoreMin: 740,
        isActive: true,
        effectiveDate: now,
      });
    }
    count++;
  }

  return count;
}

export function getDefaultRates(): ApiRate[] {
  return [
    { loan_id: "thirty_year_fix", term: 30, display_name: "30-year fixed", is_va_loan: null, is_fixed: true, rate: 0.07197 },
    { loan_id: "twenty_year_fix", term: 20, display_name: "20-year fixed", is_va_loan: null, is_fixed: true, rate: 0.0703 },
    { loan_id: "fifteen_year_fix", term: 15, display_name: "15-year fixed", is_va_loan: null, is_fixed: true, rate: 0.06298 },
    { loan_id: "ten_year_fix", term: 10, display_name: "10-year fixed", is_va_loan: null, is_fixed: true, rate: 0.06217 },
    { loan_id: "thirty_year_fha", term: 30, display_name: "30-year fixed FHA", is_va_loan: null, is_fixed: true, rate: 0.06369 },
    { loan_id: "thirty_year_va", term: 30, display_name: "30-year fixed VA", is_va_loan: true, is_fixed: true, rate: 0.06416 },
    { loan_id: "five_one_arm", term: 30, display_name: "5-year ARM", is_va_loan: null, is_fixed: false, rate: 0.07035 },
    { loan_id: "seven_one_arm", term: 30, display_name: "7-year ARM", is_va_loan: null, is_fixed: false, rate: 0.07062 },
  ];
}

export async function refreshRates(): Promise<{ source: string; count: number }> {
  const liveRates = await fetchLiveRatesFromApi();
  const rates = liveRates || getDefaultRates();
  const source = liveRates ? "live_api" : "cached";
  const count = await syncRatesToDatabase(rates);
  return { source, count };
}

// =============================================================================
// BEST-EXECUTION ADVERTISED RATES
//
// Populates the advertised-rate rows (mortgage_rates — what the landing page,
// rate pages, and refi alerts display) with the LOWEST rate achievable per
// program across the active wholesale rate sheets, priced by the same
// deterministic engine borrowers see (pricingAdapter.computeOffers). Vendor
// sheet rates always win over survey rates: advertising a survey rate we
// cannot execute would be a Reg Z advertising problem, not a marketing win.
//
// The marketing assumption profile below is written onto each row
// (loanAmount / downPaymentPercent / creditScoreMin), and the rate pages
// already render those fields as the "rates assume…" disclosure line.
// =============================================================================

const MARKETING_PROFILE: BorrowerPricingProfile = {
  creditScore: 780,
  loanAmount: 280000,
  propertyValue: 400000, // 70% LTV — top LLPA band
  propertyType: "single_family",
  occupancyType: "primary_residence",
  loanPurpose: "purchase",
  isFirstTimeHomeBuyer: false,
  lockTermDays: 30,
};

/** Map a priced wholesale offer onto the advertised-rate program catalog. */
function programIdForOffer(offer: ComputedOffer): string | null {
  if (offer.amortizationType === "ARM" || offer.productType === "ARM") {
    if (/5\s*\/\s*[16]/.test(offer.productName)) return "prog-5-6-arm";
    if (/7\s*\/\s*[16]/.test(offer.productName)) return "prog-7-6-arm";
    return null;
  }
  if (offer.productType === "FHA") return offer.loanTerm === 360 ? "prog-30yr-fha" : null;
  if (offer.productType === "VA") return offer.loanTerm === 360 ? "prog-30yr-va" : null;
  if (offer.productType === "CONVENTIONAL") {
    switch (offer.loanTerm) {
      case 360: return "prog-30yr-fixed";
      case 240: return "prog-20yr-fixed";
      case 180: return "prog-15yr-fixed";
      case 120: return "prog-10yr-fixed";
    }
  }
  return null; // jumbo & everything else has no advertised program yet
}

// Advertised APR: actuarial solve (services/apr.ts) over the marketing
// profile's loan amount and the representative fee model. FHA includes
// upfront + annual MIP in the finance-charge stream.
function aprFor(programId: string, ratePct: number, termMonths: number): number {
  return advertisedAPR(MARKETING_PROFILE.loanAmount, ratePct, termMonths, {
    isFHA: programId === "prog-30yr-fha",
  });
}

export async function syncBestExecutionRates(): Promise<{ synced: number; programs: string[] }> {
  let offers: ComputedOffer[];
  try {
    offers = await computeOffers(storage, MARKETING_PROFILE);
  } catch (err) {
    console.warn("[Rates] Best-execution pricing unavailable (matrix gap?):", err);
    return { synced: 0, programs: [] };
  }
  if (offers.length === 0) return { synced: 0, programs: [] };

  // Lowest final rate per program. Advertised rates fail CLOSED: a non-finite
  // or non-positive rate is never published (the storefront would rather show
  // nothing than "NaN%" — a Reg Z advertising problem).
  const best = new Map<string, ComputedOffer>();
  for (const offer of offers) {
    if (!Number.isFinite(offer.adjustedRate) || offer.adjustedRate <= 0) continue;
    const programId = programIdForOffer(offer);
    if (!programId) continue;
    const current = best.get(programId);
    if (!current || offer.adjustedRate < current.adjustedRate) {
      best.set(programId, offer);
    }
  }

  const now = new Date();
  for (const [programId, offer] of best) {
    const rate = offer.adjustedRate.toFixed(3);
    const apr = aprFor(programId, offer.adjustedRate, offer.loanTerm || 360).toFixed(3);
    const row = {
      rate,
      apr,
      points: "0.00",
      loanAmount: String(MARKETING_PROFILE.loanAmount),
      downPaymentPercent: 30,
      creditScoreMin: MARKETING_PROFILE.creditScore,
      isActive: true,
      effectiveDate: now,
    };

    const existing = await db
      .select()
      .from(mortgageRates)
      .where(eq(mortgageRates.programId, programId))
      .limit(1);

    if (existing.length > 0) {
      await db.update(mortgageRates).set({ ...row, updatedAt: now }).where(eq(mortgageRates.id, existing[0].id));
    } else {
      await db.insert(mortgageRates).values({ programId, ...row });
    }
  }

  return { synced: best.size, programs: [...best.keys()] };
}
