import { describe, expect, it } from "vitest";
import express from "express";
import helmet from "helmet";
import { HELMET_OPTIONS } from "../server/app";

/**
 * Baseline security headers, pinned against the REAL helmet config.
 *
 * These headers were served from two places with two different values: the CDN
 * (`vercel.json` headers: `X-Frame-Options: DENY`) and the app (helmet's
 * `SAMEORIGIN` default). On Vercel the CDN value landed and the discrepancy was
 * invisible; on the self-host / Railway path there is no CDN layer, so the app's
 * weaker value would have been what shipped — a silent downgrade of clickjacking
 * protection at cutover, with nothing testing it.
 *
 * Asserted by mounting the exported options on a bare Express app, so this
 * proves the config PRODUCES the header rather than restating the config.
 */
function headersFrom(): Promise<Record<string, string>> {
  const app = express();
  app.use(helmet(HELMET_OPTIONS));
  app.get("/probe", (_req, res) => res.json({ ok: true }));

  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/probe`);
        const out: Record<string, string> = {};
        res.headers.forEach((v, k) => (out[k.toLowerCase()] = v));
        resolve(out);
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
  });
}

describe("baseline security headers", () => {
  it("denies framing outright — not SAMEORIGIN", async () => {
    const h = await headersFrom();
    // The whole point: helmet's default is SAMEORIGIN, vercel.json served DENY.
    // Nothing legitimately frames this app, and the self-host path has no CDN
    // header to fall back on.
    expect(h["x-frame-options"]).toBe("DENY");
  });

  it("sets nosniff and a no-referrer policy", async () => {
    const h = await headersFrom();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("no-referrer");
  });

  it("sets HSTS", async () => {
    const h = await headersFrom();
    expect(h["strict-transport-security"]).toMatch(/max-age=\d+/);
    expect(h["strict-transport-security"]).toMatch(/includeSubDomains/i);
  });

  it("never advertises the server framework", async () => {
    const h = await headersFrom();
    expect(h["x-powered-by"]).toBeUndefined();
  });
});
