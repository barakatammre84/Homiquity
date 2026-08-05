import type { DraftConsentProgress } from "@shared/schema";

export interface DisclosureData {
  disclosureText: string;
  disclosureVersion: string;
}

export interface ConsentData {
  consent: {
    id: string;
    applicationId: string;
    userId: string;
    consentType: string;
    disclosureVersion: string;
    consentGiven: boolean;
    consentTimestamp: string;
    borrowerFullName: string;
    isActive: boolean;
  } | null;
}

export interface CreditSummary {
  hasActiveConsent: boolean;
  consent: ConsentData["consent"];
  latestPull: {
    id: string;
    status: string;
    representativeScore: number | null;
    experianScore: number | null;
    equifaxScore: number | null;
    transunionScore: number | null;
    completedAt: string | null;
    expiresAt: string | null;
  } | null;
  pullCount: number;
  adverseActionCount: number;
}

export interface DraftData {
  draft: DraftConsentProgress | null;
}

/**
 * Which of the three consent-form steps the borrower has reached, persisted
 * with the draft so a returning borrower resumes where they left off.
 *
 * 1 = details entered, 2 = disclosure read, 3 = acknowledged.
 */
export function draftStep(disclosureRead: boolean, acknowledged: boolean): 1 | 2 | 3 {
  return acknowledged ? 3 : disclosureRead ? 2 : 1;
}

/** The last four digits of an SSN — digits only, never more than four. */
export function normalizeSsnLast4(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4);
}
