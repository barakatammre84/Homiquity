import { describe, it, expect } from "vitest";
import {
  resolveTimezoneFromZip,
  localHourInTimezone,
  isWithinCallingWindow,
  isContactAllowed,
} from "../server/services/quietHours";

describe("resolveTimezoneFromZip", () => {
  it("maps representative ZIPs to their timezone", () => {
    expect(resolveTimezoneFromZip("10001")).toBe("America/New_York"); // NYC
    expect(resolveTimezoneFromZip("60601")).toBe("America/Chicago"); // Chicago
    expect(resolveTimezoneFromZip("80202")).toBe("America/Denver"); // Denver
    expect(resolveTimezoneFromZip("85001")).toBe("America/Phoenix"); // Phoenix (no DST)
    expect(resolveTimezoneFromZip("90210")).toBe("America/Los_Angeles"); // Beverly Hills
    expect(resolveTimezoneFromZip("96801")).toBe("Pacific/Honolulu"); // Honolulu
    expect(resolveTimezoneFromZip("99501")).toBe("America/Anchorage"); // Anchorage
  });

  it("accepts ZIP+4 and trims", () => {
    expect(resolveTimezoneFromZip("12345-6789")).toBe("America/New_York");
    expect(resolveTimezoneFromZip("  90001 ")).toBe("America/Los_Angeles");
  });

  it("returns null for missing or malformed ZIPs", () => {
    expect(resolveTimezoneFromZip(null)).toBeNull();
    expect(resolveTimezoneFromZip("")).toBeNull();
    expect(resolveTimezoneFromZip("abcde")).toBeNull();
    expect(resolveTimezoneFromZip("12")).toBeNull();
  });
});

describe("localHourInTimezone (July / DST)", () => {
  // 2026-07-15T14:00:00Z. EDT = UTC-4 -> 10:00; PDT = UTC-7 -> 07:00.
  const instant = new Date("2026-07-15T14:00:00Z");
  it("computes wall-clock hour per zone", () => {
    expect(localHourInTimezone(instant, "America/New_York")).toBe(10);
    expect(localHourInTimezone(instant, "America/Los_Angeles")).toBe(7);
    expect(localHourInTimezone(instant, "Pacific/Honolulu")).toBe(4); // UTC-10, no DST
  });
});

describe("isWithinCallingWindow", () => {
  it("is inclusive of 8 AM and exclusive of 9 PM", () => {
    // NY 08:00 -> 12:00Z (EDT); NY 21:00 -> 01:00Z next day.
    expect(isWithinCallingWindow(new Date("2026-07-15T12:00:00Z"), "America/New_York")).toBe(true); // 8 AM
    expect(isWithinCallingWindow(new Date("2026-07-16T01:00:00Z"), "America/New_York")).toBe(false); // 9 PM
    expect(isWithinCallingWindow(new Date("2026-07-15T11:00:00Z"), "America/New_York")).toBe(false); // 7 AM
    expect(isWithinCallingWindow(new Date("2026-07-16T00:00:00Z"), "America/New_York")).toBe(true); // 8 PM
  });
});

describe("isContactAllowed", () => {
  it("allows contact inside the window for a resolved ZIP", () => {
    const d = isContactAllowed({ zip: "10001", now: new Date("2026-07-15T14:00:00Z") }); // NY 10 AM
    expect(d.allowed).toBe(true);
    expect(d.timezone).toBe("America/New_York");
    expect(d.localHour).toBe(10);
  });

  it("blocks contact during quiet hours for a resolved ZIP", () => {
    // 2026-07-15T11:00:00Z -> NY 07:00 (before 8 AM).
    const d = isContactAllowed({ zip: "10001", now: new Date("2026-07-15T11:00:00Z") });
    expect(d.allowed).toBe(false);
    expect(d.localHour).toBe(7);
  });

  it("honors an explicit timezone over the ZIP", () => {
    // Same instant: LA is 07:00 (quiet) even though the ZIP would resolve east.
    const d = isContactAllowed({ zip: "10001", timezone: "America/Los_Angeles", now: new Date("2026-07-15T14:00:00Z") });
    expect(d.timezone).toBe("America/Los_Angeles");
    expect(d.localHour).toBe(7);
    expect(d.allowed).toBe(false);
  });

  it("fails safe for an unknown ZIP: blocked unless inside the window at both US extremes", () => {
    // 14:00Z: NY 10:00 (in) but Honolulu 04:00 (out) -> blocked.
    const blocked = isContactAllowed({ zip: "ZZZZZ", now: new Date("2026-07-15T14:00:00Z") });
    expect(blocked.allowed).toBe(false);
    expect(blocked.timezone).toBe("uncertain");

    // 19:00Z: NY 15:00 (in) and Honolulu 09:00 (in) -> allowed.
    const ok = isContactAllowed({ zip: null, now: new Date("2026-07-15T19:00:00Z") });
    expect(ok.allowed).toBe(true);
    expect(ok.timezone).toBe("uncertain");
  });
});
