import { describe, it, expect, afterEach } from "vitest";
import { isRateLimitRelaxed } from "../server/services/rateLimitPolicy";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env.RATE_LIMIT_RELAXED = ORIGINAL_ENV.RATE_LIMIT_RELAXED;
  process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;
});

describe("isRateLimitRelaxed", () => {
  it("is off by default (flag unset)", () => {
    delete process.env.RATE_LIMIT_RELAXED;
    expect(isRateLimitRelaxed()).toBe(false);
  });

  it("is on when RATE_LIMIT_RELAXED=true outside production", () => {
    process.env.RATE_LIMIT_RELAXED = "true";
    process.env.NODE_ENV = "development";
    expect(isRateLimitRelaxed()).toBe(true);
  });

  it("requires the exact string 'true'", () => {
    process.env.NODE_ENV = "development";
    for (const v of ["1", "TRUE", "yes", ""]) {
      process.env.RATE_LIMIT_RELAXED = v;
      expect(isRateLimitRelaxed(), `value ${JSON.stringify(v)}`).toBe(false);
    }
  });

  it("is ALWAYS off in production, even with the flag set", () => {
    process.env.RATE_LIMIT_RELAXED = "true";
    process.env.NODE_ENV = "production";
    expect(isRateLimitRelaxed()).toBe(false);
  });
});
