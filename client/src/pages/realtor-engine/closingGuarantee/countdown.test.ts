import { describe, it, expect } from "vitest";
import { EXPIRED_LABEL, elapsedPercent, formatRemaining, remainingUntil } from "./countdown";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatRemaining", () => {
  it("reads Expired at or past the target", () => {
    // A guarantee that just lapsed must not read "0 minutes remaining".
    expect(formatRemaining(0)).toBe(EXPIRED_LABEL);
    expect(formatRemaining(-1)).toBe(EXPIRED_LABEL);
    expect(formatRemaining(-5 * DAY)).toBe(EXPIRED_LABEL);
  });

  it("shows days and hours when more than a day remains", () => {
    expect(formatRemaining(2 * DAY + 3 * HOUR)).toBe("2 days, 3 hours remaining");
    expect(formatRemaining(1 * DAY + 1 * HOUR)).toBe("1 day, 1 hour remaining");
  });

  it("shows hours and minutes inside a day", () => {
    expect(formatRemaining(5 * HOUR + 30 * MIN)).toBe("5 hours, 30 min remaining");
    expect(formatRemaining(1 * HOUR + 1 * MIN)).toBe("1 hour, 1 min remaining");
  });

  it("shows minutes only inside an hour", () => {
    expect(formatRemaining(45 * MIN)).toBe("45 minutes remaining");
    expect(formatRemaining(1 * MIN)).toBe("1 minute remaining");
  });

  it("pluralises each unit independently", () => {
    // The singular/plural is per-unit, so a 1-day/2-hour gap mixes both.
    expect(formatRemaining(1 * DAY + 2 * HOUR)).toBe("1 day, 2 hours remaining");
    expect(formatRemaining(2 * DAY + 1 * HOUR)).toBe("2 days, 1 hour remaining");
  });

  it("floors rather than rounds, so it never overstates the time left", () => {
    // 59 minutes 59 seconds is "59 minutes", not "1 hour".
    expect(formatRemaining(59 * MIN + 59_000)).toBe("59 minutes remaining");
    expect(formatRemaining(23 * HOUR + 59 * MIN)).toBe("23 hours, 59 min remaining");
  });
});

describe("remainingUntil", () => {
  it("measures from the supplied clock rather than the real one", () => {
    const now = Date.parse("2026-03-01T00:00:00.000Z");
    expect(remainingUntil("2026-03-03T06:00:00.000Z", now)).toBe("2 days, 6 hours remaining");
    expect(remainingUntil("2026-02-28T00:00:00.000Z", now)).toBe(EXPIRED_LABEL);
  });
});

describe("elapsedPercent", () => {
  const created = "2026-03-01T00:00:00.000Z";
  const target = "2026-03-11T00:00:00.000Z"; // 10 days

  it("reports the share of the window that has elapsed", () => {
    expect(elapsedPercent(created, target, Date.parse("2026-03-06T00:00:00.000Z"))).toBe(50);
    expect(elapsedPercent(created, target, Date.parse("2026-03-01T00:00:00.000Z"))).toBe(0);
  });

  it("clamps at both ends", () => {
    // Past due must read 100%, not 180%; a clock before creation must read 0%.
    expect(elapsedPercent(created, target, Date.parse("2026-03-19T00:00:00.000Z"))).toBe(100);
    expect(elapsedPercent(created, target, Date.parse("2026-02-01T00:00:00.000Z"))).toBe(0);
  });

  it("is 0 for a non-positive window rather than dividing by zero", () => {
    // Same instant, or a target before creation — both would yield NaN or
    // -Infinity and render as an unbounded bar.
    expect(elapsedPercent(created, created, Date.parse("2026-03-05T00:00:00.000Z"))).toBe(0);
    expect(elapsedPercent(target, created, Date.parse("2026-03-05T00:00:00.000Z"))).toBe(0);
  });
});
