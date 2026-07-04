import { describe, it, expect } from "vitest";
import {
  classifyAdverseActionDelivery,
  daysBetween,
  ECOA_DELIVERY_WINDOW_DAYS,
  ECOA_DELIVERY_WARNING_DAYS,
} from "../server/services/adverseActionDelivery";

// ---------------------------------------------------------------------------
// ECOA / Reg B §1002.9(a)(1): an applicant must be NOTIFIED of adverse action
// within 30 days. These tests pin the delivery-window classification that the
// daily watchdog uses to decide when a generated-but-undelivered notice needs a
// staff task. A threshold change here changes a compliance obligation, so it
// must be deliberate.
// ---------------------------------------------------------------------------

const NOW = new Date("2026-07-04T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe("classifyAdverseActionDelivery", () => {
  it("is 'delivered' whenever a delivery timestamp exists, regardless of age", () => {
    expect(
      classifyAdverseActionDelivery(
        { noticeDate: daysAgo(90), deliveredAt: daysAgo(80) },
        NOW,
      ),
    ).toBe("delivered");
  });

  it("is 'on_track' for a fresh undelivered notice", () => {
    expect(
      classifyAdverseActionDelivery({ noticeDate: daysAgo(3), deliveredAt: null }, NOW),
    ).toBe("on_track");
  });

  it("is 'on_track' the day before the warning band opens", () => {
    expect(
      classifyAdverseActionDelivery(
        { noticeDate: daysAgo(ECOA_DELIVERY_WARNING_DAYS - 1), deliveredAt: null },
        NOW,
      ),
    ).toBe("on_track");
  });

  it("becomes 'warning' exactly at the warning threshold", () => {
    expect(
      classifyAdverseActionDelivery(
        { noticeDate: daysAgo(ECOA_DELIVERY_WARNING_DAYS), deliveredAt: null },
        NOW,
      ),
    ).toBe("warning");
  });

  it("stays 'warning' the day before the statutory deadline", () => {
    expect(
      classifyAdverseActionDelivery(
        { noticeDate: daysAgo(ECOA_DELIVERY_WINDOW_DAYS - 1), deliveredAt: null },
        NOW,
      ),
    ).toBe("warning");
  });

  it("becomes 'breach' exactly at the 30-day statutory deadline", () => {
    expect(
      classifyAdverseActionDelivery(
        { noticeDate: daysAgo(ECOA_DELIVERY_WINDOW_DAYS), deliveredAt: null },
        NOW,
      ),
    ).toBe("breach");
  });

  it("stays 'breach' well past the deadline", () => {
    expect(
      classifyAdverseActionDelivery({ noticeDate: daysAgo(120), deliveredAt: null }, NOW),
    ).toBe("breach");
  });

  it("treats an undelivered notice with no generation date as a 'warning' (surface, don't ignore)", () => {
    expect(
      classifyAdverseActionDelivery({ noticeDate: null, deliveredAt: null }, NOW),
    ).toBe("warning");
  });
});

describe("daysBetween", () => {
  it("floors partial days", () => {
    const start = new Date("2026-07-01T00:00:00Z");
    const end = new Date("2026-07-03T23:00:00Z"); // 2 days + 23h
    expect(daysBetween(start, end)).toBe(2);
  });

  it("never returns a negative span", () => {
    expect(daysBetween(NOW, daysAgo(5))).toBe(0);
  });
});
