import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The module reads SENTRY_DSN at import time, so each test sets env then
// imports a fresh copy via resetModules.
describe("errorMonitoring", () => {
  const OLD_ENV = process.env.SENTRY_DSN;

  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    process.env.SENTRY_DSN = OLD_ENV;
    vi.restoreAllMocks();
  });

  it("is disabled and a no-op when SENTRY_DSN is unset", async () => {
    delete process.env.SENTRY_DSN;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const mod = await import("../server/services/errorMonitoring");
    expect(mod.isErrorMonitoringEnabled()).toBe(false);
    mod.captureException(new Error("boom"));
    mod.captureMessage("hi", "info");
    // Give any (unexpected) async send a tick.
    await new Promise((r) => setTimeout(r, 5));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts an exception to the parsed Sentry ingest URL with the auth header", async () => {
    process.env.SENTRY_DSN = "https://abc123@o42.ingest.sentry.io/98765";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const mod = await import("../server/services/errorMonitoring");
    expect(mod.isErrorMonitoringEnabled()).toBe(true);

    mod.captureException(new Error("kaboom"), { path: "/api/x" });
    await new Promise((r) => setTimeout(r, 5));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://o42.ingest.sentry.io/api/98765/store/");
    const auth = (init.headers as Record<string, string>)["X-Sentry-Auth"];
    expect(auth).toContain("sentry_key=abc123");
    const body = JSON.parse(init.body as string);
    expect(body.exception.values[0].value).toBe("kaboom");
    expect(body.exception.values[0].type).toBe("Error");
    expect(body.extra.path).toBe("/api/x");
    expect(body.event_id).toMatch(/^[0-9a-f]{32}$/);
  });
});
