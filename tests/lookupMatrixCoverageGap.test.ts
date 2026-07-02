import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { like } from "drizzle-orm";
import { db } from "../server/db";
import { lookupMatrices } from "@shared/schema";
import { LookupResolverService } from "../server/services/lookupResolver";

/**
 * Coverage-gap guard tests (Task #86 safety net) against the LIVE admin routes
 * and a REAL database.
 *
 * The guard in server/routes/lookup-matrix.ts blocks any lifecycle action that
 * would silently leave a matrix code with no ACTIVE + currently-effective
 * version — which would hard-fail every borrower pricing/underwriting decision
 * that relies on it (server/services/lookupResolver.ts throws loudly). Staff can
 * still force the action by re-submitting with `confirmCoverageGap: true`.
 *
 * These tests prove:
 *   - retire / activate (future-dated) / schedule each return 409 COVERAGE_GAP
 *     when they would strand the only live version, and succeed once confirmed.
 *   - a pre-existing gap (no live coverage before OR after) is NOT attributed to
 *     the action, so it does not trigger a false 409.
 *   - rescheduling a DRAFT version (which never provides coverage) never trips
 *     the guard, even while a separate ACTIVE version is live.
 *   - once a gap is actually accepted, the resolver throws — proving the 409 was
 *     guarding a real decision hard-fail, not a phantom one.
 *
 * Requires:
 *   - The dev server running on TEST_BASE_URL (default http://localhost:5000)
 *   - DATABASE_URL (the same database the server uses)
 */

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";

// Session cookie is `secure: true`; signal HTTPS via the proxy header so
// cookie-based auth works over plain HTTP in tests.
const PROXY_HEADERS = { "X-Forwarded-Proto": "https" };

// All test codes share this prefix so cleanup never touches seeded matrices.
const CODE_PREFIX = "TEST_COVERAGE_GAP_";

const DAY = 86_400_000;

// A sibling resolver with its own DB-backed readers — used to confirm the
// resolver actually fails once a gap is accepted.
const sibling = new LookupResolverService();

function extractCookies(res: Response): string {
  const anyHeaders = res.headers as any;
  const list: string[] =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : ([res.headers.get("set-cookie")].filter(Boolean) as string[]);
  return list.map((c) => c.split(";")[0]).join("; ");
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/test-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...PROXY_HEADERS },
    body: JSON.stringify({ email, password }),
  });
  expect(res.status).toBe(200);
  const cookie = extractCookies(res);
  expect(cookie).toContain("connect.sid");
  return cookie;
}

async function authPost(cookie: string, path: string, body?: any) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      ...PROXY_HEADERS,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function authPatch(cookie: string, path: string, body?: any) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      ...PROXY_HEADERS,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

/** Publishes a single-cell DRAFT version of the given code and returns its id. */
async function publishVersion(
  cookie: string,
  code: string,
  outputValue: number,
  opts: { effectiveDate?: Date; expirationDate?: Date | null } = {},
): Promise<string> {
  const res = await authPost(cookie, "/api/lookup-matrices", {
    matrixCode: code,
    description: `coverage-gap test ${outputValue}`,
    effectiveDate: (opts.effectiveDate ?? new Date(Date.now() - DAY)).toISOString(),
    expirationDate: opts.expirationDate ? opts.expirationDate.toISOString() : null,
    cells: [{ outputValue }],
  });
  expect(res.status).toBe(201);
  expect(res.body).toHaveProperty("id");
  return res.body.id as string;
}

/** Publishes + activates a version in one step, asserting both succeed. */
async function publishAndActivate(
  cookie: string,
  code: string,
  outputValue: number,
  opts: { effectiveDate?: Date; expirationDate?: Date | null } = {},
): Promise<string> {
  const id = await publishVersion(cookie, code, outputValue, opts);
  const activate = await authPost(cookie, `/api/lookup-matrices/${id}/activate`);
  expect(activate.status).toBe(200);
  expect(activate.body.lifecycleStatus).toBe("ACTIVE");
  return id;
}

async function deleteTestMatrices(): Promise<void> {
  // Cells cascade on matrix delete (onDelete: "cascade").
  await db.delete(lookupMatrices).where(like(lookupMatrices.matrixCode, `${CODE_PREFIX}%`));
}

describe("Lookup matrix coverage-gap guard — live routes + real DB", () => {
  let admin: string;

  beforeAll(async () => {
    admin = await login("admin@test.com", process.env.DEV_TEST_PASSWORD!);
    await deleteTestMatrices();
  });

  afterAll(async () => {
    await deleteTestMatrices();
  });

  it("retire: blocks 409 when removing the only live version, succeeds when confirmed, and the resolver then throws", async () => {
    const code = `${CODE_PREFIX}RETIRE`;
    const v1 = await publishAndActivate(admin, code, 10);

    // The active version resolves before any action.
    sibling.invalidateInstance(code);
    expect(await sibling.resolveMatrixValue({ matrixCode: code })).toBe(10);

    // Retiring the only live version is blocked with a 409 COVERAGE_GAP.
    const blocked = await authPost(admin, `/api/lookup-matrices/${v1}/retire`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe("COVERAGE_GAP");
    expect(blocked.body.matrixCode).toBe(code);

    // The matrix is untouched: it still resolves (no silent strand).
    sibling.invalidateInstance(code);
    expect(await sibling.resolveMatrixValue({ matrixCode: code })).toBe(10);

    // Re-submitting with the explicit confirmation succeeds.
    const confirmed = await authPost(admin, `/api/lookup-matrices/${v1}/retire`, {
      confirmCoverageGap: true,
    });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.lifecycleStatus).toBe("RETIRED");

    // The gap is now real: the resolver must hard-fail rather than quote a
    // retired sheet — proving the 409 was guarding a genuine decision failure.
    sibling.invalidateInstance(code);
    await expect(
      sibling.resolveMatrixValue({ matrixCode: code }),
    ).rejects.toThrow(/missing, expired, or not active/i);
  });

  it("activate: blocks 409 when a future-dated activation would strand the code after the prior version is retired", async () => {
    const code = `${CODE_PREFIX}ACTIVATE`;
    // v1 is live now.
    await publishAndActivate(admin, code, 20);
    sibling.invalidateInstance(code);
    expect(await sibling.resolveMatrixValue({ matrixCode: code })).toBe(20);

    // v2 is effective 30 days out. Activating it retires v1, but v2 is not yet
    // effective — so the code would be stranded in the meantime.
    const future = new Date(Date.now() + 30 * DAY);
    const v2 = await publishVersion(admin, code, 25, { effectiveDate: future });

    const blocked = await authPost(admin, `/api/lookup-matrices/${v2}/activate`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe("COVERAGE_GAP");
    expect(blocked.body.matrixCode).toBe(code);

    // v1 is still live because the activation was blocked.
    sibling.invalidateInstance(code);
    expect(await sibling.resolveMatrixValue({ matrixCode: code })).toBe(20);

    // Confirming proceeds: v2 goes ACTIVE (future) and v1 is retired.
    const confirmed = await authPost(admin, `/api/lookup-matrices/${v2}/activate`, {
      confirmCoverageGap: true,
    });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.lifecycleStatus).toBe("ACTIVE");

    // The accepted gap is real: no currently-effective version remains.
    sibling.invalidateInstance(code);
    await expect(
      sibling.resolveMatrixValue({ matrixCode: code }),
    ).rejects.toThrow(/missing, expired, or not active/i);
  });

  it("schedule: blocks 409 when pushing effectiveDate forward removes the only live coverage", async () => {
    const code = `${CODE_PREFIX}SCHEDULE_EFF`;
    const v1 = await publishAndActivate(admin, code, 30);
    sibling.invalidateInstance(code);
    expect(await sibling.resolveMatrixValue({ matrixCode: code })).toBe(30);

    // Pushing the effectiveDate into the future makes the only version dormant.
    const future = new Date(Date.now() + 10 * DAY);
    const blocked = await authPatch(admin, `/api/lookup-matrices/${v1}/schedule`, {
      effectiveDate: future.toISOString(),
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe("COVERAGE_GAP");

    // Still live (change rejected).
    sibling.invalidateInstance(code);
    expect(await sibling.resolveMatrixValue({ matrixCode: code })).toBe(30);

    // Confirmed reschedule proceeds and strands the code (now future-dated).
    const confirmed = await authPatch(admin, `/api/lookup-matrices/${v1}/schedule`, {
      effectiveDate: future.toISOString(),
      confirmCoverageGap: true,
    });
    expect(confirmed.status).toBe(200);

    sibling.invalidateInstance(code);
    await expect(
      sibling.resolveMatrixValue({ matrixCode: code }),
    ).rejects.toThrow(/missing, expired, or not active/i);
  });

  it("schedule: blocks 409 when pulling expirationDate back removes the only live coverage", async () => {
    const code = `${CODE_PREFIX}SCHEDULE_EXP`;
    // Effective 2 days ago, open-ended.
    const v1 = await publishAndActivate(admin, code, 40, {
      effectiveDate: new Date(Date.now() - 2 * DAY),
    });
    sibling.invalidateInstance(code);
    expect(await sibling.resolveMatrixValue({ matrixCode: code })).toBe(40);

    // Pull the expirationDate back to 1 hour ago (still after effectiveDate, so
    // it passes the date-order validation) — the version is now expired.
    const expired = new Date(Date.now() - 3_600_000);
    const blocked = await authPatch(admin, `/api/lookup-matrices/${v1}/schedule`, {
      expirationDate: expired.toISOString(),
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe("COVERAGE_GAP");

    sibling.invalidateInstance(code);
    expect(await sibling.resolveMatrixValue({ matrixCode: code })).toBe(40);
  });

  it("does NOT raise a false 409 for a pre-existing gap (no live coverage before OR after)", async () => {
    const code = `${CODE_PREFIX}PRE_EXISTING`;
    // Activate a version effective 10 days out: it is ACTIVE but not yet
    // effective, so the code already has no live coverage (a pre-existing gap).
    const future = new Date(Date.now() + 10 * DAY);
    const v1 = await publishAndActivate(admin, code, 50, { effectiveDate: future });

    // Retiring it removes no live coverage (there was none), so the guard must
    // not fire — it succeeds with NO confirmCoverageGap flag.
    const retire = await authPost(admin, `/api/lookup-matrices/${v1}/retire`);
    expect(retire.status).toBe(200);
    expect(retire.body.lifecycleStatus).toBe("RETIRED");
  });

  it("never trips the guard when rescheduling a DRAFT version, even with a live ACTIVE version present", async () => {
    const code = `${CODE_PREFIX}DRAFT_RESCHEDULE`;
    // A live version provides current coverage.
    await publishAndActivate(admin, code, 60);

    // A separate DRAFT version (never activated) provides no coverage.
    const draft = await publishVersion(admin, code, 65);

    // Pushing the DRAFT's dates around cannot strand the code (DRAFT rows are
    // never resolved), so the reschedule succeeds without confirmation.
    const future = new Date(Date.now() + 20 * DAY);
    const reschedule = await authPatch(admin, `/api/lookup-matrices/${draft}/schedule`, {
      effectiveDate: future.toISOString(),
    });
    expect(reschedule.status).toBe(200);

    // The live version is untouched and still resolves.
    sibling.invalidateInstance(code);
    expect(await sibling.resolveMatrixValue({ matrixCode: code })).toBe(60);
  });
});
