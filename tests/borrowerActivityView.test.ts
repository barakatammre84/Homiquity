import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { dealActivities } from "@shared/schema";
import { buildLenderIdentifiers } from "@shared/borrowerConditionView";
import { TARGET_LENDERS } from "../server/seedData/wholesaleLenderTargets";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  toBorrowerActivityView,
  toBorrowerActivityViews,
  hasWriterContract,
  BORROWER_ACTIVITY_VIEW_COLUMNS,
  BORROWER_ACTIVITY_EMBARGOED_COLUMNS,
  WRITER_CONTRACT_KEY,
  WRITER_CONTRACT_VERSION,
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

/** What storage.createDealActivity stamps onto every row it writes. */
const CONTRACT_META = { [WRITER_CONTRACT_KEY]: WRITER_CONTRACT_VERSION };

// Default fixture rows carry the writer-contract marker — i.e. they were
// written by post-fix code, so their descriptions are derived copy.
const activity = (over: Partial<MaskableDealActivity> = {}): MaskableDealActivity => ({
  id: "act-1",
  applicationId: "app-1",
  activityType: "status_change",
  title: "Application Submitted",
  description: "Your loan application has been received and is being analyzed.",
  metadata: CONTRACT_META,
  performedBy: "borrower-user-1",
  createdAt: "2026-08-04T12:00:00.000Z",
  ...over,
});

const LENDER_IDS = buildLenderIdentifiers(TARGET_LENDERS);

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
      }), LENDER_IDS,
      "borrower-user-1");
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
    expect(TARGET_LENDERS.length).toBeGreaterThan(0);
    for (const lender of TARGET_LENDERS) {
      const view = toBorrowerActivityView(
        activity({
          activityType: "lender_conditions_logged",
          title: "Lender conditions logged",
          description: `3 condition(s) from ${lender.lenderName} logged for clearing.`,
          metadata: { submissionId: "sub-77", count: 3 },
          performedBy: "staff-user-42",
        }), LENDER_IDS,
        "borrower-user-1");
      expect(view).not.toBeNull();
      const serialized = JSON.stringify(view).toLowerCase();
      expect(serialized, `${lender.lenderId} name leaked`).not.toContain(lender.lenderName.toLowerCase());
      expect(serialized, `${lender.lenderId} id leaked`).not.toContain(lender.lenderId.toLowerCase());
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
      }), LENDER_IDS);
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
      }), LENDER_IDS,
      "borrower-user-1");
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
    expect(toBorrowerActivityView(activity({ activityType: type }), LENDER_IDS)).toBeNull();
  });

  it("toBorrowerActivityViews filters dropped rows out of the array", () => {
    const views = toBorrowerActivityViews([
      activity(),
      activity({ id: "act-2", activityType: "autopilot_review" }),
      activity({ id: "act-3", activityType: "document_uploaded", title: "Document Uploaded" }),
    ], LENDER_IDS);
    expect(views.map((v) => v.id)).toEqual(["act-1", "act-3"]);
  });
});

describe("verbatim types pass through scrubbed", () => {
  it("keeps derived borrower copy intact", () => {
    const view = toBorrowerActivityView(activity(), LENDER_IDS, "borrower-user-1");
    expect(view!.title).toBe("Application Submitted");
    expect(view!.description).toBe("Your loan application has been received and is being analyzed.");
    expect(view!.performedBy).toBe("borrower-user-1");
    expect(view!.createdAt).toBe("2026-08-04T12:00:00.000Z");
  });

  it("scrubs wholesale-lender identity out of verbatim text", () => {
    const lender = TARGET_LENDERS[0];
    const view = toBorrowerActivityView(
      activity({
        activityType: "status_change",
        title: `Status Updated after ${lender.lenderName} response`,
        description: `Application status changed from submitted to conditional (${lender.lenderName})`,
      }), LENDER_IDS);
    const serialized = JSON.stringify(view).toLowerCase();
    expect(serialized).not.toContain(lender.lenderName.toLowerCase());
    expect(serialized).toContain("lender");
  });

  it("viewer-scopes performedBy — another user's id is dropped", () => {
    const staffPerformed = toBorrowerActivityView(
      activity({ performedBy: "staff-user-42" }), LENDER_IDS,
      "borrower-user-1");
    expect(staffPerformed!.performedBy).toBeUndefined();
    expect(JSON.stringify(staffPerformed)).not.toContain("staff-user-42");

    const unscoped = toBorrowerActivityView(activity({ performedBy: "staff-user-42" }), LENDER_IDS);
    expect(unscoped!.performedBy).toBeUndefined();
  });

  it("never emits metadata even on verbatim types", () => {
    const view = toBorrowerActivityView(
      activity({ metadata: { notes: "internal: suspend pending fraud review" } }), LENDER_IDS,
      "borrower-user-1");
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("fraud");
    expect(serialized).not.toContain("metadata");
  });
});

describe("pre-contract legacy rows — historical staff free text never travels (§9 finding)", () => {
  const staffNote = "declining comp factor — suspected undisclosed MCA debt, see credit memo";
  /** A row written before the contract: no marker, whatever else it carries. */
  const legacy = (over: Partial<MaskableDealActivity>) => activity({ metadata: null, ...over });

  it("masks the description of an unmarked status_change row, keeping the derived title", () => {
    const view = toBorrowerActivityView(
      legacy({
        title: "Status Updated to SUSPENDED",
        description: staffNote,
        performedBy: "staff-user-42",
      }), LENDER_IDS,
      "borrower-user-1");
    expect(view!.title).toBe("Status Updated to SUSPENDED");
    expect(view!.description).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain("MCA");
  });

  it("masks an unmarked document_uploaded description carrying a staff task title", () => {
    const view = toBorrowerActivityView(
      legacy({
        activityType: "document_uploaded",
        title: "Document Uploaded for Task",
        description: "Document uploaded for task: internal fraud-queue recheck of bank statements",
      }), LENDER_IDS);
    expect(view!.title).toBe("Document Uploaded for Task");
    expect(view!.description).toBeUndefined();
  });

  it("masks a legacy row that carries staff metadata but no marker", () => {
    const view = toBorrowerActivityView(
      legacy({ description: staffNote, metadata: { notes: staffNote } }), LENDER_IDS);
    expect(view!.description).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain("MCA");
  });

  it("rejects near-miss markers — wrong version, wrong shape, array metadata", () => {
    for (const metadata of [
      { [WRITER_CONTRACT_KEY]: 0 },
      { [WRITER_CONTRACT_KEY]: "1" },
      { [WRITER_CONTRACT_KEY]: true },
      [WRITER_CONTRACT_KEY],
      "writerContract",
      null,
      undefined,
    ]) {
      expect(hasWriterContract(metadata), JSON.stringify(metadata)).toBe(false);
      expect(toBorrowerActivityView(activity({ description: staffNote, metadata }), LENDER_IDS)!.description)
        .toBeUndefined();
    }
    expect(hasWriterContract(CONTRACT_META)).toBe(true);
  });

  it("timestamps do NOT gate the description — created_at carries no reliable zone", () => {
    // created_at is `timestamp without time zone` filled by the column default,
    // so the same instant reads hours apart depending on the writing session's
    // timezone. A marked row shows its description regardless of its date; an
    // unmarked one is masked regardless of how recent it looks.
    for (const createdAt of ["2020-01-01T00:00:00.000Z", "2099-01-01T00:00:00.000Z", null]) {
      expect(toBorrowerActivityView(activity({ createdAt }), LENDER_IDS)!.description).toBe(
        "Your loan application has been received and is being analyzed.",
      );
      expect(toBorrowerActivityView(legacy({ createdAt }), LENDER_IDS)!.description).toBeUndefined();
    }
  });

  it("leaves other verbatim types untouched — their writers never embedded free text", () => {
    const view = toBorrowerActivityView(
      legacy({
        activityType: "rate_locked",
        title: "Rate Locked",
        description: "Rate locked at 6.375% for 30 days",
      }), LENDER_IDS);
    expect(view!.description).toBe("Rate locked at 6.375% for 30 days");
  });
});

describe("the insert chokepoint stamps the marker", () => {
  it("storage.createDealActivity is the only writer and applies WRITER_CONTRACT_KEY", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../server/storage/applications.ts", import.meta.url)),
      "utf8",
    );
    const body = src.slice(src.indexOf("async createDealActivity"));
    expect(body).toContain("WRITER_CONTRACT_KEY");
    expect(body).toContain("WRITER_CONTRACT_VERSION");
    // Guard the merge: a caller-supplied metadata object must survive alongside
    // the marker, or writers like the condition handlers silently lose notes.
    expect(body).toMatch(/\.\.\.caller/);
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
      .map((type) => toBorrowerActivityView(activity({ activityType: type, metadata: { count: 2 } }), LENDER_IDS))
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
