import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * J-0820-01 / J-0820-02 — the two halves of "a consent the borrower gave that
 * no gate can see".
 *
 * The defect was silent in the worst way: `/e-consent` reported six green
 * consents while `consentGate` refused the Loan Estimate, because the page
 * wrote `application_id = NULL` and the gate matches with
 * `eq(borrowerConsents.applicationId, applicationId)`. Nothing failed, nothing
 * logged, and the two surfaces each looked right on their own.
 *
 * These assertions read the *source*, not a fixture. A fixture is exactly how
 * this class of bug survives — a hand-written `applicationId` in a test object
 * supplies what the product never sends (the NotificationsPanel `readAt`
 * lesson, F-0819-10).
 */

const repoRoot = join(__dirname, "..");
const read = (p: string) => readFileSync(join(repoRoot, p), "utf8");

/**
 * Strip `//` and block comments before asserting on source.
 *
 * Not a nicety — without it every assertion here is a false pass. The code
 * these tests guard is *documented* with the very identifiers they look for
 * ("applicationId", "credit_pull"), so a comment-blind scanner reports the fix
 * as present when it has been deleted. Both halves of this file were caught
 * doing exactly that on 2026-08-24: the bug was reintroduced by hand and four
 * of six assertions still passed, because the explanatory comment above the
 * deleted line kept matching. Same failure mode as the design-token guard
 * matching `text-white` inside a comment.
 */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

describe("J-0820-01 — /e-consent scopes its signatures to a loan file", () => {
  const src = codeOnly(read("client/src/pages/borrower/EConsent.tsx"));

  it("sends an applicationId on the consent POST", () => {
    const mutation = /apiRequest\("POST", "\/api\/consents",[\s\S]*?\}\);/.exec(src)?.[0] ?? "";
    expect(mutation, "the POST /api/consents call was not found").not.toBe("");
    expect(
      /applicationId/.test(mutation),
      "the consent POST does not carry an applicationId — the row will land with " +
        "application_id = NULL and getConsentByTypeAndApplication can never match it",
    ).toBe(true);
  });

  it("resolves that id through the sanctioned active-application hook", () => {
    expect(src).toContain("useActiveApplication");
    // Feeding this hook from any list other than the two sanctioned keys
    // repoints every other borrower surface — see its docstring and
    // tests/activeApplicationListParity.test.ts.
    expect(src).toContain("loanApplicationKeys.all()");
  });

  it("answers 'already given?' with the application scope the gate uses", () => {
    const predicate = /const isConsentGiven =[\s\S]*?\n  \};/.exec(src)?.[0] ?? "";
    expect(predicate, "isConsentGiven was not found").not.toBe("");
    expect(
      /applicationId/.test(predicate),
      "isConsentGiven still answers from the user-scoped list only, so the page " +
        "can again show a consent as complete that the gate cannot see",
    ).toBe(true);
  });

  it("does not backfill or widen the gate to rescue unscoped rows", () => {
    // Fix-forward only (founder decision, 2026-08-24). Both escapes are
    // forbidden: widening the gate loosens a compliance check, and backfilling
    // application_id puts a guessed value on an audit row.
    const gate = codeOnly(read("server/storage/locksAndConsents.ts"));
    const scoped =
      /async getConsentByTypeAndApplication[\s\S]*?\n  \}/.exec(gate)?.[0] ?? "";
    expect(scoped).not.toMatch(/isNull\s*\(/);
    expect(scoped).not.toMatch(/\bor\s*\(/);
  });
});

describe("J-0820-02 — every required consent type can actually be signed", () => {
  const src = codeOnly(read("server/routes/lending/dashboard.ts"));

  it("derives the required list from the active templates, not a literal", () => {
    expect(
      /const requiredConsentTypes = \[\s*"/.test(src),
      'requiredConsentTypes is a hardcoded string list again. That is how ' +
        '"credit_pull" — a value no consent template can ever carry — made the ' +
        "borrower's Sign Required Disclosures to-do unclearable by construction.",
    ).toBe(false);
    expect(src).toContain("getActiveConsentTemplates");
  });

  it("never requires a type that is absent from the canonical vocabulary", () => {
    // The guard that would have caught the original defect: whatever the
    // handler requires must be a real consent type.
    const consentTypes = read("shared/schema/compliance.ts");  // declarations carry trailing // comments; matched on quoted literals only
    const declared = /export const CONSENT_TYPES = \[([\s\S]*?)\] as const;/.exec(consentTypes)?.[1] ?? "";
    expect(declared, "CONSENT_TYPES was not found").not.toBe("");
    expect(declared).not.toContain('"credit_pull"');

    // And the handler must not name it either. `src` is already comment-free,
    // so this anchors on the two declarations rather than the prose above
    // them — anchoring on a comment would make the assertion vanish the moment
    // someone reworded it.
    const handlerConsentBlock =
      /const requiredConsentTypes[\s\S]*?const pendingConsentTypes[^\n]*\n/.exec(src)?.[0] ?? "";
    expect(handlerConsentBlock, "the required-consent block was not found").not.toBe("");
    const quotedTypes = [...handlerConsentBlock.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
    for (const t of quotedTypes) {
      expect(
        declared.includes(`"${t}"`),
        `dashboard.ts requires consent type "${t}", which is not in CONSENT_TYPES — ` +
          "no template can carry it, so the count can never reach zero",
      ).toBe(true);
    }
  });
});
