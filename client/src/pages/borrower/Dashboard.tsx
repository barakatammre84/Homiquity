import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { usePageView } from "@/hooks/useActivityTracker";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/formatters";
import { hasPendingPreApprovalSubmit } from "@/lib/pendingAttribution";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BorrowerRequests } from "@/components/BorrowerRequests";
import { TermTooltip } from "@/components/TermTooltip";
import { ApplicationSwitcher } from "@/components/ApplicationSwitcher";
import { JourneyTracker } from "@/components/JourneyTracker";
import { TrustLayer } from "@/components/TrustLayer";
import { RenterHome } from "@/pages/borrower/RenterHome";
import { isStaffRole } from "@shared/roles";
import { isTerminalLoanAppStatus } from "@shared/schema";
import PredictionInsights from "@/components/borrower/PredictionInsights";
import type { LoanApplication, DealActivity } from "@shared/schema";
import {
  CheckCircle2,
  Clock,
  FileText,
  ArrowRight,
  TrendingUp,
  Home,
  Percent,
  DollarSign,
  Calendar,
  User,
  Bot,
  Sparkles,
  Users,
  Download,
  Loader2,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Shield,
  Target,
  Briefcase,
  PiggyBank,
  Rocket,
  Zap,
} from "lucide-react";

/** Server-computed next action (see server/services/nextAction.ts). */
interface NextActionData {
  kind:
    | "start_application" | "resume_draft" | "renew_preapproval" | "read_messages"
    | "strengthen_file" | "upload_documents" | "complete_tasks" | "clear_conditions"
    | "browse_homes" | "contact_team" | "talk_to_coach" | "homeowner_hub" | "in_review";
  title: string;
  description: string;
  href: string;
  buttonLabel: string;
  whyNeeded?: string;
  timeEstimate?: string;
  count?: number;
  urgency?: "normal" | "urgent" | "expired";
}

interface DashboardData {
  applications: LoanApplication[];
  stats: {
    totalApplications: number;
    preApprovedAmount: string;
    pendingDocuments: number;
  };
  activities: DealActivity[];
  unreadMessages: number;
  pendingTaskCount: number;
  pendingTasksByApplication?: Record<string, { total: number; documents: number }>;
  loanOptionCounts?: Record<string, number>;
  hmdaStatus?: Record<string, boolean>;
  recentOptions?: Array<{ id: string; applicationId: string; interestRate: string; loanType: string; loanTerm: number; monthlyPayment: string; isRecommended: boolean | null; lockedAt: string | null }>;
  verificationStatus?: Record<string, { hasCreditConsent: boolean; hasIdVerification: boolean; hasBankConnected: boolean; hasRateLocked: boolean }>;
  activitySummary?: { totalPageViews: number; propertySearches: number; calculatorUses: number; coachChats: number; propertyViews: number };
  nextAction?: NextActionData;
}

/** Icon per next-action kind — the only presentation decision left client-side. */
const NEXT_ACTION_ICONS: Record<NextActionData["kind"], React.ElementType> = {
  start_application: Sparkles,
  resume_draft: FileText,
  renew_preapproval: AlertTriangle,
  read_messages: MessageCircle,
  strengthen_file: AlertTriangle,
  upload_documents: FileText,
  complete_tasks: FileText,
  clear_conditions: AlertCircle,
  browse_homes: Home,
  contact_team: Sparkles,
  talk_to_coach: Bot,
  homeowner_hub: Home,
  in_review: Clock,
};

/** Shape of loan_applications.pre_uw_flags (written by the pre-underwriting validator). */
interface PreUwFlagsPayload {
  flags?: Array<{ code: string; severity: string; reason: string }>;
  evaluatedAt?: string;
}

function getPreUwFlags(application: LoanApplication | null | undefined): PreUwFlagsPayload | null {
  if (!application) return null;
  const raw = (application as { preUwFlags?: unknown }).preUwFlags;
  if (!raw || typeof raw !== "object") return null;
  return raw as PreUwFlagsPayload;
}

function getExpirationInfo(application: LoanApplication): { label: string; daysLeft: number; urgency: "expired" | "urgent" | "normal" } | null {
  if (application.status !== "pre_approved") return null;
  if (!application.createdAt) return null;
  const createdDate = new Date(application.createdAt);
  if (isNaN(createdDate.getTime())) return null;
  const expirationDate = new Date(createdDate);
  expirationDate.setDate(expirationDate.getDate() + 30);
  const now = new Date();
  const daysLeft = Math.ceil((expirationDate.getTime() - now.getTime()) / 86400000);
  const label = expirationDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const urgency = daysLeft <= 0 ? "expired" : daysLeft <= 7 ? "urgent" : "normal";
  return { label, daysLeft, urgency };
}

function formatActivityTime(timestamp: string | Date): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getReadinessPercent(
  application: LoanApplication | null,
  pendingDocs: number,
  pendingTasks: number,
  verificationStatus?: { hasCreditConsent: boolean; hasIdVerification: boolean; hasBankConnected: boolean; hasRateLocked: boolean },
  hasCoachSession?: boolean,
  hasBrowsedProperties?: boolean,
): number {
  if (!application) {
    let score = 10;
    if (hasCoachSession) score += 15;
    if (hasBrowsedProperties) score += 10;
    return score;
  }
  const status = application.status;
  const statusWeights: Record<string, number> = {
    draft: 20,
    submitted: 35,
    analyzing: 40,
    pre_approved: 60,
    doc_collection: 55,
    processing: 65,
    underwriting: 75,
    conditional: 85,
    clear_to_close: 95,
    closing: 98,
    funded: 100,
    denied: 10,
  };
  let base = statusWeights[status] || 30;
  if (verificationStatus) {
    if (verificationStatus.hasCreditConsent) base += 3;
    if (verificationStatus.hasIdVerification) base += 3;
    if (verificationStatus.hasBankConnected) base += 3;
    if (verificationStatus.hasRateLocked) base += 3;
  }
  if (pendingDocs === 0 && base >= 50) base += 5;
  if (pendingTasks === 0 && base >= 50) base += 5;
  return Math.min(base, 100);
}

function getPersonalizedGreeting(user: { firstName?: string | null } | null | undefined, application: LoanApplication | null): { title: string; subtitle: string } {
  const name = user?.firstName || "";
  const greeting = name ? `Hi, ${name}` : "Welcome back";

  if (!application) {
    return { title: greeting, subtitle: "Here's where you stand on your mortgage journey." };
  }

  switch (application.status) {
    case "draft":
      return { title: greeting, subtitle: "You have an unfinished application. Pick up where you left off." };
    case "submitted":
    case "analyzing":
      return { title: greeting, subtitle: "Your application is being reviewed. We'll have an answer shortly." };
    case "pre_approved":
      return { title: greeting, subtitle: "You're pre-approved. Time to find your home." };
    case "doc_collection":
    case "processing":
      return { title: greeting, subtitle: "We're processing your documents. Upload anything still needed." };
    case "underwriting":
      return { title: greeting, subtitle: "Your file is with underwriting. We'll keep you posted." };
    case "conditional":
      return { title: greeting, subtitle: "Almost there. A few conditions left to clear." };
    case "clear_to_close":
    case "closing":
      return { title: greeting, subtitle: "You're clear to close. The finish line is in sight." };
    case "denied":
      return { title: greeting, subtitle: "Let's look at your options and find a path forward." };
    case "funded":
      return { title: greeting, subtitle: "Congratulations on closing! Your Homeowner Hub is tracking your equity." };
    case "suspended":
      return { title: greeting, subtitle: "Your application is on hold. Your loan team will be in touch." };
    case "expired":
      return { title: greeting, subtitle: "Your pre-approval expired. Renew it to keep shopping with confidence." };
    default:
      return { title: greeting, subtitle: "Here's where things stand with your mortgage." };
  }
}


interface BorrowerGraphData {
  bestAnnualIncome: number | null;
  bestIncomeSource: string | null;
  totalVerifiedAssets: number | null;
  totalMonthlyDebts: number | null;
  documentsUploaded: number;
  documentsVerified: number;
  documentsMissing: string[];
  readiness: {
    completionPercentage: number;
    tier: string;
    completedInputs: string[];
    outstandingInputs: string[];
  };
  eligibility: {
    estimatedDTI: number | null;
    estimatedLTV: number | null;
    creditTier: string;
    creditScore: number | null;
    employmentStable: boolean | null;
    hasAdequateSavings: boolean | null;
    estimatedMaxPurchase: number | null;
    eligibleLoanTypes: string[];
  };
  predictiveSignals: {
    engagementLevel: string;
    suggestedNextAction: string;
  };
}

function FinancialSnapshot({ graph }: { graph: BorrowerGraphData }) {
  const [expanded, setExpanded] = useState(false);
  const { eligibility } = graph;

  const hasData = eligibility.creditScore || graph.bestAnnualIncome || eligibility.estimatedDTI;
  if (!hasData) return null;

  const creditColor = {
    "760_plus": "text-success-subtle-foreground",
    "720_759": "text-success-subtle-foreground",
    "680_719": "text-info",
    "640_679": "text-warning-subtle-foreground",
    "below_640": "text-destructive",
    "unknown": "text-muted-foreground",
  }[eligibility.creditTier] || "text-muted-foreground";

  const dtiColor = eligibility.estimatedDTI
    ? eligibility.estimatedDTI <= 36
      ? "text-success-subtle-foreground"
      : eligibility.estimatedDTI <= 43
      ? "text-warning-subtle-foreground"
      : "text-destructive"
    : "text-muted-foreground";

  const signals: Array<{ icon: React.ElementType; label: string; value: string; color: string; testId: string; termKey?: string }> = [];

  if (eligibility.creditScore) {
    signals.push({
      icon: Shield,
      label: "Credit Score",
      value: `${eligibility.creditScore} (${eligibility.creditTier === "unknown" ? "Not provided" : eligibility.creditTier.replace(/_/g, "-")})`,
      color: creditColor,
      testId: "signal-credit",
    });
  }

  if (eligibility.estimatedDTI !== null) {
    signals.push({
      icon: Percent,
      label: "Debt-to-Income",
      value: `${eligibility.estimatedDTI}%`,
      color: dtiColor,
      testId: "signal-dti",
      termKey: "dti",
    });
  }

  if (graph.bestAnnualIncome) {
    signals.push({
      icon: Briefcase,
      label: "Annual Income",
      value: `$${Math.round(graph.bestAnnualIncome).toLocaleString()}`,
      color: "",
      testId: "signal-income",
    });
  }

  if (eligibility.estimatedMaxPurchase) {
    signals.push({
      icon: Target,
      label: "Est. Max Purchase",
      value: `$${eligibility.estimatedMaxPurchase.toLocaleString()}`,
      color: "",
      testId: "signal-max-purchase",
    });
  }

  if (graph.totalVerifiedAssets) {
    signals.push({
      icon: PiggyBank,
      label: "Verified Assets",
      value: `$${graph.totalVerifiedAssets.toLocaleString()}`,
      color: "",
      testId: "signal-assets",
    });
  }

  if (eligibility.eligibleLoanTypes.length > 0) {
    signals.push({
      icon: CheckCircle2,
      label: "Eligible Programs",
      value: eligibility.eligibleLoanTypes.map(t => t.toUpperCase()).join(", "),
      color: "text-success-subtle-foreground",
      testId: "signal-programs",
    });
  }

  if (signals.length === 0) return null;

  const previewSignals = signals.slice(0, 3);
  const extraSignals = signals.slice(3);

  return (
    <div className="space-y-2" data-testid="section-financial-snapshot">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left group"
        data-testid="button-toggle-snapshot"
      >
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Your Financial Profile
        </h3>
        {extraSignals.length > 0 && (
          expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )
        )}
      </button>
      <Card data-testid="card-financial-snapshot">
        <CardContent className="p-4">
          <div className="space-y-3">
            {previewSignals.map((signal) => (
              <div key={signal.testId} className="flex items-center justify-between gap-3 flex-wrap" data-testid={signal.testId}>
                <div className="flex items-center gap-2.5">
                  <signal.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {signal.termKey ? (
                    <TermTooltip term={signal.termKey} className="text-xs text-muted-foreground">
                      {signal.label}
                    </TermTooltip>
                  ) : (
                    <span className="text-xs text-muted-foreground">{signal.label}</span>
                  )}
                </div>
                <span className={`text-xs font-medium ${signal.color}`}>{signal.value}</span>
              </div>
            ))}
            {expanded && extraSignals.map((signal) => (
              <div key={signal.testId} className="flex items-center justify-between gap-3 flex-wrap animate-in fade-in slide-in-from-top-1 duration-200" data-testid={signal.testId}>
                <div className="flex items-center gap-2.5">
                  <signal.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {signal.termKey ? (
                    <TermTooltip term={signal.termKey} className="text-xs text-muted-foreground">
                      {signal.label}
                    </TermTooltip>
                  ) : (
                    <span className="text-xs text-muted-foreground">{signal.label}</span>
                  )}
                </div>
                <span className={`text-xs font-medium ${signal.color}`}>{signal.value}</span>
              </div>
            ))}
          </div>
          {graph.readiness.outstandingInputs.length > 0 && expanded && (
            <div className="mt-3 pt-3 border-t space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Areas to Strengthen</p>
              {graph.readiness.outstandingInputs.slice(0, 3).map((gap, i) => (
                <div key={i} className="flex items-center gap-2" data-testid={`text-gap-${i}`}>
                  <AlertCircle className="h-3 w-3 text-warning-subtle-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">{gap}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CollapsibleActivity({ activities }: { activities: DealActivity[] }) {
  const [expanded, setExpanded] = useState(false);

  if (activities.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="section-activity">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left group"
        data-testid="button-toggle-activity"
      >
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Recent Activity
        </h3>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        {!expanded && (
          <Badge variant="secondary" className="text-[10px]" data-testid="badge-activity-count">
            {Math.min(activities.length, 5)}
          </Badge>
        )}
      </button>

      {expanded && (
        <Card className="animate-in fade-in slide-in-from-top-1 duration-200" data-testid="card-recent-activity">
          <CardContent className="p-4">
            <div className="space-y-2.5">
              {activities.slice(0, 5).map((activity, index) => (
                <div key={activity.id} className="flex items-start gap-2.5" data-testid={`row-activity-${index}`}>
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border mt-0.5">
                    {!activity.performedBy ? (
                      <Bot className="h-2.5 w-2.5 text-muted-foreground" />
                    ) : (
                      <User className="h-2.5 w-2.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground" data-testid={`text-activity-desc-${index}`}>
                      {activity.description || activity.title}
                    </p>
                    <span className="text-[11px] text-muted-foreground" data-testid={`text-activity-time-${index}`}>
                      {formatActivityTime(activity.createdAt!)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LoanDetails({
  application,
  hasOffers,
  offerCount,
  rateRange,
  hmdaCompleted,
  expirationInfo,
  isPreApproved,
}: {
  application: LoanApplication;
  hasOffers: boolean;
  offerCount: number;
  rateRange: string | null;
  hmdaCompleted: boolean;
  expirationInfo: { label: string; daysLeft: number; urgency: "expired" | "urgent" | "normal" } | null;
  isPreApproved: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const items: Array<{ icon: React.ElementType; label: string; value: string; href?: string; color?: string; testId: string }> = [];

  if (hasOffers) {
    items.push({
      icon: TrendingUp,
      label: "Loan Offers",
      value: `${offerCount} available${rateRange ? ` (${rateRange})` : ""}`,
      href: `/pipeline/${application.id}/offers`,
      color: "text-success-subtle-foreground",
      testId: "detail-offers",
    });
  }

  if (expirationInfo && expirationInfo.urgency !== "expired") {
    items.push({
      icon: Calendar,
      label: "Pre-Approval Valid Until",
      value: expirationInfo.label,
      color: expirationInfo.urgency === "urgent" ? "text-warning-subtle-foreground" : undefined,
      testId: "detail-expiration",
    });
  }

  if (isPreApproved) {
    const purchasePrice = formatCurrency(application.preApprovalAmount || application.purchasePrice || "0");
    const downPayment = formatCurrency(application.downPayment || "0");
    const loanType = application.preferredLoanType || "Conventional";
    items.push(
      { icon: Home, label: "Purchase Price", value: purchasePrice, testId: "detail-purchase-price" },
      { icon: DollarSign, label: "Down Payment", value: downPayment, testId: "detail-down-payment" },
      { icon: Percent, label: "Loan Type", value: loanType, testId: "detail-loan-type" },
    );
  }

  if (!hmdaCompleted) {
    items.push({
      icon: Users,
      label: "Government Monitoring",
      value: "Not yet completed",
      href: `/hmda/${application.id}`,
      testId: "detail-hmda",
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="section-loan-details">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left group"
        data-testid="button-toggle-details"
      >
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Loan Details
        </h3>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        {!expanded && (
          <Badge variant="secondary" className="text-[10px]" data-testid="badge-detail-count">
            {items.length}
          </Badge>
        )}
      </button>

      {expanded && (
        <Card className="animate-in fade-in slide-in-from-top-1 duration-200" data-testid="card-loan-details">
          <CardContent className="p-4">
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.testId} className="flex items-center justify-between gap-3 flex-wrap" data-testid={item.testId}>
                  <div className="flex items-center gap-2.5">
                    <item.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium ${item.color || ""}`}>{item.value}</span>
                    {item.href && (
                      <Link href={item.href} data-testid={`link-${item.testId}`}>
                        <Button variant="ghost" size="sm" data-testid={`button-${item.testId}`}>
                          View
                          <ArrowRight className="h-3 w-3 ml-0.5" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  usePageView("/dashboard");
  const [, navigate] = useLocation();
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  const isStaff = isStaffRole(user?.role || "");

  useEffect(() => {
    if (!authLoading && isStaff) {
      navigate("/staff-dashboard");
    }
  }, [authLoading, isStaff, navigate]);

  // Catch-all for OAuth sign-in: the password login/signup handlers already route
  // a deferred pre-approval submit back to /apply, but an OAuth callback lands the
  // user here on /dashboard. If a completed funnel is waiting to submit, bounce to
  // /apply so the replay effect finishes it instead of stranding them on the
  // incubator with their answers unsent.
  useEffect(() => {
    if (!authLoading && !isStaff && hasPendingPreApprovalSubmit()) {
      navigate("/apply");
    }
  }, [authLoading, isStaff, navigate]);

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    enabled: !authLoading && !isStaff,
  });

  const { data: coachConversations } = useQuery<{ id: number }[]>({
    queryKey: ["/api/coach/conversations"],
    enabled: !authLoading && !isStaff,
  });

  // activitySummary and nextAction now ride on /api/dashboard — two fewer
  // request waterfalls on mount. (The old /api/homeownership-goal query fed a
  // goal-string switch that never matched — the endpoint returns an object —
  // so it's dropped, not moved.)
  const activitySummary = data?.activitySummary;

  const { data: borrowerGraph, isError: graphError } = useQuery<BorrowerGraphData>({
    queryKey: ["/api/borrower-graph"],
    enabled: !authLoading && !isStaff,
    retry: 1,
    staleTime: 60000,
  });

  const [browsedProperties, setBrowsedProperties] = useState(false);
  useEffect(() => {
    try {
      setBrowsedProperties(localStorage.getItem("homiquity_browsed_properties") === "true");
    } catch {}
  }, []);

  if (authLoading || isLoading || isStaff) {
    return (
      <div className="p-8 max-w-xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-3 w-40 mt-4" />
        <Skeleton className="h-40 w-full mt-6" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const applications = data?.applications || [];
  const activities = data?.activities || [];
  const unreadMessages = data?.unreadMessages || 0;
  const pendingTasksByApplication = data?.pendingTasksByApplication || {};

  const defaultApp = applications.find(
    (app) => !isTerminalLoanAppStatus(app.status)
  );

  // Post-close borrowers graduate to the Homeowner module (equity tracking,
  // refi alerts). This is the only in-app path to /homeowner-dashboard.
  // ("funded" is the canonical post-close status — the old check for "closed"
  // matched a value no backend path ever wrote, so this link never appeared.)
  const hasClosedLoan = applications.some((app) => app.status === "funded");

  const activeApplication = selectedAppId
    ? applications.find(app => app.id === selectedAppId) || defaultApp
    : defaultApp;

  const isPreApproved = activeApplication?.status === "pre_approved";
  const expirationInfo = activeApplication ? getExpirationInfo(activeApplication) : null;

  const offerCount = activeApplication ? (data?.loanOptionCounts?.[activeApplication.id] || 0) : 0;
  const hasOffers = offerCount > 0;
  const appOptions = (data?.recentOptions || []).filter(
    (opt) => activeApplication && opt.applicationId === activeApplication.id
  );
  const sortedRates = appOptions
    .map((o) => parseFloat(o.interestRate))
    .filter((r: number) => !isNaN(r))
    .sort((a: number, b: number) => a - b);
  const rateRange = hasOffers && sortedRates.length >= 2
    ? `${sortedRates[0].toFixed(2)}% - ${sortedRates[sortedRates.length - 1].toFixed(2)}%`
    : hasOffers && sortedRates.length === 1
    ? `${sortedRates[0].toFixed(2)}%`
    : null;
  const hmdaCompleted = activeApplication ? (data?.hmdaStatus?.[activeApplication.id] || false) : false;

  const verificationStatus = activeApplication
    ? data?.verificationStatus?.[activeApplication.id]
    : undefined;

  const hasCoachSession = (coachConversations?.length || 0) > 0;

  // Signals are scoped to the ACTIVE application — never summed across every
  // application the user has ever had.
  const activeTaskCounts = (activeApplication && pendingTasksByApplication[activeApplication.id]) || {
    total: 0,
    documents: 0,
  };

  const readiness = getReadinessPercent(
    activeApplication || null,
    data?.stats?.pendingDocuments || 0,
    activeTaskCounts.total,
    verificationStatus,
    hasCoachSession,
    browsedProperties,
  );

  const hasApplication = !!activeApplication;
  const isFirstVisit = !hasApplication && applications.length === 0;

  if (isFirstVisit) {
    return (
      <RenterHome
        userName={user?.firstName || undefined}
      />
    );
  }

  const { title: greetingTitle, subtitle: greetingSubtitle } = getPersonalizedGreeting(
    user,
    activeApplication || null,
  );

  // Server-computed next action — one source of truth for "what should the
  // borrower do next" (server/services/nextAction.ts). The generic fallback
  // only shows if the payload predates the field (stale cache mid-deploy).
  const dominant: NextActionData = data?.nextAction ?? {
    kind: "in_review",
    title: "Your application is being reviewed",
    description: "We're analyzing your information. You'll hear back shortly.",
    href: "/dashboard",
    buttonLabel: "View Status",
  };

  const DominantIcon = NEXT_ACTION_ICONS[dominant.kind] ?? Clock;

  // File-health signal: pre-underwriting flags drive the header chip — amber
  // "action needed" when flagged, green check once the automated review is clean.
  const activePreUw = getPreUwFlags(activeApplication);
  const fileHealth: "healthy" | "action" | null = activePreUw?.evaluatedAt
    ? (activePreUw.flags?.length ?? 0) > 0
      ? "action"
      : "healthy"
    : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-10 space-y-8">

        {/* Section 1: Greeting */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">
                  {greetingTitle}
                </h1>
                {fileHealth === "healthy" && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-success-subtle px-2 py-0.5 text-[11px] font-medium text-success-subtle-foreground"
                    title="Automated pre-underwriting review found no issues"
                    data-testid="chip-file-healthy"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    File healthy
                  </span>
                )}
                {fileHealth === "action" && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-warning-subtle px-2 py-0.5 text-[11px] font-medium text-warning-subtle-foreground"
                    title={activePreUw?.flags?.map((f) => f.reason).join(" ")}
                    data-testid="chip-file-action-needed"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Action needed
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed" data-testid="text-dashboard-subtitle">
                {greetingSubtitle}
              </p>
            </div>
            {applications.length > 1 && (
              <ApplicationSwitcher
                applications={applications}
                activeApplicationId={activeApplication?.id}
                onSelectApplication={(app) => setSelectedAppId(app.id)}
              />
            )}
          </div>
          {hasClosedLoan && (
            <Link href="/homeowner-dashboard">
              <div
                className="mt-3 flex items-center justify-between rounded-lg border border-card-border bg-card px-4 py-3 hover-elevate cursor-pointer"
                data-testid="link-homeowner-dashboard"
              >
                <div>
                  <p className="text-sm font-semibold">Your Homeowner Hub</p>
                  <p className="text-xs text-muted-foreground">
                    Track your equity, watch for refinance opportunities, and manage your home.
                  </p>
                </div>
                <span className="text-sm font-medium text-primary">Open →</span>
              </div>
            </Link>
          )}
        </div>

        {/* Section 2: Journey Progress (prominent, above action) */}
        {activeApplication && activeApplication.status !== "draft" && (
          <Card data-testid="card-journey">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Your Journey
                </h3>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{ width: `${readiness}%` }}
                      data-testid="progress-bar-fill"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground" data-testid="text-readiness">
                    {readiness}%
                  </span>
                </div>
              </div>
              <JourneyTracker status={activeApplication.status} showEstimates />
              <div className="mt-3 pt-3 border-t flex items-center gap-2 text-[11px] text-muted-foreground/70" data-testid="text-automation-status">
                <Zap className="h-3 w-3 text-primary" />
                <span>Platform is automatically tracking compliance deadlines, verifying documents, and updating your progress</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 3: One dominant action — the "next step" hero */}
        <Card className="shadow-md hover-elevate border-2 border-accent/40" data-testid="card-dominant-action">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold tracking-wide text-accent uppercase">Your next step</span>
                {dominant.timeEstimate && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" data-testid="text-dominant-time">
                    <Clock className="h-3 w-3" />
                    {dominant.timeEstimate}
                  </span>
                )}
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <DominantIcon className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold" data-testid="text-dominant-title">
                  {dominant.title}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto" data-testid="text-dominant-description">
                  {dominant.description}
                </p>
                {dominant.whyNeeded && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-[11px] text-muted-foreground/70 hover:text-muted-foreground underline decoration-dotted underline-offset-2 cursor-help" data-testid="button-why-needed">
                        Why is this needed?
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                      <p>{dominant.whyNeeded}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <Link href={dominant.href} data-testid="link-dominant-action">
                <Button size="lg" data-testid="button-dominant-action">
                  {dominant.buttonLabel}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Trust Layer (who's handling your file + timeline + security) */}
        {activeApplication && activeApplication.status !== "draft" && (
          <TrustLayer
            applicationId={activeApplication.id}
            status={activeApplication.status}
          />
        )}

        {/* Section 5: Borrower requests (pending tasks from staff) */}
        {activeApplication && (
          <BorrowerRequests
            applicationId={activeApplication.id}
            data-testid="card-what-we-need"
          />
        )}

        {/* Section 6: Pre-qual letter for submitted apps */}
        {activeApplication && ["submitted", "analyzing"].includes(activeApplication.status) && (
          <PreQualLetterCard applicationId={activeApplication.id} />
        )}

        {/* Section 7: Prediction Insights */}
        {activeApplication && activeApplication.status !== "draft" && (
          <PredictionInsights applicationId={activeApplication.id} />
        )}

        {/* Section 8: Financial Snapshot (collapsed by default) */}
        {borrowerGraph && !graphError && (
          <FinancialSnapshot graph={borrowerGraph} />
        )}

        {/* Section 8: Loan Details (collapsed by default) */}
        {activeApplication && (
          <LoanDetails
            application={activeApplication}
            hasOffers={hasOffers}
            offerCount={offerCount}
            rateRange={rateRange}
            hmdaCompleted={hmdaCompleted}
            expirationInfo={expirationInfo}
            isPreApproved={isPreApproved}
          />
        )}

        {/* Section 9: Recent Activity (collapsed by default) */}
        <CollapsibleActivity activities={activities} />

        {/* Section 10: Journey checklist link */}
        {activeApplication && (
          <div className="flex justify-center pt-2">
            <Link href="/onboarding" data-testid="link-view-journey">
              <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5">
                <Rocket className="h-3.5 w-3.5" />
                View full journey checklist
              </Button>
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}

function PreQualLetterCard({ applicationId }: { applicationId: string }) {
  const { toast } = useToast();

  const statusQuery = useQuery<{ hasLetter: boolean; letterNumber?: string; estimatedAmount?: string }>({
    queryKey: ["/api/loan-applications", applicationId, "prequal-status"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/loan-applications/${applicationId}/generate-prequal`);
      return res.json();
    },
    onSuccess: (data: { letterNumber: string }) => {
      toast({ title: "Letter Ready", description: `Your pre-qualification letter #${data.letterNumber} has been generated.` });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-applications", applicationId, "prequal-status"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not generate letter. Please try again.", variant: "destructive" });
    },
  });

  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/loan-applications/${applicationId}/prequal-pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pre-qualification-letter.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "Could not download letter.", variant: "destructive" });
    }
  };

  const hasLetter = statusQuery.data?.hasLetter;

  return (
    <Card className="hover-elevate" data-testid="card-prequal-letter">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-border">
              <FileText className="h-4 w-4 text-warning-subtle-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm" data-testid="text-prequal-title">
                Pre-Qualification Letter
              </p>
              <p className="text-xs text-muted-foreground">
                {hasLetter
                  ? "Your letter is ready to download"
                  : "Get a preliminary qualification letter"}
              </p>
            </div>
          </div>
          {hasLetter ? (
            <Button onClick={handleDownload} variant="outline" size="sm" className="gap-2" data-testid="button-download-prequal-dash">
              <Download className="h-4 w-4" />
              Download
            </Button>
          ) : (
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              variant="outline"
              size="sm"
              className="gap-2"
              data-testid="button-generate-prequal-dash"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {generateMutation.isPending ? "Generating..." : "Generate"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
