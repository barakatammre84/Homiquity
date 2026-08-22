import { describe, expect, it } from "vitest";
import { determineDocumentRequirements } from "../server/pipelineEngine";
import {
  buildDocumentChecklist,
  outstandingChecklistItems,
  borrowerAskLabel,
  type ChecklistCondition,
  type ChecklistDocument,
} from "../server/services/documentChecklist";
import type { IncomeType } from "@shared/schema";

/**
 * The whole chain the assistant's next-ask now travels, end to end and pure:
 *
 *   determineDocumentRequirements  →  loan_conditions  →  buildDocumentChecklist
 *                                  →  outstandingChecklistItems  →  borrowerAskLabel
 *
 * Before this, borrowerGraph skipped every step and used a hardcoded list of
 * five document types, so a self-employed borrower was asked for a pay stub and
 * a W-2 and never for the P&L.
 */
const baseProfile = {
  employmentType: null as string | null,
  employmentYears: 3,
  annualIncome: 90000,
  creditScore: 720,
  ltvRatio: 90,
  loanPurpose: "purchase",
  propertyType: "single_family",
  isVeteran: false,
  isFirstTimeBuyer: false,
  isSelfEmployed: false,
};

/** Mirrors generateConditionsFromRequirements: one condition per requirement. */
function conditionsFor(...types: IncomeType[]): ChecklistCondition[] {
  return determineDocumentRequirements({
    ...baseProfile,
    incomeSources: types.map((type) => ({ type, evidence: "borrower_stated" as const })),
  }).map((req, i) => ({
    id: `c-${i}-${req.documentType}`,
    title: req.conditionTitle,
    description: req.description,
    category: req.conditionCategory,
    priority: req.priority,
    status: "outstanding",
    requiredDocumentTypes: [req.documentType],
  }));
}

const doc = (over: Partial<ChecklistDocument> & { id: string; documentType: string }): ChecklistDocument => ({
  fileName: `${over.id}.pdf`,
  status: "uploaded",
  rejectionReason: null,
  reviewedAt: null,
  createdAt: new Date("2026-07-01T00:00:00Z"),
  ...over,
});

const outstandingTypes = (conditions: ChecklistCondition[], documents: ChecklistDocument[] = []) =>
  outstandingChecklistItems(buildDocumentChecklist({ conditions, documents, tasks: [] }).documents)
    .map((i) => i.documentType);

describe("what the borrower still owes — the contract the assistant reads", () => {
  it("never asks a self-employed borrower for a document they cannot produce", () => {
    const types = outstandingTypes(conditionsFor("self_employed"));
    expect(types).toEqual(expect.arrayContaining([
      "tax_return", "profit_loss", "business_license", "bank_statement_business",
    ]));
    expect(types).not.toContain("pay_stub");
    expect(types).not.toContain("w2");
  });

  it("asks a self-employed borrower who ALSO has a W-2 job for both sets", () => {
    expect(outstandingTypes(conditionsFor("self_employed", "w2")))
      .toEqual(expect.arrayContaining(["pay_stub", "w2", "profit_loss"]));
  });

  it("the FIRST thing asked of a self-employed borrower is producible", () => {
    // coachingTurn renders documentsMissing[0] as the single next ask.
    const first = outstandingTypes(conditionsFor("self_employed"))[0];
    expect(["pay_stub", "w2"]).not.toContain(first);
  });

  it("counts a `paystub` upload as satisfying a `pay_stub` requirement", () => {
    expect(outstandingTypes(conditionsFor("w2"), [doc({ id: "d1", documentType: "paystub" })]))
      .not.toContain("pay_stub");
  });

  it("keeps a REJECTED document outstanding instead of counting it as present", () => {
    const items = outstandingChecklistItems(buildDocumentChecklist({
      conditions: conditionsFor("w2"),
      documents: [doc({ id: "d1", documentType: "pay_stub", status: "rejected", rejectionReason: "illegible" })],
      tasks: [],
    }).documents);
    const payStub = items.find((i) => i.documentType === "pay_stub");
    expect(payStub).toBeDefined();
    expect(payStub?.status).toBe("rejected");
  });

  it("puts a rejected item first — the borrower already acted and it bounced", () => {
    const items = outstandingChecklistItems(buildDocumentChecklist({
      conditions: conditionsFor("w2"),
      documents: [doc({ id: "d1", documentType: "w2", status: "rejected", rejectionReason: "wrong year" })],
      tasks: [],
    }).documents);
    expect(items[0].documentType).toBe("w2");
    expect(items[0].status).toBe("rejected");
  });

  /**
   * 🚨 Load-bearing negative. A personal checking statement must NOT satisfy the
   * self-employed BUSINESS bank-statement requirement. Adding a "helpful" alias
   * from bank_statement_business → bank_statement would silently unblock a
   * lender submission on an incomplete file.
   */
  it("does not let a personal bank statement clear the business bank-statement requirement", () => {
    expect(outstandingTypes(conditionsFor("self_employed"), [
      doc({ id: "d1", documentType: "bank_statement_checking" }),
    ])).toContain("bank_statement_business");
  });

  describe("borrowerAskLabel", () => {
    it("turns a staff-voiced condition title into something you can say", () => {
      const items = buildDocumentChecklist({
        conditions: conditionsFor("self_employed"), documents: [], tasks: [],
      }).documents;
      for (const label of items.map(borrowerAskLabel)) {
        expect(label).not.toMatch(/_/);           // never "pay_stub"
        expect(label).not.toMatch(/required$/i);  // never "... Required"
        expect(label.trim()).not.toBe("");
      }
    });

    it("falls back to a readable slug when there is no label", () => {
      expect(borrowerAskLabel({ documentType: "bank_statement_business", label: "" } as never))
        .toBe("bank statement business");
    });
  });

  /**
   * The readiness denominator moves as a RESULT of this change: it used to be a
   * fixed 5 for every borrower on earth. Pinned here so a future shift is a
   * decision someone made, not something discovered in production.
   */
  describe("readiness denominator (chosen, not discovered)", () => {
    it("is the borrower's own requirement count, and differs by income shape", () => {
      const w2Only = outstandingTypes(conditionsFor("w2")).length;
      const selfEmployed = outstandingTypes(conditionsFor("self_employed")).length;
      const both = outstandingTypes(conditionsFor("w2", "self_employed")).length;

      // W-2: id, pay stub, W-2, bank statement, gift letter (LTV 90 > 80),
      // purchase contract, insurance.
      expect(w2Only).toBe(7);
      // Self-employed swaps the two wage documents for four business ones.
      expect(selfEmployed).toBe(9);
      // Both incomes = both sets, deduped: 11, not 7 and not 9.
      expect(both).toBe(11);
      expect(both).toBeGreaterThan(Math.max(w2Only, selfEmployed));
    });
  });
});
