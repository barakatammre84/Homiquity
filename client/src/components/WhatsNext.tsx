import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowRight,
  Upload,
  FileText,
  MessageCircle,
  Home,
  Sparkles,
  BookOpen,
  Calculator,
  Shield,
  Clock,
  Bot,
  CheckCircle2,
  CreditCard,
  Fingerprint,
  Landmark,
  Lock,
  TrendingDown,
} from "lucide-react";
import type { LoanApplication } from "@shared/schema";

interface WhatsNextProps {
  application: LoanApplication | null;
  pendingTasks: number;
  pendingDocuments: number;
  unreadMessages: number;
  hasCreditConsent?: boolean;
  hasIdVerification?: boolean;
  hasBankConnected?: boolean;
  hasRateLocked?: boolean;
}

interface NextAction {
  icon: typeof ArrowRight;
  iconColor: string;
  title: string;
  description: string;
  href: string;
  buttonLabel: string;
  priority: number;
  whyNeeded?: string;
}

export function getNextActions(props: WhatsNextProps): NextAction[] {
  const { application, pendingTasks, pendingDocuments, unreadMessages, hasCreditConsent = true, hasIdVerification = true, hasBankConnected = true, hasRateLocked = true } = props;
  const actions: NextAction[] = [];

  if (!application) {
    actions.push({
      icon: Sparkles,
      iconColor: "text-emerald-500",
      title: "Start your pre-approval",
      description: "Get pre-approved in as little as 3 minutes. No hard credit check.",
      href: "/apply",
      buttonLabel: "Get Started",
      priority: 1,
    });
    actions.push({
      icon: Calculator,
      iconColor: "text-blue-500",
      title: "Estimate your monthly payment",
      description: "Use our calculator to estimate your monthly payment based on different scenarios.",
      href: "/calculators/affordability",
      buttonLabel: "Calculate",
      priority: 2,
    });
    actions.push({
      icon: BookOpen,
      iconColor: "text-purple-500",
      title: "Learn how mortgages work",
      description: "Browse guides and articles to prepare for your homebuying journey.",
      href: "/learn",
      buttonLabel: "Explore",
      priority: 3,
    });
    return actions;
  }

  const status = application.status;

  if (unreadMessages > 0) {
    actions.push({
      icon: MessageCircle,
      iconColor: "text-blue-500",
      title: `You have ${unreadMessages} unread message${unreadMessages > 1 ? "s" : ""}`,
      description: "Your loan team sent you a message. Respond to keep things moving.",
      href: "/messages",
      buttonLabel: "View Messages",
      priority: 1,
    });
  }

  if (pendingTasks > 0) {
    actions.push({
      icon: Upload,
      iconColor: "text-amber-500",
      title: `${pendingTasks} task${pendingTasks > 1 ? "s" : ""} need${pendingTasks === 1 ? "s" : ""} your attention`,
      description: "Complete your pending tasks to keep your application moving forward.",
      href: "/tasks",
      buttonLabel: "View Tasks",
      priority: 2,
      whyNeeded: "Completing tasks on time prevents delays in your approval.",
    });
  }

  if (pendingDocuments > 0) {
    actions.push({
      icon: FileText,
      iconColor: "text-orange-500",
      title: `${pendingDocuments} document${pendingDocuments > 1 ? "s" : ""} still needed`,
      description: "Upload the remaining documents so we can continue reviewing your application.",
      href: "/documents",
      buttonLabel: "Upload Documents",
      priority: 3,
      whyNeeded: "Documents verify the information in your application and are required by federal regulations.",
    });
  }

  if (!hasCreditConsent) {
    actions.push({
      icon: CreditCard,
      iconColor: "text-rose-500",
      title: "Authorize your credit check",
      description: "We need your consent to pull your credit report. This is a soft pull and won't affect your score.",
      href: "/dashboard?action=credit-consent",
      buttonLabel: "Authorize",
      priority: 2,
      whyNeeded: "A credit report is required by law to evaluate your loan eligibility.",
    });
  }

  if (!hasIdVerification) {
    actions.push({
      icon: Fingerprint,
      iconColor: "text-indigo-500",
      title: "Verify your identity",
      description: "A quick ID verification helps us protect you and speeds up your approval.",
      href: "/dashboard?action=verify-id",
      buttonLabel: "Verify Now",
      priority: 3,
      whyNeeded: "Identity verification is required under federal anti-fraud regulations.",
    });
  }

  if (!hasBankConnected) {
    actions.push({
      icon: Landmark,
      iconColor: "text-teal-500",
      title: "Connect your bank account",
      description: "Securely link your bank to instantly verify your income and assets.",
      href: "/dashboard?action=connect-bank",
      buttonLabel: "Connect Bank",
      priority: 3,
      whyNeeded: "Bank verification provides faster, more accurate income and asset confirmation.",
    });
  }

  if (!hasRateLocked && (status === "pre_approved" || status === "underwriting" || status === "conditional")) {
    actions.push({
      icon: Lock,
      iconColor: "text-amber-500",
      title: "Lock in your rate",
      description: "Rates can change daily. Lock your rate now to protect against increases.",
      href: "/dashboard?action=rate-lock",
      buttonLabel: "Lock Rate",
      priority: 2,
    });
  }

  if (status === "submitted" || status === "analyzing") {
    actions.push({
      icon: Clock,
      iconColor: "text-primary",
      title: "Your application is being reviewed",
      description: "We're analyzing your information. You'll hear back within minutes.",
      href: "/dashboard",
      buttonLabel: "View Status",
      priority: 5,
    });
  }

  if (status === "pre_approved") {
    if (actions.length === 0) {
      actions.push({
        icon: Home,
        iconColor: "text-emerald-500",
        title: "Check if you can afford a home",
        description: "You have a pre-approval on file. See if a specific home fits your budget.",
        href: "/afford",
        buttonLabel: "Can I Afford This Home?",
        priority: 4,
      });
    }
    actions.push({
      icon: Shield,
      iconColor: "text-blue-500",
      title: "How we protect your data",
      description: "Learn about the security measures protecting your personal information.",
      href: "/privacy",
      buttonLabel: "Learn More",
      priority: 10,
    });
  }

  if (["doc_collection", "processing"].includes(status)) {
    if (pendingTasks === 0 && pendingDocuments === 0) {
      actions.push({
        icon: Clock,
        iconColor: "text-blue-500",
        title: "Your documents are being processed",
        description: "Our team is reviewing your documents. We'll reach out if we need anything else.",
        href: "/dashboard",
        buttonLabel: "View Status",
        priority: 4,
      });
    }
  }

  if (["underwriting", "conditional"].includes(status)) {
    actions.push({
      icon: Shield,
      iconColor: "text-primary",
      title: "Underwriting in progress",
      description: "A human underwriter is reviewing your file. This typically takes 1-3 business days.",
      href: "/dashboard",
      buttonLabel: "View Status",
      priority: 5,
    });
  }

  if (status === "clear_to_close" || status === "closing") {
    actions.push({
      icon: Sparkles,
      iconColor: "text-emerald-500",
      title: "You're almost there",
      description: "Your loan is clear to close. Your closer will reach out to schedule your signing.",
      href: "/messages",
      buttonLabel: "Contact Team",
      priority: 1,
    });
  }

  if (status === "denied" || status === "declined") {
    actions.push({
      icon: TrendingDown,
      iconColor: "text-rose-500",
      title: "Let's explore your options",
      description: "Your current application wasn't approved, but there may be other paths. Chat with our AI Coach to learn what you can do next.",
      href: "/ai-coach",
      buttonLabel: "Talk to Coach",
      priority: 1,
    });
    actions.push({
      icon: BookOpen,
      iconColor: "text-purple-500",
      title: "Improve your mortgage readiness",
      description: "Read our guides on credit improvement, saving for a down payment, and more.",
      href: "/learn",
      buttonLabel: "Read Guides",
      priority: 2,
    });
  }

  if (status === "submitted" || status === "analyzing") {
    actions.push({
      icon: Bot,
      iconColor: "text-purple-500",
      title: "Chat with your AI Coach",
      description: "While you wait, get personalized homebuying tips and answers to your mortgage questions.",
      href: "/ai-coach",
      buttonLabel: "Start Chat",
      priority: 8,
    });
  }

  if (actions.length === 0) {
    actions.push({
      icon: BookOpen,
      iconColor: "text-purple-500",
      title: "Homebuying tips for you",
      description: "Browse expert guides about the mortgage process while you wait.",
      href: "/learn",
      buttonLabel: "Read Guides",
      priority: 10,
    });
  }

  return actions.sort((a, b) => a.priority - b.priority).slice(0, 3);
}

export function WhatsNext(props: WhatsNextProps) {
  const actions = getNextActions(props);

  if (actions.length === 0) return null;

  const primary = actions[0];
  const secondary = actions.slice(1);
  const PrimaryIcon = primary.icon;

  return (
    <div className="space-y-3" data-testid="whats-next">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        What's Next
      </h3>

      <Card className="shadow-md hover-elevate" data-testid="card-primary-action">
        <CardContent className="p-5">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 ${primary.iconColor}`} data-testid="icon-primary-action">
              <PrimaryIcon className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-sm" data-testid="text-primary-action-title">
                {primary.title}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                {primary.description}
              </p>
              {primary.whyNeeded && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-[11px] text-muted-foreground/70 hover:text-muted-foreground underline decoration-dotted underline-offset-2 cursor-help mt-1" data-testid="button-why-needed">
                      Why is this needed?
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                    <p>{primary.whyNeeded}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <Link href={primary.href}>
              <Button size="default" data-testid="button-primary-action">
                {primary.buttonLabel}
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {secondary.length > 0 && (
        <div className="space-y-1.5" data-testid="section-secondary-actions">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium px-1">
            Also available
          </p>
          {secondary.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link key={index} href={action.href} data-testid={`link-secondary-action-${index}`}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-md hover-elevate cursor-pointer" data-testid={`row-secondary-action-${index}`}>
                  <Icon className={`h-4 w-4 shrink-0 ${action.iconColor}`} />
                  <span className="text-sm flex-1 min-w-0 truncate">{action.title}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

const ONBOARDING_STEPS = [
  {
    step: 1,
    icon: Bot,
    iconColor: "text-purple-500",
    bgColor: "bg-purple-500",
    title: "Meet your AI Coach",
    description: "Start a quick chat to understand your mortgage readiness.",
    href: "/ai-coach",
    buttonLabel: "Start Chat",
  },
  {
    step: 2,
    icon: Home,
    iconColor: "text-amber-500",
    bgColor: "bg-amber-500",
    title: "Check affordability",
    description: "See if a specific home fits your budget.",
    href: "/afford",
    buttonLabel: "Can I Afford This Home?",
  },
  {
    step: 3,
    icon: FileText,
    iconColor: "text-emerald-500",
    bgColor: "bg-emerald-500",
    title: "Get pre-approved",
    description: "Apply in about 3 minutes. No hard credit check.",
    href: "/apply",
    buttonLabel: "Start Application",
  },
  {
    step: 4,
    icon: Upload,
    iconColor: "text-blue-500",
    bgColor: "bg-blue-500",
    title: "Upload your documents",
    description: "Share pay stubs, bank statements, and tax returns.",
    href: "/documents",
    buttonLabel: "Upload Docs",
  },
];

interface FirstVisitWelcomeProps {
  userName?: string;
  hasApplication?: boolean;
  hasDocuments?: boolean;
  hasCoachSession?: boolean;
  hasBrowsedProperties?: boolean;
}

export function FirstVisitWelcome({ userName, hasApplication = false, hasDocuments = false, hasCoachSession = false, hasBrowsedProperties = false }: FirstVisitWelcomeProps) {
  const completedSteps = [
    hasCoachSession,
    hasBrowsedProperties,
    hasApplication,
    hasDocuments,
  ];

  const firstIncompleteIndex = completedSteps.findIndex(s => !s);
  const completedCount = completedSteps.filter(Boolean).length;
  const activeStep = firstIncompleteIndex >= 0 ? ONBOARDING_STEPS[firstIncompleteIndex] : null;

  return (
    <div className="space-y-6" data-testid="first-visit-welcome">
      <div className="text-center py-3">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground" data-testid="text-welcome-heading">
          {userName ? `Welcome, ${userName}` : "Welcome to Homiquity"}
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
          Your path to homeownership starts here. Let's take it one step at a time.
        </p>
      </div>

      <div className="flex items-center justify-center gap-3 pb-1" data-testid="section-onboarding-progress">
        <div className="flex gap-1.5" data-testid="progress-dots">
          {ONBOARDING_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                completedSteps[i]
                  ? "w-8 bg-emerald-500"
                  : i === firstIncompleteIndex
                  ? "w-8 bg-primary"
                  : "w-4 bg-muted"
              }`}
              data-testid={`progress-dot-${i}`}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground" data-testid="text-step-count">
          {completedCount}/{ONBOARDING_STEPS.length}
        </span>
      </div>

      {activeStep && (
        <Card className="shadow-md border-primary/20" data-testid="card-active-onboarding-step">
          <CardContent className="p-5">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${activeStep.iconColor}`}>
                <activeStep.icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <Badge variant="default" className="text-[10px] mb-1">
                  Step {activeStep.step} of {ONBOARDING_STEPS.length}
                </Badge>
                <p className="font-semibold text-sm" data-testid="text-active-step-title">
                  {activeStep.title}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {activeStep.description}
                </p>
              </div>
              <Link href={activeStep.href}>
                <Button size="default" data-testid="button-active-step">
                  {activeStep.buttonLabel}
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </Link>
              {activeStep.step === 2 && (
                <Link href="/apply" data-testid="link-skip-to-apply">
                  <span className="text-xs text-muted-foreground hover:underline cursor-pointer">
                    Already found a home? Skip to application
                  </span>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-1.5">
        {ONBOARDING_STEPS.map((step, index) => {
          const isComplete = completedSteps[index];
          const isActive = index === firstIncompleteIndex;
          if (isActive) return null;

          const Icon = step.icon;
          return (
            <Link key={step.step} href={step.href} data-testid={`link-onboarding-step-${step.step}`}>
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md ${isComplete ? "opacity-60" : "hover-elevate cursor-pointer"}`}>
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                  isComplete ? "border-emerald-500 bg-emerald-500 text-white" : "border-border text-muted-foreground"
                }`}>
                  {isComplete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                </div>
                <span className={`text-sm flex-1 min-w-0 ${isComplete ? "line-through text-muted-foreground" : ""}`}>
                  {step.title}
                </span>
                {isComplete && (
                  <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                    Done
                  </Badge>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <Card className="hover-elevate" data-testid="card-quick-tools">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Quick Tools
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/calculators/affordability" data-testid="link-quick-calculator">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2" data-testid="button-quick-calculator">
                <Calculator className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                Affordability
              </Button>
            </Link>
            <Link href="/rates" data-testid="link-quick-rates">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2" data-testid="button-quick-rates">
                <Shield className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                Today's Rates
              </Button>
            </Link>
            <Link href="/first-time-buyer" data-testid="link-quick-ftb">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2" data-testid="button-quick-ftb">
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                Buyer Guide
              </Button>
            </Link>
            <Link href="/down-payment-wizard" data-testid="link-quick-dpa">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2" data-testid="button-quick-dpa">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                Down Payment
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-2 py-2" data-testid="trust-footer">
        <Shield className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        <p className="text-[11px] text-muted-foreground">
          Your data is encrypted and never shared without your consent.
        </p>
      </div>
    </div>
  );
}
