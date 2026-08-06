import { describe, it, expect } from "vitest";

import { buildCommitmentLetter } from "../server/services/ausSubmission";
import { COMPANY_IDENTITY } from "@shared/companyIdentity";

/**
 * A "commitment letter" built from SIMULATED underwriting must say so.
 *
 * Unlike the credit leg — which refuses outright in production unless
 * CREDIT_VENDOR_MODE=simulation is set — the AUS leg has no production guard.
 * Every DU run today is the deterministic adapter (a set FANNIE_DU_API_KEY
 * throws rather than going live), and `buildCommitmentLetter` was dropping
 * `findings.simulated` on the floor. The route logged "(simulated)"; the
 * DOCUMENT did not, and the log is not attached to the document.
 *
 * The result was a JSON artifact titled "commitment", naming the company as
 * lender, returned to the caller, with nothing on it indicating no automated
 * underwriting system had ever seen the file.
 *
 * It also hardcoded `nmls: "PENDING"`, which stopped being true on 2026-07-13
 * when the company was licensed as #427468 — a document misstating its own
 * issuer's licensure.
 */

const findings = (simulated: boolean) =>
  ({
    casefileId: "CF-TEST-1",
    duVersion: "DU 12.0",
    recommendation: "approve_eligible",
    simulated,
    riskAssessment: { ltv: 0.8, dti: 0.36 },
    day1Certainty: {
      assets: { relief: true },
      income: { relief: false },
      employment: { relief: false },
    },
    messages: [],
  }) as unknown as Parameters<typeof buildCommitmentLetter>[0]["findings"];

const build = (simulated: boolean) =>
  buildCommitmentLetter({
    applicationId: "app-1",
    borrowerName: "Test Borrower",
    propertyAddress: "1 Main St",
    loanAmount: 400000,
    propertyValue: 500000,
    findings: findings(simulated),
  });

describe("commitment letter carries AUS provenance", () => {
  it("marks a simulated letter as simulated", () => {
    expect(build(true).simulated).toBe(true);
  });

  it("does not mark a live letter as simulated", () => {
    expect(build(false).simulated).toBe(false);
  });

  it("leads the disclaimer with the simulation warning, not buries it", () => {
    // Position matters: a reader who stops after the first sentence must
    // already know this is not a real underwriting decision.
    const d = build(true).disclaimer;
    expect(d.startsWith("SIMULATED — NOT A REAL UNDERWRITING DECISION.")).toBe(true);
    expect(d).toMatch(/must not be relied on or presented as a commitment to lend/i);
  });

  it("says no automated underwriting system evaluated the file", () => {
    // The specific claim a reader would otherwise infer from the letterType.
    expect(build(true).disclaimer).toMatch(/no automated underwriting\s+system has evaluated this file/i);
  });

  it("leaves the live disclaimer unchanged", () => {
    const d = build(false).disclaimer;
    expect(d).not.toMatch(/SIMULATED/);
    expect(d.startsWith("This commitment is based on automated underwriting findings")).toBe(true);
  });
});

describe("commitment letter states the issuer truthfully", () => {
  it("uses the real NMLS id, not the hardcoded 'PENDING'", () => {
    const letter = build(true);
    expect(letter.lender.nmls).toBe(COMPANY_IDENTITY.nmlsId);
    expect(letter.lender.nmls).not.toBe("PENDING");
  });

  it("takes the issuer name from the single identity source", () => {
    expect(build(true).lender.name).toBe(COMPANY_IDENTITY.legalName);
  });

  it("cannot drift from companyIdentity again", () => {
    // Both fields read from the shared constant, so a future licensing change
    // is one edit rather than a hunt for literals.
    const letter = build(false);
    expect(letter.lender).toEqual({
      name: COMPANY_IDENTITY.legalName,
      nmls: COMPANY_IDENTITY.nmlsId,
    });
  });
});
