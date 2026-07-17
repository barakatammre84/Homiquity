import { describe, expect, it } from "vitest";

import {
  buildDocumentChecklist,
  STANDARD_DOCS,
  type ChecklistCondition,
  type ChecklistDocument,
  type ChecklistTask,
} from "../server/services/documentChecklist";

const condition = (over: Partial<ChecklistCondition> & { id: string }): ChecklistCondition => ({
  title: over.id,
  description: null,
  category: "income",
  priority: "prior_to_approval",
  status: "outstanding",
  requiredDocumentTypes: [],
  ...over,
});

const doc = (over: Partial<ChecklistDocument> & { id: string; documentType: string }): ChecklistDocument => ({
  fileName: `${over.id}.pdf`,
  status: "uploaded",
  rejectionReason: null,
  reviewedAt: null,
  createdAt: new Date("2026-07-01T00:00:00Z"),
  ...over,
});

const task = (over: Partial<ChecklistTask> & { id: string }): ChecklistTask => ({
  taskType: "document_request",
  documentCategory: null,
  title: over.id,
  status: "OPEN",
  verificationStatus: null,
  verificationNotes: null,
  requestingTeam: null,
  isCustomRequest: true,
  documentInstructions: null,
  ...over,
});

describe("buildDocumentChecklist — personalized (condition-driven) path", () => {
  it("emits the pipeline's personalized requirements, not the standard list (self-employed)", () => {
    const { documents } = buildDocumentChecklist({
      conditions: [
        condition({ id: "c-pnl", title: "Year-to-date P&L", requiredDocumentTypes: ["profit_loss_statement"] }),
        condition({ id: "c-biz", title: "Business bank statements", category: "assets", requiredDocumentTypes: ["business_bank_statement"] }),
        condition({ id: "c-tax", title: "2 years personal returns", requiredDocumentTypes: ["tax_return"] }),
      ],
      documents: [],
      tasks: [],
    });
    expect(documents.map((d) => d.id)).toEqual(["c-pnl", "c-biz", "c-tax"]);
    expect(documents.every((d) => d.source === "condition" && d.status === "needed")).toBe(true);
    expect(documents[1].category).toBe("assets");
    // No silent fallback mixing.
    expect(documents.some((d) => d.source === "standard")).toBe(false);
  });

  it("matches uploads across the type-vocabulary bridge (paystub satisfies pay_stub)", () => {
    const { documents } = buildDocumentChecklist({
      conditions: [condition({ id: "c1", requiredDocumentTypes: ["pay_stub"] })],
      documents: [doc({ id: "d1", documentType: "paystub" })],
      tasks: [],
    });
    expect(documents[0].status).toBe("uploaded");
    expect(documents[0].documentId).toBe("d1");
  });

  it("the LATEST upload of a type decides the status, regardless of fetch order", () => {
    const older = doc({ id: "d-old", documentType: "bank_statement", status: "rejected", rejectionReason: "Blurry", createdAt: new Date("2026-07-01T00:00:00Z") });
    const newer = doc({ id: "d-new", documentType: "bank_statement_checking", status: "uploaded", createdAt: new Date("2026-07-10T00:00:00Z") });
    for (const order of [[older, newer], [newer, older]]) {
      const { documents } = buildDocumentChecklist({
        conditions: [condition({ id: "c1", requiredDocumentTypes: ["bank_statement"] })],
        documents: order,
        tasks: [],
      });
      expect(documents[0].documentId).toBe("d-new");
      expect(documents[0].status).toBe("uploaded");
      expect(documents[0].rejectionReason).toBeUndefined();
    }
  });

  it('a document staged "verifying" surfaces as verifying (the Under Review badge)', () => {
    const { documents } = buildDocumentChecklist({
      conditions: [condition({ id: "c1", requiredDocumentTypes: ["pay_stub"] })],
      documents: [doc({ id: "d1", documentType: "pay_stub", status: "verifying" })],
      tasks: [],
    });
    expect(documents[0].status).toBe("verifying");
  });

  it("rejected items expose the reason and review time for the Action Needed card", () => {
    const reviewedAt = new Date("2026-07-15T12:00:00Z");
    const { documents, stats } = buildDocumentChecklist({
      conditions: [condition({ id: "c1", requiredDocumentTypes: ["w2"] })],
      documents: [doc({ id: "d1", documentType: "w2", status: "rejected", rejectionReason: "Missing page 2", reviewedAt })],
      tasks: [],
    });
    expect(documents[0].status).toBe("rejected");
    expect(documents[0].rejectionReason).toBe("Missing page 2");
    expect(documents[0].reviewedAt).toBe(reviewedAt.toISOString());
    expect(stats.rejected).toBe(1);
  });

  it("doc-less submitted conditions read as verifying; settled conditions leave the checklist", () => {
    const { documents } = buildDocumentChecklist({
      conditions: [
        condition({ id: "c-submitted", status: "submitted", requiredDocumentTypes: ["gift_letter"] }),
        condition({ id: "c-cleared", status: "cleared", requiredDocumentTypes: ["pay_stub"] }),
        condition({ id: "c-waived", status: "waived", requiredDocumentTypes: ["w2"] }),
      ],
      documents: [],
      tasks: [],
    });
    expect(documents.map((d) => d.id)).toEqual(["c-submitted"]);
    expect(documents[0].status).toBe("verifying");
  });

  it("narrative conditions (no requiredDocumentTypes) never become checklist items", () => {
    const { documents } = buildDocumentChecklist({
      conditions: [
        condition({ id: "c-narrative", requiredDocumentTypes: [] }),
        condition({ id: "c-doc", requiredDocumentTypes: ["tax_return"] }),
      ],
      documents: [],
      tasks: [],
    });
    expect(documents.map((d) => d.id)).toEqual(["c-doc"]);
  });
});

describe("buildDocumentChecklist — standard fallback path", () => {
  it("falls back to the 5 standard items when no condition carries document types", () => {
    const { documents } = buildDocumentChecklist({
      conditions: [condition({ id: "c-narrative", requiredDocumentTypes: [] })],
      documents: [],
      tasks: [],
    });
    expect(documents.map((d) => d.documentType)).toEqual(STANDARD_DOCS.map((s) => s.type));
    expect(documents.every((d) => d.source === "standard")).toBe(true);
  });

  it("standard items match uploads through the bridge and honor submitted tasks", () => {
    const { documents } = buildDocumentChecklist({
      conditions: [],
      documents: [doc({ id: "d1", documentType: "tax_return_1040", status: "verified" })],
      tasks: [
        task({ id: "t1", documentCategory: "pay_stub", status: "IN_PROGRESS", verificationStatus: "pending" }),
      ],
    });
    const byType = Object.fromEntries(documents.map((d) => [d.documentType, d]));
    expect(byType["tax_return"].status).toBe("verified");
    expect(byType["pay_stub"].status).toBe("verifying");
    expect(byType["w2"].status).toBe("needed");
  });
});

describe("buildDocumentChecklist — custom document-request tasks", () => {
  it("appends tasks that no existing item covers, and dedupes ones that are covered", () => {
    const { documents } = buildDocumentChecklist({
      conditions: [condition({ id: "c1", requiredDocumentTypes: ["pay_stub"] })],
      documents: [],
      tasks: [
        task({ id: "t-covered", documentCategory: "paystub", title: "Pay stub please" }),
        task({ id: "t-new", documentCategory: "divorce_decree", title: "Divorce decree" }),
      ],
    });
    expect(documents.map((d) => d.id)).toEqual(["c1", "t-new"]);
    expect(documents[1].source).toBe("task");
    expect(documents[1].label).toBe("Divorce decree");
  });

  it("ignores non-document tasks entirely", () => {
    const { documents } = buildDocumentChecklist({
      conditions: [],
      documents: [],
      tasks: [task({ id: "t1", taskType: "call_borrower", documentCategory: "w2" })],
    });
    expect(documents.every((d) => d.source === "standard")).toBe(true);
  });
});

describe("buildDocumentChecklist — stats", () => {
  it("keeps the legacy stat semantics (uploaded counts verifying)", () => {
    const { stats } = buildDocumentChecklist({
      conditions: [
        condition({ id: "c1", requiredDocumentTypes: ["w2"] }),
        condition({ id: "c2", requiredDocumentTypes: ["pay_stub"] }),
        condition({ id: "c3", requiredDocumentTypes: ["bank_statement"] }),
        condition({ id: "c4", requiredDocumentTypes: ["tax_return"] }),
      ],
      documents: [
        doc({ id: "d1", documentType: "w2", status: "verified" }),
        doc({ id: "d2", documentType: "pay_stub", status: "verifying" }),
        doc({ id: "d3", documentType: "bank_statement", status: "rejected", rejectionReason: "Partial" }),
      ],
      tasks: [],
    });
    expect(stats).toEqual({ total: 4, verified: 1, uploaded: 1, needed: 1, rejected: 1 });
  });
});
