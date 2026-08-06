import { describe, it, expect } from "vitest";
import type { Request } from "express";

import { clientIp, clientIpForRecord, rateLimitKey } from "../server/clientIp";

/**
 * Client-IP identity on a proxy that does not speak X-Forwarded-For.
 *
 * Railway's edge sends `X-Real-IP` and NOT `X-Forwarded-For` (published
 * request spec). Express derives `req.ip` from XFF only, so before this
 * module `req.ip` was the socket peer — a rotating internal proxy address
 * shared by every visitor. Measured against production: ten sequential
 * requests from one client, one replica, returned `ratelimit-remaining`
 * 498,497,498,497,497,496,495,494,496,495 across four different
 * `ratelimit-reset` values. Several buckets where there should be one.
 *
 * The consequences were silent in both directions — a waitlist limiter of
 * 5/15min behaving closer to site-wide, and a proxy address written into
 * TCPA / E-SIGN / audit records as the consenter's IP.
 *
 * These tests pin the three properties that make the fix correct rather than
 * merely different: X-Real-IP wins, a forged X-Forwarded-For cannot influence
 * anything, and an unknown IP is recorded as NULL rather than as a lie.
 */

function req(headers: Record<string, string | string[]> = {}, ip?: string): Request {
  return { headers, ip } as unknown as Request;
}

describe("clientIp", () => {
  it("prefers X-Real-IP, the header Railway's edge actually sends", () => {
    expect(clientIp(req({ "x-real-ip": "203.0.113.7" }, "10.0.0.5"))).toBe("203.0.113.7");
  });

  it("falls back to req.ip so local dev and XFF-speaking proxies still work", () => {
    expect(clientIp(req({}, "198.51.100.22"))).toBe("198.51.100.22");
  });

  it("IGNORES a client-supplied X-Forwarded-For entirely", () => {
    // The load-bearing assertion. Honouring XFF here would hand an attacker a
    // free rate-limit-bucket generator AND a way to forge the consent IP on a
    // regulated record. Railway discards the header; we must not resurrect it.
    const forged = req(
      { "x-forwarded-for": "1.2.3.4", "x-real-ip": "203.0.113.7" },
      "10.0.0.5",
    );
    expect(clientIp(forged)).toBe("203.0.113.7");
    expect(clientIp(forged)).not.toBe("1.2.3.4");

    // ...and with no X-Real-IP at all, XFF still must not win.
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4" }, "10.0.0.5"))).toBe("10.0.0.5");
  });

  it("takes the first entry and trims, if a comma-joined value ever appears", () => {
    expect(clientIp(req({ "x-real-ip": " 203.0.113.7 , 10.0.0.1 " }))).toBe("203.0.113.7");
  });

  it("handles a repeated header arriving as an array", () => {
    expect(clientIp(req({ "x-real-ip": ["203.0.113.7", "10.0.0.1"] }))).toBe("203.0.113.7");
  });

  it("is undefined — never a placeholder — when the IP is genuinely unknown", () => {
    expect(clientIp(req({}))).toBeUndefined();
    expect(clientIp(req({ "x-real-ip": "" }))).toBeUndefined();
  });
});

describe("clientIpForRecord", () => {
  it("writes NULL rather than a proxy address when the client is unknown", () => {
    // A NULL consent IP is an honest gap. A wrong one is a false record on a
    // TCPA / E-SIGN artifact, which is strictly worse than no record.
    expect(clientIpForRecord(req({}))).toBeNull();
  });

  it("fits the varchar(64) consent/audit columns", () => {
    const long = `2001:db8:${"a".repeat(80)}`;
    const got = clientIpForRecord(req({ "x-real-ip": long }));
    expect(got).not.toBeNull();
    expect(got!.length).toBeLessThanOrEqual(64);
  });
});

describe("rateLimitKey", () => {
  it("gives two different clients two different buckets", () => {
    expect(rateLimitKey(req({ "x-real-ip": "203.0.113.7" }))).not.toBe(
      rateLimitKey(req({ "x-real-ip": "203.0.113.8" })),
    );
  });

  it("gives one client one stable bucket across requests", () => {
    // The production symptom this fixes: the same visitor was landing in
    // different buckets request to request.
    const keys = new Set(
      Array.from({ length: 5 }, () => rateLimitKey(req({ "x-real-ip": "203.0.113.7" }, "10.0.0.5"))),
    );
    expect(keys.size).toBe(1);
  });

  it("cannot be moved by a forged X-Forwarded-For", () => {
    const honest = rateLimitKey(req({ "x-real-ip": "203.0.113.7" }));
    const forged = rateLimitKey(req({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "9.9.9.9" }));
    expect(forged).toBe(honest);
  });

  it("buckets IPv6 by subnet, so one host cannot rotate within its own /64", () => {
    const a = rateLimitKey(req({ "x-real-ip": "2001:db8:1234:5678:1::1" }));
    const b = rateLimitKey(req({ "x-real-ip": "2001:db8:1234:5678:2::2" }));
    expect(a).toBe(b);
  });

  it("still yields a usable key when the IP is unknown", () => {
    expect(rateLimitKey(req({}))).toBeTruthy();
  });
});
