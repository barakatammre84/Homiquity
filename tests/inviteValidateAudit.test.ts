import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerInviteRoutes } from "../server/routes/agent-broker/invites";
import type { IStorage } from "../server/storage";

// -----------------------------------------------------------------------------
// public-funnel-08 — GET /api/application-invites/validate/:token discloses the
// invitee's clientName and clientEmail to whoever holds the token, and wrote no
// audit entry for that read (contrary to CLAUDE.md's PII rule).
//
// The fix is one logAudit call, so the tests that matter are not "is it called"
// but WHAT IT RECORDS. An audit entry for a PII read is itself a security
// surface: get it wrong and the control becomes a second leak. Two properties
// carry the whole fix and each is pinned below —
//
//   1. the bearer token NEVER reaches the audit store. The token is a
//      capability (crypto.randomBytes(32)); recording it would let anyone with
//      audit-log read access replay the invite URL.
//   2. the PII VALUES never reach the audit store. Recording clientName /
//      clientEmail to prove they were disclosed would copy the borrower's name
//      and email into a second system — the opposite of the intent.
//
// Same stub-app approach as tests/twilioMessageStatus.test.ts: no HTTP server,
// no database.
// -----------------------------------------------------------------------------

const TOKEN = "b7f3a1c2d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f";

const auditCalls: Array<{
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}> = [];

vi.mock("../server/auditLog", () => ({
  logAudit: (
    _req: unknown,
    action: string,
    targetType?: string,
    targetId?: string,
    metadata?: Record<string, unknown>,
  ) => {
    auditCalls.push({ action, targetType, targetId, metadata });
  },
}));

type Handler = (req: any, res: any) => Promise<unknown>;

function captureValidateHandler(storage: Partial<IStorage>): Handler {
  const handlers = new Map<string, Handler>();
  const app = {
    get: (p: string, ...rest: unknown[]) => {
      handlers.set(p, rest[rest.length - 1] as Handler);
    },
    post: () => {},
    patch: () => {},
    delete: () => {},
    put: () => {},
  };
  registerInviteRoutes(app as never, storage as IStorage);
  const handler = handlers.get("/api/application-invites/validate/:token");
  if (!handler) throw new Error("validate route was not registered");
  return handler;
}

function fakeRes() {
  return {
    statusCode: 200,
    payload: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.payload = body; return this; },
  };
}

const fakeReq = () => ({
  params: { token: TOKEN },
  headers: { "user-agent": "vitest" },
  get(h: string) { return (this.headers as Record<string, string>)[h.toLowerCase()]; },
});

function invite(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv_0001",
    referrerId: "user_lo_42",
    clientName: "Dana Borrower",
    clientEmail: "dana.borrower@example.test",
    message: "Looking forward to working with you",
    token: TOKEN,
    status: "pending",
    expiresAt: new Date(Date.now() + 7 * 86_400_000),
    ...overrides,
  };
}

function storageFor(row: unknown) {
  return {
    getApplicationInviteByToken: vi.fn().mockResolvedValue(row),
    updateApplicationInvite: vi.fn().mockResolvedValue(undefined),
    getUser: vi.fn().mockResolvedValue({
      id: "user_lo_42",
      firstName: "Sam",
      lastName: "Officer",
      role: "lo",
      email: "sam.officer@homiquity.test",
    }),
  } as unknown as Partial<IStorage>;
}

describe("GET /api/application-invites/validate/:token — PII read audit", () => {
  beforeEach(() => { auditCalls.length = 0; });

  it("writes an audit entry when it discloses the invitee's name and email", async () => {
    const res = fakeRes();
    await captureValidateHandler(storageFor(invite()))(fakeReq(), res);

    // Precondition: the response really did disclose the PII this audits.
    expect(res.payload.invite.clientName).toBe("Dana Borrower");
    expect(res.payload.invite.clientEmail).toBe("dana.borrower@example.test");

    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]).toMatchObject({
      action: "application_invite.viewed",
      targetType: "application_invite",
      targetId: "inv_0001",
    });
  });

  it("never records the bearer token — it is a replayable capability", async () => {
    await captureValidateHandler(storageFor(invite()))(fakeReq(), fakeRes());

    const serialized = JSON.stringify(auditCalls);
    expect(serialized).not.toContain(TOKEN);
    // Guard the near-miss too: a truncated token is still a token prefix.
    expect(serialized).not.toContain(TOKEN.slice(0, 16));
    expect(auditCalls[0].targetId).toBe("inv_0001");
  });

  it("records that PII was disclosed without copying the PII itself", async () => {
    await captureValidateHandler(storageFor(invite()))(fakeReq(), fakeRes());

    expect(auditCalls[0].metadata).toEqual({
      referrerId: "user_lo_42",
      statusBefore: "pending",
      disclosedClientName: true,
      disclosedClientEmail: true,
    });

    const serialized = JSON.stringify(auditCalls);
    expect(serialized).not.toContain("Dana Borrower");
    expect(serialized).not.toContain("dana.borrower@example.test");
    // The free-text message is borrower-adjacent content, not metadata either.
    expect(serialized).not.toContain("Looking forward to working with you");
  });

  it("distinguishes an absent field from a disclosed one, without leaking either", async () => {
    await captureValidateHandler(
      storageFor(invite({ clientName: null, clientEmail: null })),
    )(fakeReq(), fakeRes());

    expect(auditCalls[0].metadata).toMatchObject({
      disclosedClientName: false,
      disclosedClientEmail: false,
    });
  });

  it("does not audit a 404 — nothing was disclosed", async () => {
    const res = fakeRes();
    await captureValidateHandler(storageFor(undefined))(fakeReq(), res);

    expect(res.statusCode).toBe(404);
    expect(auditCalls).toHaveLength(0);
  });

  it("does not audit an expired invite — the 410 path discloses nothing", async () => {
    const res = fakeRes();
    await captureValidateHandler(
      storageFor(invite({ expiresAt: new Date(Date.now() - 86_400_000) })),
    )(fakeReq(), res);

    expect(res.statusCode).toBe(410);
    expect(auditCalls).toHaveLength(0);
  });

  it("does not audit an already-used invite — also a 410 with no disclosure", async () => {
    const res = fakeRes();
    await captureValidateHandler(storageFor(invite({ status: "applied" })))(fakeReq(), res);

    expect(res.statusCode).toBe(410);
    expect(auditCalls).toHaveLength(0);
  });

  it("records the pre-read status, so a re-view after the click transition is distinguishable", async () => {
    await captureValidateHandler(storageFor(invite({ status: "clicked" })))(fakeReq(), fakeRes());

    // Second and later views are still PII disclosures and still audited; the
    // status tells an auditor which one they are looking at.
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0].metadata).toMatchObject({ statusBefore: "clicked" });
  });
});
