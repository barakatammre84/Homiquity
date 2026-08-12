import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  planCreditScoreEvents,
  DEFAULT_LOOKBACK_HOURS,
  type CreditPullSnapshot,
} from "../server/services/creditMonitoring";

/**
 * The credit-monitoring planner — the producer for an event socket that existed
 * unfired since it was built (`emitCreditEvent` had zero callers).
 *
 * Pure in-process: the planner takes its clock as a parameter, so none of this
 * touches a database or a wall clock.
 */

const NOW = new Date("2026-08-08T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);
const opts = { now: NOW, lookbackHours: DEFAULT_LOOKBACK_HOURS };

const pull = (over: Partial<CreditPullSnapshot> = {}): CreditPullSnapshot => ({
  applicationId: "app-1",
  representativeScore: 700,
  completedAt: hoursAgo(1),
  isSimulated: false,
  ...over,
});

describe("planCreditScoreEvents", () => {
  it("emits one event for a drop between the two most recent completed pulls", () => {
    const events = planCreditScoreEvents(
      [
        pull({ representativeScore: 700, completedAt: hoursAgo(48) }),
        pull({ representativeScore: 655, completedAt: hoursAgo(2) }),
      ],
      opts,
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ applicationId: "app-1", previousScore: 700, newScore: 655, delta: -45 });
  });

  it("is order-independent — input ordering must not decide the delta's sign", () => {
    const rows = [
      pull({ representativeScore: 655, completedAt: hoursAgo(2) }),
      pull({ representativeScore: 700, completedAt: hoursAgo(48) }),
    ];
    expect(planCreditScoreEvents(rows, opts)[0].delta).toBe(-45);
    expect(planCreditScoreEvents([...rows].reverse(), opts)[0].delta).toBe(-45);
  });

  it("emits nothing when the score rose", () => {
    // Upward crossings are the pitch's "intercept at 620/680". There is no
    // score-improved event type, and firing CREDIT_SCORE_DROPPED for a rise would put a
    // false statement in the event log's type column.
    expect(
      planCreditScoreEvents(
        [
          pull({ representativeScore: 610, completedAt: hoursAgo(48) }),
          pull({ representativeScore: 665, completedAt: hoursAgo(2) }),
        ],
        opts,
      ),
    ).toEqual([]);
  });

  it("emits nothing when the score is unchanged", () => {
    expect(
      planCreditScoreEvents(
        [
          pull({ representativeScore: 700, completedAt: hoursAgo(48) }),
          pull({ representativeScore: 700, completedAt: hoursAgo(2) }),
        ],
        opts,
      ),
    ).toEqual([]);
  });

  // THE IDEMPOTENCY GUARD. emitCreditEvent builds its key as
  // `credit_${type}_${applicationId}_${Date.now()}`, so it does NOT dedupe: without the
  // window, a daily sweep would re-emit the same delta between the same two pulls every
  // day forever, creating a fresh staff task each run.
  it("does not re-emit once the newer pull falls outside the lookback window", () => {
    const stale = [
      pull({ representativeScore: 700, completedAt: hoursAgo(96) }),
      pull({ representativeScore: 655, completedAt: hoursAgo(30) }),
    ];
    expect(planCreditScoreEvents(stale, opts)).toEqual([]);
    // ...and the same data DOES fire under a window wide enough to include it.
    expect(planCreditScoreEvents(stale, { now: NOW, lookbackHours: 72 })).toHaveLength(1);
  });

  it("needs two comparable pulls — a first-ever pull is not a change", () => {
    expect(planCreditScoreEvents([pull()], opts)).toEqual([]);
  });

  it("ignores pulls with no representative score rather than coercing one", () => {
    // Comparing a single-bureau or VantageScore against a representative score would mix
    // score models across a delta and produce a number that means nothing.
    const events = planCreditScoreEvents(
      [
        pull({ representativeScore: null, completedAt: hoursAgo(48) }),
        pull({ representativeScore: 655, completedAt: hoursAgo(2) }),
      ],
      opts,
    );
    expect(events).toEqual([]);
  });

  it("ignores pulls with no completion timestamp", () => {
    expect(
      planCreditScoreEvents(
        [pull({ completedAt: null }), pull({ representativeScore: 655, completedAt: hoursAgo(2) })],
        opts,
      ),
    ).toEqual([]);
  });

  it("keeps applications independent and returns them in a stable order", () => {
    const events = planCreditScoreEvents(
      [
        pull({ applicationId: "app-b", representativeScore: 720, completedAt: hoursAgo(48) }),
        pull({ applicationId: "app-b", representativeScore: 700, completedAt: hoursAgo(2) }),
        pull({ applicationId: "app-a", representativeScore: 640, completedAt: hoursAgo(48) }),
        pull({ applicationId: "app-a", representativeScore: 600, completedAt: hoursAgo(3) }),
      ],
      opts,
    );
    expect(events.map((e) => e.applicationId)).toEqual(["app-a", "app-b"]);
    expect(events.map((e) => e.delta)).toEqual([-40, -20]);
  });

  it("compares only the two MOST RECENT pulls, not the oldest and newest", () => {
    const events = planCreditScoreEvents(
      [
        pull({ representativeScore: 500, completedAt: hoursAgo(200) }),
        pull({ representativeScore: 700, completedAt: hoursAgo(48) }),
        pull({ representativeScore: 690, completedAt: hoursAgo(2) }),
      ],
      opts,
    );
    expect(events[0].delta).toBe(-10);
  });

  it("marks the event simulated when either side was a fabricated pull", () => {
    // Every pull is simulated today — there is no live bureau adapter. A reviewer must
    // never be asked to act on a fabricated score without being told it is fabricated.
    const events = planCreditScoreEvents(
      [
        pull({ representativeScore: 700, completedAt: hoursAgo(48), isSimulated: true }),
        pull({ representativeScore: 655, completedAt: hoursAgo(2), isSimulated: false }),
      ],
      opts,
    );
    expect(events[0].simulated).toBe(true);
  });
});

describe("no invented materiality threshold", () => {
  it("any decrease fires — no hardcoded point cutoff exists", () => {
    // A "only if it drops more than N" rule needs N, and N would be a policy number
    // invented here. Policy numbers come from the seeded, cited lookup matrices
    // (lookupResolver.resolveMatrixValue throws rather than falling back, by Fair Lending
    // design). Inventing 20 to keep the queue quiet is what that rule prevents.
    const events = planCreditScoreEvents(
      [
        pull({ representativeScore: 700, completedAt: hoursAgo(48) }),
        pull({ representativeScore: 699, completedAt: hoursAgo(2) }),
      ],
      opts,
    );
    expect(events).toHaveLength(1);

    const src = fs.readFileSync(
      path.join(path.resolve(__dirname, ".."), "server/services/creditMonitoring.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/(MATERIAL|MIN|THRESHOLD|CUTOFF)[A-Z_]*\s*=\s*\d/);
  });
});

describe("the sweep is staff-side only", () => {
  it("emits no borrower-facing notification or message from the monitoring path", () => {
    const src = fs.readFileSync(
      path.join(path.resolve(__dirname, ".."), "server/services/creditMonitoring.ts"),
      "utf8",
    );
    // The pitch wants the borrower intercepted the moment a threshold is crossed. This
    // repo models no FCRA permissible purpose, and LICENSED_STATES is ["IL"], so the
    // output is a task for a human — never outreach.
    expect(src).not.toMatch(/sendNotificationEmail|createNotification|evaluateOutboundSms/);
  });
});
