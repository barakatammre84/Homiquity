/**
 * Journey-step derivation for the borrower onboarding page.
 *
 * Extracted verbatim from OnboardingJourney.tsx. Pure — takes the
 * /api/onboarding/status payload plus the two consent checks and returns the
 * ordered step list the page renders. No clock, no I/O.
 *
 * KNOWN GAP (partial ux-07 fix). Six of these steps hardcode `complete: false`
 * because /api/onboarding/status carries nothing that could answer them:
 * education, affordability, tax_docs, bank_statements, alt_docs, asset_review.
 * The handler in server/routes/borrower/onboarding.ts returns profile, kba,
 * kyc, verifications, borrowerType and the latest application — verifications
 * are typed records (the page reads verificationType === "identity"), not
 * per-document-category completion, so there is no client-side fix.
 *
 * The consequence is real and is pinned by tests below: a self-employed or
 * non-QM borrower can never reach 100%, and once the shared steps are done
 * "Up Next" parks permanently on Tax Documentation / Alternative
 * Documentation. That is the same failure the e_consent/credit_consent wiring
 * fixed for those two steps; closing it for the rest needs the status endpoint
 * to report document-category progress. Left honest and pinned rather than
 * papered over with a guessed `complete: true`.
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

export interface OnboardingStatus {
  profile: Record<string, unknown> | null;
  kba: { status: string } | null;
  kyc: { overallStatus: string } | null;
  verifications: Array<{ verificationType: string; status: string }>;
  borrowerType: string;
  applicationId: string | null;
  applicationStatus: string | null;
}

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
        complete: false,
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
        complete: false,
        active: hasApp && identityVerified,
        required: true,
      },
      {
        id: "bank_statements",
        title: "Bank Statements",
        description: "12-24 months of personal and business statements",
        icon: Briefcase,
        href: "/documents",
        complete: false,
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
        complete: false,
        active: hasApp && identityVerified,
        required: true,
      },
      {
        id: "asset_review",
        title: "Asset Qualification Review",
        description: "We review your assets against non-QM qualification guidelines",
        icon: DollarSign,
        href: "/verification",
        complete: false,
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
  completedCount: number;
  progressPercent: number;
  nextStep: JourneyStep | undefined;
}

/** Progress figures and the "Up Next" card's target, derived from the steps. */
export function summariseJourney(steps: JourneyStep[]): JourneySummary {
  const completedCount = steps.filter(s => s.complete).length;
  return {
    completedCount,
    progressPercent: Math.round((completedCount / steps.length) * 100),
    nextStep: steps.find(s => !s.complete && s.active),
  };
}
