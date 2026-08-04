import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { tasks } from "@shared/schema";
import type { Document, TaskDocument } from "@shared/schema";
import {
  toBorrowerTaskView,
  toBorrowerTaskViews,
  toBorrowerTaskDocumentView,
  BORROWER_TASK_VIEW_COLUMNS,
  BORROWER_TASK_EMBARGOED_COLUMNS,
  type MaskableBorrowerTask,
} from "@shared/borrowerTaskView";
import { TASK_TYPE_SLA_MAPPING_SEED } from "../server/seedData/taskEngineSla";
import { lintOutboundText } from "@shared/compliance/loCommsLint";

/**
 * Borrower Clarity PR 4 (kb log 2026-08-04 §4): the borrower-tasks payload is
 * a strict whitelist for non-staff callers, in the borrowerOfferView pattern —
 * field-absence is pinned here so a future edit can't quietly re-expose staff
 * review free text or staff user ids by spreading the row.
 */

const borrowerTask = (over: Partial<MaskableBorrowerTask> = {}): MaskableBorrowerTask => ({
  id: "t-1",
  applicationId: "app-1",
  title: "Upload your 2023 federal return",
  description: "We need all pages including schedules.",
  taskType: "document_request",
  taskTypeCode: null,
  ownerRole: "BORROWER",
  slaClass: "S3",
  status: "OPEN",
  priority: "normal",
  dueDate: null,
  createdAt: null,
  documentCategory: "tax_return",
  documentYear: "2023",
  documentInstructions: "Include Schedule C and Schedule E.",
  requestingTeam: "processing",
  isCustomRequest: true,
  verificationStatus: null,
  slaStatus: "green",
  timeRemaining: 120,
  percentageElapsed: 10,
  ...over,
});

/** The raw row a careless refactor might spread into the response. */
const rawRowHazards = {
  verificationNotes: "internal: AGI mismatch, escalate to UW",
  resolutionNotes: "resolved after second-level review",
  assignedToUserId: "staff-user-77",
  createdByUserId: "staff-user-12",
  verifiedByUserId: "staff-user-99",
  resolvedByUserId: "staff-user-99",
  escalationLevel: 3,
  triggerSource: "DOCUMENT_INTELLIGENCE",
};

describe("toBorrowerTaskView — borrower-owned actionables", () => {
  it("keeps the borrower-facing context (title, description, document what/year/why)", () => {
    const view = toBorrowerTaskView(borrowerTask());
    expect(view.title).toBe("Upload your 2023 federal return");
    expect(view.description).toBe("We need all pages including schedules.");
    expect(view.documentCategory).toBe("tax_return");
    expect(view.documentYear).toBe("2023");
    expect(view.documentInstructions).toBe("Include Schedule C and Schedule E.");
    expect(view.slaStatus).toBe("green");
  });

  it("never emits staff review text, staff user ids, or escalation internals", () => {
    const view = toBorrowerTaskView({
      ...borrowerTask(),
      ...(rawRowHazards as Partial<MaskableBorrowerTask>),
    });
    const serialized = JSON.stringify(view);
    for (const [key, value] of Object.entries(rawRowHazards)) {
      if (typeof value === "string") {
        expect(serialized, `field ${key} leaked`).not.toContain(value);
      }
      expect(key in view, `key ${key} present`).toBe(false);
    }
  });
});

describe("toBorrowerTaskView — staff transparency rows", () => {
  const staffRow = borrowerTask({
    ownerRole: "CLOSER",
    taskTypeCode: "CMP_CLOSING_DISC",
    title: "Prepare closing package (CD tolerance review, wire check)",
    description: "Verify CD against LE tolerances before disclosure",
    borrowerDisplayText: "We're preparing your closing paperwork.",
  });

  it("displays ONLY the mapping's borrowerDisplayText — staff title/description stay internal", () => {
    const view = toBorrowerTaskView(staffRow);
    expect(view.title).toBe("We're preparing your closing paperwork.");
    expect(view.borrowerDisplayText).toBe("We're preparing your closing paperwork.");
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("CD tolerance review");
    expect(serialized).not.toContain("Verify CD against LE tolerances");
    expect(view.description).toBeUndefined();
    expect(view.documentInstructions).toBeUndefined();
  });

  it("falls back to generic text when display text is missing (hand-inserted mapping)", () => {
    const view = toBorrowerTaskView({ ...staffRow, borrowerDisplayText: null });
    expect(view.title).toBe("In progress on our side.");
  });

  it("maps arrays through toBorrowerTaskViews", () => {
    const views = toBorrowerTaskViews([borrowerTask(), staffRow]);
    expect(views).toHaveLength(2);
    expect(views[0].description).toBeDefined();
    expect(views[1].description).toBeUndefined();
  });
});

describe("borrower display copy stays inside the Reg N lexicon", () => {
  it("every seeded borrowerDisplayText passes lintOutboundText with no hard blocks", () => {
    const visible = TASK_TYPE_SLA_MAPPING_SEED.filter((m) => m.visibleToBorrower);
    expect(visible.length).toBeGreaterThan(0);
    for (const mapping of visible) {
      expect(mapping.borrowerDisplayText, mapping.taskTypeCode).toBeTruthy();
      const result = lintOutboundText(mapping.borrowerDisplayText!);
      const blocking = [...result.triggerMatches, ...result.hardBlockMatches];
      expect(
        blocking,
        `${mapping.taskTypeCode} display text tripped: ${blocking.map((m) => m.ruleId).join(", ")}`,
      ).toHaveLength(0);
    }
  });

  it("CMP_CLOSING_DISC is borrower-visible with the closing-prep line", () => {
    const mapping = TASK_TYPE_SLA_MAPPING_SEED.find((m) => m.taskTypeCode === "CMP_CLOSING_DISC");
    expect(mapping?.visibleToBorrower).toBe(true);
    expect(mapping?.borrowerDisplayText).toBe("We're preparing your closing paperwork.");
  });
});

describe("column classification is exhaustive against the live table", () => {
  const columns = Object.keys(getTableColumns(tasks));
  const allowed = new Set<string>(BORROWER_TASK_VIEW_COLUMNS);
  const embargoed = new Set<string>(BORROWER_TASK_EMBARGOED_COLUMNS);

  it("classifies every tasks column as allowed or embargoed — a new column fails here until it is classified deliberately", () => {
    expect(columns.filter((c) => !allowed.has(c) && !embargoed.has(c))).toEqual([]);
  });

  it("never classifies a column both ways, and never classifies a phantom column", () => {
    expect(BORROWER_TASK_VIEW_COLUMNS.filter((c) => embargoed.has(c))).toEqual([]);
    expect([...allowed, ...embargoed].filter((c) => !columns.includes(c))).toEqual([]);
  });
});

describe("toBorrowerTaskView — plain /api/tasks-family rows", () => {
  // A plain storage row: no derived SLA trio, but every staff column set —
  // what GET /api/tasks | /user/:userId | /application/:id | /:id serve.
  const plainRow = () =>
    ({
      ...borrowerTask(),
      slaStatus: undefined,
      timeRemaining: undefined,
      percentageElapsed: undefined,
      ...(rawRowHazards as Partial<MaskableBorrowerTask>),
      aiAnalysisResult: { flag: "INCOME_MISMATCH" },
      extractedData: { wages: 88450.23, employer: "Acme Corp" },
      triggerMetadata: { rule: "UW-INCOME-004" },
      verifiedAt: new Date("2026-08-03T00:00:00Z"),
      completedAt: null,
      assignedToUserId: "borrower-user-1",
    }) as MaskableBorrowerTask;

  it("omits the SLA keys entirely when the source row has no derived trio", () => {
    const view = toBorrowerTaskView(plainRow(), "borrower-user-1");
    expect(view).not.toHaveProperty("slaStatus");
    expect(view).not.toHaveProperty("timeRemaining");
    expect(view).not.toHaveProperty("percentageElapsed");
  });

  it("keeps the verdict timestamp but never the machine payloads", () => {
    const view = toBorrowerTaskView(plainRow(), "borrower-user-1");
    expect(view.verifiedAt).toEqual(new Date("2026-08-03T00:00:00Z"));
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("INCOME_MISMATCH");
    expect(serialized).not.toContain("Acme Corp");
    expect(serialized).not.toContain("UW-INCOME-004");
    for (const field of BORROWER_TASK_EMBARGOED_COLUMNS) {
      expect(view, `embargoed column leaked: ${field}`).not.toHaveProperty(field);
    }
  });

  it("keeps assignedToUserId only for the viewer's own assignment (upload gating)", () => {
    expect(toBorrowerTaskView(plainRow(), "borrower-user-1").assignedToUserId).toBe(
      "borrower-user-1",
    );
    // Someone else's assignee id — including staff — is never emitted.
    expect(toBorrowerTaskView(plainRow(), "other-user")).not.toHaveProperty("assignedToUserId");
    // No viewer supplied (the borrower-tasks endpoint): never emitted.
    expect(toBorrowerTaskView(plainRow())).not.toHaveProperty("assignedToUserId");
  });
});

describe("toBorrowerTaskDocumentView", () => {
  const makeTaskDoc = (): TaskDocument => ({
    id: "taskdoc-1",
    taskId: "t-1",
    documentId: "doc-1",
    isVerified: false,
    verificationNotes: "Statement page 2 missing — could hide an undisclosed liability.",
    createdAt: new Date("2026-08-02T00:00:00Z"),
  });

  it("drops the per-document staff review text and keeps the link facts", () => {
    const view = toBorrowerTaskDocumentView(makeTaskDoc()) as unknown as Record<string, unknown>;
    expect(view).not.toHaveProperty("verificationNotes");
    expect(JSON.stringify(view)).not.toContain("undisclosed liability");
    expect(view.id).toBe("taskdoc-1");
    expect(view.taskId).toBe("t-1");
    expect(view.documentId).toBe("doc-1");
    expect(view.isVerified).toBe(false);
  });

  it("passes the joined borrower document through minus the server-only fields, and omits the key when absent", () => {
    const doc = {
      id: "doc-1",
      fileName: "w2-2023.pdf",
      rejectionReason: "Please upload all pages.",
      reviewedByUserId: "staff-user-99",
      extractionRawEncrypted: "ZW5jcnlwdGVkLWNpcGhlcnRleHQ=",
      extractionRawIv: "aXYtYnl0ZXM=",
      extractionRawKeyId: "key-2026-08",
    } as unknown as Document;
    const joined = toBorrowerTaskDocumentView({ ...makeTaskDoc(), document: doc });
    // publicExtraction() doctrine: ciphertext/IV/key never reach a client;
    // the staff reviewer id is masked like the task view's staff ids.
    expect(joined.document).toEqual({
      id: "doc-1",
      fileName: "w2-2023.pdf",
      rejectionReason: "Please upload all pages.",
    });
    const serialized = JSON.stringify(joined);
    expect(serialized).not.toContain("ZW5jcnlwdGVkLWNpcGhlcnRleHQ=");
    expect(serialized).not.toContain("key-2026-08");
    expect(serialized).not.toContain("staff-user-99");

    expect(toBorrowerTaskDocumentView(makeTaskDoc())).not.toHaveProperty("document");
  });
});
