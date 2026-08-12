// #450 — "Remove Co-Borrower" silently reverted.
//
// The button was local state only. The bulk save is upsert-only and omitted
// `coApplicants` entirely when the flag was false, so nothing was deleted; the
// post-save refetch then found the seq-2 rows still present, the six-way
// `hasCo` check computed true, and the co-borrower reappeared — after a success
// toast. A co-applicant the borrower had deliberately removed stayed on the
// loan file and was still exported to MISMO.
//
// Removal is now a real, ownership-checked, audited DELETE. These pins cover
// the parts that are dangerous to get wrong:
//   - it must refuse the PRIMARY borrower (seq <= 1) — that request would wipe
//     the applicant's own file;
//   - it must be scoped to the application AND the exact sequence;
//   - it must not run for someone else's application;
//   - it must write an audit entry, because once the rows are gone the audit
//     log is the only remaining evidence of what was removed.
//
// Hermetic: the real route on an express app over an ephemeral port with a stub
// storage — same pattern as tests/urlaLoanDetailsSave.test.ts.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";

vi.mock("../server/auth", () => ({
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
}));

const logAuditMock = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("../server/auditLog", () => ({ logAudit: logAuditMock }));

vi.mock("../server/services/trid", () => ({
  evaluateTridTrigger: vi.fn(async () => ({ justTriggered: false, leDueDate: null })),
}));
vi.mock("../server/services/decisionEngine", () => ({
  recalculateDecision: vi.fn(async () => null),
}));
vi.mock("../server/services/autopilot/config", () => ({
  getAutopilotConfig: vi.fn(async () => ({ enabled: false })),
}));

const h = {
  applications: [] as { id: string; userId: string }[],
  deleteCalls: [] as { applicationId: string; seq: number }[],
  reset() {
    this.applications = [];
    this.deleteCalls = [];
  },
};

const storageStub = {
  getLoanApplicationWithAccess: async (id: string, userId: string, role: string) => {
    const app = h.applications.find((a) => a.id === id);
    if (!app) return undefined;
    const staff = ["admin", "lo", "processor", "underwriter"].includes(role);
    if (!staff && app.userId !== userId) return undefined;
    return app;
  },
  // Mirrors the real method's guard so the contract is pinned on both sides.
  deleteCoApplicantRecords: async (applicationId: string, seq: number) => {
    if (!Number.isInteger(seq) || seq <= 1) {
      throw new Error(`Refusing to delete borrower sequence ${seq}`);
    }
    h.deleteCalls.push({ applicationId, seq });
    return { personalInfo: 1, employmentHistory: 2, assets: 1, liabilities: 0, declarations: 1, demographics: 1 };
  },
} as any;

describe("DELETE /api/urla/:applicationId/co-applicant/:seq", () => {
  let server: import("node:http").Server;
  let base: string;
  let currentUser: { id: string; role: string };

  beforeAll(async () => {
    const express = (await import("express")).default;
    const { registerUrlaRoutes } = await import("../server/routes/borrower/urla");
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = currentUser;
      next();
    });
    registerUrlaRoutes(app, storageStub);
    server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(() => server?.close());

  beforeEach(() => {
    h.reset();
    logAuditMock.mockClear();
    currentUser = { id: "borrower-1", role: "aspiring_owner" };
    h.applications.push({ id: "app-1", userId: "borrower-1" });
  });

  const remove = (seq: string | number, appId = "app-1") =>
    fetch(`${base}/api/urla/${appId}/co-applicant/${seq}`, { method: "DELETE" });

  it("removes the co-applicant and reports what went", async () => {
    const res = await remove(2);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      removed: { personalInfo: 1, employmentHistory: 2 },
    });
    expect(h.deleteCalls).toEqual([{ applicationId: "app-1", seq: 2 }]);
  });

  it("REFUSES the primary borrower — that request would wipe the applicant's own file", async () => {
    for (const seq of [1, 0, -1]) {
      const res = await remove(seq);
      expect(res.status, `seq ${seq}`).toBe(400);
    }
    expect(h.deleteCalls).toEqual([]);
  });

  it("refuses a non-integer sequence rather than coercing it", async () => {
    for (const seq of ["abc", "2.5", ""]) {
      const res = await remove(seq);
      expect([400, 404]).toContain(res.status);
    }
    expect(h.deleteCalls).toEqual([]);
  });

  it("does not touch someone else's application", async () => {
    currentUser = { id: "someone-else", role: "aspiring_owner" };
    const res = await remove(2);
    expect(res.status).toBe(403);
    expect(h.deleteCalls).toEqual([]);
  });

  it("writes an audit entry naming the sequence and the per-table counts", async () => {
    // Once the rows are deleted this entry is the ONLY record that the removal
    // happened, and of what it took.
    await remove(2);
    expect(logAuditMock).toHaveBeenCalledTimes(1);
    const [, action, targetType, targetId, metadata] = logAuditMock.mock.calls[0] as any[];
    expect(action).toBe("urla.co_applicant.removed");
    expect(targetType).toBe("loan_application");
    expect(targetId).toBe("app-1");
    expect(metadata).toMatchObject({
      borrowerSequenceNumber: 2,
      removed: { personalInfo: 1, employmentHistory: 2 },
    });
  });

  it("does not audit a refused removal", async () => {
    await remove(1);
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("removes a sparse sequence exactly, never a range", async () => {
    // Sequences can be sparse or out of order — an application may carry only a
    // co-borrower #3. A `> 1` delete would take people the caller never named,
    // and on hmda_demographics sequence is the ONLY discriminator, because
    // borrowerId is the application's userId for every borrower.
    const res = await remove(3);
    expect(res.status).toBe(200);
    expect(h.deleteCalls).toEqual([{ applicationId: "app-1", seq: 3 }]);
  });
});
