import { describe, it, expect } from "vitest";
import { friendlyApiError } from "../client/src/lib/errorMessage";

// friendlyApiError turns apiRequest's "<status>: <body>" errors into
// borrower-safe toast copy without leaking raw envelopes or server-fault detail.
describe("friendlyApiError", () => {
  it("hides server-fault (5xx) detail behind the fallback", () => {
    const err = new Error('500: {"error":"Failed to register document"}');
    expect(friendlyApiError(err, "fallback")).toBe("fallback");
  });

  it("surfaces the server message for client-fault (4xx) responses", () => {
    const err = new Error('400: {"error":"Invalid file type"}');
    expect(friendlyApiError(err)).toBe("Invalid file type");
  });

  it("falls back to message when only a message field is present", () => {
    const err = new Error('422: {"message":"Down payment must be less than the purchase price"}');
    expect(friendlyApiError(err)).toBe("Down payment must be less than the purchase price");
  });

  it("passes through a custom (non-status) error unchanged", () => {
    const err = new Error("Choose a file first");
    expect(friendlyApiError(err)).toBe("Choose a file first");
  });

  it("uses a non-JSON 4xx body as-is", () => {
    const err = new Error("400: Bad Request");
    expect(friendlyApiError(err)).toBe("Bad Request");
  });

  it("falls back on an HTML error page", () => {
    const err = new Error("500: <!DOCTYPE html><html>...</html>");
    expect(friendlyApiError(err, "fallback")).toBe("fallback");
  });

  it("falls back on empty / non-error input", () => {
    expect(friendlyApiError(new Error(""), "fallback")).toBe("fallback");
    expect(friendlyApiError(undefined, "fallback")).toBe("fallback");
    expect(friendlyApiError(null, "fallback")).toBe("fallback");
  });

  it("falls back on a stringified object body", () => {
    const err = new Error("400: [object Object]");
    expect(friendlyApiError(err, "fallback")).toBe("fallback");
  });

  it("accepts a plain string error", () => {
    expect(friendlyApiError("just a string")).toBe("just a string");
  });

  // A 503 with our JSON envelope is a deliberate maintenance response
  // (INTAKE_PAUSED kill switch) — its message is written for the borrower.
  it("surfaces a deliberate 503 maintenance envelope", () => {
    const err = new Error(
      '503: {"error":"We\'re briefly paused for scheduled maintenance.","code":"INTAKE_PAUSED"}',
    );
    expect(friendlyApiError(err, "fallback")).toBe(
      "We're briefly paused for scheduled maintenance.",
    );
  });

  it("still hides a 503 without a JSON envelope (proxy/platform outage)", () => {
    expect(friendlyApiError(new Error("503: Service Unavailable"), "fallback")).toBe("fallback");
    expect(friendlyApiError(new Error("503: <html>gateway</html>"), "fallback")).toBe("fallback");
  });
});
