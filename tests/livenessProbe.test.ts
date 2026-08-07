import { describe, expect, it, afterEach } from "vitest";

import { app } from "../server/app";

/**
 * GET /health — the platform liveness probe.
 *
 * WHY THIS FILE EXISTS
 *
 * The endpoint itself is three lines and could not really break. What CAN break
 * is where it is MOUNTED, and both failure modes are silent:
 *
 *   1. Below `betaGateMiddleware`. The gate carves out `/api/` and nothing else
 *      (server/middleware/betaGate.ts), so a bare `/health` sitting below it is
 *      served the 401 lock screen the instant BETA_ACCESS_CODE is set — the
 *      health check would start failing precisely when the private beta is
 *      switched on, and the cause would look like a platform problem.
 *   2. Not mounted at all. `/health` then falls through to the SPA catch-all and
 *      returns the HTML shell with a 200. A probe that cannot fail is worse than
 *      no probe: it reports healthy without touching the process's actual state.
 *
 * So these tests deliberately do NOT call the handler directly, and do not
 * rebuild a representative app. They import the REAL `app` from server/app.ts —
 * the same singleton with the same middleware registered in the same order that
 * production runs — and make real HTTP requests through it. A test that mounted
 * its own express() would have passed just as happily with the route sitting
 * underneath the gate.
 *
 * Note `registerRoutes()` is never called here, so /api/health does not exist in
 * this instance. That is deliberate: it isolates the module-scope chain, and it
 * means a 200 below cannot have come from anything but the route under test.
 */

const ORIGINAL_BETA = process.env.BETA_ACCESS_CODE;

afterEach(() => {
  if (ORIGINAL_BETA === undefined) delete process.env.BETA_ACCESS_CODE;
  else process.env.BETA_ACCESS_CODE = ORIGINAL_BETA;
});

async function get(path: string): Promise<{ status: number; body: string; contentType: string }> {
  const server = app.listen(0);
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", () => resolve());
      server.once("error", reject);
    });
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    return {
      status: res.status,
      body: await res.text(),
      contentType: res.headers.get("content-type") ?? "",
    };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("GET /health (liveness)", () => {
  it("answers 200 with a JSON status body", async () => {
    delete process.env.BETA_ACCESS_CODE;
    const res = await get("/health");
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: "ok" });
  });

  it("still answers 200 while the private-beta gate is ARMED", async () => {
    // The regression this file exists for. betaGateMiddleware exempts `/api/`
    // only, so a `/health` registered below it would 401 here — and would do so
    // only once BETA_ACCESS_CODE was set on the service, long after the code
    // shipped green.
    process.env.BETA_ACCESS_CODE = "let-me-in";
    const res = await get("/health");
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: "ok" });
  });

  it("returns JSON, never the SPA HTML shell", async () => {
    // Pins the second failure mode: with no route of its own, `/health` reaches
    // the SPA catch-all and returns index.html with a 200 — a probe that always
    // passes. Asserting the content type is what distinguishes the two.
    delete process.env.BETA_ACCESS_CODE;
    const res = await get("/health");
    expect(res.contentType).toContain("application/json");
    expect(res.body).not.toContain("<!DOCTYPE");
    expect(res.body).not.toContain("<html");
  });
});
