export interface KycStatus {
  overallStatus: string;
  riskScore: number;
  ofacStatus?: string;
  sanctionsStatus?: string;
  pepStatus?: string;
  adverseMediaStatus?: string;
}

export interface OnboardingStatus {
  profile: Record<string, unknown> | null;
  kba: { id: string; status: string; score: number; attemptNumber: number; maxAttempts: number } | null;
  kyc: KycStatus | null;
  verifications: Array<{ verificationType: string; status: string }>;
  borrowerType: string;
  applicationId: string | null;
  applicationStatus: string | null;
}

export interface KbaQuestion {
  id: string;
  question: string;
  choices: string[];
}

export interface KbaResult {
  passed: boolean;
  score: number;
  totalQuestions: number;
  remainingAttempts?: number;
}

export interface VerificationStep {
  id: string;
  label: string;
  complete: boolean;
}

export interface VerificationSummary {
  identityVerified: boolean;
  kycCleared: boolean;
  docsVerified: boolean;
  /** How many of the three tracked steps are done, 0-3. */
  overallProgress: number;
  steps: VerificationStep[];
}

/**
 * Which verification steps are complete.
 *
 * Each is an exact status match, never a truthiness check: an in-progress KYC
 * screening or a document verification that came back "flagged" must read as
 * not-yet-complete, because the progress bar this feeds is what tells the
 * borrower whether anything is still owed.
 *
 * The biometric card on the page is not counted — it is labelled Coming Soon
 * and has no backing status, so including it would permanently cap progress.
 */
export function summariseVerification(status: OnboardingStatus | undefined): VerificationSummary {
  const identityVerified = status?.kba?.status === "passed";
  const kycCleared = status?.kyc?.overallStatus === "cleared";
  const docsVerified = (status?.verifications || []).some(
    v => v.verificationType === "identity" && v.status === "verified",
  );

  return {
    identityVerified,
    kycCleared,
    docsVerified,
    overallProgress: [identityVerified, kycCleared, docsVerified].filter(Boolean).length,
    steps: [
      { id: "kba", label: "Identity Questions", complete: identityVerified },
      { id: "kyc", label: "Compliance Checks", complete: kycCleared },
      { id: "docs", label: "Document Verification", complete: docsVerified },
    ],
  };
}
