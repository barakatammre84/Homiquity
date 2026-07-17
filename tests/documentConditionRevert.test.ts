import { describe, expect, it } from "vitest";

import { conditionsToRevertAfterRejection } from "../server/pipelineEngine";

const condition = (
  id: string,
  status: string,
  requiredDocumentTypes: string[] | null,
) => ({ id, status, requiredDocumentTypes });

describe("conditionsToRevertAfterRejection (review-loop re-arm)", () => {
  it("reverts a submitted condition when its only satisfying document was rejected", () => {
    expect(
      conditionsToRevertAfterRejection({
        conditions: [condition("c1", "submitted", ["bank_statement"])],
        documents: [{ documentType: "bank_statement_checking", status: "rejected" }],
        rejectedDocumentType: "bank_statement_checking",
      }),
    ).toEqual(["c1"]);
  });

  it("does NOT revert when another non-rejected document still satisfies the condition (alias-aware)", () => {
    expect(
      conditionsToRevertAfterRejection({
        conditions: [condition("c1", "submitted", ["bank_statement"])],
        documents: [
          { documentType: "bank_statement_checking", status: "rejected" },
          // A savings statement is an alias of the same canonical type and is
          // still in play — the condition stays submitted.
          { documentType: "bank_statement_savings", status: "uploaded" },
        ],
        rejectedDocumentType: "bank_statement_checking",
      }),
    ).toEqual([]);
  });

  it("reverts when every satisfying document is rejected", () => {
    expect(
      conditionsToRevertAfterRejection({
        conditions: [condition("c1", "submitted", ["bank_statement"])],
        documents: [
          { documentType: "bank_statement_checking", status: "rejected" },
          { documentType: "bank_statement_savings", status: "rejected" },
        ],
        rejectedDocumentType: "bank_statement_savings",
      }),
    ).toEqual(["c1"]);
  });

  it("only touches submitted conditions — outstanding/cleared/waived stay put", () => {
    expect(
      conditionsToRevertAfterRejection({
        conditions: [
          condition("c-outstanding", "outstanding", ["pay_stub"]),
          condition("c-cleared", "cleared", ["pay_stub"]),
          condition("c-waived", "waived", ["pay_stub"]),
        ],
        documents: [{ documentType: "paystub", status: "rejected" }],
        rejectedDocumentType: "paystub",
      }),
    ).toEqual([]);
  });

  it("ignores conditions whose required types don't match the rejected document", () => {
    expect(
      conditionsToRevertAfterRejection({
        conditions: [condition("c1", "submitted", ["tax_return"])],
        documents: [{ documentType: "paystub", status: "rejected" }],
        rejectedDocumentType: "paystub",
      }),
    ).toEqual([]);
  });

  it("bridges vocabularies both ways: rejected catalog type re-arms a coarse condition", () => {
    expect(
      conditionsToRevertAfterRejection({
        conditions: [condition("c1", "submitted", ["pay_stub"])],
        documents: [{ documentType: "paystub", status: "rejected" }],
        rejectedDocumentType: "paystub",
      }),
    ).toEqual(["c1"]);
  });

  it("narrative conditions (no requiredDocumentTypes) are never reverted", () => {
    expect(
      conditionsToRevertAfterRejection({
        conditions: [condition("c1", "submitted", null), condition("c2", "submitted", [])],
        documents: [{ documentType: "paystub", status: "rejected" }],
        rejectedDocumentType: "paystub",
      }),
    ).toEqual([]);
  });

  it("reverts multiple matching conditions in one pass", () => {
    expect(
      conditionsToRevertAfterRejection({
        conditions: [
          condition("c1", "submitted", ["bank_statement"]),
          condition("c2", "submitted", ["bank_statement", "gift_letter"]),
        ],
        documents: [{ documentType: "bank_statement_checking", status: "rejected" }],
        rejectedDocumentType: "bank_statement_checking",
      }),
    ).toEqual(["c1", "c2"]);
  });
});
