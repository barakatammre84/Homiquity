import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The borrower's Autopilot banner headline (server/services/autopilot/events.ts).
 *
 * THE DEFECT THIS PINS. `buildAutopilotStatus` derived the headline from a
 * single number — the count of conditions whose status is "outstanding" — and
 * fell to `clean` ("Looks good! No issues found.") whenever that number was 0.
 * Three unrelated situations produce 0:
 *
 *   1. items were raised and all are resolved  → the all-clear is TRUE
 *   2. nothing has ever been raised on the file → nothing was found because
 *      nothing was looked for
 *   3. the conditions read THREW — the old catch block was
 *      `catch { /* leave outstanding = 0 *\/ }`, so a database failure
 *      rendered as a green check and an affirmative all-clear
 *
 * (2) is what every borrower sees on a fresh file and (3) is the repo's
 * dominant defect class: an operation that did not happen while the UI says it
 * did. Both now have their own phase.
 */

const getLoanConditionsByApplication = vi.fn();
const evaluateBrokerSubmissionReadiness = vi.fn();

vi.mock("../server/storage", () => ({
  storage: {
    get getLoanConditionsByApplication() {
      return getLoanConditionsByApplication;
    },
  },
}));

vi.mock("../server/services/brokerSubmissionReadiness", () => ({
  get evaluateBrokerSubmissionReadiness() {
    return evaluateBrokerSubmissionReadiness;
  },
}));

const { buildAutopilotStatus, deriveAutopilotPhase, statusFingerprint } = await import(
  "../server/services/autopilot/events"
);

const condition = (status: string) => ({ status }) as never;

beforeEach(() => {
  getLoanConditionsByApplication.mockReset();
  evaluateBrokerSubmissionReadiness.mockReset();
  // Readiness is advisory and orthogonal to the phase; keep it boring.
  evaluateBrokerSubmissionReadiness.mockResolvedValue({
    readyToSubmitToLender: false,
    stages: [{ status: "ready" }, { status: "blocked" }, { status: "not_applicable" }],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("deriveAutopilotPhase — the four things a conditions read can mean", () => {
  it("an unread count outranks everything: it can support neither an all-clear nor a to-do", () => {
    expect(
      deriveAutopilotPhase({ conditionsKnown: false, conditionCount: 0, outstandingCount: 0 }),
    ).toBe("unavailable");
    // Even if stale counts were somehow non-zero, an unknown read asserts nothing.
    expect(
      deriveAutopilotPhase({ conditionsKnown: false, conditionCount: 9, outstandingCount: 4 }),
    ).toBe("unavailable");
  });

  it("outstanding items are items_needed", () => {
    expect(
      deriveAutopilotPhase({ conditionsKnown: true, conditionCount: 3, outstandingCount: 1 }),
    ).toBe("items_needed");
  });

  it("a file with NO conditions at all is no_items_yet, never clean", () => {
    expect(
      deriveAutopilotPhase({ conditionsKnown: true, conditionCount: 0, outstandingCount: 0 }),
    ).toBe("no_items_yet");
  });

  it("clean requires items to have existed and been resolved", () => {
    expect(
      deriveAutopilotPhase({ conditionsKnown: true, conditionCount: 4, outstandingCount: 0 }),
    ).toBe("clean");
  });
});

describe("buildAutopilotStatus — the snapshot only asserts what it read", () => {
  it("a brand-new file is NOT told 'Looks good! No issues found.'", async () => {
    getLoanConditionsByApplication.mockResolvedValue([]);
    const s = await buildAutopilotStatus("app-new");
    expect(s.phase).toBe("no_items_yet");
    expect(s.message).not.toMatch(/no issues found/i);
    expect(s.outstandingConditions).toBe(0);
  });

  it("a failed conditions read reports 'unavailable', not an all-clear", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    getLoanConditionsByApplication.mockRejectedValue(new Error("connection terminated"));
    const s = await buildAutopilotStatus("app-db-down");
    expect(s.phase).toBe("unavailable");
    expect(s.message).not.toMatch(/no issues found/i);
    // The failure is logged, not swallowed.
    expect(spy).toHaveBeenCalled();
    // Readiness still answered, so the meter is still honest.
    expect(s.readiness).toEqual({ completed: 1, total: 2 });
  });

  it("a fully-resolved file keeps the all-clear it has earned", async () => {
    getLoanConditionsByApplication.mockResolvedValue([
      condition("satisfied"),
      condition("waived"),
    ]);
    const s = await buildAutopilotStatus("app-clean");
    expect(s.phase).toBe("clean");
    expect(s.message).toBe("Looks good! No issues found.");
  });

  it("an outstanding condition still counts and still surfaces", async () => {
    getLoanConditionsByApplication.mockResolvedValue([
      condition("outstanding"),
      condition("outstanding"),
      condition("satisfied"),
    ]);
    const s = await buildAutopilotStatus("app-items");
    expect(s.phase).toBe("items_needed");
    expect(s.outstandingConditions).toBe(2);
  });

  it("the SSE change-detector can tell the new phases apart", async () => {
    // statusFingerprint drives whether a frame is pushed. If two phases hashed
    // the same, a file moving from 'unavailable' to a real answer would never
    // reach an open stream.
    const base = {
      applicationId: "a",
      message: "",
      outstandingConditions: 0,
      readyToSubmitToLender: false,
      readiness: { completed: 0, total: 0 },
      updatedAt: "",
    };
    const prints = (["clean", "no_items_yet", "unavailable"] as const).map((phase) =>
      statusFingerprint({ ...base, phase }),
    );
    expect(new Set(prints).size).toBe(3);
  });
});
