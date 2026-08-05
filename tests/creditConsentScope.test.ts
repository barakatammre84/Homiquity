import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { consentCoversPullType } from "../server/services/creditConsents";
import {
  FUNNEL_SOFT_PULL_CONSENT_TEXT,
  FUNNEL_SOFT_PULL_CONSENT_VERSION,
} from "@shared/creditConsentCopy";

/**
 * F-034 / F-035 / F-036 — the credit-consent record and gate.
 *
 * Three defects, one service:
 *   F-035  a `soft_pull` consent (whose funnel checkbox promises "a soft
 *          inquiry, which will not affect my credit score") unblocked a hard
 *          tri-merge pull, because the gate compared consent IDs and never
 *          read `consentType`.
 *   F-034  every consent row stored the full FCRA authorization — both inquiry
 *          types, 120-day validity, identity attestations — as the "text shown",
 *          regardless of what was actually displayed, with IP/user-agent/
 *          electronic-signature metadata attached as evidence.
 *   F-036  production pull rows persisted with `isSimulated: false` because the
 *          only assignment of `true` lived past a throw, so the record asserted
 *          a real bureau inquiry that never happened.
 *
 * The coverage predicate is genuinely unit-testable; the wiring assertions are
 * source-level (the F-014 class) and are here because these defects are
 * *absences* — a deleted check, a default argument — which is what a source
 * check can detect coming back.
 */

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("F-035: consent scope governs pull type", () => {
  it("a soft_pull consent authorizes ONLY a soft pull", () => {
    expect(consentCoversPullType("soft_pull", "soft")).toBe(true);
    // The exact defect: these were permitted.
    expect(consentCoversPullType("soft_pull", "hard")).toBe(false);
    expect(consentCoversPullType("soft_pull", "tri_merge")).toBe(false);
  });

  it("a hard_pull consent covers soft as lesser-included", () => {
    // The hard-pull disclosure the borrower is shown explicitly authorizes
    // "both 'soft' inquiries ... and 'hard' inquiries".
    expect(consentCoversPullType("hard_pull", "soft")).toBe(true);
    expect(consentCoversPullType("hard_pull", "hard")).toBe(true);
    expect(consentCoversPullType("hard_pull", "tri_merge")).toBe(true);
  });

  it("denies by default — unknown or unwritten consent types authorize nothing", () => {
    // `credit_pull` and `monitoring` are in the schema's taxonomy comment but no
    // code path writes them. They must fail closed rather than inherit a guessed
    // permission (escalation U-12 owns the ratified map).
    for (const unknown of ["credit_pull", "monitoring", "", "HARD_PULL", "anything"]) {
      for (const pull of ["soft", "hard", "tri_merge"]) {
        expect(
          consentCoversPullType(unknown, pull),
          `"${unknown}" must not authorize "${pull}"`,
        ).toBe(false);
      }
    }
  });

  it("the pull service enforces coverage, not just consent existence", () => {
    const src = read("server/services/creditPulls.ts");
    expect(src).toMatch(/consentCoversPullType\(consent\.consentType, data\.pullType\)/);
  });

  it("the pull route requires an explicit pullType instead of defaulting to tri_merge", () => {
    const src = read("server/routes/compliance.ts");
    // A fail-open default on a regulated, billable action: an omitted field used
    // to select the most invasive and most expensive option there is.
    expect(src).not.toMatch(/pullType:\s*pullType\s*\|\|\s*"tri_merge"/);
    expect(src).toMatch(/pullType:\s*z\.enum\(\["soft", "hard", "tri_merge"\]\)/);
  });
});

describe("F-034: the ledger records the disclosure actually shown", () => {
  it("createCreditConsent accepts the rendered text rather than hardcoding one constant", () => {
    const src = read("server/services/creditConsents.ts");
    expect(src).toMatch(/disclosureText:\s*data\.disclosureText\s*\?\?/);
  });

  it("the funnel records its own checkbox copy, not the full FCRA authorization", () => {
    const src = read("server/routes/lending/applications.ts");
    expect(src).toMatch(/disclosureText:\s*FUNNEL_SOFT_PULL_CONSENT_TEXT/);
    expect(src).toMatch(/disclosureVersion:\s*FUNNEL_SOFT_PULL_CONSENT_VERSION/);
  });

  it("the funnel's stored copy is soft-scoped and says nothing about hard inquiries", () => {
    // If this ever fails, the recorded authorization has widened past what the
    // checkbox promises — which is the F-034 defect returning in reverse.
    expect(FUNNEL_SOFT_PULL_CONSENT_TEXT).toMatch(/soft inquiry/);
    expect(FUNNEL_SOFT_PULL_CONSENT_TEXT).not.toMatch(/hard/i);
    expect(FUNNEL_SOFT_PULL_CONSENT_VERSION).toBeTruthy();
  });

  it("the funnel page renders the shared constant so screen and record cannot drift", () => {
    const src = read("client/src/pages/lending/PreApproval.tsx");
    expect(src).toMatch(/FUNNEL_SOFT_PULL_CONSENT_TEXT/);
    // The old hardcoded JSX copy must be gone.
    expect(src).not.toMatch(/I authorize Homiquity to obtain my credit report using a\{" "\}/);
  });

  it("the /credit-consent path stores the state-combined text it renders", () => {
    const src = read("server/routes/compliance.ts");
    // GET /api/credit/disclosure serves getCombinedDisclosure(stateCode); the
    // row used to store the bare federal constant, so any state with an addendum
    // had a stored "text shown" narrower than what was displayed.
    expect(src).toMatch(/disclosureText:\s*creditService\.getCombinedDisclosure\(/);
  });
});

describe("F-036: pull rows never assert an inquiry that did not happen", () => {
  it("isSimulated is set at insert, not only after the production guard", () => {
    const src = read("server/services/creditPulls.ts");
    // The column is default(false).notNull(); the only other assignment lives
    // inside simulateCreditPullCompletion, past a throw that fires first in prod.
    expect(src).toMatch(/isSimulated:\s*creditVendorIsSimulated\(\)/);
  });
});
