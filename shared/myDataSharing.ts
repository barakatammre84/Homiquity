/**
 * Borrower "My Data" transparency read model — the view builders behind
 * GET /api/my-data/sharing and the types the borrower dashboard renders.
 *
 * Every mapper here is a strict whitelist. The raw lender_submissions,
 * credit_consents, and borrower_consents rows carry staff-internal and
 * PII-adjacent columns (staff notes, readiness snapshots, the full MISMO XML
 * package, SSN last-4, DOB, IP addresses, browser fingerprints) that must
 * never reach the borrower payload. A new field is exposed by adding it to a
 * view interface deliberately — never by spreading the row.
 *
 * Lives in shared/ because it is pure and dependency-free at runtime: the
 * server maps rows through it, the client imports the view types, and the
 * unit suite exercises it without a database.
 */

import {
  getWholesaleLender,
  LENDER_SUBMISSION_STATUSES,
  type LenderSubmissionStatus,
} from "./wholesaleLenders";
import type { LenderSubmission } from "./schema/delivery";
import type { CreditConsent } from "./schema/compliance";
import type { BorrowerConsent } from "./schema/compliance";

// ---------------------------------------------------------------------------
// Submission status → borrower-facing presentation
// ---------------------------------------------------------------------------

/** Tones map 1:1 to Badge variants in the Obsidian Indigo design system. */
export type StatusTone = "info" | "success" | "warning" | "destructive" | "secondary";

export interface SubmissionStatusMeta {
  label: string;
  description: string;
  tone: StatusTone;
  terminal: boolean;
}

/**
 * Borrower-friendly rendering of the wholesale submission status machine.
 * Keys must stay in lockstep with LENDER_SUBMISSION_STATUSES — enforced by
 * the unit suite so a new status cannot ship without borrower-facing copy.
 */
export const SUBMISSION_STATUS_META: Record<LenderSubmissionStatus, SubmissionStatusMeta> = {
  submitted: {
    label: "Sent to lender",
    description: "Your loan file has been transmitted to this lender.",
    tone: "info",
    terminal: false,
  },
  acknowledged: {
    label: "Received by lender",
    description: "The lender has confirmed receipt of your file.",
    tone: "info",
    terminal: false,
  },
  in_underwriting: {
    label: "Under review",
    description: "The lender's underwriting team is reviewing your file.",
    tone: "info",
    terminal: false,
  },
  conditions_issued: {
    label: "Items requested",
    description: "The lender needs additional items before a final decision.",
    tone: "warning",
    terminal: false,
  },
  conditions_cleared: {
    label: "Items cleared",
    description: "The requested items have been provided and accepted.",
    tone: "success",
    terminal: false,
  },
  clear_to_close: {
    label: "Clear to close",
    description: "The lender has approved your file for closing.",
    tone: "success",
    terminal: false,
  },
  funded: {
    label: "Funded",
    description: "This lender funded your loan.",
    tone: "success",
    terminal: true,
  },
  denied: {
    label: "Declined by lender",
    description: "This lender declined the file. Your team can discuss next steps.",
    tone: "destructive",
    terminal: true,
  },
  withdrawn: {
    label: "Withdrawn",
    description: "This submission was withdrawn and is no longer active.",
    tone: "secondary",
    terminal: true,
  },
  suspended: {
    label: "On hold",
    description: "The lender has paused review of this file.",
    tone: "warning",
    terminal: false,
  },
};

/**
 * What a wholesale MISMO 3.4 lender package contains, in borrower terms.
 * Static by design: the package is always the full loan file assembled by
 * server/mismo.ts, so the categories do not vary per submission.
 */
export const SHARED_PACKAGE_CONTENTS: readonly string[] = [
  "Identity and contact information (name, address, date of birth, Social Security number)",
  "Employment history and income",
  "Assets and account balances",
  "Debts and monthly obligations",
  "Credit scores from your credit report",
  "Property details and requested loan terms",
  "Loan application declarations",
];

// ---------------------------------------------------------------------------
// View models
// ---------------------------------------------------------------------------

export interface BorrowerSubmissionView {
  id: string;
  lenderId: string;
  lenderName: string;
  lenderSpecialty: string | null;
  status: LenderSubmissionStatus;
  statusLabel: string;
  statusDescription: string;
  statusTone: StatusTone;
  isTerminal: boolean;
  /** True while the lender leg is the deterministic simulation (no live broker agreement). */
  simulated: boolean;
  confirmationId: string | null;
  submittedAt: string | null;
  statusUpdatedAt: string | null;
  /** sha256 fingerprint of the exact package the lender received (tamper evidence). */
  packageFingerprint: string | null;
  packageGeneratedAt: string | null;
  sharedData: readonly string[];
}

export interface CreditConsentView {
  id: string;
  kind: "credit";
  consentType: string;
  label: string;
  disclosureVersion: string;
  consentGiven: boolean;
  consentedAt: string | null;
  signatureType: string | null;
  isActive: boolean;
  revokedAt: string | null;
  revokedReason: string | null;
}

export interface PlatformConsentView {
  id: string;
  kind: "platform";
  consentType: string;
  label: string;
  templateVersion: string | null;
  consentGiven: boolean;
  consentMethod: string;
  consentedAt: string | null;
  isRevoked: boolean;
  revokedAt: string | null;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const CREDIT_CONSENT_LABELS: Record<string, string> = {
  soft_pull: "Soft credit check authorization (no score impact)",
  hard_pull: "Full credit report authorization",
  credit_pull: "Credit check authorization",
  monitoring: "Credit monitoring authorization",
};

const PLATFORM_CONSENT_LABELS: Record<string, string> = {
  credit_authorization: "Credit pull authorization",
  econsent: "Electronic records & communications (eConsent)",
  privacy_policy: "Privacy policy acknowledgment",
  terms_of_service: "Terms of service",
  disclosure: "General disclosures",
  appraisal_waiver: "Appraisal copy timing waiver",
  title_acknowledgment: "Title company selection acknowledgment",
  rate_lock_agreement: "Rate lock agreement",
  intent_to_proceed: "Intent to proceed (TRID)",
  loan_estimate_receipt: "Loan Estimate receipt acknowledgment",
  // Seeded by consentGate.ts alongside the CONSENT_TYPES list.
  anti_steering: "Anti-steering loan options disclosure",
};

/** "soft_pull" → "Soft pull" — fallback for consent types without curated copy. */
export function humanizeConsentType(consentType: string): string {
  const spaced = consentType.replace(/_/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : consentType;
}

// ---------------------------------------------------------------------------
// Mappers (strict whitelists)
// ---------------------------------------------------------------------------

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function toBorrowerSubmissionView(submission: LenderSubmission): BorrowerSubmissionView {
  const lender = getWholesaleLender(submission.lenderId);
  const status = (LENDER_SUBMISSION_STATUSES as readonly string[]).includes(submission.status)
    ? (submission.status as LenderSubmissionStatus)
    : "submitted";
  const meta = SUBMISSION_STATUS_META[status];
  return {
    id: submission.id,
    lenderId: submission.lenderId,
    lenderName: lender?.name ?? submission.lenderId,
    lenderSpecialty: lender?.specialty ?? null,
    status,
    statusLabel: meta.label,
    statusDescription: meta.description,
    statusTone: meta.tone,
    isTerminal: meta.terminal,
    simulated: submission.simulated,
    confirmationId: submission.confirmationId ?? null,
    submittedAt: toIso(submission.submittedAt),
    statusUpdatedAt: toIso(submission.statusUpdatedAt),
    packageFingerprint: submission.mismoPackageHash ?? null,
    packageGeneratedAt: toIso(submission.mismoPackageGeneratedAt),
    sharedData: SHARED_PACKAGE_CONTENTS,
  };
}

export function toCreditConsentView(consent: CreditConsent): CreditConsentView {
  return {
    id: consent.id,
    kind: "credit",
    consentType: consent.consentType,
    label: CREDIT_CONSENT_LABELS[consent.consentType] ?? humanizeConsentType(consent.consentType),
    disclosureVersion: consent.disclosureVersion,
    consentGiven: consent.consentGiven,
    consentedAt: toIso(consent.consentTimestamp),
    signatureType: consent.signatureType ?? null,
    isActive: consent.isActive ?? false,
    revokedAt: toIso(consent.revokedAt),
    revokedReason: consent.revokedReason ?? null,
  };
}

export function toPlatformConsentView(consent: BorrowerConsent): PlatformConsentView {
  return {
    id: consent.id,
    kind: "platform",
    consentType: consent.consentType,
    label: PLATFORM_CONSENT_LABELS[consent.consentType] ?? humanizeConsentType(consent.consentType),
    templateVersion: consent.templateVersion ?? null,
    consentGiven: consent.consentGiven,
    consentMethod: consent.consentMethod,
    consentedAt: toIso(consent.consentedAt),
    isRevoked: consent.isRevoked ?? false,
    revokedAt: toIso(consent.revokedAt),
  };
}
