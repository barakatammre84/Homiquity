import { describe, expect, it } from "vitest";
import express from "express";
import helmet from "helmet";

import { HELMET_OPTIONS } from "../server/app";

/**
 * Baseline security headers, pinned against the REAL helmet config.
 *
 * WHY THIS FILE EXISTS
 *
 * X-Frame-Options was served from two places with two different values: the CDN
 * layer sent `DENY`, while helmet's in-app default sent `SAMEORIGIN`. Whichever
 * one reached the browser depended on which platform was in front, nothing
 * asserted either value, and when the CDN went away the weaker one silently
 * became the only one. A downgrade of clickjacking protection, shipped by
 * deletion, with every check green.
 *
 * So these assertions deliberately do NOT read the options object and compare
 * it to itself. They mount the exported config on a bare Express app, make a
 * real request, and read the real response headers — proving the config
 * PRODUCES the header. A test that restated the config would have passed just
 * as happily while the browser got SAMEORIGIN.
 */
async function headersFrom(): Promise<Record<string, string>> {
  const app = express();
  app.use(helmet(HELMET_OPTIONS));
  app.get("/probe", (_req, res) => {
    res.json({ ok: true });
  });

  const server = app.listen(0);
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", () => resolve());
      server.once("error", reject);
    });
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    const res = await fetch(`http://127.0.0.1:${port}/probe`);
    const out: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      out[key.toLowerCase()] = value;
    });
    return out;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("baseline security headers", () => {
  it("denies framing outright — DENY, not helmet's SAMEORIGIN default", async () => {
    const h = await headersFrom();
    expect(h["x-frame-options"]).toBe("DENY");
  });

  it("does not rely on CSP frame-ancestors to block framing", async () => {
    // frame-ancestors 'none' IS configured, but production ships CSP in
    // Report-Only mode until CSP_ENFORCE=true — so it is observed, not
    // enforced. X-Frame-Options is what actually blocks a frame today, which
    // is why the assertion above is not redundant with the CSP directive.
    expect(process.env.CSP_ENFORCE).not.toBe("true");
  });

  it("sets nosniff and a no-referrer policy", async () => {
    const h = await headersFrom();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("no-referrer");
  });

  it("sets HSTS with includeSubDomains", async () => {
    const h = await headersFrom();
    expect(h["strict-transport-security"]).toMatch(/max-age=\d+/);
    expect(h["strict-transport-security"]).toMatch(/includeSubDomains/i);
  });

  it("never advertises the server framework", async () => {
    const h = await headersFrom();
    expect(h["x-powered-by"]).toBeUndefined();
  });
});
