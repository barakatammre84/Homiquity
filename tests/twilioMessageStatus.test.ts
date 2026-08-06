import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  parseMessageStatusEvent,
  classifyMessageStatus,
  OPT_OUT_ERROR_CODE,
} from "../server/services/twilioMessageStatus";
import { computeTwilioSignature } from "../server/services/twilioSignature";
import { registerWebhookRoutes } from "../server/routes/webhooks";
import type { IStorage } from "../server/storage";

// -----------------------------------------------------------------------------
// Outbound delivery receipts — POST /api/webhooks/sms/status.
//
// The endpoint exists to give Twilio's "Status callback URL" field a real target,
// but its reason to exist beyond logging is error 21610: Twilio holding an
// opt-out our ledger never saw. These tests pin (a) that 21610 and ONLY 21610
// converges the ledger, and (b) that the endpoint is authenticated as strictly
// as the inbound one, against its OWN configured URL.
// -----------------------------------------------------------------------------

const AUTH_TOKEN = "test-auth-token-not-a-real-secret";
const STATUS_URL = "https://www.homiquity.com/api/webhooks/sms/status";
const INBOUND_URL = "https://www.homiquity.com/api/webhooks/sms";

describe("parseMessageStatusEvent", () => {
  it("reads Twilio's canonical PascalCase form fields", () => {
    const event = parseMessageStatusEvent({
      MessageSid: "SM0123456789abcdef0123456789abcdef",
      MessageStatus: "delivered",
      To: "+1 (555) 123-4567",
      From: "+13125551234",
    });
    expect(event).toEqual({
      messageSid: "SM0123456789abcdef0123456789abcdef",
      to: "15551234567",
      status: "delivered",
      errorCode: null,
    });
  });

  it("accepts the lowercase provider-agnostic variants used for local testing", () => {
    const event = parseMessageStatusEvent({ sid: "SM1", status: "failed", to: "5551234567", errorCode: 21610 });
    expect(event).toMatchObject({ messageSid: "SM1", status: "failed", to: "15551234567", errorCode: "21610" });
  });

  it("coerces a numeric ErrorCode — JSON sends it unquoted", () => {
    expect(parseMessageStatusEvent({ ErrorCode: 21610 }).errorCode).toBe("21610");
    expect(parseMessageStatusEvent({ ErrorCode: "21610" }).errorCode).toBe("21610");
  });

  it("lowercases the status so casing drift cannot change the classification", () => {
    expect(parseMessageStatusEvent({ MessageStatus: "DELIVERED" }).status).toBe("delivered");
  });

  it("treats empty and whitespace-only values as absent", () => {
    const event = parseMessageStatusEvent({ MessageSid: "", MessageStatus: "   ", ErrorCode: "" });
    expect(event).toMatchObject({ messageSid: null, status: null, errorCode: null });
  });

  it("takes the first value when a key is repeated (urlencoded arrays)", () => {
    // A hostile duplicate key must not stringify into "21610,0" and slip past
    // the exact-match opt-out comparison.
    expect(parseMessageStatusEvent({ ErrorCode: ["21610", "0"] }).errorCode).toBe("21610");
  });

  it("returns to: null for a number it cannot normalize", () => {
    expect(parseMessageStatusEvent({ To: "not-a-phone" }).to).toBeNull();
    expect(parseMessageStatusEvent({}).to).toBeNull();
  });
});

describe("classifyMessageStatus", () => {
  const event = (over: Partial<ReturnType<typeof parseMessageStatusEvent>> = {}) => ({
    messageSid: "SM1",
    to: "15551234567",
    status: "delivered",
    errorCode: null,
    ...over,
  });

  it("classifies the documented statuses", () => {
    expect(classifyMessageStatus(event({ status: "delivered" })).outcome).toBe("delivered");
    expect(classifyMessageStatus(event({ status: "failed" })).outcome).toBe("failed");
    expect(classifyMessageStatus(event({ status: "undelivered" })).outcome).toBe("failed");
    expect(classifyMessageStatus(event({ status: "queued" })).outcome).toBe("in_flight");
    expect(classifyMessageStatus(event({ status: "sent" })).outcome).toBe("in_flight");
  });

  it("carries an unrecognized status through as 'unknown' rather than throwing", () => {
    // Twilio documents that they add properties and event types without notice.
    // A future status must not become a 4xx, which would mark the webhook
    // unhealthy and get delivery attempts throttled.
    expect(classifyMessageStatus(event({ status: "teleported" })).outcome).toBe("unknown");
    expect(classifyMessageStatus(event({ status: null })).outcome).toBe("unknown");
  });

  it("records an opt-out for 21610 — Twilio knows about a STOP the ledger missed", () => {
    const got = classifyMessageStatus(event({ status: "failed", errorCode: OPT_OUT_ERROR_CODE }));
    expect(got).toEqual({ outcome: "failed", recordOptOut: true });
  });

  it("does NOT treat other failures as consent signals", () => {
    // 30004 "Message blocked" can be carrier filtering, a landline, or a
    // powered-off handset — suppressing on it would silently stop texting
    // borrowers who never opted out.
    for (const errorCode of ["30003", "30004", "30005", "30006", "21614"]) {
      const got = classifyMessageStatus(event({ status: "undelivered", errorCode }));
      expect(got).toMatchObject({ outcome: "failed", recordOptOut: false });
    }
  });

  it("does not record an opt-out it cannot key on a phone number", () => {
    const got = classifyMessageStatus(event({ status: "failed", errorCode: OPT_OUT_ERROR_CODE, to: null }));
    expect(got.recordOptOut).toBe(false);
  });

  it("never resubscribes on success — suppression is one-directional", () => {
    expect(classifyMessageStatus(event({ status: "delivered" })).recordOptOut).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// Route behavior. Same stub-app approach as tests/twilioWebhookSignature.ts —
// no HTTP server, no database.
// -----------------------------------------------------------------------------

type Handler = (req: any, res: any) => Promise<unknown>;

function captureStatusHandler(storage: Partial<IStorage>): Handler {
  const handlers = new Map<string, Handler>();
  const app = { post: (p: string, h: Handler) => { handlers.set(p, h); } };
  registerWebhookRoutes(app as never, storage as IStorage);
  const handler = handlers.get("/api/webhooks/sms/status");
  if (!handler) throw new Error("status callback route was not registered");
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

function statusRequest(params: Record<string, string>, signature?: string) {
  return {
    originalUrl: "/api/webhooks/sms/status",
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

const sign = (params: Record<string, string>, url = STATUS_URL) => computeTwilioSignature(AUTH_TOKEN, url, params);

describe("POST /api/webhooks/sms/status", () => {
  const originalToken = process.env.TWILIO_AUTH_TOKEN;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalInboundUrl = process.env.TWILIO_WEBHOOK_URL;
  const originalStatusUrl = process.env.TWILIO_STATUS_CALLBACK_URL;
  let storage: {
    setSmsOptOut: ReturnType<typeof vi.fn>;
    applyLeadContactabilityByPhone: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    delete process.env.TWILIO_WEBHOOK_URL;
    delete process.env.TWILIO_STATUS_CALLBACK_URL;
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
    storage = {
      setSmsOptOut: vi.fn().mockResolvedValue({}),
      applyLeadContactabilityByPhone: vi.fn().mockResolvedValue(1),
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const [key, value] of [
      ["TWILIO_AUTH_TOKEN", originalToken],
      ["NODE_ENV", originalNodeEnv],
      ["TWILIO_WEBHOOK_URL", originalInboundUrl],
      ["TWILIO_STATUS_CALLBACK_URL", originalStatusUrl],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("acknowledges a delivered receipt with 204 and writes nothing", async () => {
    const params = { MessageSid: "SM1", MessageStatus: "delivered", To: "+15551234567" };
    const res = fakeRes();

    await captureStatusHandler(storage)(statusRequest(params, sign(params)), res);

    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
    expect(storage.setSmsOptOut).not.toHaveBeenCalled();
  });

  it("converges the ledger on 21610 with honest provenance", async () => {
    const params = { MessageSid: "SM1", MessageStatus: "failed", To: "+15551234567", ErrorCode: "21610" };
    const res = fakeRes();

    await captureStatusHandler(storage)(statusRequest(params, sign(params)), res);

    expect(res.statusCode).toBe(204);
    expect(storage.setSmsOptOut).toHaveBeenCalledWith({
      phone: "15551234567",
      optedOut: true,
      // Nobody typed a keyword — recording "STOP" here would falsify the record.
      keyword: null,
      source: "twilio_status_callback",
    });
    expect(storage.applyLeadContactabilityByPhone).toHaveBeenCalledWith("15551234567", true);
  });

  it("keeps the 21610 ledger row when the lead sweep fails", async () => {
    storage.applyLeadContactabilityByPhone.mockRejectedValue(new Error("db unavailable"));
    const params = { MessageSid: "SM1", MessageStatus: "failed", To: "+15551234567", ErrorCode: "21610" };
    const res = fakeRes();

    await captureStatusHandler(storage)(statusRequest(params, sign(params)), res);

    expect(storage.setSmsOptOut).toHaveBeenCalled();
    expect(res.statusCode).toBe(204); // not a 500 — the suppression was recorded
  });

  it("does not suppress on a non-consent failure", async () => {
    const params = { MessageSid: "SM1", MessageStatus: "undelivered", To: "+15551234567", ErrorCode: "30004" };
    const res = fakeRes();

    await captureStatusHandler(storage)(statusRequest(params, sign(params)), res);

    expect(res.statusCode).toBe(204);
    expect(storage.setSmsOptOut).not.toHaveBeenCalled();
    expect(storage.applyLeadContactabilityByPhone).not.toHaveBeenCalled();
  });

  it("accepts an unknown future status without erroring", async () => {
    const params = { MessageSid: "SM1", MessageStatus: "some_new_status_twilio_added", To: "+15551234567" };
    const res = fakeRes();

    await captureStatusHandler(storage)(statusRequest(params, sign(params)), res);

    expect(res.statusCode).toBe(204);
  });

  it("rejects an unsigned request and writes nothing", async () => {
    const params = { MessageSid: "SM1", MessageStatus: "failed", To: "+15551234567", ErrorCode: "21610" };
    const res = fakeRes();

    await captureStatusHandler(storage)(statusRequest(params), res);

    expect(res.statusCode).toBe(403);
    expect(storage.setSmsOptOut).not.toHaveBeenCalled();
  });

  it("rejects a forged opt-out — an attacker cannot suppress an arbitrary number", async () => {
    // Signature is valid for one recipient; the attacker swaps in another.
    const signed = { MessageSid: "SM1", MessageStatus: "failed", To: "+15551234567", ErrorCode: "21610" };
    const req = statusRequest({ ...signed, To: "+15559999999" }, sign(signed));
    const res = fakeRes();

    await captureStatusHandler(storage)(req, res);

    expect(res.statusCode).toBe(403);
    expect(storage.setSmsOptOut).not.toHaveBeenCalled();
  });

  it("returns 503 in production when TWILIO_AUTH_TOKEN is unset — fail CLOSED", async () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    process.env.NODE_ENV = "production";
    const params = { MessageSid: "SM1", MessageStatus: "delivered", To: "+15551234567" };
    const res = fakeRes();

    await captureStatusHandler(storage)(statusRequest(params, sign(params)), res);

    expect(res.statusCode).toBe(503);
    expect(res.payload).toMatchObject({ error: "Webhook not configured" });
  });

  it("does NOT inherit the inbound URL pin", async () => {
    // The regression this endpoint was designed against: TWILIO_WEBHOOK_URL pins
    // the INBOUND url. If the status callback reused it, the only candidate URL
    // would be an address Twilio never called for this endpoint, and a correctly
    // configured deployment would 403 every receipt.
    process.env.TWILIO_WEBHOOK_URL = INBOUND_URL;
    const params = { MessageSid: "SM1", MessageStatus: "delivered", To: "+15551234567" };
    const res = fakeRes();

    await captureStatusHandler(storage)(statusRequest(params, sign(params)), res);

    expect(res.statusCode).toBe(204);
  });

  it("honors its own pin when TWILIO_STATUS_CALLBACK_URL is set", async () => {
    process.env.TWILIO_STATUS_CALLBACK_URL = STATUS_URL;
    const params = { MessageSid: "SM1", MessageStatus: "delivered", To: "+15551234567" };
    const req = statusRequest(params, sign(params));
    // Host header points somewhere else entirely; the pin is what must match.
    req.headers.host = "internal.railway:5001";
    const res = fakeRes();

    await captureStatusHandler(storage)(req, res);

    expect(res.statusCode).toBe(204);
  });
});
