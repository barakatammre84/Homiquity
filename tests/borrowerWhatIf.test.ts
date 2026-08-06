// Roadmap ARC-3 — the borrower-facing what-if on LoanOptions.
//
// ARC-3 named `/api/scenario-calculator`. That endpoint carries its own
// hardcoded rate table (6.875 / 6.5 / 6.25 / 6.375), its own PMI factors and
// its own tax/insurance assumptions, and is blind to credit score, property
// state and LLPA. Wiring it to a borrower surface would have shown a borrower a
// number that disagrees with their OWN Loan Estimate.
//
// So the panel runs `computePaymentProjection` — the same derivation the Loan
// Estimate prices from, byte-identical for identical inputs (F-047) — with the
// borrower's what-if values passed as NON-PERSISTED overrides.
//
// Three properties are load-bearing and pinned here:
//   1. A what-if NEVER writes. Asking a question must not edit the file.
//   2. The disclosable path never passes overrides, so LE parity is preserved
//      BY CONSTRUCTION rather than by a test that could drift.
//   3. Nothing disclosable (fees, closing costs, APR) can leave the endpoint.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const repoRoot = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(repoRoot, p), "utf8");

const routeSrc = read("server/routes/lending/pricing.ts");
const estimateSrc = read("server/services/loanEstimate.ts");

/** The what-if handler body, isolated from the rest of the registrar. */
function whatIfHandler(): string {
  // Start at the schema, not the handler — the input bounds are declared just
  // above the route and are part of its contract.
  const start = routeSrc.indexOf("const whatIfSchema");
  expect(start, "what-if schema is declared").toBeGreaterThan(-1);
  expect(routeSrc).toContain('app.post("/api/loan-applications/:id/what-if"');
  const end = routeSrc.indexOf('app.get("/api/loan-applications/:id/offers"', start);
  return routeSrc.slice(start, end === -1 ? start + 6000 : end);
}

describe("ARC-3 — a what-if never mutates the file", () => {
  const handler = whatIfHandler();

  it("performs no write of any kind", () => {
    // The whole promise of the panel's copy ("nothing here changes your
    // application") rests on this. A persisted override would silently reprice
    // the borrower's real file.
    expect(handler).not.toMatch(/storage\.(update|create|delete|insert)/);
    expect(handler).not.toMatch(/\.set\(/);
  });

  it("passes the borrower's inputs as overrides, not as field updates", () => {
    expect(handler).toContain("computePaymentProjection(application.id, {");
    expect(handler).toContain("purchasePrice: scenario.purchasePrice");
    expect(handler).toContain("downPayment: scenario.downPayment");
    expect(handler).toContain("creditScore: scenario.creditScore");
  });

  it("is read-gated on ownership, like its sibling /offers", () => {
    expect(handler).toContain("storage.getLoanApplicationWithAccess");
    expect(handler).toContain("req.user!.id");
  });
});

describe("ARC-3 — the Loan Estimate parity invariant is preserved by construction", () => {
  it("overrides are optional and the disclosable generator never passes them", () => {
    // derivePricing gained an optional second parameter. If generateLoanEstimate
    // ever passes one, the byte-identical parity with computePaymentProjection
    // (F-047) stops being structural and becomes a coincidence.
    expect(estimateSrc).toMatch(/derivePricing\(\s*applicationId: string,\s*overrides\?: PricingOverrides,/);
    const generator = estimateSrc.slice(estimateSrc.indexOf("export async function generateLoanEstimate"));
    const call = generator.match(/derivePricing\([^)]*\)/);
    expect(call, "generateLoanEstimate calls derivePricing").not.toBeNull();
    expect(call![0]).toBe("derivePricing(applicationId)");
  });

  it("does not let a what-if change the loan PROGRAM", () => {
    // Program interacts with veteran status and underwriting routing
    // (isVaLoan), so it is an LO conversation, not a self-serve toggle.
    const overrides = estimateSrc.slice(
      estimateSrc.indexOf("export interface PricingOverrides"),
      estimateSrc.indexOf("async function derivePricing"),
    );
    expect(overrides).toContain("purchasePrice?: number");
    expect(overrides).toContain("downPayment?: number");
    expect(overrides).toContain("creditScore?: number");
    expect(overrides).not.toMatch(/preferredLoanType|loanType|program/i);
  });
});

describe("ARC-3 — nothing disclosable escapes", () => {
  const handler = whatIfHandler();

  it("returns payment projections only — no fees, closing costs or APR", () => {
    // PaymentProjection's shape is itself the guarantee (loanAmount, rate, P&I,
    // MI, escrow, total). Assert the handler never reaches for a disclosable
    // generator, so a scenario can never be mistaken for a Loan Estimate.
    expect(handler).not.toContain("generateLoanEstimate");
    expect(handler).not.toContain("computeClosingCosts");
    expect(handler).not.toMatch(/\bapr\b/i);
  });

  it("bounds how many scenarios one request can ask for", () => {
    expect(handler).toMatch(/\.max\(4\)/);
  });

  it("never echoes an internal error message to the borrower", () => {
    // derivePricing's own errors are safe, but an unexpected failure beneath it
    // (storage, the LLPA lookup) would otherwise put an internal message in a
    // borrower-reachable response body. Log the cause, return a generic reason.
    expect(handler).not.toContain("error.message");
    expect(handler).toContain("console.warn");
    expect(handler).toContain('"Pricing is not available for this file yet"');
  });

  it("treats an unpriceable file as an answer, not a 500", () => {
    // derivePricing throws named errors for genuinely missing inputs; the file
    // is simply not priceable yet, and saying so is correct.
    expect(handler).toContain("unavailable");
    expect(handler).toContain("baseline: null");
  });
});

describe("ARC-3 — the orphaned calculator is not what got wired", () => {
  it("the what-if does not route through /api/scenario-calculator", () => {
    expect(whatIfHandler()).not.toContain("scenario-calculator");
  });

  it("the client panel consumes the what-if endpoint, not the orphan", () => {
    const panel = read("client/src/pages/lending/loanOptions/WhatIfPanel.tsx");
    expect(panel).toContain("/what-if");
    // The orphan is named in the file's docstring, explaining why it is NOT
    // used — so assert on the absence of a CALL, not of the string.
    expect(panel).not.toMatch(/apiRequest\([^)]*scenario-calculator/);
    expect(panel).not.toMatch(/fetch\([^)]*scenario-calculator/);
  });

  it("the panel shows a SIGNED delta — an increase must read as an increase", () => {
    const panel = read("client/src/pages/lending/loanOptions/WhatIfPanel.tsx");
    expect(panel).toContain('monthlyDeltaFromBaseline > 0 ? "+" : ""');
    expect(panel).not.toMatch(/Math\.abs\(\s*scenario\.monthlyDeltaFromBaseline/);
  });

  it("the panel frames results as estimates, never as offers", () => {
    const panel = read("client/src/pages/lending/loanOptions/WhatIfPanel.tsx");
    expect(panel).toMatch(/estimates, not offers/i);
    expect(panel).toMatch(/nothing here changes your/i);
  });
});
