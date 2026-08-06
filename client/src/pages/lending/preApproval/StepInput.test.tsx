import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { StepInput } from "./StepInput";
import { QUESTIONS_BY_ID } from "./questions";
import type { PreApprovalFormData } from "@shared/schema";
import { FUNNEL_SOFT_PULL_CONSENT_TEXT } from "@shared/creditConsentCopy";

// StepInput is PreApproval.tsx's renderInput() switch, extracted verbatim
// into its own component. These pin the field-wiring contract per question
// type (currency masking, choice advance, final-step consent) so a future
// edit to the switch can't silently change what reaches the form.

const DEFAULT_VALUES: PreApprovalFormData = {
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
};

function Harness({
  stepId,
  onAdvance = vi.fn(),
  onConsentChange = vi.fn(),
  consentAcknowledged = false,
}: {
  stepId: string;
  onAdvance?: (values: PreApprovalFormData) => void;
  onConsentChange?: (checked: boolean) => void;
  consentAcknowledged?: boolean;
}) {
  const form = useForm<PreApprovalFormData>({ defaultValues: DEFAULT_VALUES });
  const watchedValues = form.watch();
  return (
    <StepInput
      currentQ={QUESTIONS_BY_ID[stepId]}
      form={form}
      watchedValues={watchedValues}
      onKeyDown={() => {}}
      onAdvance={onAdvance}
      consentAcknowledged={consentAcknowledged}
      onConsentChange={onConsentChange}
    />
  );
}

describe("StepInput — currency", () => {
  it("masks typed digits into the field", async () => {
    const user = userEvent.setup();
    render(<Harness stepId="purchasePrice" />);
    const input = screen.getByTestId("input-purchasePrice") as HTMLInputElement;
    await user.type(input, "450000");
    expect(input.value).toBe("450,000");
  });
});

describe("StepInput — choice", () => {
  it("selecting an option reports the value and advances", async () => {
    const user = userEvent.setup();
    const onAdvance = vi.fn();
    render(<Harness stepId="loanPurpose" onAdvance={onAdvance} />);
    await user.click(screen.getByTestId("option-loanPurpose-refinance"));
    await new Promise((r) => setTimeout(r, 250));
    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(onAdvance.mock.calls[0][0]).toMatchObject({ loanPurpose: "refinance" });
  });
});

describe("StepInput — final (soft-pull consent)", () => {
  it("reflects consentAcknowledged and reports a toggle", async () => {
    const user = userEvent.setup();
    const onConsentChange = vi.fn();
    render(<Harness stepId="final" consentAcknowledged={false} onConsentChange={onConsentChange} />);
    const checkbox = screen.getByTestId("checkbox-soft-pull-consent");
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
    await user.click(checkbox);
    expect(onConsentChange).toHaveBeenCalledWith(true);
  });

  // F-034: the words on screen and the words persisted as
  // credit_consents.disclosure_text cannot drift. The disclosure is rendered by
  // splitting the shared constant on "soft inquiry" to bold that phrase, so this
  // asserts the REJOINED text is byte-identical to the constant — which is the
  // actual invariant. (A `toContain("soft inquiry")` would still pass if the
  // constant ever gained a second occurrence and split/rejoin silently dropped
  // the middle segment; this will not.) The source-scan in
  // tests/creditConsentScope.test.ts proves the constant is *referenced*; only
  // this proves what the borrower actually reads.
  it("renders the shared disclosure verbatim, plus the security note", () => {
    render(<Harness stepId="final" />);
    expect(screen.getByTestId("text-soft-pull-consent").textContent).toBe(
      FUNNEL_SOFT_PULL_CONSENT_TEXT,
    );
    expect(screen.getByTestId("text-consent-security-note")).toBeTruthy();
  });
});
