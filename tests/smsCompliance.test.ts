import { describe, it, expect } from "vitest";
import { normalizePhone, classifyKeyword, evaluateOutboundSms } from "../server/services/smsCompliance";

describe("normalizePhone", () => {
  it("normalizes common US formats to 1XXXXXXXXXX", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("15551234567");
    expect(normalizePhone("555-123-4567")).toBe("15551234567");
    expect(normalizePhone("+1 555 123 4567")).toBe("15551234567");
    expect(normalizePhone("15551234567")).toBe("15551234567");
    expect(normalizePhone("0015551234567")).toBe("15551234567");
  });
  it("rejects numbers that are too short", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe("classifyKeyword", () => {
  it("recognizes STOP-family keywords case- and punctuation-insensitively", () => {
    for (const w of ["STOP", "stop", " Stop. ", "UNSUBSCRIBE", "cancel", "QUIT", '"STOP"', "END"]) {
      expect(classifyKeyword(w)).toBe("stop");
    }
  });
  it("recognizes START and HELP", () => {
    expect(classifyKeyword("START")).toBe("start");
    expect(classifyKeyword("unstop")).toBe("start");
    expect(classifyKeyword("HELP")).toBe("help");
  });
  it("treats only the first word as the keyword", () => {
    expect(classifyKeyword("STOP texting me")).toBe("stop");
    expect(classifyKeyword("please stop")).toBe("unknown"); // 'please' is first
    expect(classifyKeyword("hello there")).toBe("unknown");
    expect(classifyKeyword("")).toBe("unknown");
  });
});

describe("evaluateOutboundSms", () => {
  const inWindow = new Date("2026-07-15T14:00:00Z"); // NY 10 AM

  it("blocks when the recipient has opted out, regardless of hour", () => {
    const r = evaluateOutboundSms({ optedOut: true, zip: "10001", now: inWindow });
    expect(r.canSend).toBe(false);
    expect(r.reason).toMatch(/opted out/i);
  });

  it("allows when not opted out and inside calling hours", () => {
    const r = evaluateOutboundSms({ optedOut: false, zip: "10001", now: inWindow });
    expect(r.canSend).toBe(true);
  });

  it("blocks during quiet hours even when not opted out", () => {
    // NY 07:00 (before 8 AM)
    const r = evaluateOutboundSms({ optedOut: false, zip: "10001", now: new Date("2026-07-15T11:00:00Z") });
    expect(r.canSend).toBe(false);
  });
});
