import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "../server/db";
import { lookupMatrices } from "@shared/schema";
import { LookupResolverService } from "../server/services/lookupResolver";

/**
 * End-to-end (real database) proof of cross-process pricing cache coherence.
 *
 * Task #85 made activating/retiring/rescheduling a pricing matrix visible on
 * every autoscale server instance via a database-derived invalidation stamp
 * (MAX(updated_at) per matrix_code). tests/lookupResolver.test.ts already proves
 * the cache logic hermetically with injected readers. This suite proves the same
 * thing against the LIVE admin lifecycle routes and a REAL database.
 *
 * How the cross-process scenario is modeled
 * -----------------------------------------
 * The lifecycle mutations run through the live admin HTTP routes inside the
 * running server process (which clears ITS OWN in-memory cache via
 * LookupResolverService.invalidate). This test process owns a SEPARATE resolver
 * instance (`sibling`) that is NEVER told to invalidate — exactly like a second
 * autoscale instance that did not handle the mutation. The only coherence
 * channel between them is the shared database stamp. So whenever `sibling`
 * returns a fresh number, it can only be because it noticed the bumped
 * updated_at stamp, not because someone invalidated its cache.
 *
 * Because the resolver runs in default (strict) mode and every resolve happens
 * milliseconds apart (far under the 60s value TTL), a changed return value
 * cannot be attributed to TTL expiry — it must come from the stamp.
 *
 * Requires:
 *   - The dev server running on TEST_BASE_URL (default http://localhost:5000)
 *   - DATABASE_URL (the same database the server uses)
 */

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";

// Session cookie is `secure: true`; signal HTTPS via the proxy header so
// cookie-based auth works over plain HTTP in tests (see pricingUnderwriting).
const PROXY_HEADERS = { "X-Forwarded-Proto": "https" };

// Unique code so this never collides with the seeded production matrices.
const CODE = "TEST_COHERENCE_RATE_SHEET";

// A second autoscale instance: its own cache, real DB-backed readers, never
// receives an in-process invalidate() from the lifecycle routes.
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

/** Reads the cross-process stamp (MAX(updated_at) epoch-ms) straight from the DB. */
async function readStamp(): Promise<number> {
  const [row] = await db
    .select({
      stamp: sql<string>`COALESCE(EXTRACT(EPOCH FROM MAX(${lookupMatrices.updatedAt})) * 1000, 0)`,
    })
    .from(lookupMatrices)
    .where(eq(lookupMatrices.matrixCode, CODE));
  return Number(row?.stamp ?? 0);
}

/** Publishes a single-cell DRAFT version of the matrix and returns its id. */
async function publishVersion(
  cookie: string,
  outputValue: number,
  opts: { effectiveDate?: Date; expirationDate?: Date | null } = {},
): Promise<string> {
  const res = await authPost(cookie, "/api/lookup-matrices", {
    matrixCode: CODE,
    description: `coherence test ${outputValue}`,
    effectiveDate: (opts.effectiveDate ?? new Date(Date.now() - 86_400_000)).toISOString(),
    expirationDate: opts.expirationDate ? opts.expirationDate.toISOString() : null,
    cells: [{ outputValue }],
  });
  expect(res.status).toBe(201);
  expect(res.body).toHaveProperty("id");
  return res.body.id as string;
}

async function deleteTestMatrices(): Promise<void> {
  // Cells cascade on matrix delete (onDelete: "cascade").
  await db.delete(lookupMatrices).where(eq(lookupMatrices.matrixCode, CODE));
}

describe("Lookup matrix lifecycle — live routes + real DB cross-process coherence", () => {
  let admin: string;

  beforeAll(async () => {
    admin = await login("admin@test.com", process.env.DEV_TEST_PASSWORD!);
    await deleteTestMatrices();
    // Cold cache for the sibling instance.
    sibling.invalidateInstance(CODE);
  });

  afterAll(async () => {
    await deleteTestMatrices();
  });

  it("a sibling instance picks up a publish+activate purely via the DB stamp", async () => {
    const v1 = await publishVersion(admin, 10);

    // Publishing a DRAFT already advances updated_at on its own row.
    const stampAfterCreate = await readStamp();
    expect(stampAfterCreate).toBeGreaterThan(0);

    const activate = await authPost(admin, `/api/lookup-matrices/${v1}/activate`);
    expect(activate.status).toBe(200);
    expect(activate.body.lifecycleStatus).toBe("ACTIVE");

    const stampAfterActivate = await readStamp();
    expect(stampAfterActivate).toBeGreaterThan(stampAfterCreate);

    // Sibling (cold cache, never invalidated by the route) resolves the value.
    expect(await sibling.resolveMatrixValue({ matrixCode: CODE })).toBe(10);
    // A repeat read is served from cache (no mutation, stamp unchanged).
    expect(await sibling.resolveMatrixValue({ matrixCode: CODE })).toBe(10);
  });

  it("publishing + activating a NEW version is reflected on the sibling immediately", async () => {
    const stampBefore = await readStamp();

    const v2 = await publishVersion(admin, 20);
    const activate = await authPost(admin, `/api/lookup-matrices/${v2}/activate`);
    expect(activate.status).toBe(200);

    // Activation must bump the stamp (it updates the new row AND retires v1).
    const stampAfter = await readStamp();
    expect(stampAfter).toBeGreaterThan(stampBefore);

    // The sibling was NEVER told to invalidate. Within the value TTL it would
    // otherwise still quote 10; instead it returns 20 because the stamp moved.
    expect(await sibling.resolveMatrixValue({ matrixCode: CODE })).toBe(20);
  });

  it("retiring the active version stops the sibling from quoting it", async () => {
    const v3 = await publishVersion(admin, 30);
    await authPost(admin, `/api/lookup-matrices/${v3}/activate`);
    expect(await sibling.resolveMatrixValue({ matrixCode: CODE })).toBe(30);

    const stampBefore = await readStamp();
    // Retiring the only live version trips the coverage-gap guard (Task #86);
    // this test intentionally strands the code to prove the sibling stops
    // quoting it, so it confirms the gap explicitly.
    const retire = await authPost(admin, `/api/lookup-matrices/${v3}/retire`, {
      confirmCoverageGap: true,
    });
    expect(retire.status).toBe(200);
    expect(retire.body.lifecycleStatus).toBe("RETIRED");

    const stampAfter = await readStamp();
    expect(stampAfter).toBeGreaterThan(stampBefore);

    // No active+effective version remains, so the resolver must fail loudly
    // rather than quote a retired sheet.
    await expect(
      sibling.resolveMatrixValue({ matrixCode: CODE }),
    ).rejects.toThrow(/missing, expired, or not active/i);
  });

  it("rescheduling a future-dated version flips it live on the sibling", async () => {
    // Publish a version effective in the future, then activate it: it is ACTIVE
    // but not yet effective, so the resolver ignores it.
    const future = new Date(Date.now() + 30 * 86_400_000);
    const v4 = await publishVersion(admin, 40, { effectiveDate: future });
    await authPost(admin, `/api/lookup-matrices/${v4}/activate`);

    await expect(
      sibling.resolveMatrixValue({ matrixCode: CODE }),
    ).rejects.toThrow(/missing, expired, or not active/i);

    const stampBefore = await readStamp();

    // Reschedule it to be effective in the past.
    const reschedule = await authPatch(
      admin,
      `/api/lookup-matrices/${v4}/schedule`,
      { effectiveDate: new Date(Date.now() - 86_400_000).toISOString() },
    );
    expect(reschedule.status).toBe(200);

    const stampAfter = await readStamp();
    expect(stampAfter).toBeGreaterThan(stampBefore);

    // The sibling now resolves the freshly-effective value via the stamp alone.
    expect(await sibling.resolveMatrixValue({ matrixCode: CODE })).toBe(40);
  });

  it("rejects lifecycle mutations from non-admin staff", async () => {
    const underwriter = await login("underwriter@test.com", process.env.DEV_TEST_PASSWORD!);
    const denied = await authPost(underwriter, "/api/lookup-matrices", {
      matrixCode: CODE,
      effectiveDate: new Date().toISOString(),
      cells: [{ outputValue: 99 }],
    });
    expect([401, 403]).toContain(denied.status);
  });
});
