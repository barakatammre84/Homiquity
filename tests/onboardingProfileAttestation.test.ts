import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  BORROWER_ATTESTABLE_PROFILE_FIELDS,
  SERVER_ONLY_PROFILE_FIELDS,
  partitionProfileUpdate,
} from "../server/routes/borrower/onboarding";

/**
 * F-045 — a borrower could self-assert `identityVerified` and `kycCleared`.
 *
 * `PATCH /api/onboarding/profile/:id` is borrower-authenticated and scoped to
 * the caller's own profile (404 otherwise), so this was never a cross-tenant
 * write. The defect is the contradiction: the server declines to set both flags
 * itself, deliberately and with comments explaining why —
 *
 *   - the KBA handler refuses `identityVerified` because "granting
 *     identity-verified status from a simulated challenge would create false
 *     compliance evidence";
 *   - `simulateKycScreening` refuses to write `cleared` for the same reason,
 *     which is the entire premise of the F-044 staff clearance workflow;
 *
 * — and then handed the borrower a route that set them both. Two deliberate
 * refusals, defeated by one PATCH.
 *
 * Impact was bounded when found (the route had no callers, and nothing gates on
 * either column), which is precisely why it was worth closing before something
 * started trusting a column named `kycCleared`.
 *
 * The membership rule these assertions protect: **if the server deliberately
 * declines to write a field itself, no client may write it either.**
 * `documentsComplete`/`personalInfoComplete` fail that test — nothing refuses to
 * write them — so they remain borrower-attestable and are asserted as such, to
 * pin the distinction rather than leave it to memory.
 *
 * The policy is exercised through `partitionProfileUpdate` rather than by
 * grepping the route, so a guard that is present-but-unreachable fails here. An
 * earlier source-level draft of this file passed against exactly that mutation.
 */

describe("F-045: compliance attestations cannot be set by the borrower", () => {
  it("drops both flags from the applied update", () => {
    const { update } = partitionProfileUpdate({
      identityVerified: true,
      kycCleared: true,
      currentStep: "kyc",
    });
    expect(update).not.toHaveProperty("identityVerified");
    expect(update).not.toHaveProperty("kycCleared");
    // The legitimate field in the same body still lands.
    expect(update.currentStep).toBe("kyc");
  });

  it("reports the attempt instead of silently swallowing it", () => {
    // Quiet filtering would make a self-attestation attempt indistinguishable
    // from a well-formed request. The route turns a non-empty `rejected` into a
    // 400 + audit entry, so this list IS the signal.
    const { rejected } = partitionProfileUpdate({ identityVerified: true, kycCleared: true });
    expect(rejected.sort()).toEqual(["identityVerified", "kycCleared"]);
  });

  it("reports only what was actually attempted", () => {
    expect(partitionProfileUpdate({ kycCleared: true }).rejected).toEqual(["kycCleared"]);
    expect(partitionProfileUpdate({ currentStep: "kba" }).rejected).toEqual([]);
  });

  it("a falsy value is still an attempt", () => {
    // `false` and `undefined` are different: writing false is still a write to a
    // column the borrower must not control, and admitting it would let the flag
    // be toggled once the column starts mattering.
    expect(partitionProfileUpdate({ identityVerified: false }).rejected).toEqual([
      "identityVerified",
    ]);
    expect(partitionProfileUpdate({ identityVerified: undefined }).rejected).toEqual([]);
  });

  it("no prototype or unknown key leaks into the update", () => {
    const { update, rejected } = partitionProfileUpdate({
      isAdmin: true,
      role: "admin",
      userId: "someone-else",
      constructor: "x",
    } as Record<string, unknown>);
    expect(update).toEqual({});
    expect(rejected).toEqual([]);
  });

  it("tolerates an empty body", () => {
    expect(partitionProfileUpdate({})).toEqual({ update: {}, rejected: [] });
  });
});

describe("F-045: the two field lists stay disjoint and correctly populated", () => {
  it("no server-only field appears in the borrower list", () => {
    for (const f of SERVER_ONLY_PROFILE_FIELDS) {
      expect(BORROWER_ATTESTABLE_PROFILE_FIELDS).not.toContain(f);
    }
  });

  it("both compliance attestations are named server-only", () => {
    expect([...SERVER_ONLY_PROFILE_FIELDS].sort()).toEqual(["identityVerified", "kycCleared"]);
  });

  it("genuinely borrower-driven journey state still works, so the fix is not over-broad", () => {
    const { update } = partitionProfileUpdate({
      journeyStatus: "in_progress",
      currentStep: "documents",
      completedSteps: ["kba_verification"],
      progressPercent: 40,
      // Nothing refuses to write these and nothing reads them, so they fail the
      // server-only test and stay borrower-attestable. Pinned deliberately: if
      // either ever gates something, it must be derived server-side instead.
      documentsComplete: true,
      personalInfoComplete: true,
    });
    expect(Object.keys(update).sort()).toEqual([
      "completedSteps",
      "currentStep",
      "documentsComplete",
      "journeyStatus",
      "personalInfoComplete",
      "progressPercent",
    ]);
  });
});

describe("F-045: the server's own refusals are still in place", () => {
  const ROUTES = readFileSync(
    join(__dirname, "..", "server/routes/borrower/onboarding.ts"),
    "utf8",
  );

  it("the KBA flow still declines to grant identityVerified", () => {
    // If this refusal is ever removed, the allowlist fix loses its rationale —
    // and, worse, a simulated challenge would start minting compliance evidence.
    expect(ROUTES).toMatch(/identityVerified is intentionally NOT set to true here/);
  });

  it("the KYC simulator still declines to clear a screening", () => {
    expect(ROUTES).not.toMatch(/overallStatus:\s*"cleared"/);
  });

  it("the route rejects rather than applies, and audits the attempt", () => {
    expect(ROUTES).toMatch(/logAudit\(req, "onboarding\.server_only_field_rejected"/);
    expect(ROUTES).toMatch(/code: "SERVER_ONLY_FIELD"/);
    // Pins that the branch is REACHABLE, not merely present. Neutering this
    // condition does not reopen the vulnerability — `safeUpdate` already
    // excludes both fields, so nothing gets written either way — but it does
    // silently discard the 400 and the audit entry, i.e. the entire signal that
    // someone tried. Source-level because only an HTTP-tier test could observe
    // the status code, and this suite is the unit tier.
    expect(ROUTES).toMatch(/if \(rejected\.length > 0\)/);
  });
});
