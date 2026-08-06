import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// ensureAdverseActionForDenial — the single denial chokepoint (WF5-F2 fix,
// CONFIRMED-DEFECT under FCRA §615(a), 15 U.S.C. §1681m(a)).
//
// The defect: the auto-deny path could never set a consumer-report basis, so
// every auto-generated denial notice asserted a non-report basis even when a
// completed pull's score had been ingested and required by the decision
// engine — and fcraCompliant was stamped true unconditionally.
//
// The fix's three branches, pinned here THROUGH the real chokepoint against a
// stubbed database (same hermetic pattern as tests/taskCancellation.test.ts):
//   1. no completed pull      → ECOA-only notice (unchanged behavior);
//   2. completed SIMULATED pull → { ok:false } refusal the seams surface as a
//      422 — even when a notice already exists (a pre-generated ECOA-only
//      notice must not make a simulated-pull file deniable);
//   3. completed REAL pull    → notice threaded from the pull record: pull id,
//      representativeScore (authoritative over application.creditScore),
//      deterministic score source, score date, every furnishing CRA.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

const h = {
  latestPull: null as Row | null,
  existingActions: [] as Row[],
  inserts: [] as { values: Row }[],
  auditEntries: [] as Row[],
  reset() {
    this.latestPull = null;
    this.existingActions = [];
    this.inserts = [];
    this.auditEntries = [];
  },
};

// The chokepoint resolves the pull itself — that call is the seam under test.
vi.mock("../server/services/creditPulls", () => ({
  getLatestCreditPull: vi.fn(async () => h.latestPull),
}));

// The tamper-evident audit chain writes through its own db path; the
// assertions here are about WHAT was logged, not the hash chain.
vi.mock("../server/services/creditAuditChain", () => ({
  logCreditAction: vi.fn(async (entry: Row) => {
    h.auditEntries.push(entry);
  }),
}));

// getAdverseActionsByApplication: select().from().where().orderBy() → rows.
// generateAdverseAction: insert().values().returning() → [row].
vi.mock("../server/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ orderBy: async () => h.existingActions }),
      }),
    }),
    insert: () => ({
      values: (values: Row) => ({
        returning: async () => {
          h.inserts.push({ values });
          return [{ id: "aa-1", ...values }];
        },
      }),
    }),
  },
}));

import { ensureAdverseActionForDenial } from "../server/services/creditAdverseActions";

const realTriMergePull = (overrides: Row = {}): Row => ({
  id: "pull-real-1",
  applicationId: "app-1",
  status: "completed",
  isSimulated: false,
  bureaus: ["experian", "equifax", "transunion"],
  experianScore: 650,
  equifaxScore: 634,
  transunionScore: 620,
  representativeScore: 634,
  completedAt: new Date("2026-08-01T19:15:00Z"),
  ...overrides,
});

const denyParams = {
  applicationId: "app-1",
  userId: "borrower-1",
  denialReasons: ["Debt-to-income ratio", "Employment history"],
  creditScoreUsed: 634,
  generatedBy: "underwriter-1",
};

beforeEach(() => {
  h.reset();
});

describe("branch 1 — no completed pull: ECOA-only notice (unchanged behavior)", () => {
  it("generates a notice with no consumer-report claims and computes fcraCompliant true", async () => {
    const result = await ensureAdverseActionForDenial(denyParams);

    expect(result).toMatchObject({ ok: true, created: true, adverseActionId: "aa-1" });
    expect(h.inserts).toHaveLength(1);
    const row = h.inserts[0].values;
    expect(row.basedOnConsumerReport).toBe(false);
    // No §615(a) duty attached → the ECOA-only notice is the compliant one.
    expect(row.fcraCompliant).toBe(true);
    // Score/bureau fields must NOT be stored on a non-report-based notice.
    expect(row.creditScoreUsed).toBeUndefined();
    expect(row.creditScoreSource).toBeUndefined();
    expect(row.bureauName).toBeUndefined();
    expect(row.creditPullId).toBeUndefined();
    expect(String(row.noticeText)).not.toContain("FAIR CREDIT REPORTING ACT");
    expect(String(row.noticeText)).not.toContain("consumer reporting agency");
    expect(String(row.noticeText)).toContain("EQUAL CREDIT OPPORTUNITY ACT");
  });

  it("writes the adverse_action_generated audit entry (PII-touching mutation)", async () => {
    await ensureAdverseActionForDenial(denyParams);
    expect(h.auditEntries.some((e) => e.action === "adverse_action_generated")).toBe(true);
  });
});

describe("branch 2 — completed SIMULATED pull: the denial is refused", () => {
  it("returns { ok:false } with staff-safe copy that names NO bureau, and inserts nothing", async () => {
    h.latestPull = realTriMergePull({ isSimulated: true });

    const result = await ensureAdverseActionForDenial(denyParams);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/simulated/i);
    expect(result.error).toMatch(/615\(a\)/);
    // Fabricated attribution barred: simulated data was furnished by no CRA.
    expect(result.error).not.toMatch(/experian|equifax|transunion/i);
    expect(h.inserts).toHaveLength(0);
  });

  it("refuses even when a notice already exists — the no-op must not bypass the block", async () => {
    h.latestPull = realTriMergePull({ isSimulated: true });
    h.existingActions = [{ id: "aa-preexisting" }];

    const result = await ensureAdverseActionForDenial(denyParams);

    expect(result.ok).toBe(false);
    expect(result.adverseActionId).toBeUndefined();
  });

  // The refusal IS the compliance event. Returning only a 422 to the caller
  // left "show me every time you refused to act on simulated credit data"
  // with no answer in the tamper-evident chain.
  it("writes the refusal to the tamper-evident credit audit chain", async () => {
    h.latestPull = realTriMergePull({ isSimulated: true });

    await ensureAdverseActionForDenial(denyParams);

    const refusals = h.auditEntries.filter((e) => e.action === "adverse_action_refused");
    expect(refusals).toHaveLength(1);
    expect(refusals[0].applicationId).toBe(denyParams.applicationId);
    expect(refusals[0].actionDetails.reason).toBe("simulated_pull");
    expect(refusals[0].actionDetails.isSimulated).toBe(true);
  });

  // computeAuditEntryHash digests actionDetails but NOT the FK columns, so a
  // linkage recorded only in creditPullId would sit outside the hash and would
  // not be tamper-evident. It must appear in both places.
  it("carries the pull linkage inside the hashed actionDetails, not only the FK column", async () => {
    h.latestPull = realTriMergePull({ isSimulated: true });

    await ensureAdverseActionForDenial(denyParams);

    const [refusal] = h.auditEntries.filter((e) => e.action === "adverse_action_refused");
    expect(refusal.creditPullId).toBe("pull-real-1");
    expect(refusal.actionDetails.creditPullId).toBe("pull-real-1");
  });

  it("chains the refusal for an unattributable real pull too, with its own reason", async () => {
    h.latestPull = realTriMergePull({ bureaus: [], experianScore: null, equifaxScore: null, transunionScore: null });

    const result = await ensureAdverseActionForDenial(denyParams);

    expect(result.ok).toBe(false);
    const [refusal] = h.auditEntries.filter((e) => e.action === "adverse_action_refused");
    expect(refusal).toBeDefined();
    expect(refusal.actionDetails.reason).toBe("unattributable_score");
  });
});

describe("branch 3 — completed REAL pull: §615(a) content threaded from the pull record", () => {
  it("threads pull id, representative score, deterministic source, score date, and all furnishing CRAs", async () => {
    h.latestPull = realTriMergePull();

    // application.creditScore diverges from the pull — the pull must win.
    const result = await ensureAdverseActionForDenial({ ...denyParams, creditScoreUsed: 700 });

    expect(result).toMatchObject({ ok: true, created: true });
    expect(h.inserts).toHaveLength(1);
    const row = h.inserts[0].values;
    expect(row.basedOnConsumerReport).toBe(true);
    expect(row.creditPullId).toBe("pull-real-1");
    expect(row.creditScoreUsed).toBe(634); // pull's representativeScore, not 700
    expect(row.creditScoreSource).toBe("equifax"); // middle score, deterministic
    expect(row.bureauName).toBe("Equifax");

    const notice = String(row.noticeText);
    expect(notice).toContain("information obtained from a consumer reporting agency");
    expect(notice).toContain("Your credit score: 634");
    expect(notice).toContain(`Date of score: ${new Date("2026-08-01T19:15:00Z").toLocaleDateString()}`);
    // §1681m(a)(3): every furnishing CRA, not just the score source.
    expect(notice).toContain("CONSUMER REPORTING AGENCIES:");
    for (const name of ["Experian", "Equifax", "TransUnion"]) {
      expect(notice).toContain(name);
    }
  });

  it("computes fcraCompliant false while the §1681g(f)(1) score fields (key factors, provider, model range) cannot render (pre-F3)", async () => {
    h.latestPull = realTriMergePull();

    await ensureAdverseActionForDenial(denyParams);

    // Honest incompleteness: the notice discloses what exists but must not
    // self-certify §615(a) completeness without the model's key factors.
    expect(h.inserts[0].values.fcraCompliant).toBe(false);
  });

  it("no-ops (created:false) when a notice already exists on a real-pull file", async () => {
    h.latestPull = realTriMergePull();
    h.existingActions = [{ id: "aa-preexisting" }];

    const result = await ensureAdverseActionForDenial(denyParams);

    expect(result).toMatchObject({ ok: true, created: false, adverseActionId: "aa-preexisting" });
    expect(h.inserts).toHaveLength(0);
  });

  it("refuses when the representative score cannot be attributed to any bureau on the record", async () => {
    h.latestPull = realTriMergePull({
      experianScore: 700,
      equifaxScore: 690,
      transunionScore: 680,
      representativeScore: 634,
    });

    const result = await ensureAdverseActionForDenial(denyParams);

    expect(result.ok).toBe(false);
    expect(h.inserts).toHaveLength(0);
  });
});

describe("unmappable denial reasons still refuse (existing 422 path, unchanged)", () => {
  it("returns the compliance-endpoint pointer when no reason maps", async () => {
    const result = await ensureAdverseActionForDenial({ ...denyParams, denialReasons: ["Not a reason"] });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/could not be mapped/);
  });
});
