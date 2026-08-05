import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdvisoryPanel } from "./AdvisoryPanel";
import type { PreApprovalFormData } from "@shared/schema";

// LO-M16 pins: the payment estimate's PMI assumption branches on the same
// condition as the advisory copy (isVeteran && purchase), so the number and
// the words can never disagree again. The 1.25%/yr factor is taxes+insurance
// only (the platform-standard constant) — PMI is added separately, and only
// when it would actually be charged.

const BASE: PreApprovalFormData = {
  annualIncome: "120000",
  monthlyDebts: "500",
  purchasePrice: "400000",
  downPayment: "20000",
  isVeteran: false,
  isFirstTimeBuyer: false,
  loanPurpose: "purchase",
  propertyType: "single_family",
  propertyState: "IL",
  creditScore: "720",
  employmentType: "employed",
  employmentYears: "5",
} as PreApprovalFormData;

// Mirror of the component's arithmetic at the illustrative 6.5% fallback rate
// (the test seeds an empty rates response, so the fallback is deterministic).
function expectedPayment(price: number, down: number, withPmi: boolean): number {
  const loan = price - down;
  const r = 0.065 / 12;
  const n = 360;
  let m = (loan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  m += (price * 0.0125) / 12;
  if (withPmi) m += (loan * 0.005) / 12;
  return m;
}

function renderPanel(overrides: Partial<PreApprovalFormData>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["/api/mortgage-rates"], []);
  return render(
    <QueryClientProvider client={client}>
      <AdvisoryPanel formValues={{ ...BASE, ...overrides }} currentStepId="downPayment" />
    </QueryClientProvider>,
  );
}

function shownPayment(): number {
  const text = screen.getByTestId("text-est-payment").textContent ?? "";
  return parseFloat(text.replace(/[^0-9.]/g, ""));
}

describe("AdvisoryPanel payment estimate — PMI branches with the copy", () => {
  it("adds illustrative PMI for a low-down non-VA borrower and names it in the disclaimer", () => {
    renderPanel({ isVeteran: false, downPayment: "20000" }); // 95% LTV
    const expected = Math.round(expectedPayment(400000, 20000, true));
    expect(shownPayment()).toBe(expected);
    expect(screen.getByTestId("text-payment-disclaimer").textContent).toMatch(/taxes, insurance, and PMI/);
  });

  it("VA purchase at $0 down carries no PMI — the number matches the no-PMI copy", () => {
    renderPanel({ isVeteran: true, downPayment: "0" }); // 100% LTV
    const expected = Math.round(expectedPayment(400000, 0, false));
    expect(shownPayment()).toBe(expected);
    expect(screen.getByTestId("text-payment-disclaimer").textContent).toMatch(
      /No PMI included — VA loans don't require it/,
    );
  });

  it("a VA refinance is not the VA-purchase branch: PMI applies like anyone else above 80% LTV", () => {
    renderPanel({ isVeteran: true, loanPurpose: "refinance", downPayment: "20000" });
    const expected = Math.round(expectedPayment(400000, 20000, true));
    expect(shownPayment()).toBe(expected);
  });

  it("20%+ down carries no PMI, so the 'avoids PMI' advice is true in the number", () => {
    renderPanel({ isVeteran: false, downPayment: "100000" }); // 75% LTV
    const expected = Math.round(expectedPayment(400000, 100000, false));
    expect(shownPayment()).toBe(expected);
    const disclaimer = screen.getByTestId("text-payment-disclaimer").textContent ?? "";
    expect(disclaimer).toMatch(/taxes and insurance/);
    expect(disclaimer).not.toMatch(/PMI/);
  });
});
