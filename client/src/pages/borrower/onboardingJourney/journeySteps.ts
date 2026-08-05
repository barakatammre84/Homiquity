/**
 * Journey-step derivation for the borrower onboarding page.
 *
 * Pure — takes the /api/onboarding/status payload plus the two consent checks
 * and returns the ordered step list the page renders. No clock, no I/O.
 *
 * Every step that can be answered now is. The document steps (tax_docs,
 * bank_statements, alt_docs) read the per-category task counts the status
 * endpoint reports; asset_review reads the assets verification record;
 * affordability reads whether the borrower has saved an affordability
 * calculation. All five used to hardcode `complete: false`, which is why a
 * self-employed or non-QM borrower could never reach 100% and "Up Next" parked
 * permanently on Tax Documentation / Alternative Documentation — the same
 * ux-07 failure the e_consent/credit_consent wiring fixed for those two steps.
 *
 * ONE STEP STILL HAS NO BACKING DATA: `education` ("Homebuyer Education").
 * Nothing in the schema records course completion, and inventing a value would
 * be worse than leaving it open. It is optional, and summariseJourney counts
 * required steps only, so it no longer caps anyone's progress.
 */

import {
  Briefcase,
  Calculator,
  CheckCircle2,
  CreditCard,
  ClipboardCheck,
  DollarSign,
  FileText,
  GraduationCap,
  Home,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import { areCategoriesSatisfied, type DocumentProgress } from "@shared/onboardingDocumentProgress";

export interface OnboardingStatus {
  profile: Record<string, unknown> | null;
  kba: { status: string } | null;
  kyc: { overallStatus: string } | null;
  verifications: Array<{ verificationType: string; status: string }>;
  borrowerType: string;
  applicationId: string | null;
  applicationStatus: string | null;
  /** Per-document-category request/completion counts; absent on older payloads. */
  documentProgress?: DocumentProgress;
  /** Calculator types this borrower has saved a result from. */
  calculatorTypesUsed?: string[];
}

/**
 * Document categories each journey step is asking for.
 *
 * These are `tasks.document_category` values (tax_return, pay_stub,
 * bank_statement, w2, id, other). alt_docs asks for "bank statements, asset
 * docs, or alternative income proof" but the taxonomy has no distinct
 * asset-document category, so it keys off bank_statement — the one it names
 * first and the one processors actually raise for non-QM files.
 */
export const STEP_DOCUMENT_CATEGORIES = {
  tax_docs: ["tax_return"],
  bank_statements: ["bank_statement"],
  alt_docs: ["bank_statement"],
} as const;

export interface JourneyStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href?: string;
  complete: boolean;
  active: boolean;
  required: boolean;
}

export interface ConsentStatus {
  eDisclosureGiven: boolean;
  creditConsentGiven: boolean;
}

export function getBorrowerTypeLabel(type: string) {
  switch (type) {
    case "first_time_buyer": return "First-Time Buyer";
    case "self_employed": return "Self-Employed";
    case "non_qm": return "Non-QM";
    default: return "Standard";
  }
}

export function getBorrowerTypeDescription(type: string) {
  switch (type) {
    case "first_time_buyer":
      return "Includes extra guidance, down payment help, and educational resources for first-time buyers.";
    case "self_employed":
      return "Includes additional steps for tax returns, P&L statements, and bank statements.";
    case "non_qm":
      return "Includes alternative qualification options like bank statement and asset-based programs.";
    default:
      return "Streamlined verification and quick processing.";
  }
}

export function getBorrowerTypeIcon(type: string) {
  switch (type) {
    case "first_time_buyer": return GraduationCap;
    case "self_employed": return Briefcase;
    case "non_qm": return TrendingUp;
    default: return Home;
  }
}

export function getJourneySteps(
  status: OnboardingStatus,
  consentStatus: ConsentStatus,
): JourneyStep[] {
  const identityVerified = status.kba?.status === "passed";
  const kycCleared = status.kyc?.overallStatus === "cleared";
  const hasApp = !!status.applicationId;
  const docsVerified = status.verifications?.some(v => v.verificationType === "identity" && v.status === "verified");
  const assetsVerified = status.verifications?.some(v => v.verificationType === "assets" && v.status === "verified") ?? false;
  const usedAffordability = status.calculatorTypesUsed?.includes("affordability") ?? false;
  const docs = (step: keyof typeof STEP_DOCUMENT_CATEGORIES) =>
    areCategoriesSatisfied(status.documentProgress, STEP_DOCUMENT_CATEGORIES[step]);

  const baseSteps: JourneyStep[] = [
    {
      id: "application",
      title: "Apply for Pre-Approval",
      description: "Answer a few questions about your finances",
      icon: FileText,
      href: "/apply",
      complete: hasApp,
      active: !hasApp,
      required: true,
    },
    {
      id: "identity",
      title: "Verify Your Identity",
      description: "Quick identity check to protect your information",
      icon: Shield,
      href: "/identity-verification",
      complete: identityVerified && kycCleared,
      active: hasApp && !(identityVerified && kycCleared),
      required: true,
    },
    {
      id: "documents",
      title: "Upload Documents",
      description: "Income, tax, and ID documents",
      icon: FileText,
      href: "/documents",
      complete: docsVerified || false,
      active: hasApp && identityVerified,
      required: true,
    },
    {
      id: "e_consent",
      title: "Review Disclosures",
      description: "Agree to electronic disclosures",
      icon: ClipboardCheck,
      href: "/e-consent",
      complete: consentStatus.eDisclosureGiven,
      active: hasApp,
      required: true,
    },
    {
      id: "credit_consent",
      title: "Authorize Credit Check",
      description: "Lets us pull your credit report",
      icon: CreditCard,
      href: "/e-consent",
      complete: consentStatus.creditConsentGiven,
      active: hasApp && identityVerified,
      required: true,
    },
  ];

  if (status.borrowerType === "first_time_buyer") {
    baseSteps.push(
      {
        id: "education",
        title: "Homebuyer Education",
        description: "Learn about down payments, closing costs, and the mortgage process",
        icon: GraduationCap,
        href: "/learn",
        complete: false,
        active: hasApp,
        required: false,
      },
      {
        id: "affordability",
        title: "Check Affordability",
        description: "See what price range fits your budget",
        icon: Calculator,
        href: "/calculators/affordability",
        complete: usedAffordability,
        active: true,
        required: false,
      }
    );
  }

  if (status.borrowerType === "self_employed") {
    baseSteps.push(
      {
        id: "tax_docs",
        title: "Tax Documentation",
        description: "2 years of personal and business tax returns, plus P&L",
        icon: DollarSign,
        href: "/documents",
        complete: docs("tax_docs"),
        active: hasApp && identityVerified,
        required: true,
      },
      {
        id: "bank_statements",
        title: "Bank Statements",
        description: "12-24 months of personal and business statements",
        icon: Briefcase,
        href: "/documents",
        complete: docs("bank_statements"),
        active: hasApp && identityVerified,
        required: true,
      }
    );
  }

  if (status.borrowerType === "non_qm") {
    baseSteps.push(
      {
        id: "alt_docs",
        title: "Alternative Documentation",
        description: "Bank statements, asset docs, or alternative income proof",
        icon: FileText,
        href: "/documents",
        complete: docs("alt_docs"),
        active: hasApp && identityVerified,
        required: true,
      },
      {
        id: "asset_review",
        title: "Asset Qualification Review",
        description: "We review your assets against non-QM qualification guidelines",
        icon: DollarSign,
        href: "/verification",
        complete: assetsVerified,
        active: hasApp && identityVerified,
        required: true,
      }
    );
  }

  baseSteps.push(
    {
      id: "review",
      title: "Application Review",
      description: "Our team reviews your full application",
      icon: Users,
      href: "/dashboard",
      complete: status.applicationStatus === "pre_approved" || status.applicationStatus === "approved",
      active: hasApp && identityVerified && kycCleared,
      required: true,
    },
    {
      id: "approval",
      title: "Get Your Letter",
      description: "Receive your verified pre-approval letter",
      icon: CheckCircle2,
      href: "/dashboard",
      complete: status.applicationStatus === "pre_approved" || status.applicationStatus === "approved",
      active: false,
      required: true,
    }
  );

  return baseSteps;
}

export interface JourneySummary {
  /** Completed REQUIRED steps — the numerator behind progressPercent. */
  completedCount: number;
  /** Required steps in this borrower's journey. */
  requiredCount: number;
  progressPercent: number;
  nextStep: JourneyStep | undefined;
}

/**
 * Progress figures and the "Up Next" card's target.
 *
 * Progress is measured over REQUIRED steps only. The optional ones are already
 * badged "Optional" in the timeline, so counting them in the denominator meant
 * a borrower who had finished everything the file actually needs still saw an
 * unfinished journey — and for `education`, which has no completion data at
 * all, that shortfall was permanent.
 *
 * "Up Next" still considers every step, optional included: an optional step is
 * a reasonable thing to suggest next, it just must not gate the percentage.
 */
export function summariseJourney(steps: JourneyStep[]): JourneySummary {
  const required = steps.filter(s => s.required);
  const completedCount = required.filter(s => s.complete).length;
  return {
    completedCount,
    requiredCount: required.length,
    progressPercent: required.length === 0 ? 0 : Math.round((completedCount / required.length) * 100),
    nextStep: steps.find(s => !s.complete && s.active),
  };
}
