import { describe, it, expect } from "vitest";
import { format } from "date-fns";
import { NO_DATE, formatDateSafe, formatDistanceToNowSafe, isUsableDate } from "./dates";

describe("formatDateSafe", () => {
  it("formats a real date exactly as date-fns would", () => {
    // Behaviour-preservation is the whole contract: every call site that works
    // today must render byte-identically after being routed through here.
    const iso = "2026-03-14T15:09:26.000Z";
    for (const pattern of ["MMM d, yyyy", "MMMM d, yyyy", "MMM d, yyyy 'at' h:mm a", "M/yy"]) {
      expect(formatDateSafe(iso, pattern)).toBe(format(new Date(iso), pattern));
    }
  });

  it("accepts Date and epoch-millis inputs, not just strings", () => {
    const d = new Date("2026-03-14T00:00:00.000Z");
    expect(formatDateSafe(d, "yyyy")).toBe("2026");
    expect(formatDateSafe(d.getTime(), "yyyy")).toBe("2026");
  });

  it("returns the fallback for null instead of rendering the epoch", () => {
    // The case that motivated the file. `new Date(null)` is 1970-01-01, so the
    // unguarded call renders a confident, wrong date rather than failing.
    expect(new Date(null as never).getTime()).toBe(0); // the trap, pinned
    expect(formatDateSafe(null, "MMM d, yyyy")).toBe(NO_DATE);
    expect(formatDateSafe(null, "MMM d, yyyy")).not.toMatch(/1970/);
  });

  it("returns the fallback for undefined and empty string instead of throwing", () => {
    // Both of these throw RangeError inside date-fns, which unmounts the
    // subtree up to the nearest error boundary mid-render.
    expect(() => format(new Date(undefined as never), "MMM d")).toThrow(RangeError);
    expect(formatDateSafe(undefined, "MMM d, yyyy")).toBe(NO_DATE);
    expect(formatDateSafe("", "MMM d, yyyy")).toBe(NO_DATE);
  });

  it("returns the fallback for unparseable values", () => {
    expect(formatDateSafe("not a date", "MMM d, yyyy")).toBe(NO_DATE);
    expect(formatDateSafe(NaN, "MMM d, yyyy")).toBe(NO_DATE);
  });

  it("honours a caller-supplied fallback", () => {
    expect(formatDateSafe(null, "MMM d, yyyy", "Not scheduled")).toBe("Not scheduled");
  });

  it("treats 0 as the epoch when passed deliberately", () => {
    // Only `null` is reinterpreted. An explicit 0 is a real instant and a
    // caller asking for it should get it — the guard must not overreach.
    expect(formatDateSafe(0, "yyyy")).toBe(format(new Date(0), "yyyy"));
  });
});

describe("formatDistanceToNowSafe", () => {
  it("matches date-fns for a real date and passes options through", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3);
    expect(formatDistanceToNowSafe(past, { addSuffix: true })).toMatch(/3 days ago/);
    expect(formatDistanceToNowSafe(past)).toMatch(/3 days/);
  });

  it("returns the fallback rather than 'over 56 years ago'", () => {
    // What an unguarded null renders today. Plausible enough to survive a
    // skim of a queue, which is what makes it worse than a crash.
    expect(formatDistanceToNowSafe(null, { addSuffix: true })).toBe(NO_DATE);
    expect(formatDistanceToNowSafe(undefined, { addSuffix: true })).toBe(NO_DATE);
    expect(formatDistanceToNowSafe("", { addSuffix: true })).toBe(NO_DATE);
  });
});

describe("isUsableDate", () => {
  it("separates real instants from absent and unparseable ones", () => {
    expect(isUsableDate("2026-03-14T00:00:00.000Z")).toBe(true);
    expect(isUsableDate(new Date())).toBe(true);
    expect(isUsableDate(0)).toBe(true);
    expect(isUsableDate(null)).toBe(false);
    expect(isUsableDate(undefined)).toBe(false);
    expect(isUsableDate("")).toBe(false);
    expect(isUsableDate("nope")).toBe(false);
  });
});
