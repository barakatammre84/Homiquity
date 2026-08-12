import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// FCRA consent gate — behavior, not source text (F-014, second slice).
//
// What this replaces. `tests/complianceInvariants.test.ts` guards this gate by
// reading strings out of the file:
//
//     expect(credit).toMatch(/Valid consent required before credit pull/);
//     expect(credit).toMatch(/does not belong to this borrower/);
//
// F-043 already recorded why that is worse than useless here: it asserts the
// presence of the ERROR MESSAGE of a gate that F-035 (open P0) says is
// insufficient. The compliance suite therefore certifies the defective gate and
// stays green through the entire F-034/F-035/F-040 cluster. A test that pins a
// string cannot tell you whether the check runs, whether it runs BEFORE the
// disclosure, or what it fails to check.
//
// So these tests call recordExternalSoftPull and assert what it actually does.
//
// TWO KINDS OF TEST LIVE HERE, and the distinction is deliberate:
//   1. PROTECTIONS — properties that hold today and must never regress. Normal
//      passing tests.
//   2. GAPS — things the gate does NOT check. Pinned as characterization tests
//      named "GAP (<finding>)", asserting today's behavior with an explicit note
//      on how to invert them once fixed. They are NOT an endorsement: a gap left
//      untested is a gap that gets silently re-introduced or silently "fixed"
//      with no one noticing which. Each says plainly what the right behavior is.
//
// Scope. This covers the AG-2 audited persistence path (recordExternalSoftPull).
// The separate requestCreditPull path in creditPulls.ts is where F-035's
// consentType hole actually bites; it is NOT touched here, because F-035 is an
// open P0 awaiting the U-12 legal decision on the consentType→pullType map, and
// writing a test that fixes the mapping by implication would pre-empt it.
// ---------------------------------------------------------------------------

const consentStore = new Map<string, any>();
const inserted: Array<{ table: string; values: any }> = [];

vi.mock("../server/services/creditConsents", () => ({
  getConsentById: async (id: string) => consentStore.get(id) ?? null,
  getActiveConsent: async () => null,
}));

// The audit chain writes are not under test; keep them inert but observable so
// a test can prove the gate rejected BEFORE anything was recorded.
const auditCalls: string[] = [];
vi.mock("../server/services/creditAuditChain", () => ({
  logCreditAction: async (...args: any[]) => {
    auditCalls.push(String(args[0]?.action ?? args[1] ?? "unknown"));
  },
  auditChainScopeKey: (id: string | null) => id ?? "null-scope",
  NULL_APPLICATION_SCOPE_KEY: "null-scope",
}));

vi.mock("../server/db", () => {
  const chain = (table: string) => ({
    values: (values: any) => {
      inserted.push({ table, values });
      return { returning: async () => [{ id: "pull_generated", ...values }] };
    },
  });
  return {
    db: {
      insert: (t: any) => chain(t?.[Symbol.for("drizzle:Name")] ?? "unknown"),
      select: () => ({
        from: () => ({
          where: () => ({ orderBy: () => ({ limit: async () => [] }) }),
        }),
      }),
      transaction: async (fn: any) =>
        fn({
          insert: (t: any) => chain(t?.[Symbol.for("drizzle:Name")] ?? "unknown"),
          select: () => ({
            from: () => ({ where: () => ({ for: () => ({ limit: async () => [] }) }) }),
          }),
          update: () => ({ set: () => ({ where: async () => undefined }) }),
        }),
    },
  };
});

import { recordExternalSoftPull } from "../server/services/creditAudit";

const BORROWER = "user_borrower_1";
const OTHER_BORROWER = "user_borrower_2";
const APP = "app_1";

function consent(overrides: Record<string, unknown> = {}) {
  return {
    id: "consent_1",
    applicationId: APP,
    userId: BORROWER,
    consentGiven: true,
    isActive: true,
    consentType: "soft_pull",
    consentTimestamp: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function vendorPayload() {
  return {
    vendorRequestId: "vendor_req_1",
    experianScore: 720,
    equifaxScore: 715,
    transunionScore: 725,
    representativeScore: 720,
    vantageScore4: 700,
    tradelines: [],
    totalDebt: 1000,
    totalMonthlyPayments: 250,
  };
}

const pull = (over: Record<string, unknown> = {}) =>
  recordExternalSoftPull({
    applicationId: APP,
    consentId: "consent_1",
    requestedBy: BORROWER,
    expiresAt: new Date("2026-12-31T00:00:00Z"),
    vendor: vendorPayload() as never,
    ...over,
  });

beforeEach(() => {
  consentStore.clear();
  inserted.length = 0;
  auditCalls.length = 0;
});

// ---------------------------------------------------------------------------
// 1. PROTECTIONS — must never regress.
// ---------------------------------------------------------------------------
describe("FCRA gate: protections that must not regress", () => {
  it("refuses when no consent row exists", async () => {
    await expect(pull()).rejects.toThrow(/Valid consent required/);
  });

  it("refuses a consent the borrower never gave (consentGiven false)", async () => {
    consentStore.set("consent_1", consent({ consentGiven: false }));
    await expect(pull()).rejects.toThrow(/Valid consent required/);
  });

  it("refuses a REVOKED consent (isActive false)", async () => {
    consentStore.set("consent_1", consent({ isActive: false }));
    await expect(pull()).rejects.toThrow(/Valid consent required/);
  });

  it("refuses another borrower's consent — no cross-borrower permissible purpose", async () => {
    consentStore.set("consent_1", consent({ userId: OTHER_BORROWER }));
    await expect(pull()).rejects.toThrow(/does not belong to this borrower/);
  });

  it("persists NOTHING when it refuses — the refusal precedes every write", async () => {
    consentStore.set("consent_1", consent({ isActive: false }));
    await expect(pull()).rejects.toThrow();
    // This is the property the string-grep could never express: not merely that
    // an error message exists in the file, but that no credit_pulls row and no
    // audit entry were created on the refusal path.
    expect(inserted).toEqual([]);
    expect(auditCalls).toEqual([]);
  });

  it("proceeds on a valid, active, owned consent", async () => {
    consentStore.set("consent_1", consent());
    await expect(pull()).resolves.toBeDefined();
    expect(inserted.length).toBeGreaterThan(0);
  });

  it("records the pull as SOFT regardless of caller input — this path cannot emit a hard inquiry", async () => {
    consentStore.set("consent_1", consent());
    await pull();
    const row = inserted.find((i) => "pullType" in (i.values ?? {}));
    expect(row?.values.pullType).toBe("soft");
  });
});

// ---------------------------------------------------------------------------
// 2. GAPS — what the gate does NOT check. Pinned, named, and reversible.
// ---------------------------------------------------------------------------
describe("FCRA gate: known gaps, pinned so they cannot move silently", () => {
  it("GAP (F-052): accepts a consent belonging to a DIFFERENT application", async () => {
    // The gate resolves the consent by id and checks the BORROWER owns it, but
    // never checks the consent's applicationId matches the application the pull
    // is recorded against. A borrower with two files can therefore have a pull
    // on file B authorized by the consent they signed for file A, and the
    // credit_pulls row will link them.
    //
    // CORRECT BEHAVIOUR when fixed: this must reject. Invert to
    // `await expect(...).rejects.toThrow(/does not belong to this application/)`
    // and delete this comment.
    consentStore.set("consent_1", consent({ applicationId: "a_different_app" }));
    await expect(pull()).resolves.toBeDefined();
  });

  it("GAP (F-040): accepts a consent of ANY age — no expiry is enforced", async () => {
    // credit_consents has no expiry column at all (F-040), while the disclosure
    // text stored on the row promises 120-day validity. A consent signed years
    // ago still authorizes a pull today.
    //
    // CORRECT BEHAVIOUR when fixed: a consent older than the ledgered validity
    // period must reject. Invert once F-040's column + gate land.
    consentStore.set(
      "consent_1",
      consent({ consentTimestamp: new Date("2019-01-01T00:00:00Z") }),
    );
    await expect(pull()).resolves.toBeDefined();
  });

  it("GAP (F-035 family): consentType is not read on this path either", async () => {
    // This path hardcodes pullType "soft", so a mis-scoped consent cannot
    // produce a hard inquiry HERE — which is why this is the mild instance and
    // F-035's requestCreditPull is the severe one. Pinned anyway so the
    // taxonomy's total absence from the credit subsystem is visible in one
    // place: a consent explicitly scoped to something else still passes.
    //
    // Deliberately NOT "fixed" by this test: the consentType→pullType map is a
    // legal reading escalated as U-12, not an engineering choice.
    consentStore.set("consent_1", consent({ consentType: "hard_pull" }));
    await expect(pull()).resolves.toBeDefined();
  });
});
