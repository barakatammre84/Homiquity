import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import type { PreApprovalFormData } from "@shared/schema";
import { CREDIT_SCORE_BAND_VALUES } from "@shared/schema";
import { writeCalculatorPrefill, readCalculatorPrefill } from "@/lib/calculatorPrefill";
import { gapFillFromCalculatorPrefill, useCalculatorPrefill } from "./calculatorPrefill";

// The calculator → funnel handoff. The property that matters and was NOT true
// before: every value this writes must be one the funnel can actually accept.
// The old inline version mapped the credit slider into the LEADS vocabulary
// ("excellent"/"good"/"fair"/"poor"), which no funnel option matches and
// `preApprovalFormSchema` rejects — so the borrower was bounced at the final
// step, after authorising the soft pull, over a field they never filled in.

// The funnel's construction defaults (PreApproval.tsx): currency/text blank,
// enums and booleans concrete.
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

beforeEach(() => {
  sessionStorage.clear();
});

// ---------------------------------------------------------------------------
// The rule, in isolation.
// ---------------------------------------------------------------------------

describe("gapFillFromCalculatorPrefill", () => {
  it("fills blank currency fields as strings", () => {
    expect(
      gapFillFromCalculatorPrefill(DEFAULTS, {
        annualIncome: 100000,
        monthlyDebts: 500,
        downPayment: 50000,
        purchasePrice: 425000,
      }),
    ).toMatchObject({
      annualIncome: "100000",
      monthlyDebts: "500",
      downPayment: "50000",
      purchasePrice: "425000",
    });
  });

  // THE REGRESSION. Every slider position must land on a value the funnel's own
  // option list offers — not on a fifth vocabulary nothing accepts. The band
  // boundaries mirror the option labels in preApproval/questions.ts:
  // "760+" / "720-759" / "680-719" / "640-679" / "Under 640".
  it.each([
    [850, "760"], // slider max — the tolerance matcher dropped everything > 790
    [800, "760"],
    [760, "760"],
    [759, "720"],
    [720, "720"],
    [719, "680"],
    [680, "680"],
    [679, "640"],
    [640, "640"],
    [639, "600"], // "Under 640" — must NOT round up into the 640-679 band
    [600, "600"],
    [580, "600"], // slider min
  ])("maps credit score %i onto the funnel band %s", (score, band) => {
    const patch = gapFillFromCalculatorPrefill(DEFAULTS, { creditScore: score });
    expect(patch.creditScore).toBe(band);
    expect(CREDIT_SCORE_BAND_VALUES).toContain(patch.creditScore);
  });

  // Totality: the mapping is by RANGE with open ends, so no slider position can
  // fall through and leave the borrower re-answering a question we had.
  it("emits a valid band for every score on the slider track, and never anything else", () => {
    for (let score = 580; score <= 850; score += 1) {
      const { creditScore } = gapFillFromCalculatorPrefill(DEFAULTS, { creditScore: score });
      expect(CREDIT_SCORE_BAND_VALUES).toContain(creditScore);
      expect(creditScore).not.toBe("not_sure"); // a borrower's own answer, never derived
    }
  });

  it("never replaces an answer the borrower already gave", () => {
    const answered: PreApprovalFormData = {
      ...DEFAULTS,
      annualIncome: "90000",
      creditScore: "640",
    };
    expect(
      gapFillFromCalculatorPrefill(answered, { annualIncome: 100000, creditScore: 780 }),
    ).toEqual({});
  });

  it("is a no-op with nothing stashed", () => {
    expect(gapFillFromCalculatorPrefill(DEFAULTS, null)).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// The transport: write → read → clear.
// ---------------------------------------------------------------------------

describe("calculatorPrefill storage", () => {
  it("round-trips a payload and consumes it on read", () => {
    writeCalculatorPrefill({ annualIncome: 100000, creditScore: 720 });
    expect(readCalculatorPrefill()).toEqual({ annualIncome: 100000, creditScore: 720 });
    // Read-and-clear: a stale payload must never reach a later, unrelated visit.
    expect(readCalculatorPrefill()).toBeNull();
  });

  it("drops non-numeric and unknown fields rather than trusting them", () => {
    sessionStorage.setItem(
      "calculatorPrefill",
      JSON.stringify({ annualIncome: "100000", creditScore: 720, role: "admin" }),
    );
    expect(readCalculatorPrefill()).toEqual({ creditScore: 720 });
  });

  it("survives a corrupt payload", () => {
    sessionStorage.setItem("calculatorPrefill", "{not json");
    expect(readCalculatorPrefill()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Wired to a live form.
// ---------------------------------------------------------------------------

describe("useCalculatorPrefill", () => {
  function renderWithForm() {
    return renderHook(() => {
      const form = useForm<PreApprovalFormData>({ defaultValues: DEFAULTS });
      useCalculatorPrefill(form);
      return form;
    });
  }

  it("applies a stashed handoff to a blank funnel", () => {
    writeCalculatorPrefill({ annualIncome: 100000, downPayment: 50000, creditScore: 680 });
    const { result } = renderWithForm();
    expect(result.current.getValues("annualIncome")).toBe("100000");
    expect(result.current.getValues("downPayment")).toBe("50000");
    expect(result.current.getValues("creditScore")).toBe("680");
  });

  it("consumes the stash so a remount cannot re-apply it", () => {
    writeCalculatorPrefill({ annualIncome: 100000 });
    renderWithForm();
    expect(sessionStorage.getItem("calculatorPrefill")).toBeNull();
    const { result } = renderWithForm();
    expect(result.current.getValues("annualIncome")).toBe("");
  });

  it("leaves the form untouched when nothing was stashed", () => {
    const { result } = renderWithForm();
    expect(result.current.getValues("annualIncome")).toBe("");
    expect(result.current.getValues("creditScore")).toBe("");
  });
});
