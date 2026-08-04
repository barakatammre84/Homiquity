import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { dealActivities } from "@shared/schema";
import { WHOLESALE_LENDERS } from "@shared/wholesaleLenders";
import {
  toBorrowerActivityView,
  toBorrowerActivityViews,
  BORROWER_ACTIVITY_VIEW_COLUMNS,
  BORROWER_ACTIVITY_EMBARGOED_COLUMNS,
  type MaskableDealActivity,
} from "@shared/borrowerActivityView";
import { lintOutboundText } from "@shared/compliance/loCommsLint";

/**
 * Borrower Clarity follow-up (§9 review of the borrowerConditionView PR,
 * 2026-08-04): the deal-activity feed leaked the two secrets the conditions
 * payload scrubbed — staff clearance notes ("Reason: <clearanceNotes>") and
 * wholesale-lender identity ("N condition(s) from <lender> logged"). The feed
 * payload is now a strict whitelist for non-staff callers, in the
 * borrowerOfferView pattern — field-absence is pinned here so a future edit
 * can't quietly re-expose staff free text, lender identity, or metadata by
 * spreading the row.
 */

// Default fixture rows are post-cutover (see WRITER_CONTRACT_CUTOVER in the
// view): written under the writer contract, so verbatim descriptions apply.
const activity = (over: Partial<MaskableDealActivity> = {}): MaskableDealActivity => ({
  id: "act-1",
  applicationId: "app-1",
  activityType: "status_change",
  title: "Application Submitted",
  description: "Your loan application has been received and is being analyzed.",
  metadata: null,
  performedBy: "borrower-user-1",
  createdAt: "2026-08-07T12:00:00.000Z",
  ...over,
});

describe("column classification stays total over the live table", () => {
  it("VIEW ∪ EMBARGOED covers every deal_activities column exactly once", () => {
    const live = Object.keys(getTableColumns(dealActivities)).sort();
    const classified = [
      ...BORROWER_ACTIVITY_VIEW_COLUMNS,
      ...BORROWER_ACTIVITY_EMBARGOED_COLUMNS,
    ].sort();
    // A new deal_activities column fails here until it is classified
    // deliberately — same gate mechanism as borrowerTaskView.test.ts.
    expect(classified).toEqual(live);
    const overlap = BORROWER_ACTIVITY_VIEW_COLUMNS.filter((c) =>
      (BORROWER_ACTIVITY_EMBARGOED_COLUMNS as readonly string[]).includes(c),
    );
    expect(overlap).toEqual([]);
  });
});

describe("condition events — staff clearance notes never travel", () => {
  const clearanceNotes = "internal: waived per UW mgr, comp factor — strong reserves, see credit memo";

  it.each([
    ["condition_waived", "Condition Waived"],
    ["condition_cleared", "Condition Cleared"],
    ["condition_not_applicable", "Condition No Longer Applies"],
  ])("%s replaces title/description with fixed copy and drops metadata.notes", (type, expectedTitle) => {
    const view = toBorrowerActivityView(
      activity({
        activityType: type,
        title: "Condition Waived",
        description: `"Verify 2023 bonus income" has been waived. Reason: ${clearanceNotes}`,
        metadata: { conditionId: "cond-9", notes: clearanceNotes },
        performedBy: "staff-user-42",
      }),
      "borrower-user-1",
    );
    expect(view).not.toBeNull();
    expect(view!.title).toBe(expectedTitle);
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain(clearanceNotes);
    expect(serialized).not.toContain("Reason:");
    expect(serialized).not.toContain("cond-9");
    expect(serialized).not.toContain("staff-user-42");
    expect(serialized).not.toContain("metadata");
  });
});

describe("lender_conditions_logged — wholesale identity never travels", () => {
  it("scrubs every cataloged lender's name and id out of the rebuilt copy", () => {
    expect(WHOLESALE_LENDERS.length).toBeGreaterThan(0);
    for (const lender of WHOLESALE_LENDERS) {
      const view = toBorrowerActivityView(
        activity({
          activityType: "lender_conditions_logged",
          title: "Lender conditions logged",
          description: `3 condition(s) from ${lender.name} logged for clearing.`,
          metadata: { submissionId: "sub-77", count: 3 },
          performedBy: "staff-user-42",
        }),
        "borrower-user-1",
      );
      expect(view).not.toBeNull();
      const serialized = JSON.stringify(view).toLowerCase();
      expect(serialized, `${lender.id} name leaked`).not.toContain(lender.name.toLowerCase());
      expect(serialized, `${lender.id} id leaked`).not.toContain(lender.id.toLowerCase());
      expect(serialized).not.toContain("sub-77");
      expect(view!.description).toBe("3 new condition(s) were added to your file for clearing.");
    }
  });

  it("falls back to countless copy when metadata carries no usable count", () => {
    const view = toBorrowerActivityView(
      activity({
        activityType: "lender_conditions_logged",
        description: "2 condition(s) from Angel Oak Mortgage Solutions logged for clearing.",
        metadata: { submissionId: "sub-77" },
      }),
    );
    expect(view!.description).toBe("New conditions were added to your file for clearing.");
  });
});

describe("application_withdrawn — free-text reason/details never travel", () => {
  it("replaces the description and drops metadata", () => {
    const view = toBorrowerActivityView(
      activity({
        activityType: "application_withdrawn",
        title: "Application Withdrawn",
        description:
          "Application withdrawn by staff. Reason: borrower unresponsive. Details: suspected straw-buyer pattern, see fraud queue",
        metadata: { reason: "borrower unresponsive", details: "suspected straw-buyer pattern" },
        performedBy: "staff-user-42",
      }),
      "borrower-user-1",
    );
    expect(view!.title).toBe("Application Withdrawn");
    expect(view!.description).toBe("The application was withdrawn.");
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("straw-buyer");
    expect(serialized).not.toContain("unresponsive");
  });
});

describe("internal and unknown types are dropped (default-deny)", () => {
  it.each([
    ["note"],
    ["autopilot_review"],
    ["compliance_event"],
    ["some_future_type"],
  ])("%s never reaches a client-role payload", (type) => {
    expect(toBorrowerActivityView(activity({ activityType: type }))).toBeNull();
  });

  it("toBorrowerActivityViews filters dropped rows out of the array", () => {
    const views = toBorrowerActivityViews([
      activity(),
      activity({ id: "act-2", activityType: "autopilot_review" }),
      activity({ id: "act-3", activityType: "document_uploaded", title: "Document Uploaded" }),
    ]);
    expect(views.map((v) => v.id)).toEqual(["act-1", "act-3"]);
  });
});

describe("verbatim types pass through scrubbed", () => {
  it("keeps derived borrower copy intact", () => {
    const view = toBorrowerActivityView(activity(), "borrower-user-1");
    expect(view!.title).toBe("Application Submitted");
    expect(view!.description).toBe("Your loan application has been received and is being analyzed.");
    expect(view!.performedBy).toBe("borrower-user-1");
    expect(view!.createdAt).toBe("2026-08-07T12:00:00.000Z");
  });

  it("scrubs wholesale-lender identity out of verbatim text", () => {
    const lender = WHOLESALE_LENDERS[0];
    const view = toBorrowerActivityView(
      activity({
        activityType: "status_change",
        title: `Status Updated after ${lender.name} response`,
        description: `Application status changed from submitted to conditional (${lender.name})`,
      }),
    );
    const serialized = JSON.stringify(view).toLowerCase();
    expect(serialized).not.toContain(lender.name.toLowerCase());
    expect(serialized).toContain("lender");
  });

  it("viewer-scopes performedBy — another user's id is dropped", () => {
    const staffPerformed = toBorrowerActivityView(
      activity({ performedBy: "staff-user-42" }),
      "borrower-user-1",
    );
    expect(staffPerformed!.performedBy).toBeUndefined();
    expect(JSON.stringify(staffPerformed)).not.toContain("staff-user-42");

    const unscoped = toBorrowerActivityView(activity({ performedBy: "staff-user-42" }));
    expect(unscoped!.performedBy).toBeUndefined();
  });

  it("never emits metadata even on verbatim types", () => {
    const view = toBorrowerActivityView(
      activity({ metadata: { notes: "internal: suspend pending fraud review" } }),
      "borrower-user-1",
    );
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("fraud");
    expect(serialized).not.toContain("metadata");
  });
});

describe("pre-contract legacy rows — historical staff free text never travels (§9 finding)", () => {
  const staffNote = "declining comp factor — suspected undisclosed MCA debt, see credit memo";

  it("masks the description of a pre-cutover status_change row, keeping the derived title", () => {
    const view = toBorrowerActivityView(
      activity({
        title: "Status Updated to SUSPENDED",
        description: staffNote,
        createdAt: "2026-08-01T09:00:00.000Z",
        performedBy: "staff-user-42",
      }),
      "borrower-user-1",
    );
    expect(view!.title).toBe("Status Updated to SUSPENDED");
    expect(view!.description).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain("MCA");
  });

  it("masks a pre-cutover document_uploaded description carrying a staff task title", () => {
    const view = toBorrowerActivityView(
      activity({
        activityType: "document_uploaded",
        title: "Document Uploaded for Task",
        description: "Document uploaded for task: internal fraud-queue recheck of bank statements",
        createdAt: "2026-08-01T09:00:00.000Z",
      }),
    );
    expect(view!.title).toBe("Document Uploaded for Task");
    expect(view!.description).toBeUndefined();
  });

  it("treats a missing createdAt as pre-contract (mask, never leak)", () => {
    const view = toBorrowerActivityView(
      activity({ description: staffNote, createdAt: null }),
    );
    expect(view!.description).toBeUndefined();
  });

  it("leaves other verbatim types untouched — their writers never embedded free text", () => {
    const view = toBorrowerActivityView(
      activity({
        activityType: "rate_locked",
        title: "Rate Locked",
        description: "Rate locked at 6.375% for 30 days",
        createdAt: "2026-08-01T09:00:00.000Z",
      }),
    );
    expect(view!.description).toBe("Rate locked at 6.375% for 30 days");
  });
});

describe("template copy stays inside the Reg N lexicon", () => {
  it("every fixed borrower string passes lintOutboundText with no hard blocks", () => {
    const templates = [
      "condition_cleared",
      "condition_waived",
      "condition_not_applicable",
      "lender_conditions_logged",
      "application_withdrawn",
    ]
      .map((type) => toBorrowerActivityView(activity({ activityType: type, metadata: { count: 2 } })))
      .flatMap((view) => [view!.title, view!.description!]);
    for (const text of templates) {
      const result = lintOutboundText(text);
      const blocking = [...result.triggerMatches, ...result.hardBlockMatches];
      expect(
        blocking,
        `"${text}" tripped: ${blocking.map((m) => m.ruleId).join(", ")}`,
      ).toHaveLength(0);
    }
  });
});
