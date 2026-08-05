import { describe, it, expect } from "vitest";
import { summariseVerification, type OnboardingStatus } from "./types";

const status = (over: Partial<OnboardingStatus> = {}): OnboardingStatus => ({
  profile: null,
  kba: null,
  kyc: null,
  verifications: [],
  borrowerType: "standard",
  applicationId: null,
  applicationStatus: null,
  ...over,
});

const kba = (s: string) => ({ id: "k1", status: s, score: 4, attemptNumber: 1, maxAttempts: 3 });

describe("summariseVerification", () => {
  it("reports nothing complete for a borrower who has not started", () => {
    const s = summariseVerification(status());
    expect(s.overallProgress).toBe(0);
    expect(s.steps.map(x => x.complete)).toEqual([false, false, false]);
  });

  it("treats undefined status as nothing complete rather than throwing", () => {
    // The page calls this before the query resolves and while it is retrying.
    expect(summariseVerification(undefined).overallProgress).toBe(0);
  });

  it("counts KBA only when passed, not when in progress or failed", () => {
    // A partially-answered or failed KBA is not a verified identity; anything
    // looser here would light up the progress bar for work still owed.
    for (const s of ["pending", "in_progress", "failed", "expired"]) {
      expect(summariseVerification(status({ kba: kba(s) })).identityVerified, s).toBe(false);
    }
    expect(summariseVerification(status({ kba: kba("passed") })).identityVerified).toBe(true);
  });

  it("counts KYC only when cleared, not when flagged", () => {
    // "flagged" is the outcome that most needs to not read as done.
    for (const s of ["pending", "in_progress", "flagged", "failed"]) {
      expect(summariseVerification(status({ kyc: { overallStatus: s, riskScore: 10 } })).kycCleared, s).toBe(false);
    }
    expect(summariseVerification(status({ kyc: { overallStatus: "cleared", riskScore: 10 } })).kycCleared).toBe(true);
  });

  it("counts documents only for a verified identity record", () => {
    const cases: [OnboardingStatus["verifications"], boolean][] = [
      [[], false],
      [[{ verificationType: "income", status: "verified" }], false],
      [[{ verificationType: "identity", status: "pending" }], false],
      [[{ verificationType: "identity", status: "verified" }], true],
      // A verified identity record alongside unrelated ones still counts.
      [[{ verificationType: "assets", status: "pending" }, { verificationType: "identity", status: "verified" }], true],
    ];
    for (const [verifications, expected] of cases) {
      expect(summariseVerification(status({ verifications })).docsVerified, JSON.stringify(verifications)).toBe(expected);
    }
  });

  it("reaches 3 of 3 when all three are done", () => {
    const s = summariseVerification(status({
      kba: kba("passed"),
      kyc: { overallStatus: "cleared", riskScore: 5 },
      verifications: [{ verificationType: "identity", status: "verified" }],
    }));
    expect(s.overallProgress).toBe(3);
    expect(s.steps.every(x => x.complete)).toBe(true);
  });

  it("tracks exactly three steps — biometric is not counted", () => {
    // The biometric card is labelled Coming Soon and has no backing status.
    // Counting it would cap every borrower below 100% permanently.
    expect(summariseVerification(status()).steps.map(s => s.id)).toEqual(["kba", "kyc", "docs"]);
  });

  it("keeps step order and labels stable", () => {
    expect(summariseVerification(status()).steps.map(s => s.label)).toEqual([
      "Identity Questions", "Compliance Checks", "Document Verification",
    ]);
  });
});
