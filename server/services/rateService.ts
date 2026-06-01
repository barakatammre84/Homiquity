import { db } from "../db";
import { mortgageRates } from "@shared/schema";
import { eq } from "drizzle-orm";

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
    const aprEstimate = ((rate.rate + 0.002) * 100).toFixed(3);

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
