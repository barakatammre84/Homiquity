import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import express, { type Express } from "express";

import {
  betaGateMiddleware,
  betaCodes as expressBetaCodes,
  sha256Hex as expressSha256Hex,
} from "../server/middleware/betaGate";

const ORIGINAL_ENV = process.env.BETA_ACCESS_CODE;

// ---------------------------------------------------------------------------
// The private-beta gate (server/middleware/betaGate.ts) — now the only
// implementation. It began as an Express port of a Vercel Edge middleware, and
// these scenarios were originally written to prove the two agreed; they are
// kept because they are the only coverage of an incident-containment control.
// Each runs through a real Express dispatch with the gate mounted ahead of the
// route surface — exactly the server/app.ts arrangement. The downstream
// handlers stand in for express.static (public robots.txt) and the SPA
// catch-all.
// ---------------------------------------------------------------------------

// Minimal in-process request driver — mirrors tests/spaCatchAll.test.ts, plus
// header capture (Location/Set-Cookie assertions need response headers).
function makeReqRes(url: string, headers: Record<string, string> = {}) {
  const req: any = new EventEmitter();
  req.url = url;
  req.method = "GET";
  req.headers = { host: "x.test", ...headers };
  req.socket = {};

  const captured: Record<string, unknown> = {};
  const res: any = new EventEmitter();
  res.statusCode = 200;
  res.headersSent = false;
  res.setHeader = (k: string, v: unknown) => {
    captured[k.toLowerCase()] = v;
    return res;
  };
  res.getHeader = (k: string) => captured[k.toLowerCase()];
  res.removeHeader = (k: string) => {
    delete captured[k.toLowerCase()];
  };
  res.writeHead = (code: number, hs?: Record<string, unknown>) => {
    res.statusCode = code;
    for (const [k, v] of Object.entries(hs ?? {})) captured[k.toLowerCase()] = v;
    return res;
  };
  res.headers = captured;
  return { req, res };
}

function run(
  app: Express,
  url: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string; headers: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const { req, res } = makeReqRes(url, headers);
    let body = "";
    res.end = (chunk?: unknown) => {
      res.headersSent = true;
      if (chunk !== undefined && chunk !== null) body += String(chunk);
      resolve({ status: res.statusCode, body, headers: res.headers });
      return res;
    };
    try {
      (app as unknown as (rq: unknown, rs: unknown) => void)(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

function buildGatedApp(): Express {
  const app = express();
  app.use(betaGateMiddleware);
  app.get("/api/jobs/lifecycle", (_req, res) => {
    res.json({ ok: true });
  });
  // Stands in for the public robots.txt that express.static would serve —
  // the armed gate's Disallow-all override must answer before it.
  app.get("/robots.txt", (_req, res) => {
    res.status(200).type("text/plain").send("User-agent: *\nAllow: /\n");
  });
  app.use((_req, res) => {
    res.status(200).type("html").end("<!doctype html><html>SPA</html>");
  });
  return app;
}

describe("beta gate Express middleware", () => {
  beforeEach(() => {
    process.env.BETA_ACCESS_CODE = "sunrise-42,agent-crew";
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.BETA_ACCESS_CODE;
    else process.env.BETA_ACCESS_CODE = ORIGINAL_ENV;
  });

  it("is a total no-op when BETA_ACCESS_CODE is unset — the SPA and the public robots.txt serve", async () => {
    delete process.env.BETA_ACCESS_CODE;
    const app = buildGatedApp();
    expect((await run(app, "/")).body).toContain("SPA");
    expect((await run(app, "/robots.txt")).body).toContain("Allow: /");
  });

  it("is a no-op when BETA_ACCESS_CODE is blank/whitespace", async () => {
    process.env.BETA_ACCESS_CODE = " , ";
    expect((await run(buildGatedApp(), "/")).body).toContain("SPA");
  });

  it("never gates /api/* even while active", async () => {
    const got = await run(buildGatedApp(), "/api/jobs/lifecycle");
    expect(got.status).toBe(200);
    expect(JSON.parse(got.body)).toEqual({ ok: true });
  });

  it("shows the 401 lock screen to visitors without a code", async () => {
    const got = await run(buildGatedApp(), "/dashboard");
    expect(got.status).toBe(401);
    expect(String(got.headers["x-robots-tag"])).toContain("noindex");
    expect(String(got.headers["cache-control"])).toBe("no-store");
    expect(got.body).toContain("private beta");
    expect(got.body).toContain('name="beta"');
    expect(got.body).not.toContain("didn&rsquo;t work");
  });

  it("shows an error on the lock screen for a wrong code", async () => {
    const got = await run(buildGatedApp(), "/?beta=wrong-guess");
    expect(got.status).toBe(401);
    expect(got.body).toContain("didn&rsquo;t work");
  });

  it("accepts a valid invite link: sets cookie, strips ?beta=, redirects", async () => {
    const got = await run(buildGatedApp(), "/rates?beta=sunrise-42&tab=va");
    expect(got.status).toBe(302);
    expect(String(got.headers["location"])).toBe("/rates?tab=va");
    const cookie = String(got.headers["set-cookie"]);
    expect(cookie).toContain(`hq_beta=${await expressSha256Hex("sunrise-42")}`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=7776000");
  });

  it("accepts any code from the comma-separated list", async () => {
    const got = await run(buildGatedApp(), "/?beta=agent-crew");
    expect(got.status).toBe(302);
    expect(String(got.headers["location"])).toBe("/");
  });

  it("admits requests carrying a valid cookie", async () => {
    const hash = await expressSha256Hex("sunrise-42");
    const got = await run(buildGatedApp(), "/dashboard", { cookie: `hq_beta=${hash}` });
    expect(got.body).toContain("SPA");
  });

  it("rejects a forged cookie, and a revoked code's cookie on the next request", async () => {
    const staleHash = await expressSha256Hex("revoked-code");
    expect((await run(buildGatedApp(), "/", { cookie: `hq_beta=${staleHash}` })).status).toBe(401);

    // Revocation: a cookie minted while the code was valid dies with the code.
    const revokedHash = await expressSha256Hex("agent-crew");
    process.env.BETA_ACCESS_CODE = "sunrise-42";
    expect((await run(buildGatedApp(), "/", { cookie: `hq_beta=${revokedHash}` })).status).toBe(401);
  });

  it("overrides robots.txt with Disallow-all while gated — winning over the static file", async () => {
    const got = await run(buildGatedApp(), "/robots.txt");
    expect(got.status).toBe(200);
    expect(got.body).toContain("Disallow: /");
    expect(got.body).not.toContain("Allow: /");
    expect(String(got.headers["x-robots-tag"])).toContain("noindex");
  });

  it("serves the robots override even to a cookie-holding tester (edge parity)", async () => {
    const hash = await expressSha256Hex("sunrise-42");
    const got = await run(buildGatedApp(), "/robots.txt", { cookie: `hq_beta=${hash}` });
    expect(got.body).toContain("Disallow: /");
  });

  it("ports betaCodes semantics unchanged", () => {
    expect(expressBetaCodes(" a , ,b,")).toEqual(["a", "b"]);
    expect(expressBetaCodes(undefined)).toEqual([]);
  });

  // Known-answer vector, not a self-comparison. This used to assert parity with
  // the Vercel Edge implementation; that module is gone, but the VALUE still
  // matters — it is the cookie payload. Any change to the hashing would
  // silently invalidate every beta cookie already issued to a tester and lock
  // them out, so the digest is pinned to a literal.
  it("hashes codes to the pinned digest — already-issued beta cookies stay valid", async () => {
    expect(await expressSha256Hex("sunrise-42")).toBe(
      "798d4696a6ee925297f8b66569b62101ddfa82e1acc55587b4867a2c1ea43dcd",
    );
  });
});
