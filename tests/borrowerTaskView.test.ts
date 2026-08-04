import { describe, expect, it } from "vitest";
import {
  toBorrowerTaskView,
  toBorrowerTaskViews,
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
