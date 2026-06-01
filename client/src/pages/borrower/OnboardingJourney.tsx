import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Rocket,
  CheckCircle2,
  Circle,
  Shield,
  FileText,
  DollarSign,
  Home,
  Briefcase,
  GraduationCap,
  ChevronRight,
  Star,
  MessageSquare,
  Target,
  BookOpen,
  Calculator,
  Users,
  TrendingUp,
  ClipboardCheck,
  CreditCard,
} from "lucide-react";

interface OnboardingStatus {
  profile: Record<string, unknown> | null;
  kba: { status: string } | null;
  kyc: { overallStatus: string } | null;
  verifications: Array<{ verificationType: string; status: string }>;
  borrowerType: string;
  applicationId: string | null;
  applicationStatus: string | null;
}

interface JourneyStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href?: string;
  complete: boolean;
  active: boolean;
  required: boolean;
}

function getBorrowerTypeLabel(type: string) {
  switch (type) {
    case "first_time_buyer": return "First-Time Buyer";
    case "self_employed": return "Self-Employed";
    case "non_qm": return "Non-QM";
    default: return "Standard";
  }
}

function getBorrowerTypeDescription(type: string) {
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

function getBorrowerTypeIcon(type: string) {
  switch (type) {
    case "first_time_buyer": return GraduationCap;
    case "self_employed": return Briefcase;
    case "non_qm": return TrendingUp;
    default: return Home;
  }
}

function getJourneySteps(status: OnboardingStatus): JourneyStep[] {
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
      complete: false,
      active: hasApp,
      required: true,
    },
    {
      id: "credit_consent",
      title: "Authorize Credit Check",
      description: "Lets us pull your credit report",
      icon: CreditCard,
      href: "/e-consent",
      complete: false,
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

function FeedbackForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/onboarding/feedback", {
      rating,
      comment: comment || undefined,
      feedbackType: "general",
      step: "onboarding_journey",
    }),
    onSuccess: () => {
      toast({ title: "Thank you!", description: "Your feedback helps us improve." });
      onSubmitted();
    },
    onError: () => toast({ title: "Error", description: "Failed to submit feedback", variant: "destructive" }),
  });

  return (
    <div data-testid="feedback-form">
      <p className="text-sm font-medium text-foreground mb-3">How is your experience so far?</p>
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            onClick={() => setRating(value)}
            className="p-1 transition-colors"
            data-testid={`button-rating-${value}`}
          >
            <Star
              className={`h-6 w-6 ${value <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
            />
          </button>
        ))}
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Tell us what's working or what could be better..."
        className="mb-3 text-sm"
        rows={3}
        data-testid="input-feedback-comment"
      />
      <Button
        size="sm"
        onClick={() => mutation.mutate()}
        disabled={rating === 0 || mutation.isPending}
        data-testid="button-submit-feedback"
      >
        Submit Feedback
      </Button>
    </div>
  );
}

export default function OnboardingJourney() {
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const { data: status, isLoading } = useQuery<OnboardingStatus>({
    queryKey: ["/api/onboarding/status"],
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-48" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  if (!status) return null;

  const BorrowerIcon = getBorrowerTypeIcon(status.borrowerType);
  const steps = getJourneySteps(status);
  const completedCount = steps.filter(s => s.complete).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);
  const nextStep = steps.find(s => !s.complete && s.active);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" data-testid="onboarding-journey-page">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Rocket className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground md:text-2xl" data-testid="text-journey-title">Your Mortgage Journey</h1>
            <p className="text-sm text-muted-foreground">Here's every step from application to closing.</p>
          </div>
        </div>
      </div>

      <Card className="mb-6" data-testid="card-borrower-profile">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              <BorrowerIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" data-testid="badge-borrower-type">{getBorrowerTypeLabel(status.borrowerType)} Path</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{getBorrowerTypeDescription(status.borrowerType)}</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-muted-foreground">Overall Progress</span>
              <span className="text-xs font-semibold text-foreground" data-testid="text-progress-percent">{progressPercent}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
                data-testid="progress-bar"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {nextStep && (
        <Card className="mb-6 border-primary/20" data-testid="card-next-step">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">Up Next</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-foreground" data-testid="text-next-step-title">{nextStep.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{nextStep.description}</p>
              </div>
              {nextStep.href && (
                <Button size="sm" asChild data-testid="button-next-step">
                  <Link href={nextStep.href}>
                    Continue
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-1 mb-6" data-testid="journey-steps-list">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.id} className="flex gap-3" data-testid={`journey-step-${step.id}`}>
              <div className="flex flex-col items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${
                  step.complete ? "bg-emerald-500 text-white" : step.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {step.complete ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-0.5 flex-1 min-h-[24px] ${step.complete ? "bg-emerald-500" : "bg-muted"}`} />
                )}
              </div>
              <div className={`flex-1 pb-4 ${!step.active && !step.complete ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${step.complete ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                      {step.title}
                    </span>
                    {!step.required && <Badge variant="secondary" className="text-[10px]">Optional</Badge>}
                  </div>
                  {step.complete && <Badge variant="default">Complete</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                {step.active && !step.complete && step.href && (
                  <Button variant="outline" size="sm" className="mt-2" asChild data-testid={`button-step-${step.id}`}>
                    <Link href={step.href}>
                      Get Started
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {status.borrowerType === "first_time_buyer" && (
        <Card className="mb-6" data-testid="card-buyer-tips">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">First-Time Buyer Tips</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { title: "Check your credit score", desc: "Aim for 620+ for conventional loans, 580+ for FHA" },
                { title: "Save for closing costs", desc: "Typically 2-5% of the purchase price" },
                { title: "Get pre-approved first", desc: "Sellers prefer buyers with pre-approval letters" },
                { title: "Explore down payment assistance", desc: "Many state and local programs help first-time buyers" },
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{tip.title}</p>
                    <p className="text-xs text-muted-foreground">{tip.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/learn">
                Browse Learning Center
                <ChevronRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {status.borrowerType === "self_employed" && (
        <Card className="mb-6" data-testid="card-se-checklist">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Self-Employed Document Checklist</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { title: "2 years personal tax returns", desc: "Complete 1040s with all schedules" },
                { title: "2 years business tax returns", desc: "1120, 1120S, or 1065 as applicable" },
                { title: "Year-to-date P&L statement", desc: "Signed and dated within 60 days" },
                { title: "Business license or registration", desc: "Proof of ongoing business operation" },
                { title: "12-24 months bank statements", desc: "Personal and business accounts" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-feedback">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Share Your Feedback</CardTitle>
          </div>
          <CardDescription>Help us improve the onboarding experience for future borrowers.</CardDescription>
        </CardHeader>
        <CardContent>
          {feedbackSubmitted ? (
            <div className="text-center py-4" data-testid="feedback-thanks">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">Thank you for your feedback!</p>
            </div>
          ) : (
            <FeedbackForm onSubmitted={() => setFeedbackSubmitted(true)} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
