import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";

/**
 * The credit-vendor flag interlock.
 *
 * Two environment variables govern the credit leg and they mean different
 * things, which is exactly why they get confused:
 *
 *   CREDIT_VENDOR_API_KEY   PROVENANCE. Unset => every credit_pulls row and
 *                           cost-ledger entry is stamped isSimulated/simulated
 *                           = true. Setting it flips the stamp to false. Its
 *                           VALUE is never used to call anything — there is no
 *                           live bureau adapter in this codebase yet.
 *   CREDIT_VENDOR_MODE      PERMISSION. "simulation" allows
 *                           simulateCreditPullCompletion — which invents scores
 *                           with Math.random — to run under NODE_ENV=production.
 *
 * Set both and fabricated scores get recorded as a genuine consumer report.
 * That is not a wrong number, it is a falsified regulated record: the FCRA
 * §615(a) bureau-naming guard in server/routes/compliance.ts keys off
 * isSimulated, so a false stamp disarms the very check that stops an
 * adverse-action notice from naming a bureau nobody contacted.
 *
 * This combination becomes reachable during the F3 vendor handoff — the moment
 * someone sets the real key while the pre-F3 simulation override is still in
 * place. These tests pin the refusal so that window is not silent.
 */

const SRC = readFileSync(
  path.join(path.resolve(__dirname, ".."), "server/services/creditPulls.ts"),
  "utf8",
);

const ORIGINAL = {
  key: process.env.CREDIT_VENDOR_API_KEY,
  mode: process.env.CREDIT_VENDOR_MODE,
  nodeEnv: process.env.NODE_ENV,
};

function restore() {
  for (const [name, value] of [
    ["CREDIT_VENDOR_API_KEY", ORIGINAL.key],
    ["CREDIT_VENDOR_MODE", ORIGINAL.mode],
    ["NODE_ENV", ORIGINAL.nodeEnv],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

beforeEach(restore);
afterEach(restore);

/** The guard's own predicate, mirrored so the truth table is executable. */
function interlockTrips(): boolean {
  return Boolean(
    process.env.CREDIT_VENDOR_API_KEY && process.env.CREDIT_VENDOR_MODE === "simulation",
  );
}

describe("credit-vendor flag interlock", () => {
  it("trips when BOTH flags are on — the falsified-record state", () => {
    process.env.CREDIT_VENDOR_API_KEY = "live-key-from-the-bureau";
    process.env.CREDIT_VENDOR_MODE = "simulation";
    expect(interlockTrips()).toBe(true);
  });

  it("permits the pre-F3 window: simulation on, no live key", () => {
    delete process.env.CREDIT_VENDOR_API_KEY;
    process.env.CREDIT_VENDOR_MODE = "simulation";
    // Rows are stamped isSimulated: true, so nothing is falsified.
    expect(interlockTrips()).toBe(false);
  });

  it("permits the post-F3 end state: live key, override removed", () => {
    process.env.CREDIT_VENDOR_API_KEY = "live-key-from-the-bureau";
    delete process.env.CREDIT_VENDOR_MODE;
    expect(interlockTrips()).toBe(false);
  });

  it("permits the default: neither flag set", () => {
    delete process.env.CREDIT_VENDOR_API_KEY;
    delete process.env.CREDIT_VENDOR_MODE;
    expect(interlockTrips()).toBe(false);
  });

  it("is not fooled by a non-'simulation' mode value alongside a live key", () => {
    process.env.CREDIT_VENDOR_API_KEY = "live-key-from-the-bureau";
    process.env.CREDIT_VENDOR_MODE = "live";
    expect(interlockTrips()).toBe(false);
  });
});

describe("the guard is wired into the fabrication path", () => {
  it("refuses inside simulateCreditPullCompletion, not at boot", () => {
    // Boot-time refusal would be near-invisible on Railway: a failed deploy
    // leaves the PREVIOUS container serving, so the site answers 200 while the
    // contradiction persists. The check must sit in the function that
    // fabricates.
    const fn = SRC.slice(SRC.indexOf("export async function simulateCreditPullCompletion"));
    expect(fn).toContain("Contradictory credit-vendor configuration");
    expect(fn.indexOf("Contradictory credit-vendor configuration")).toBeGreaterThan(-1);
  });

  it("checks the interlock BEFORE the production-mode guard", () => {
    // Ordering matters for the error message a human sees: with both flags on,
    // the production guard would pass (mode IS "simulation") and say nothing,
    // so the contradiction must be reported first.
    const fn = SRC.slice(SRC.indexOf("export async function simulateCreditPullCompletion"));
    const interlock = fn.indexOf("Contradictory credit-vendor configuration");
    const prodGuard = fn.indexOf("Simulated credit pulls are disabled in production");
    expect(interlock).toBeGreaterThan(-1);
    expect(prodGuard).toBeGreaterThan(-1);
    expect(interlock).toBeLessThan(prodGuard);
  });

  it("still stamps provenance off the API key alone", () => {
    // The interlock must not have changed what marks a row simulated —
    // that remains keyed to CREDIT_VENDOR_API_KEY only.
    expect(SRC).toContain("return !process.env.CREDIT_VENDOR_API_KEY;");
  });
});
