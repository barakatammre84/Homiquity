import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { PreApprovalFormData } from "@shared/schema";
import { gapFillFromCoachIntake, toCreditBand, useCoachPrefill, type CoachIntake } from "./coachPrefill";

// The funnel's construction defaults (PreApproval.tsx). Currency/text fields
// start blank; the enums and booleans start concrete — which is exactly why
// intake may fill the former and never the latter.
const DEFAULTS: PreApprovalFormData = {
  annualIncome: "",
  employmentType: "employed",
  employmentYears: "",
  monthlyDebts: "",
  creditScore: "",
  loanPurpose: "purchase",
  propertyType: "single_family",
  purchasePrice: "",
  downPayment: "",
  isVeteran: false,
  isFirstTimeBuyer: false,
  avoidsInterestFinancing: false,
  propertyState: "",
  hasAdditionalIncome: false,
  incomeSources: [],
} as PreApprovalFormData;

const FULL_INTAKE: CoachIntake = {
  annualIncome: "$60,000",
  monthlyDebts: "$400",
  creditScore: "640",
  employmentType: "employed",
  employmentYears: "2",
  downPayment: "$10,000",
  purchasePrice: "$250,000",
  propertyType: "condo",
  loanPurpose: "refinance",
  isVeteran: true,
  isFirstTimeBuyer: true,
};

// ---------------------------------------------------------------------------
// The rule, in isolation.
// ---------------------------------------------------------------------------

describe("gapFillFromCoachIntake", () => {
  it("fills blank currency and tenure fields", () => {
    expect(gapFillFromCoachIntake(DEFAULTS, FULL_INTAKE)).toMatchObject({
      annualIncome: "60000",
      monthlyDebts: "400",
      downPayment: "10000",
      purchasePrice: "250000",
      employmentYears: "2",
      creditScore: "640",
    });
  });

  it("never returns a field the borrower has already answered", () => {
    const answered: PreApprovalFormData = {
      ...DEFAULTS,
      annualIncome: "150000",
      monthlyDebts: "0",
      creditScore: "760",
      employmentYears: "9",
      purchasePrice: "800000",
      downPayment: "200000",
      isVeteran: true,
      isFirstTimeBuyer: true,
    };
    expect(gapFillFromCoachIntake(answered, FULL_INTAKE)).toEqual({});
  });

  it('treats "0" as an answer, not a blank — blankness is the only test', () => {
    const patch = gapFillFromCoachIntake({ ...DEFAULTS, monthlyDebts: "0" }, FULL_INTAKE);
    expect(patch.monthlyDebts).toBeUndefined();
  });

  it("never fills the enum fields — their defaults may carry URL intent", () => {
    // /self-employed and ?type=refinance land as construction defaults, so a
    // blank enum is unobservable and intake must not second-guess them.
    const fromUrl: PreApprovalFormData = {
      ...DEFAULTS,
      employmentType: "self_employed",
      loanPurpose: "cash_out",
    };
    const patch = gapFillFromCoachIntake(fromUrl, FULL_INTAKE);
    expect(patch).not.toHaveProperty("employmentType");
    expect(patch).not.toHaveProperty("propertyType");
    expect(patch).not.toHaveProperty("loanPurpose");
  });

  it("raises veteran/first-time flags but never lowers them", () => {
    expect(gapFillFromCoachIntake(DEFAULTS, { isVeteran: true })).toEqual({ isVeteran: true });
    // /va-loans pre-set the flag; intake saying "no" must not drop the VA path.
    expect(
      gapFillFromCoachIntake({ ...DEFAULTS, isVeteran: true }, { isVeteran: false }),
    ).toEqual({});
  });

  it("returns an empty patch for missing or empty intake", () => {
    expect(gapFillFromCoachIntake(DEFAULTS, null)).toEqual({});
    expect(gapFillFromCoachIntake(DEFAULTS, undefined)).toEqual({});
    expect(gapFillFromCoachIntake(DEFAULTS, {})).toEqual({});
  });

  it("declines to guess a credit band it cannot place", () => {
    expect(toCreditBand("715")).toBe("720");
    expect(toCreditBand("about 640")).toBe("640");
    expect(toCreditBand("no idea")).toBeUndefined();
    // 690 is >30 from both 660-less-720 and 680 is not a band; nothing fits.
    expect(gapFillFromCoachIntake(DEFAULTS, { creditScore: "not sure" }).creditScore)
      .toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// The wiring: a live form + a late-arriving intake, which is how the funnel
// actually experiences this (refetchOnWindowFocus is on globally).
// ---------------------------------------------------------------------------

/** Minimal stand-in for the funnel: real react-hook-form, intake pushed in. */
function Harness({ initial }: { initial?: Partial<PreApprovalFormData> }) {
  const [intake, setIntake] = useState<CoachIntake | null>(null);
  const form = useForm<PreApprovalFormData>({
    defaultValues: { ...DEFAULTS, ...initial },
  });
  useCoachPrefill(form, intake);
  const values = form.watch();
  return (
    <div>
      <input data-testid="input-annualIncome" {...form.register("annualIncome")} />
      <input data-testid="input-purchasePrice" {...form.register("purchasePrice")} />
      <span data-testid="value-monthlyDebts">{values.monthlyDebts}</span>
      <span data-testid="value-creditScore">{values.creditScore}</span>
      <span data-testid="value-employmentType">{values.employmentType}</span>
      <span data-testid="value-isVeteran">{String(values.isVeteran)}</span>
      <button data-testid="button-intake-arrives" onClick={() => setIntake(FULL_INTAKE)}>
        intake
      </button>
    </div>
  );
}

describe("useCoachPrefill (live funnel form)", () => {
  it("keeps what the borrower typed when intake arrives afterwards", async () => {
    // THE REGRESSION. Borrower types their income, opens the coach in another
    // tab, comes back; the focus refetch resolves intake mid-funnel. Before the
    // fix this reset the form and replaced 150000 with the coach's 60000.
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByTestId("input-annualIncome"), "150000");
    await user.type(screen.getByTestId("input-purchasePrice"), "800000");
    await user.click(screen.getByTestId("button-intake-arrives"));

    await waitFor(() =>
      expect(screen.getByTestId("value-monthlyDebts").textContent).toBe("400"),
    );
    expect(screen.getByTestId<HTMLInputElement>("input-annualIncome").value).toBe("150000");
    expect(screen.getByTestId<HTMLInputElement>("input-purchasePrice").value).toBe("800000");
  });

  it("still fills the fields the borrower left blank", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByTestId("input-annualIncome"), "150000");
    await user.click(screen.getByTestId("button-intake-arrives"));

    await waitFor(() =>
      expect(screen.getByTestId("value-creditScore").textContent).toBe("640"),
    );
    expect(screen.getByTestId("value-monthlyDebts").textContent).toBe("400");
    expect(screen.getByTestId<HTMLInputElement>("input-purchasePrice").value).toBe("250000");
  });

  it("does not override a URL-param deep link or a restored draft", async () => {
    // Both arrive as construction defaults — non-blank, so untouchable.
    const user = userEvent.setup();
    render(<Harness initial={{ purchasePrice: "425000", isVeteran: true, employmentType: "self_employed" }} />);
    await user.click(screen.getByTestId("button-intake-arrives"));

    await waitFor(() =>
      expect(screen.getByTestId("value-monthlyDebts").textContent).toBe("400"),
    );
    expect(screen.getByTestId<HTMLInputElement>("input-purchasePrice").value).toBe("425000");
    expect(screen.getByTestId("value-isVeteran").textContent).toBe("true");
    expect(screen.getByTestId("value-employmentType").textContent).toBe("self_employed");
  });

  it("applies at most once, so a later refetch cannot re-fill a cleared field", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId("button-intake-arrives"));
    await waitFor(() =>
      expect(screen.getByTestId<HTMLInputElement>("input-annualIncome").value).toBe("60000"),
    );

    await user.clear(screen.getByTestId("input-annualIncome"));
    await user.type(screen.getByTestId("input-annualIncome"), "90000");
    await user.click(screen.getByTestId("button-intake-arrives"));

    expect(screen.getByTestId<HTMLInputElement>("input-annualIncome").value).toBe("90000");
  });
});
