import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * F-037 — the production credit-simulation guard set must be symmetric.
 *
 * There are two entrances to fabricated bureau data:
 *   1. server/services/creditPulls.ts  simulateCreditPullCompletion  (guarded all along)
 *   2. server/mcp/vendors.ts           softPullCredit                (was NOT guarded)
 *
 * The second one's only gate was inverted — a vendor key PRESENT throws, a key
 * ABSENT fabricates — and no key can be present, since no vendor contract exists.
 * So it returned invented scores and tradelines under any NODE_ENV, and those
 * persist through recordExternalSoftPull as a completed pull.
 *
 * The consumer side mattered just as much: preUnderwriting selected the latest
 * completed pull with no `isSimulated` predicate, and its output persists flags,
 * materializes conditions and notifies the borrower.
 *
 * Source-level assertions (F-014 class). Justified here for the same reason as the
 * other guards in this repo: the defects are ABSENCES — a missing guard, a missing
 * predicate — which is exactly what a source check detects coming back.
 */

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("F-037: both credit-simulation entrances refuse in production", () => {
  const PROD_GUARD =
    /process\.env\.NODE_ENV === "production"\s*&&\s*process\.env\.CREDIT_VENDOR_MODE !== "simulation"/;

  it("creditPulls.simulateCreditPullCompletion keeps its guard", () => {
    expect(read("server/services/creditPulls.ts")).toMatch(PROD_GUARD);
  });

  it("the MCP softPullCredit adapter has the same guard", () => {
    // The asymmetry was the whole defect: one entrance guarded, one not.
    expect(read("server/mcp/vendors.ts")).toMatch(PROD_GUARD);
  });

  it("both guards use the identical escape hatch, so there is one rule to remember", () => {
    const occurrences = [read("server/services/creditPulls.ts"), read("server/mcp/vendors.ts")]
      .map((src) => (PROD_GUARD.test(src) ? 1 : 0))
      .reduce((a: number, b: number) => a + b, 0);
    expect(occurrences).toBe(2);
  });
});

describe("F-037: simulated pulls do not drive borrower-facing output in production", () => {
  it("preUnderwriting filters completed pulls on isSimulated in production", () => {
    const src = read("server/services/preUnderwriting.ts");
    expect(src).toMatch(/eq\(creditPulls\.isSimulated, false\)/);
    expect(src).toMatch(/process\.env\.NODE_ENV === "production"/);
  });
});
