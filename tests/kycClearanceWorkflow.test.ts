import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * F-044 — the KYC/AML clearance workflow that nothing could reach.
 *
 * `simulateKycScreening` deliberately refuses to auto-clear a borrower:
 * auto-clearing "would produce a falsely-cleared compliance record", so it
 * parks every screening at `pending_review` and defers to "the admin compliance
 * workflow". That refusal is correct. The workflow it deferred to was never
 * built — so no code path in the repository could ever write
 * `overallStatus: "cleared"`, every borrower sat at pending_review forever, and
 * onboarding.ts's `overallStatus === "cleared"` re-screening skip was dead code.
 *
 * These assertions pin the four properties that make the new workflow safe, each
 * of which is a way the fix could silently regress:
 *
 *   1. it exists at all, and is the ONLY writer of "cleared";
 *   2. it is role-gated to admin + underwriter (an AML adjudication, not a
 *      sales task);
 *   3. it refuses to re-decide a settled screening (409), because overwriting
 *      one adjudication with another leaves no trace of the first;
 *   4. it preserves adverse sub-check findings — a `flagged` OFAC hit must not
 *      become "cleared" just because the human cleared the borrower overall.
 *
 * Source-level (the F-014 class), and appropriately so: three of the four are
 * *absences* — a missing gate, a missing conflict check, a missing guard — which
 * is exactly what a source assertion catches coming back.
 */

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const ROUTES = read("server/routes/borrower/onboarding.ts");
const STORAGE = read("server/storage/identity.ts");

describe("F-044: a human clearance path exists", () => {
  it("exposes the clearance queue and the decision route", () => {
    expect(ROUTES).toMatch(/"\/api\/compliance\/kyc\/pending"/);
    expect(ROUTES).toMatch(/"\/api\/compliance\/kyc\/:screeningId\/decision"/);
  });

  it("the queue reads screenings parked at pending_review", () => {
    expect(STORAGE).toMatch(/getKycScreeningsPendingReview/);
    expect(STORAGE).toMatch(/eq\(kycScreenings\.overallStatus, "pending_review"\)/);
  });

  it("no code path hardcodes a cleared screening", () => {
    // simulateKycScreening lives in this same file and must keep refusing to
    // auto-clear — that refusal is the reason this workflow has to exist.
    // "cleared" may only ever arrive as the Zod-validated `decision` variable
    // from a human request, never as a literal written by the server itself.
    expect(ROUTES).not.toMatch(/overallStatus:\s*"cleared"/);
    expect(ROUTES).toMatch(/overallStatus: decision/);
  });
});

describe("F-044: the clearance decision is properly gated", () => {
  it("both routes require admin or underwriter", () => {
    const gates = ROUTES.match(/requireRole\("admin", "underwriter"\)/g) ?? [];
    expect(gates.length).toBeGreaterThanOrEqual(2);
  });

  it("requires a written basis for the decision", () => {
    expect(ROUTES).toMatch(/notes:\s*z\.string\(\)\.trim\(\)\.min\(10/);
  });

  it("refuses to re-decide a screening that is already settled", () => {
    expect(ROUTES).toMatch(/SCREENING_ALREADY_DECIDED/);
    expect(ROUTES).toMatch(/overallStatus !== "pending_review"/);
  });

  it("records who decided, when, and audits it", () => {
    expect(ROUTES).toMatch(/reviewedByUserId: user\.id/);
    expect(ROUTES).toMatch(/reviewedAt: new Date\(\)/);
    expect(ROUTES).toMatch(/logAudit\(req, `kyc\.\$\{decision\}`/);
  });

  it("a clearance expires, so it cannot serve as a permanent pass", () => {
    // Sanctions and PEP lists change continuously; onboarding.ts only skips
    // re-screening while a cleared record is unexpired, so an expiry-less
    // clearance would suppress re-screening forever.
    expect(ROUTES).toMatch(/KYC_CLEARANCE_VALIDITY_DAYS/);
    expect(ROUTES).toMatch(/expiresAt: new Date\(Date\.now\(\) \+ KYC_CLEARANCE_VALIDITY_DAYS/);
  });
});

describe("F-044: clearing a borrower does not erase what the screening found", () => {
  it("only pending_review sub-checks advance; flagged/failed keep their value", () => {
    // The defect this prevents: `ofacStatus: "cleared"` written unconditionally
    // would turn a real list match into a clean-looking record.
    expect(ROUTES).toMatch(
      /current === "pending_review" \? "cleared" : current \?\? undefined/,
    );
    // Every sub-check must go through that resolver, not be set directly.
    for (const field of ["ofacStatus", "sanctionsStatus", "pepStatus", "adverseMediaStatus"]) {
      expect(ROUTES).toMatch(new RegExp(`${field}: resolve\\(screening\\.${field}\\)`));
    }
  });
});
