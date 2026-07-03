import { describe, it, expect, beforeAll } from "vitest";

/**
 * End-to-end integration tests for the live pricing / underwriting HTTP routes.
 *
 * These exercise the actual Express endpoints (not the engine functions in
 * isolation) to confirm that, after migrating the underwriting/pricing math
 * from hardcoded constants to async Postgres matrix lookups, the routes still
 * return stable response shapes and the same matrix-derived numbers.
 *
 * Requires:
 *   - The dev server running on TEST_BASE_URL (default http://localhost:5000)
 *   - The lending grids seeded (`tsx server/scripts/seedLendingGrids.ts`)
 *
 * Representative numbers below mirror the seeded matrices exercised by
 * tests/runUnderwritingTestSuite.ts (e.g. FANNIE_LLPA, CONVENTIONAL_PMI,
 * CONVENTIONAL_DTI_CAP / STRETCH / LTV_CAP policy scalars).
 */

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";

// The session cookie is configured `secure: true`, so it is only set/sent over
// HTTPS. The dev server trusts the proxy, so signalling HTTPS via the
// X-Forwarded-Proto header lets cookie-based auth work over plain HTTP in tests.
const PROXY_HEADERS = { "X-Forwarded-Proto": "https" };

function extractCookies(res: Response): string {
  const anyHeaders = res.headers as any;
  const list: string[] =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : [res.headers.get("set-cookie")].filter(Boolean) as string[];
  return list.map((c) => c.split(";")[0]).join("; ");
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/test-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...PROXY_HEADERS },
    body: JSON.stringify({ email, password }),
  });
  expect(res.status).toBe(200);
  const cookie = extractCookies(res);
  expect(cookie).toContain("connect.sid");
  return cookie;
}

async function authPost(cookie: string, path: string, body?: any) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie, ...PROXY_HEADERS },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function authGet(cookie: string, path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: { "Content-Type": "application/json", Cookie: cookie, ...PROXY_HEADERS },
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function publicGet(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

describe("Pricing & Underwriting live endpoints (post matrix-migration)", () => {
  let cookie: string;
  let applicationId: string;
  let propertyId: string | undefined;

  beforeAll(async () => {
    cookie = await login("buyer@test.com", process.env.DEV_TEST_PASSWORD!);

    const created = await authPost(cookie, "/api/loan-applications", {
      annualIncome: "120000",
      monthlyDebts: "500",
      creditScore: "760",
      employmentType: "employed",
      employmentYears: "5",
      propertyType: "single_family",
      purchasePrice: "400000",
      downPayment: "40000",
      loanPurpose: "purchase",
      propertyState: "CA",
      isFirstTimeBuyer: true,
    });
    expect(created.status).toBe(201);
    expect(created.body).toHaveProperty("id");
    applicationId = created.body.id;

    const props = await publicGet("/api/properties");
    expect(Array.isArray(props.body)).toBe(true);
    expect(props.body.length).toBeGreaterThan(0); // sample properties are seeded
    propertyId = props.body[0].id;
  });

  // ==========================================================================
  // 1. calculate-dti — policy scalars CONVENTIONAL_DTI_CAP (43) + STRETCH (50)
  // ==========================================================================
  describe("POST /api/loan-applications/:id/calculate-dti", () => {
    it("computes ratios and resolves DTI caps from the matrices (pass)", async () => {
      const res = await authPost(cookie, `/api/loan-applications/${applicationId}/calculate-dti`, {
        qualifyingIncome: "10000",
        housingExpense: "2500",
        nonHousingDebts: "500",
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        qualifyingIncome: 10000,
        housingExpense: 2500,
        nonHousingDebts: 500,
        frontEndRatio: 25,
        backEndRatio: 30,
        status: "pass",
        maxBackEndRatio: 43,
      });
      // DTI caps must come from the seeded policy scalars, not hardcoded 43/50.
      expect(res.body.details.fannie_mae_limit_manual).toBe(43);
      expect(res.body.details.fannie_mae_limit_aus).toBe(50);
    });

    it("flags a stretch DTI between the 43 cap and the 50 stretch limit", async () => {
      const res = await authPost(cookie, `/api/loan-applications/${applicationId}/calculate-dti`, {
        qualifyingIncome: "10000",
        housingExpense: "4000",
        nonHousingDebts: "500",
      });
      expect(res.status).toBe(200);
      expect(res.body.backEndRatio).toBe(45);
      expect(res.body.status).toBe("stretch");
    });

    it("fails a DTI above the 50 stretch limit", async () => {
      const res = await authPost(cookie, `/api/loan-applications/${applicationId}/calculate-dti`, {
        qualifyingIncome: "10000",
        housingExpense: "5500",
        nonHousingDebts: "500",
      });
      expect(res.status).toBe(200);
      expect(res.body.backEndRatio).toBe(60);
      expect(res.body.status).toBe("fail");
    });

    it("rejects missing parameters with 400", async () => {
      const res = await authPost(cookie, `/api/loan-applications/${applicationId}/calculate-dti`, {
        qualifyingIncome: "10000",
      });
      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // 2. calculate-pricing — FANNIE_LLPA grid + CONVENTIONAL_PMI card
  // ==========================================================================
  describe("POST /api/loan-applications/:id/calculate-pricing", () => {
    it("resolves LLPA points and PMI from the matrices (FICO 700 @ 85% LTV)", async () => {
      const res = await authPost(cookie, `/api/loan-applications/${applicationId}/calculate-pricing`, {
        loanAmount: "200000",
        creditScore: "700",
        ltv: "85",
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        baseLLPA: 1.5,
        totalLLPA: 1.5,
      });
      expect(res.body.pricing).toMatchObject({
        loanAmount: 200000,
        lLPAFeeAmount: 3000, // 1.5% of 200k
        pmiAnnualRate: 0.3, // CONVENTIONAL_PMI FICO 700 @ 80.01-85 band
        pmiMonthlyPayment: 50, // 0.30% annual on 200k / 12
      });
    });

    it("returns zero LLPA and zero PMI below the MI trigger (FICO 800 @ 75% LTV)", async () => {
      const res = await authPost(cookie, `/api/loan-applications/${applicationId}/calculate-pricing`, {
        loanAmount: "300000",
        creditScore: "800",
        ltv: "75",
      });
      expect(res.status).toBe(200);
      expect(res.body.totalLLPA).toBe(0);
      expect(res.body.pricing.pmiMonthlyPayment).toBe(0);
    });

    it("resolves a high-LTV low-FICO LLPA cell (FICO 660 @ 97% LTV)", async () => {
      const res = await authPost(cookie, `/api/loan-applications/${applicationId}/calculate-pricing`, {
        loanAmount: "300000",
        creditScore: "660",
        ltv: "97",
      });
      expect(res.status).toBe(200);
      expect(res.body.baseLLPA).toBe(1.375);
    });

    it("rejects missing parameters with 400", async () => {
      const res = await authPost(cookie, `/api/loan-applications/${applicationId}/calculate-pricing`, {
        loanAmount: "200000",
      });
      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // 3. check-property-eligibility — LTV cap (95) + PMI lookup + stretch DTI
  // ==========================================================================
  describe("POST /api/loan-applications/:id/check-property-eligibility", () => {
    it("applies the seeded 95% LTV cap and returns a stable shape", async () => {
      const res = await authPost(
        cookie,
        `/api/loan-applications/${applicationId}/check-property-eligibility`,
        {
          borrowerAssets: "100000",
          borrowerIncome: "10000",
          borrowerDebts: "500",
          propertyPrice: "400000",
          propertyType: "single_family",
        },
      );
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        maxLoanAmount: 380000, // 95% of 400k from CONVENTIONAL_LTV_CAP
        maxDownPaymentPercent: 95,
        requiredDownPayment: 20000,
        ltvRatio: 95,
        canBuyProperty: true,
      });
      expect(typeof res.body.estimatedPITI).toBe("number");
      expect(res.body.estimatedPITI).toBeGreaterThan(0);
      expect(typeof res.body.finalDTI).toBe("number");
      expect(Array.isArray(res.body.reasons)).toBe(true);
    });

    it("rejects missing parameters with 400", async () => {
      const res = await authPost(
        cookie,
        `/api/loan-applications/${applicationId}/check-property-eligibility`,
        { borrowerAssets: "100000" },
      );
      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // 4. calculate-income / -assets / -liabilities — shape stability
  //    (async verifyAssets must not throw after the migration)
  // ==========================================================================
  describe("POST /api/loan-applications/:id/calculate-income|assets|liabilities", () => {
    it("calculate-income returns the qualifying-income shape", async () => {
      const res = await authPost(cookie, `/api/loan-applications/${applicationId}/calculate-income`, {});
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("baseMonthlyIncome");
      expect(res.body).toHaveProperty("totalQualifyingIncome");
      expect(res.body).toHaveProperty("details");
      expect(typeof res.body.totalQualifyingIncome).toBe("number");
    });

    it("calculate-assets returns the verified-assets shape", async () => {
      const res = await authPost(cookie, `/api/loan-applications/${applicationId}/calculate-assets`, {
        downPaymentAndClosing: "50000",
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalAssets");
      expect(res.body).toHaveProperty("liquidAssets");
      expect(res.body).toHaveProperty("reservesMonths");
      expect(Array.isArray(res.body.breakdown)).toBe(true);
    });

    it("calculate-liabilities returns the assessed-liabilities shape", async () => {
      const res = await authPost(cookie, `/api/loan-applications/${applicationId}/calculate-liabilities`, {});
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalMonthlyPayment");
      expect(res.body).toHaveProperty("excludedDebts");
      expect(Array.isArray(res.body.breakdown)).toBe(true);
    });
  });

  // ==========================================================================
  // 5. loan-estimate — generated end-to-end, must stay numerically coherent
  // ==========================================================================
  describe("GET /api/loan-applications/:id/loan-estimate", () => {
    it("generates a TRID-style loan estimate with a stable shape", async () => {
      // The LE sits behind the e-disclosure consent gate (ESIGN) — accept it
      // first via POST /api/consents (borrower_consents is the table the
      // gate reads), exactly as the borrower UI does.
      const consent = await authPost(cookie, `/api/consents`, {
        applicationId,
        consentType: "e_disclosure",
        consentGiven: true,
        consentMethod: "click",
      });
      expect([200, 201]).toContain(consent.status);

      const res = await authGet(cookie, `/api/loan-applications/${applicationId}/loan-estimate`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("applicationId", applicationId);
      expect(res.body).toHaveProperty("loanTerms");
      expect(res.body).toHaveProperty("projectedPayments");
      expect(res.body).toHaveProperty("costsAtClosing");

      const lt = res.body.loanTerms;
      expect(typeof lt.loanAmount).toBe("number");
      expect(lt.loanAmount).toBeGreaterThan(0);
      expect(typeof lt.interestRate).toBe("number");
      expect(lt.interestRate).toBeGreaterThan(0);
      expect(typeof lt.monthlyPrincipalAndInterest).toBe("number");
      expect(lt.monthlyPrincipalAndInterest).toBeGreaterThan(0);
      // Display formatting added by formatLoanEstimateForDisplay
      expect(typeof lt.loanAmountFormatted).toBe("string");
      expect(lt.interestRateFormatted).toContain("%");

      const costs = res.body.costsAtClosing;
      expect(typeof costs.estimatedClosingCosts).toBe("number");
      expect(typeof costs.estimatedCashToClose).toBe("number");
    });
  });

  // ==========================================================================
  // 6. "Can I Afford This Home?" — property affordability flow
  // ==========================================================================
  describe("POST /api/properties/:id/affordability", () => {
    it("returns an affordability assessment with a stable shape", async () => {
      const res = await authPost(cookie, `/api/properties/${propertyId}/affordability`, {
        downPaymentPercent: 10,
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("withinGuidelines");
      expect(res.body).toHaveProperty("status");
      expect(["within_guidelines", "exceeds_standard", "exceeds_maximum"]).toContain(res.body.status);
      expect(typeof res.body.estimatedPayment).toBe("number");
      expect(typeof res.body.dtiWithProperty).toBe("number");
      expect(typeof res.body.loanAmount).toBe("number");
      expect(typeof res.body.ltvRatio).toBe("number");
      // 10% down maps to a 90% LTV ceiling in the eligibility math.
      expect(res.body.ltvRatio).toBeLessThanOrEqual(90);
      expect(res.body.creditScore).toBe(760);
    });
  });

  // ==========================================================================
  // 7. credit-tiers — public calculator backed by LLPA + PMI matrices
  // ==========================================================================
  describe("GET /api/calculators/credit-tiers", () => {
    it("returns matrix-derived PMI rates per credit tier", async () => {
      const res = await publicGet("/api/calculators/credit-tiers");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("baseRate");
      expect(res.body).toHaveProperty("baseRateSource");
      expect(Array.isArray(res.body.tiers)).toBe(true);
      expect(res.body.tiers.length).toBe(6);

      const byId: Record<string, any> = {};
      for (const t of res.body.tiers) byId[t.id] = t;

      // PMI annual rates resolve from the seeded CONVENTIONAL_PMI card at each
      // tier's representative FICO and min-down LTV. These must stay stable.
      // exceptional: FICO 790 @ 97% LTV (3% down) -> 0.58
      expect(byId.exceptional.pmiAnnualRate).toBe(0.58);
      // good: FICO 720 @ 95% LTV (5% down) -> 0.66
      expect(byId.good.pmiAnnualRate).toBe(0.66);
      // fair: FICO 690 @ 95% LTV (5% down) -> 0.96
      expect(byId.fair.pmiAnnualRate).toBe(0.96);
      // needs_work: FICO 660 @ 90% LTV (10% down) -> 0.90
      expect(byId.needs_work.pmiAnnualRate).toBe(0.9);
      // building: FICO 620 @ 90% LTV (10% down) -> 1.02
      expect(byId.building.pmiAnnualRate).toBe(1.02);

      // Each tier carries a finite, positive interest rate (base + LLPA).
      for (const t of res.body.tiers) {
        expect(typeof t.interestRate).toBe("number");
        expect(t.interestRate).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // 8. Auth gating — these decisioning routes must reject anonymous callers
  // ==========================================================================
  describe("auth gating", () => {
    it("rejects unauthenticated access to pricing/underwriting routes", async () => {
      const dti = await fetch(`${BASE_URL}/api/loan-applications/${applicationId}/calculate-dti`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qualifyingIncome: "1", housingExpense: "1", nonHousingDebts: "1" }),
      });
      expect([401, 403]).toContain(dti.status);

      const afford = await fetch(`${BASE_URL}/api/properties/${propertyId}/affordability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ downPaymentPercent: 10 }),
      });
      expect([401, 403]).toContain(afford.status);
    });
  });
});
