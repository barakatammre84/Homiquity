import { describe, it, expect } from "vitest";
import { calculateScenario, DEFAULT_RATES, type ScenarioInput } from "./scenario";

const input = (over: Partial<ScenarioInput> = {}): ScenarioInput => ({
  purchasePrice: "400000",
  downPaymentPercent: "20",
  creditScore: "740",
  loanProgram: "conventional",
  annualIncome: "",
  interestRate: "",
  propertyTaxRate: "",
  insuranceRate: "",
  ...over,
});

describe("calculateScenario — input validation", () => {
  it("returns null rather than NaN for an unusable price", () => {
    // Every field is a raw string off a text input, so the guards are the only
    // thing between a typo and a "$NaN/mo" payment on screen.
    for (const purchasePrice of ["", "0", "-100", "abc"]) {
      expect(calculateScenario(input({ purchasePrice })), purchasePrice).toBeNull();
    }
  });

  it("rejects a down payment outside 0-100%", () => {
    expect(calculateScenario(input({ downPaymentPercent: "-1" }))).toBeNull();
    expect(calculateScenario(input({ downPaymentPercent: "101" }))).toBeNull();
    expect(calculateScenario(input({ downPaymentPercent: "abc" }))).toBeNull();
    expect(calculateScenario(input({ downPaymentPercent: "0" }))).not.toBeNull();
    expect(calculateScenario(input({ downPaymentPercent: "100" }))).not.toBeNull();
  });

  it("rejects a credit score outside the FICO range", () => {
    expect(calculateScenario(input({ creditScore: "299" }))).toBeNull();
    expect(calculateScenario(input({ creditScore: "851" }))).toBeNull();
    expect(calculateScenario(input({ creditScore: "" }))).toBeNull();
    expect(calculateScenario(input({ creditScore: "300" }))).not.toBeNull();
    expect(calculateScenario(input({ creditScore: "850" }))).not.toBeNull();
  });
});

describe("calculateScenario — defaults and overrides", () => {
  it("uses the program's default rate when none is entered", () => {
    for (const program of ["conventional", "fha", "va", "usda"] as const) {
      const r = calculateScenario(input({ loanProgram: program }))!;
      expect(r.interestRateUsed, program).toBe(DEFAULT_RATES[program]);
    }
  });

  it("prefers an entered rate over the program default", () => {
    const r = calculateScenario(input({ interestRate: "5.25" }))!;
    expect(r.interestRateUsed).toBe(5.25);
  });

  it("defaults tax to 1.1% and insurance to 0.35% of price", () => {
    const r = calculateScenario(input())!;
    expect(r.monthlyPropertyTax).toBeCloseTo((400000 * 0.011) / 12, 6);
    expect(r.monthlyInsurance).toBeCloseTo((400000 * 0.0035) / 12, 6);
  });

  it("leaves DTI null when no income is given rather than reporting 0%", () => {
    expect(calculateScenario(input({ annualIncome: "" }))!.dti).toBeNull();
    expect(calculateScenario(input({ annualIncome: "0" }))!.dti).toBeNull();
    expect(calculateScenario(input({ annualIncome: "120000" }))!.dti).toBeGreaterThan(0);
  });
});

describe("calculateScenario — mortgage insurance by program", () => {
  it("charges conventional PMI only above 80% LTV", () => {
    const at80 = calculateScenario(input({ downPaymentPercent: "20" }))!;
    const above = calculateScenario(input({ downPaymentPercent: "10" }))!;
    expect(at80.ltv).toBe(80);
    expect(at80.monthlyPmi).toBe(0);
    expect(above.monthlyPmi).toBeCloseTo((above.loanAmount * 0.005) / 12, 6);
  });

  it("charges FHA MIP at any LTV, including 20% down", () => {
    // FHA MIP is not LTV-gated the way conventional PMI is — a 20%-down FHA
    // loan still pays it, which is the whole point of the program note.
    const fha = calculateScenario(input({ loanProgram: "fha", downPaymentPercent: "20" }))!;
    expect(fha.monthlyPmi).toBeCloseTo((fha.loanAmount * 0.0085) / 12, 6);
  });

  it("charges no mortgage insurance on VA or USDA", () => {
    for (const loanProgram of ["va", "usda"] as const) {
      const r = calculateScenario(input({ loanProgram, downPaymentPercent: "0" }))!;
      expect(r.monthlyPmi, loanProgram).toBe(0);
    }
  });
});

describe("calculateScenario — totals", () => {
  it("sums the four components into the total payment", () => {
    const r = calculateScenario(input({ downPaymentPercent: "10" }))!;
    expect(r.totalMonthlyPayment).toBeCloseTo(
      r.monthlyPrincipalInterest + r.monthlyPmi + r.monthlyPropertyTax + r.monthlyInsurance,
      6,
    );
  });

  it("amortizes over 30 years and handles a 0% rate", () => {
    const r = calculateScenario(input({ interestRate: "6.5", downPaymentPercent: "20" }))!;
    expect(r.loanAmount).toBe(320000);
    expect(r.monthlyPrincipalInterest).toBeCloseTo(2022.62, 1);

    const zero = calculateScenario(input({ interestRate: "0", downPaymentPercent: "20" }))!;
    expect(zero.monthlyPrincipalInterest).toBeCloseTo(320000 / 360, 6);
  });

  it("handles 100% down — no loan, no P&I, but still taxes and insurance", () => {
    const r = calculateScenario(input({ downPaymentPercent: "100" }))!;
    expect(r.loanAmount).toBe(0);
    expect(r.ltv).toBe(0);
    expect(r.monthlyPrincipalInterest).toBe(0);
    expect(r.totalMonthlyPayment).toBeGreaterThan(0);
  });
});

describe("calculateScenario — program notes", () => {
  it("warns when the down payment is under the FHA minimum", () => {
    const notes = calculateScenario(input({ loanProgram: "fha", downPaymentPercent: "3" }))!.programNotes;
    expect(notes.join(" ")).toContain("below FHA minimum of 3.5%");
  });

  it("notes the FHA 10%-down rule for sub-580 scores", () => {
    const notes = calculateScenario(input({ loanProgram: "fha", creditScore: "560" }))!.programNotes;
    expect(notes.join(" ")).toContain("10% down payment for credit scores below 580");
  });

  it("explains conventional PMI only when it applies", () => {
    const withPmi = calculateScenario(input({ downPaymentPercent: "10" }))!.programNotes.join(" ");
    const without = calculateScenario(input({ downPaymentPercent: "25" }))!.programNotes.join(" ");
    expect(withPmi).toContain("PMI required when LTV exceeds 80%");
    expect(without).not.toContain("PMI required");
  });

  it("flags DTI above 43% and above 50%", () => {
    const high = calculateScenario(input({ annualIncome: "60000", downPaymentPercent: "5" }))!;
    expect(high.dti!).toBeGreaterThan(43);
    expect(high.programNotes.join(" ")).toMatch(/DTI exceeds (43|50)%/);

    const fine = calculateScenario(input({ annualIncome: "300000" }))!;
    expect(fine.programNotes.join(" ")).not.toContain("DTI exceeds");
  });
});
