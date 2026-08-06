import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Users } from "lucide-react";
import { TextEntryStep, ChoiceStep, BooleanPairStep, SoftPullConsentStep } from "./StepInputs";
import { FUNNEL_SOFT_PULL_CONSENT_TEXT } from "@shared/creditConsentCopy";

// TextEntryStep merges what used to be two duplicated `currency` and `number`
// branches. The masks are the only behavioural difference between them, so
// they are what these tests pin: a currency field must never emit an unmasked
// string upward (the submit path strips commas and expects to find them), and
// a number field must never emit a non-digit.

/** The step is a controlled input, so masking is only observable if the caller
 * feeds the masked value back — same as the form does in the funnel. */
function ControlledTextEntry({ variant }: { variant: "currency" | "number" }) {
  const [value, setValue] = useState("");
  return (
    <TextEntryStep
      variant={variant}
      fieldName={variant === "currency" ? "purchasePrice" : "employmentYears"}
      value={value}
      icon={Users}
      onChange={setValue}
      onKeyDown={vi.fn()}
    />
  );
}

describe("TextEntryStep", () => {
  it("masks currency input with thousands separators", async () => {
    const user = userEvent.setup();
    render(<ControlledTextEntry variant="currency" />);
    const input = screen.getByTestId("input-purchasePrice") as HTMLInputElement;
    await user.type(input, "500000");
    expect(input.value).toBe("500,000");
  });

  it("strips non-digits from a number field", async () => {
    const user = userEvent.setup();
    render(<ControlledTextEntry variant="number" />);
    const input = screen.getByTestId("input-employmentYears") as HTMLInputElement;
    await user.type(input, "5a2");
    expect(input.value).toBe("52");
  });

  it("gives a number field the numeric keyboard hint and a currency field none", () => {
    const { unmount } = render(
      <TextEntryStep variant="number" fieldName="employmentYears" value="" onChange={vi.fn()} onKeyDown={vi.fn()} />,
    );
    expect(screen.getByTestId("input-employmentYears").getAttribute("inputmode")).toBe("numeric");
    unmount();

    render(
      <TextEntryStep variant="currency" fieldName="annualIncome" value="" onChange={vi.fn()} onKeyDown={vi.fn()} />,
    );
    expect(screen.getByTestId("input-annualIncome").getAttribute("inputmode")).toBeNull();
  });

  it("renders a field error with role=alert so it is announced", () => {
    render(
      <TextEntryStep
        variant="currency"
        fieldName="annualIncome"
        value=""
        error="Income is required"
        onChange={vi.fn()}
        onKeyDown={vi.fn()}
      />,
    );
    const error = screen.getByTestId("error-annualIncome");
    expect(error.getAttribute("role")).toBe("alert");
    expect(error.textContent).toContain("Income is required");
  });
});

describe("ChoiceStep", () => {
  it("reports the clicked option's value and marks the selected one", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ChoiceStep
        field="loanPurpose"
        options={[
          { value: "purchase", label: "Buying a Home" },
          { value: "refinance", label: "Refinancing My Home" },
        ]}
        isSelected={(v) => v === "purchase"}
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByTestId("option-loanPurpose-refinance"));
    expect(onSelect).toHaveBeenCalledWith("refinance");
    expect(screen.getByTestId("option-loanPurpose-purchase").className).toContain("border-primary");
  });
});

describe("BooleanPairStep", () => {
  it("toggles the field that was clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <BooleanPairStep
        fields={[
          { field: "isVeteran", label: "I am a U.S. military veteran or active duty", icon: Users },
          { field: "isFirstTimeBuyer", label: "I am a first-time home buyer", icon: Users },
        ]}
        isChecked={(f) => f === "isVeteran"}
        onToggle={onToggle}
      />,
    );
    await user.click(screen.getByTestId("toggle-isFirstTimeBuyer"));
    expect(onToggle).toHaveBeenCalledWith("isFirstTimeBuyer");
  });
});

describe("SoftPullConsentStep", () => {
  // F-034: the words on screen must be the shared constant the server persists
  // as credit_consents.disclosure_text, or the evidence record misstates what
  // the borrower actually agreed to.
  it("renders the shared disclosure text verbatim", () => {
    render(<SoftPullConsentStep acknowledged={false} onChange={vi.fn()} />);
    expect(screen.getByTestId("text-soft-pull-consent").textContent).toBe(
      FUNNEL_SOFT_PULL_CONSENT_TEXT,
    );
  });

  it("reports the acknowledgement upward", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SoftPullConsentStep acknowledged={false} onChange={onChange} />);
    await user.click(screen.getByTestId("checkbox-soft-pull-consent"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
