import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";

/**
 * Recording a REAL bureau report that was obtained outside the app.
 *
 * The founder's stated plan for the pre-F3 window is to enter live credit data
 * into the database by hand once a vendor contract lands. A raw
 * `UPDATE credit_pulls SET ...` would work mechanically and be quietly wrong:
 * completing a pull also appends to the `credit_audit_log` hash chain and
 * updates `credit_audit_chain_tips` in the same transaction. Skip that and you
 * hold a real consumer report with NO audit entry recording who pulled it, when,
 * or under which consent — which is the artifact an FCRA/ECOA dispute actually
 * examines, and whose absence nothing flags.
 *
 * `recordLiveCreditPullCompletion` is the supported path. These tests pin the
 * guarantees that make it safe to hand a human, since the callers are a script
 * and a person under time pressure rather than a well-behaved service.
 */

const SRC = readFileSync(
  path.join(path.resolve(__dirname, ".."), "server/services/creditPulls.ts"),
  "utf8",
);
const FN = SRC.slice(SRC.indexOf("export async function recordLiveCreditPullCompletion"));

const ORIGINAL_MODE = process.env.CREDIT_VENDOR_MODE;
beforeEach(() => {
  if (ORIGINAL_MODE === undefined) delete process.env.CREDIT_VENDOR_MODE;
  else process.env.CREDIT_VENDOR_MODE = ORIGINAL_MODE;
});
afterEach(() => {
  if (ORIGINAL_MODE === undefined) delete process.env.CREDIT_VENDOR_MODE;
  else process.env.CREDIT_VENDOR_MODE = ORIGINAL_MODE;
});

describe("recordLiveCreditPullCompletion — provenance", () => {
  it("stamps isSimulated FALSE unconditionally, not from the env flag", () => {
    // creditVendorIsSimulated() reads CREDIT_VENDOR_API_KEY and describes the
    // ADAPTER's posture. During the pre-F3 window that key is unset because no
    // adapter exists — but a report typed in from a real bureau is still real.
    // The stamp must describe where THIS report came from.
    expect(FN).toContain("isSimulated: false,");
    expect(FN).not.toContain("isSimulated: creditVendorIsSimulated()");
  });

  it("requires a bureau reference — an unattributable 'real' pull is not real", () => {
    expect(FN).toContain("vendorRequestId is required");
  });

  it("refuses while CREDIT_VENDOR_MODE=simulation is still set", () => {
    // Claiming genuine data while the fabricating path is permitted in the same
    // environment is a contradiction; resolve the config before importing.
    expect(FN).toContain("CREDIT_VENDOR_MODE=simulation is set");
  });

  it("records that the completion came from outside the app", () => {
    // A future reader of the audit log must be able to tell a manually imported
    // report from one an adapter returned.
    expect(FN).toContain('source: "manual_import"');
  });
});

describe("recordLiveCreditPullCompletion — audit chain", () => {
  it("appends through logCreditAction rather than writing the chain by hand", () => {
    // The whole point: the hash chain and the tip table are maintained by the
    // audit service, transactionally. Reproducing that inline is how a
    // verification failure that looks like tampering gets manufactured.
    expect(FN).toContain("await logCreditAction({");
    expect(FN).not.toContain("previousEntryHash");
    expect(FN).not.toContain("creditAuditChainTips");
    expect(FN).not.toContain("sequenceNumber");
  });

  it("refuses to complete an already-completed pull", () => {
    // Would append a second "pull_completed" entry for one inquiry, making the
    // chain internally consistent but factually wrong.
    expect(FN).toContain("is already completed");
  });
});

describe("recordLiveCreditPullCompletion — data validity", () => {
  it("rejects scores outside the 300-850 range", () => {
    expect(FN).toContain("outside the valid 300-850 range");
  });

  it("requires at least one bureau score", () => {
    expect(FN).toContain("At least one bureau score is required");
  });

  it("encrypts the raw vendor payload at rest, like the simulated path", () => {
    expect(FN).toContain("encryptSensitiveData(input.rawResponse)");
    expect(FN).toContain("encryptionKeyId");
    expect(FN).toContain("encryptionIV");
  });

  it("never invents a value — no Math.random anywhere in this path", () => {
    // The simulated sibling fabricates tradelines, liabilities and inquiry
    // counts. This one records only what the bureau actually returned; an
    // absent field is NULL, not a plausible-looking number.
    expect(FN).not.toContain("Math.random");
  });
});

describe("the simulated path stays separate", () => {
  it("still exists and still fabricates — the two are not merged", () => {
    expect(SRC).toContain("export async function simulateCreditPullCompletion");
    const sim = SRC.slice(
      SRC.indexOf("export async function simulateCreditPullCompletion"),
      SRC.indexOf("export async function recordLiveCreditPullCompletion"),
    );
    expect(sim).toContain("Math.random");
    expect(sim).toContain("isSimulated: true,");
  });
});
