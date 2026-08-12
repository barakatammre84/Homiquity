import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  RENT_REPORTING_BILLING_ENABLED,
  FURNISHABLE_PROVENANCE,
  FURNISHING_TRANSITIONS,
  BUREAU_MINIMUM_ACTIVE_LINES,
  evaluatePaymentFurnishability,
  assertFurnishable,
  canTransition,
  assertTransition,
  evaluateProgramReadiness,
  hasMetro2Authority,
} from "../server/services/rentFurnishing";
import { FURNISHING_STATE, RENT_PAYMENT_PROVENANCE } from "../shared/schema/rent";

/**
 * The furnishing gate. Every assertion here protects the same thing: that nothing
 * reaches a credit bureau on an evidentiary basis we cannot defend.
 *
 * Pure in-process — no HTTP server, no database.
 */

const ROOT = path.resolve(__dirname, "..");

describe("billing is off, and off structurally", () => {
  it("no consumer may be charged before a tradeline is furnished", () => {
    expect(RENT_REPORTING_BILLING_ENABLED).toBe(false);
  });

  it("no payment processor exists to charge them with", () => {
    // The pitch's model was to collect subscription revenue while queued and release the
    // file at 100 users. The guard is the ABSENCE of a processor, not a boolean someone
    // can flip — so assert the absence directly.
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of ["stripe", "dwolla-v2", "braintree", "@adyen/api-library", "@moov-io/moov-sdk"]) {
      expect(deps[name], `${name} is installed — §9 money-movement review required`).toBeUndefined();
    }
  });
});

describe("provenance gate — only first-party payment records are furnishable", () => {
  const base = { status: "paid", provenance: "platform_processed", processorReference: "tr_123" } as const;

  it("accepts a platform-processed payment carrying its processor reference", () => {
    const v = evaluatePaymentFurnishability(base);
    expect(v.furnishable).toBe(true);
    expect(v.blockers).toEqual([]);
    expect(() => assertFurnishable(base)).not.toThrow();
  });

  it("refuses a bank-observed payment — an inferred payment is not evidence", () => {
    // This is the pitch's design (scan Plaid for an outflow within 5% of rent matching
    // "Rent"/"Venmo"/"Zelle"). A false negative furnishes a MISSED payment for someone
    // who paid. A heuristic may drive a suggestion; it may not drive a derogatory mark.
    const v = evaluatePaymentFurnishability({ ...base, provenance: "bank_observed" });
    expect(v.furnishable).toBe(false);
    expect(v.blockers.join(" ")).toMatch(/not furnishable/);
  });

  it("refuses a self-reported payment", () => {
    expect(evaluatePaymentFurnishability({ ...base, provenance: "self_reported" }).furnishable).toBe(false);
  });

  it("refuses a platform-processed payment with no processor reference", () => {
    const v = evaluatePaymentFurnishability({ ...base, processorReference: null });
    expect(v.furnishable).toBe(false);
    expect(v.blockers.join(" ")).toMatch(/no processor reference/);
  });

  it("refuses an unsettled status", () => {
    expect(evaluatePaymentFurnishability({ ...base, status: "scheduled" }).furnishable).toBe(false);
    expect(evaluatePaymentFurnishability({ ...base, status: "waived" }).furnishable).toBe(false);
  });

  it("reports EVERY blocker, so fixing one does not read as clearance", () => {
    const v = evaluatePaymentFurnishability({
      status: "scheduled",
      provenance: "bank_observed",
      processorReference: null,
    });
    expect(v.blockers.length).toBeGreaterThanOrEqual(2);
  });

  it("throws on the assert form", () => {
    expect(() => assertFurnishable({ ...base, provenance: "self_reported" })).toThrow(/not furnishable/);
  });

  it("exactly one provenance value is furnishable — widening it is a deliberate act", () => {
    expect([...FURNISHABLE_PROVENANCE]).toEqual(["platform_processed"]);
    const nonFurnishable = RENT_PAYMENT_PROVENANCE.filter((p) => !FURNISHABLE_PROVENANCE.includes(p));
    expect(nonFurnishable).toEqual(["self_reported", "bank_observed"]);
  });
});

describe("furnishing queue state machine", () => {
  it("covers every declared state", () => {
    expect(Object.keys(FURNISHING_TRANSITIONS).sort()).toEqual([...FURNISHING_STATE].sort());
  });

  it("never transitions to a state outside the declared set", () => {
    for (const targets of Object.values(FURNISHING_TRANSITIONS)) {
      for (const t of targets) expect(FURNISHING_STATE).toContain(t);
    }
  });

  it("suppressed is terminal — a withdrawn consumer is never silently re-enrolled", () => {
    expect(FURNISHING_TRANSITIONS.suppressed).toEqual([]);
    for (const from of FURNISHING_STATE) {
      expect(canTransition("suppressed", from)).toBe(false);
    }
  });

  it("every state can reach suppressed — withdrawal is always available", () => {
    for (const from of FURNISHING_STATE) {
      if (from === "suppressed") continue;
      expect(canTransition(from, "suppressed"), `${from} cannot be suppressed`).toBe(true);
    }
  });

  it("a furnished line can be disputed, and a dispute can re-queue a correction", () => {
    expect(canTransition("furnished", "disputed")).toBe(true);
    expect(canTransition("disputed", "queued")).toBe(true);
  });

  it("cannot skip the authority gate straight to queued or furnished", () => {
    expect(canTransition("pending_authority", "queued")).toBe(false);
    expect(canTransition("pending_authority", "furnished")).toBe(false);
    expect(() => assertTransition("pending_authority", "furnished")).toThrow(/illegal furnishing transition/);
  });
});

describe("program readiness — nothing can be furnished today, and the reasons are legible", () => {
  it("refuses, naming the missing authority and the empty compiler", () => {
    const r = evaluateProgramReadiness();
    expect(r.canFurnish).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/docs\/cdia-metro2/);
    expect(r.blockers.join(" ")).toMatch(/FIELD_LAYOUT is empty/);
  });

  it("a README alone is not authority", () => {
    // docs/cdia-metro2/ ships with a README describing what to obtain. If that counted,
    // the gate would have opened the moment the directory was created.
    expect(hasMetro2Authority()).toBe(false);
  });
});

describe("the pitched 100-line bureau minimum stays quarantined", () => {
  it("no numeric active-line minimum is asserted", () => {
    // "Bureaus require 100+ active lines" is an uncited external claim about three private
    // companies' onboarding policies. Hardcoding it would give a made-up number the
    // appearance of policy and every downstream surface would then quote it to users.
    // Same treatment as the portal-gated DSCR minimum in income/paths/dscr.ts.
    expect(BUREAU_MINIMUM_ACTIVE_LINES).toBeNull();
    const src = fs.readFileSync(path.join(ROOT, "server/services/rentFurnishing.ts"), "utf8");
    expect(src).not.toMatch(/MINIMUM_ACTIVE_LINES\s*=\s*\d/);
  });

  it("readiness names the unknown minimum as a blocker rather than assuming one", () => {
    expect(evaluateProgramReadiness().blockers.join(" ")).toMatch(/uncited external claim/);
  });
});
