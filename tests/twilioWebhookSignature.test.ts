import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHash } from "crypto";
import {
  computeTwilioSignature,
  candidateWebhookUrls,
  evaluateTwilioWebhookAuth,
  jsonBodyHashMatches,
  signaturesMatch,
} from "../server/services/twilioSignature";
import { registerWebhookRoutes } from "../server/routes/webhooks";
import type { IStorage } from "../server/storage";

// -----------------------------------------------------------------------------
// Inbound SMS webhook authentication.
//
// Before this, POST /api/webhooks/sms was unauthenticated: anyone who found the
// URL could suppress an arbitrary phone number and flip matching leads to
// do-not-contact. These tests cover both halves of the fix — the signature
// algorithm itself, and the route's fail-closed / opt-out-fail-safe posture.
// -----------------------------------------------------------------------------

const AUTH_TOKEN = "test-auth-token-not-a-real-secret";

describe("computeTwilioSignature", () => {
  // THE drift pin. This is the worked example Twilio publishes in
  // https://www.twilio.com/docs/usage/security — same URL, same params, auth
  // token "12345", and the expected signature they print. A hand-rolled
  // implementation is only safe while this vector passes; if it ever fails, the
  // implementation has drifted from Twilio's algorithm, not the other way round.
  it("reproduces Twilio's published example signature", () => {
    const url = "https://example.com/myapp.php?foo=1&bar=2";
    const params = {
      Digits: "1234",
      To: "+18005551212",
      From: "+14158675310",
      Caller: "+14158675310",
      CallSid: "CA1234567890ABCDE",
    };
    expect(computeTwilioSignature("12345", url, params)).toBe("L/OH5YylLD5NRKLltdqwSvS0BnU=");
  });

  it("is insensitive to the order keys arrive in (params are sorted)", () => {
    const url = "https://example.com/hook";
    const a = computeTwilioSignature(AUTH_TOKEN, url, { From: "+15551234567", Body: "STOP" });
    const b = computeTwilioSignature(AUTH_TOKEN, url, { Body: "STOP", From: "+15551234567" });
    expect(a).toBe(b);
  });

  it("sorts by byte order, not locale order", () => {
    // localeCompare would order "a" before "B"; Twilio's Unix-style sort does
    // not. Signing with uppercase and lowercase keys catches the wrong comparator.
    const url = "https://example.com/hook";
    const params = { a: "1", B: "2" };
    // Byte order is B < a, so the payload must be url + "B2" + "a1".
    const expected = computeTwilioSignature(AUTH_TOKEN, url + "", { B: "2", a: "1" });
    expect(computeTwilioSignature(AUTH_TOKEN, url, params)).toBe(expected);
    // And the concatenation itself is what the HMAC covers:
    expect(computeTwilioSignature(AUTH_TOKEN, url, params)).toBe(
      computeTwilioSignature(AUTH_TOKEN, url + "B2a1", {}),
    );
  });

  it("changes when any signed input changes", () => {
    const base = computeTwilioSignature(AUTH_TOKEN, "https://example.com/hook", { Body: "STOP" });
    expect(computeTwilioSignature(AUTH_TOKEN, "https://example.com/hook", { Body: "START" })).not.toBe(base);
    expect(computeTwilioSignature(AUTH_TOKEN, "https://evil.example/hook", { Body: "STOP" })).not.toBe(base);
    expect(computeTwilioSignature("other-token", "https://example.com/hook", { Body: "STOP" })).not.toBe(base);
  });
});

describe("signaturesMatch", () => {
  it("matches identical signatures and rejects different or truncated ones", () => {
    const sig = computeTwilioSignature(AUTH_TOKEN, "https://example.com/hook", { Body: "STOP" });
    expect(signaturesMatch(sig, sig)).toBe(true);
    expect(signaturesMatch(sig, sig.slice(0, -1))).toBe(false); // length mismatch must not throw
    expect(signaturesMatch(sig, "")).toBe(false);
  });
});

describe("candidateWebhookUrls", () => {
  const originalConfigured = process.env.TWILIO_WEBHOOK_URL;
  afterEach(() => {
    if (originalConfigured === undefined) delete process.env.TWILIO_WEBHOOK_URL;
    else process.env.TWILIO_WEBHOOK_URL = originalConfigured;
  });

  it("reconstructs from the forwarded proto and host", () => {
    delete process.env.TWILIO_WEBHOOK_URL;
    const urls = candidateWebhookUrls({
      originalUrl: "/api/webhooks/sms",
      headers: { "x-forwarded-proto": "https", "x-forwarded-host": "www.homiquity.com", host: "internal:5001" },
    });
    expect(urls).toContain("https://www.homiquity.com/api/webhooks/sms");
  });

  it("also offers the https form when the proxy hands the app a plaintext hop", () => {
    delete process.env.TWILIO_WEBHOOK_URL;
    const urls = candidateWebhookUrls({
      originalUrl: "/api/webhooks/sms",
      protocol: "http",
      headers: { host: "www.homiquity.com" },
    });
    expect(urls).toContain("https://www.homiquity.com/api/webhooks/sms");
  });

  it("takes the first hop from a comma-joined forwarded header", () => {
    delete process.env.TWILIO_WEBHOOK_URL;
    const urls = candidateWebhookUrls({
      originalUrl: "/api/webhooks/sms",
      headers: { "x-forwarded-host": "www.homiquity.com, internal.railway", "x-forwarded-proto": "https, http" },
    });
    expect(urls).toContain("https://www.homiquity.com/api/webhooks/sms");
  });

  it("pins the configured URL and its bodySHA256 variant when TWILIO_WEBHOOK_URL is set", () => {
    process.env.TWILIO_WEBHOOK_URL = "https://www.homiquity.com/api/webhooks/sms";
    const urls = candidateWebhookUrls({
      originalUrl: "/api/webhooks/sms?bodySHA256=abc",
      headers: { host: "internal:5001" },
    });
    expect(urls[0]).toBe("https://www.homiquity.com/api/webhooks/sms");
    expect(urls).toContain("https://www.homiquity.com/api/webhooks/sms?bodySHA256=abc");
  });
});

describe("jsonBodyHashMatches", () => {
  const body = '{"From":"+15551234567","Body":"STOP"}';
  const hash = createHash("sha256").update(body, "utf8").digest("hex");

  it("accepts a body matching the signed bodySHA256", () => {
    expect(jsonBodyHashMatches(`https://example.com/hook?bodySHA256=${hash}`, body)).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(jsonBodyHashMatches(`https://example.com/hook?bodySHA256=${hash}`, body.replace("STOP", "START"))).toBe(
      false,
    );
  });

  it("rejects a URL with no bodySHA256 — an uncovered body is not authenticated", () => {
    expect(jsonBodyHashMatches("https://example.com/hook", body)).toBe(false);
  });
});

describe("evaluateTwilioWebhookAuth", () => {
  const url = "https://www.homiquity.com/api/webhooks/sms";
  const params = { From: "+15551234567", Body: "STOP" };
  const sign = (p: Record<string, unknown> = params, u = url) => computeTwilioSignature(AUTH_TOKEN, u, p);

  const base = {
    authToken: AUTH_TOKEN,
    isProduction: true,
    urls: [url],
    params,
    isForm: true,
  };

  it("accepts a valid form signature", () => {
    expect(evaluateTwilioWebhookAuth({ ...base, signature: sign() })).toEqual({ ok: true, mode: "verified" });
  });

  it("rejects a tampered body — the signature covers the params", () => {
    const signature = sign(); // signed over Body=STOP
    const got = evaluateTwilioWebhookAuth({
      ...base,
      params: { From: "+15551234567", Body: "START" }, // ...but START arrives
      signature,
    });
    expect(got).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects a tampered From — an attacker cannot retarget a signed request", () => {
    const got = evaluateTwilioWebhookAuth({ ...base, params: { ...params, From: "+15559999999" }, signature: sign() });
    expect(got).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects a signature computed for a different URL", () => {
    const got = evaluateTwilioWebhookAuth({ ...base, signature: sign(params, "https://evil.example/api/webhooks/sms") });
    expect(got).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects a missing X-Twilio-Signature header", () => {
    expect(evaluateTwilioWebhookAuth({ ...base, signature: undefined })).toMatchObject({ ok: false, status: 403 });
    expect(evaluateTwilioWebhookAuth({ ...base, signature: "" })).toMatchObject({ ok: false, status: 403 });
  });

  it("returns 503 in production when TWILIO_AUTH_TOKEN is unset — fail CLOSED", () => {
    for (const authToken of [undefined, null, "", "   "]) {
      const got = evaluateTwilioWebhookAuth({ ...base, authToken, signature: sign() });
      expect(got).toMatchObject({ ok: false, status: 503 });
    }
  });

  it("keeps the provider-agnostic path usable outside production when unset", () => {
    const got = evaluateTwilioWebhookAuth({ ...base, authToken: undefined, isProduction: false, signature: undefined });
    expect(got).toEqual({ ok: true, mode: "unconfigured" });
  });

  it("enforces a configured token outside production too", () => {
    const got = evaluateTwilioWebhookAuth({ ...base, isProduction: false, signature: "not-the-signature" });
    expect(got).toMatchObject({ ok: false, status: 403 });
  });

  it("verifies a JSON body through the signed bodySHA256", () => {
    const rawBody = '{"From":"+15551234567","Body":"STOP"}';
    const hash = createHash("sha256").update(rawBody, "utf8").digest("hex");
    const jsonUrl = `${url}?bodySHA256=${hash}`;
    const signature = computeTwilioSignature(AUTH_TOKEN, jsonUrl, {});

    expect(
      evaluateTwilioWebhookAuth({ ...base, urls: [jsonUrl], params: {}, isForm: false, rawBody, signature }),
    ).toEqual({ ok: true, mode: "verified" });

    // Same signature, body swapped underneath it.
    expect(
      evaluateTwilioWebhookAuth({
        ...base,
        urls: [jsonUrl],
        params: {},
        isForm: false,
        rawBody: rawBody.replace("STOP", "START"),
        signature,
      }),
    ).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects a JSON request whose URL carries no bodySHA256", () => {
    const signature = computeTwilioSignature(AUTH_TOKEN, url, {});
    const got = evaluateTwilioWebhookAuth({
      ...base,
      params: {},
      isForm: false,
      rawBody: '{"From":"+15551234567","Body":"STOP"}',
      signature,
    });
    expect(got).toMatchObject({ ok: false, status: 403 });
  });

  it("accepts when any candidate URL matches (proxy scheme/host rewrite)", () => {
    const got = evaluateTwilioWebhookAuth({
      ...base,
      urls: ["http://internal:5001/api/webhooks/sms", url],
      signature: sign(),
    });
    expect(got).toEqual({ ok: true, mode: "verified" });
  });
});

// -----------------------------------------------------------------------------
// Route-level behavior. registerWebhookRoutes takes an Express app, so a minimal
// stub captures the handler and it is driven with fake req/res objects — no HTTP
// server and no database, which keeps this in the unit lane.
// -----------------------------------------------------------------------------

type Handler = (req: any, res: any) => Promise<unknown>;

// Keyed BY PATH, not "last one wins". registerWebhookRoutes now registers more
// than one route, and an overwriting capture would silently hand every test in
// this file the handler that happens to be registered last — the tests would
// still pass, against the wrong endpoint.
function captureHandler(storage: Partial<IStorage>, path = "/api/webhooks/sms"): Handler {
  const handlers = new Map<string, Handler>();
  const app = { post: (p: string, h: Handler) => { handlers.set(p, h); } };
  registerWebhookRoutes(app as never, storage as IStorage);
  const handler = handlers.get(path);
  if (!handler) throw new Error(`route ${path} was not registered`);
  return handler;
}

function fakeRes() {
  return {
    statusCode: 200,
    payload: undefined as unknown,
    ended: false,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.payload = body; return this; },
    end() { this.ended = true; return this; },
  };
}

function formRequest(params: Record<string, string>, signature?: string) {
  return {
    originalUrl: "/api/webhooks/sms",
    protocol: "https",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      host: "www.homiquity.com",
      ...(signature === undefined ? {} : { "x-twilio-signature": signature }),
    },
    get(header: string) { return (this.headers as Record<string, string>)[header.toLowerCase()]; },
    body: params,
  };
}

const SIGNED_URL = "https://www.homiquity.com/api/webhooks/sms";

describe("POST /api/webhooks/sms", () => {
  const originalToken = process.env.TWILIO_AUTH_TOKEN;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalConfiguredUrl = process.env.TWILIO_WEBHOOK_URL;
  let storage: {
    setSmsOptOut: ReturnType<typeof vi.fn>;
    applyLeadContactabilityByPhone: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    delete process.env.TWILIO_WEBHOOK_URL;
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
    storage = {
      setSmsOptOut: vi.fn().mockResolvedValue({}),
      applyLeadContactabilityByPhone: vi.fn().mockResolvedValue(2),
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalToken === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = originalToken;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalConfiguredUrl === undefined) delete process.env.TWILIO_WEBHOOK_URL;
    else process.env.TWILIO_WEBHOOK_URL = originalConfiguredUrl;
  });

  it("accepts a validly signed STOP and records the opt-out", async () => {
    const params = { From: "+1 (555) 123-4567", Body: "STOP" };
    const req = formRequest(params, computeTwilioSignature(AUTH_TOKEN, SIGNED_URL, params));
    const res = fakeRes();

    await captureHandler(storage)(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ ok: true, action: "opted_out", leadsUpdated: 2 });
    expect(storage.setSmsOptOut).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "15551234567", optedOut: true, keyword: "STOP" }),
    );
    expect(storage.applyLeadContactabilityByPhone).toHaveBeenCalledWith("15551234567", true);
  });

  it("rejects a tampered body with 403 and mutates nothing", async () => {
    // Signature is valid for this From, but the attacker swaps in another number.
    const signed = { From: "+15551234567", Body: "STOP" };
    const signature = computeTwilioSignature(AUTH_TOKEN, SIGNED_URL, signed);
    const req = formRequest({ From: "+15559999999", Body: "STOP" }, signature);
    const res = fakeRes();

    await captureHandler(storage)(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.payload).toMatchObject({ error: "Invalid webhook signature" });
    expect(storage.setSmsOptOut).not.toHaveBeenCalled();
    expect(storage.applyLeadContactabilityByPhone).not.toHaveBeenCalled();
  });

  it("rejects a request with no X-Twilio-Signature header", async () => {
    const req = formRequest({ From: "+15551234567", Body: "STOP" });
    const res = fakeRes();

    await captureHandler(storage)(req, res);

    expect(res.statusCode).toBe(403);
    expect(storage.setSmsOptOut).not.toHaveBeenCalled();
  });

  it("rejects a forged START — nobody gets re-subscribed without a signature", async () => {
    const req = formRequest({ From: "+15551234567", Body: "START" }, "AAAAAAAAAAAAAAAAAAAAAAAAAAA=");
    const res = fakeRes();

    await captureHandler(storage)(req, res);

    expect(res.statusCode).toBe(403);
    expect(storage.setSmsOptOut).not.toHaveBeenCalled();
  });

  it("returns 503 in production when TWILIO_AUTH_TOKEN is unset", async () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    process.env.NODE_ENV = "production";
    const params = { From: "+15551234567", Body: "STOP" };
    const req = formRequest(params, computeTwilioSignature(AUTH_TOKEN, SIGNED_URL, params));
    const res = fakeRes();

    await captureHandler(storage)(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.payload).toMatchObject({ error: "Webhook not configured" });
    expect(storage.setSmsOptOut).not.toHaveBeenCalled();
  });

  it("keeps an authentic STOP suppressing even when the lead sweep fails", async () => {
    // The opt-out fail-safe: the ledger row is what stops outbound messaging, so
    // a failure of the best-effort lead sweep must not lose it or 500 the caller.
    storage.applyLeadContactabilityByPhone.mockRejectedValue(new Error("db unavailable"));
    const params = { From: "+15551234567", Body: "STOP" };
    const req = formRequest(params, computeTwilioSignature(AUTH_TOKEN, SIGNED_URL, params));
    const res = fakeRes();

    await captureHandler(storage)(req, res);

    expect(storage.setSmsOptOut).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "15551234567", optedOut: true }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ ok: true, action: "opted_out", leadsUpdated: 0 });
  });

  it("still processes the provider-agnostic JSON path when no token is configured (dev)", async () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    process.env.NODE_ENV = "test";
    const req = {
      originalUrl: "/api/webhooks/sms",
      protocol: "http",
      headers: { "content-type": "application/json", host: "localhost:5001" },
      get(header: string) { return (this.headers as Record<string, string>)[header.toLowerCase()]; },
      body: { from: "+15551234567", message: "STOP" },
    };
    const res = fakeRes();

    await captureHandler(storage)(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ ok: true, action: "opted_out" });
  });

  it("accepts a validly signed JSON body via bodySHA256", async () => {
    const rawBody = JSON.stringify({ From: "+15551234567", Body: "STOP" });
    const hash = createHash("sha256").update(rawBody, "utf8").digest("hex");
    const signedUrl = `${SIGNED_URL}?bodySHA256=${hash}`;
    const req = {
      originalUrl: `/api/webhooks/sms?bodySHA256=${hash}`,
      protocol: "https",
      headers: {
        "content-type": "application/json",
        host: "www.homiquity.com",
        "x-twilio-signature": computeTwilioSignature(AUTH_TOKEN, signedUrl, {}),
      },
      get(header: string) { return (this.headers as Record<string, string>)[header.toLowerCase()]; },
      body: JSON.parse(rawBody),
      rawBody: Buffer.from(rawBody, "utf8"),
    };
    const res = fakeRes();

    await captureHandler(storage)(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ ok: true, action: "opted_out" });
  });

  it("rejects a JSON body swapped underneath a valid signature", async () => {
    const signedBody = JSON.stringify({ From: "+15551234567", Body: "STOP" });
    const hash = createHash("sha256").update(signedBody, "utf8").digest("hex");
    const signedUrl = `${SIGNED_URL}?bodySHA256=${hash}`;
    const tampered = JSON.stringify({ From: "+15559999999", Body: "STOP" });
    const req = {
      originalUrl: `/api/webhooks/sms?bodySHA256=${hash}`,
      protocol: "https",
      headers: {
        "content-type": "application/json",
        host: "www.homiquity.com",
        "x-twilio-signature": computeTwilioSignature(AUTH_TOKEN, signedUrl, {}),
      },
      get(header: string) { return (this.headers as Record<string, string>)[header.toLowerCase()]; },
      body: JSON.parse(tampered),
      rawBody: Buffer.from(tampered, "utf8"),
    };
    const res = fakeRes();

    await captureHandler(storage)(req, res);

    expect(res.statusCode).toBe(403);
    expect(storage.setSmsOptOut).not.toHaveBeenCalled();
  });
});
