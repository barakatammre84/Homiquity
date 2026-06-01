import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import BorrowerPackageView from "@/components/BorrowerPackageView";
import { useToast } from "@/hooks/use-toast";
import { usePageView, useTrackActivity, useTrackCoachSession } from "@/hooks/useActivityTracker";
import {
  Send,
  Bot,
  User,
  Target,
  FileText,
  TrendingUp,
  Shield,
  Clock,
  CheckCircle2,
  Circle,
  Sparkles,
  ArrowRight,
  MessageSquare,
  ChevronRight,
  Plus,
  Loader2,
  Lightbulb,
  Zap,
  AlertCircle,
  ListChecks,
  CreditCard,
  DollarSign,
  Home,
} from "lucide-react";

interface StructuredData {
  borrowerPackage?: Record<string, unknown>;
}

interface CoachMessage {
  id: string;
  role: string;
  content: string;
  structuredData?: StructuredData;
  createdAt: string;
}

interface CoachConversation {
  id: string;
  title: string;
  readinessTier: string | null;
  completionPercentage: number | null;
  financialProfile: CoachProfile | null;
  actionPlan: ActionPlanItem[] | null;
  documentChecklist: DocumentRequirement[] | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface CoachProfile {
  readinessTier: string;
  completionPercentage: number;
  statusNote: string;
  completedInputs: string[];
  outstandingInputs: string[];
  estimatedTimeline: string;
}

interface ActionPlanItem {
  id: string;
  phase: number;
  title: string;
  description: string;
  priority: string;
  category: string;
  completed: boolean;
}

interface DocumentRequirement {
  docType: string;
  label: string;
  reason: string;
  priority: string;
  category: string;
}

interface CoachInsight {
  type: string;
  title: string;
  description: string;
  action?: string;
}

interface CoachUsage {
  todayCount: number;
  dailyLimit: number;
  remaining: number;
  isLimited: boolean;
}

const TIER_CONFIG: Record<string, { label: string; color: string; icon: typeof Target }> = {
  ready_now: { label: "Ready Now", color: "bg-emerald-500", icon: CheckCircle2 },
  almost_ready: { label: "Almost Ready", color: "bg-blue-500", icon: TrendingUp },
  building: { label: "Building", color: "bg-amber-500", icon: Target },
  exploring: { label: "Exploring", color: "bg-slate-500", icon: Clock },
};

const CATEGORY_ICONS: Record<string, typeof Target> = {
  credit: Shield,
  savings: TrendingUp,
  income: Target,
  debt: FileText,
  documents: FileText,
  education: Sparkles,
};

const FOLLOW_UP_SUGGESTIONS: Record<string, string[]> = {
  default: [
    "What loan types am I eligible for?",
    "How much can I afford?",
    "What's my next step?",
  ],
  credit: [
    "How do I dispute errors on my credit report?",
    "What's the fastest way to boost my score?",
    "Should I pay off collections?",
  ],
  documents: [
    "Where can I get my tax transcripts?",
    "Do I need all pages of my bank statements?",
    "What if I'm missing a W-2?",
  ],
  income: [
    "Does overtime count toward my income?",
    "How is self-employment income calculated?",
    "Can I use a co-borrower's income?",
  ],
  readiness: [
    "Create an action plan for me",
    "What should I work on first?",
    "When will I be ready to apply?",
  ],
};

function getFollowUpSuggestions(lastMessage: string): string[] {
  const lower = lastMessage.toLowerCase();
  if (lower.includes("credit") || lower.includes("score") || lower.includes("fico")) {
    return FOLLOW_UP_SUGGESTIONS.credit;
  }
  if (lower.includes("document") || lower.includes("paperwork") || lower.includes("w-2") || lower.includes("tax")) {
    return FOLLOW_UP_SUGGESTIONS.documents;
  }
  if (lower.includes("income") || lower.includes("salary") || lower.includes("employment")) {
    return FOLLOW_UP_SUGGESTIONS.income;
  }
  if (lower.includes("readiness") || lower.includes("ready") || lower.includes("assess") || lower.includes("plan")) {
    return FOLLOW_UP_SUGGESTIONS.readiness;
  }
  return FOLLOW_UP_SUGGESTIONS.default;
}

function ReadinessPanel({ profile }: { profile: CoachProfile }) {
  const tier = TIER_CONFIG[profile.readinessTier] || TIER_CONFIG.exploring;
  const TierIcon = tier.icon;

  return (
    <Card data-testid="card-readiness-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <Sparkles className="h-4 w-4 text-primary" />
          Your Readiness Assessment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`p-2 rounded-lg ${tier.color}/10`}>
            <TierIcon className={`h-5 w-5 ${tier.color.replace("bg-", "text-")}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground" data-testid="text-readiness-tier">{tier.label}</span>
              <Badge variant="secondary" className="text-xs" data-testid="badge-readiness-score">
                {profile.completionPercentage}% Complete
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{profile.estimatedTimeline}</p>
          </div>
        </div>
        <Progress value={profile.completionPercentage} className="h-2" data-testid="progress-readiness" />
        <p className="text-sm text-muted-foreground" data-testid="text-readiness-summary">{profile.statusNote}</p>

        {profile.completedInputs.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">COMPLETED INPUTS</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.completedInputs.map((s, i) => (
                <Badge key={i} variant="secondary" className="text-xs font-normal">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {profile.outstandingInputs.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">OUTSTANDING INPUTS</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.outstandingInputs.map((g, i) => (
                <Badge key={i} variant="outline" className="text-xs font-normal">
                  {g}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {(profile.readinessTier === "ready_now" || profile.readinessTier === "almost_ready") && (
          <div className="pt-2 border-t space-y-2">
            <Link href={`/apply?source=coach&readiness=${profile.readinessTier}`} data-testid="link-ready-to-apply">
              <Button className="w-full gap-2" data-testid="button-ready-to-apply">
                <FileText className="h-4 w-4" />
                {profile.readinessTier === "ready_now"
                  ? "Start Your Pre-Approval"
                  : "Get a Head Start on Your Application"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground text-center">
              Your coach data will be used to pre-fill the application
            </p>
          </div>
        )}
        {profile.readinessTier !== "ready_now" && profile.readinessTier !== "almost_ready" && (
          <div className="pt-2 border-t">
            <Link href="/apply?source=coach" data-testid="link-explore-apply">
              <Button variant="outline" className="w-full gap-2" data-testid="button-explore-apply">
                <FileText className="h-4 w-4" />
                Explore Pre-Approval Anyway
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground text-center mt-2">
              See where you stand with a no-impact pre-approval check
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActionPlanPanel({
  plan,
  conversationId,
  onToggle,
}: {
  plan: ActionPlanItem[];
  conversationId: string | null;
  onToggle?: (itemId: string) => void;
}) {
  const completedCount = plan.filter(a => a.completed).length;

  return (
    <Card data-testid="card-action-plan">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Your Action Plan
          </span>
          <Badge variant="secondary" className="text-xs">
            {completedCount}/{plan.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {plan.map((item) => {
            const CatIcon = CATEGORY_ICONS[item.category] || Target;
            return (
              <button
                key={item.id}
                onClick={() => onToggle?.(item.id)}
                className={`w-full text-left flex items-start gap-3 p-2.5 rounded-lg border transition-colors ${
                  item.completed ? "bg-muted/50 border-muted" : "border-border hover-elevate"
                }`}
                data-testid={`action-item-${item.id}`}
              >
                {item.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {item.title}
                    </span>
                    <Badge
                      variant={item.priority === "high" ? "destructive" : item.priority === "medium" ? "default" : "secondary"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {item.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                </div>
                <CatIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              </button>
            );
          })}
        </div>
        {completedCount > 0 && completedCount < plan.length && (
          <div className="mt-3">
            <Progress value={(completedCount / plan.length) * 100} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground mt-1 text-center">
              {completedCount} of {plan.length} completed
            </p>
          </div>
        )}
        {completedCount === plan.length && plan.length > 0 && (
          <div className="mt-3 p-2 rounded-lg bg-emerald-500/10 text-center">
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              All action items completed!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentChecklistPanel({ docs }: { docs: DocumentRequirement[] }) {
  const grouped = docs.reduce((acc, d) => {
    const cat = d.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(d);
    return acc;
  }, {} as Record<string, DocumentRequirement[]>);

  return (
    <Card data-testid="card-document-checklist">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <FileText className="h-4 w-4 text-primary" />
          Your Document Checklist
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{category}</p>
              <div className="space-y-1.5">
                {items.map((doc, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg hover-elevate" data-testid={`doc-item-${doc.docType}`}>
                    <Circle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-foreground">{doc.label}</span>
                        <Badge
                          variant={doc.priority === "required" ? "destructive" : doc.priority === "recommended" ? "default" : "secondary"}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {doc.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{doc.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ChatMessage({ message }: { message: CoachMessage }) {
  const isUser = message.role === "user";
  const borrowerPackage = message.structuredData?.borrowerPackage;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`} data-testid={`chat-message-${message.id}`}>
      <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
        isUser ? "bg-primary text-primary-foreground" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      }`}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={`flex-1 max-w-[85%] ${isUser ? "text-right" : ""}`}>
        <div className={`inline-block text-left rounded-xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}>
          <MessageContent content={message.content} />
        </div>
        {borrowerPackage && (
          <div className="mt-3 text-left" data-testid="inline-borrower-package">
            <BorrowerPackageView data={borrowerPackage} />
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-1 px-1">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

function renderInlineMarkdown(text: string): (string | JSX.Element)[] {
  const result: (string | JSX.Element)[] = [];
  const parts = text.split(/(\*\*.*?\*\*)/g);
  parts.forEach((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      result.push(<strong key={`b-${i}`}>{part.slice(2, -2)}</strong>);
    } else {
      result.push(part);
    }
  });
  return result;
}

function MessageContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      elements.push(<div key={`sp-${i}`} className="h-2" />);
      i++;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      elements.push(
        <p key={`h3-${i}`} className="font-semibold text-sm mt-2 mb-1">
          {renderInlineMarkdown(trimmed.slice(4))}
        </p>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      elements.push(
        <p key={`h2-${i}`} className="font-semibold mt-2 mb-1">
          {renderInlineMarkdown(trimmed.slice(3))}
        </p>
      );
      i++;
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      const items: { text: string; idx: number }[] = [];
      while (i < lines.length) {
        const bm = lines[i].trim().match(/^[-*]\s+(.+)/);
        if (!bm) break;
        items.push({ text: bm[1], idx: i });
        i++;
      }
      elements.push(
        <ul key={`ul-${items[0].idx}`} className="space-y-1 my-1">
          {items.map((item) => (
            <li key={`li-${item.idx}`} className="flex gap-2 items-start">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-current shrink-0 opacity-40" />
              <span>{renderInlineMarkdown(item.text)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    const numberedMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
    if (numberedMatch) {
      const items: { num: string; text: string; idx: number }[] = [];
      while (i < lines.length) {
        const nm = lines[i].trim().match(/^(\d+)[.)]\s+(.+)/);
        if (!nm) break;
        items.push({ num: nm[1], text: nm[2], idx: i });
        i++;
      }
      elements.push(
        <ol key={`ol-${items[0].idx}`} className="space-y-1 my-1">
          {items.map((item) => (
            <li key={`oli-${item.idx}`} className="flex gap-2 items-start">
              <span className="font-medium text-muted-foreground shrink-0 min-w-[1.25rem]">{item.num}.</span>
              <span>{renderInlineMarkdown(item.text)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    elements.push(
      <p key={`p-${i}`}>{renderInlineMarkdown(trimmed)}</p>
    );
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function SuggestedPrompts({
  suggestions,
  onSelect,
  disabled,
}: {
  suggestions: string[];
  onSelect: (msg: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 px-1 pb-2" data-testid="suggested-prompts">
      {suggestions.map((s, i) => (
        <Button
          key={i}
          variant="outline"
          size="sm"
          className="text-xs gap-1.5 h-auto py-1.5"
          onClick={() => onSelect(s)}
          disabled={disabled}
          data-testid={`button-suggestion-${i}`}
        >
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          {s}
        </Button>
      ))}
    </div>
  );
}

function InsightsBanner({
  insights,
  onAction,
}: {
  insights: CoachInsight[];
  onAction: (msg: string) => void;
}) {
  if (insights.length === 0) return null;

  return (
    <div className="space-y-2 px-4 pt-4" data-testid="insights-banner">
      {insights.slice(0, 2).map((insight, i) => (
        <div
          key={i}
          className="flex items-start gap-3 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5"
          data-testid={`insight-${insight.type}`}
        >
          <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{insight.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
          </div>
          {insight.action && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-xs"
              onClick={() => onAction(insight.action!)}
              data-testid={`button-insight-action-${insight.type}`}
            >
              <Zap className="h-3 w-3 mr-1" />
              Ask
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function UsageMeter({ usage }: { usage: CoachUsage }) {
  if (!usage.isLimited && usage.remaining > 10) return null;

  return (
    <div className="flex items-center gap-2 px-1 pb-1" data-testid="usage-meter">
      {usage.isLimited ? (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          <span>Daily limit reached. Resets tomorrow.</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{usage.remaining} messages remaining today</span>
        </div>
      )}
    </div>
  );
}

function WelcomeState({ onStart, insights }: { onStart: (msg: string) => void; insights: CoachInsight[] }) {
  const STARTER_CATEGORIES = [
    {
      heading: "Getting Started",
      items: [
        { label: "I want to buy my first home — where do I begin?", icon: Home, testId: "first-home" },
        { label: "Am I financially ready for a mortgage?", icon: TrendingUp, testId: "readiness-check" },
      ],
    },
    {
      heading: "Financial Planning",
      items: [
        { label: "How much home can I afford?", icon: DollarSign, testId: "affordability" },
        { label: "How can I improve my credit score before applying?", icon: CreditCard, testId: "credit-improve" },
      ],
    },
    {
      heading: "Preparation",
      items: [
        { label: "What documents will I need for my application?", icon: FileText, testId: "documents-needed" },
        { label: "Create a personalized action plan for me", icon: ListChecks, testId: "action-plan" },
      ],
    },
  ];

  const VALUE_PROPS = [
    { icon: Target, text: "Personalized readiness assessment" },
    { icon: ListChecks, text: "Step-by-step action plan" },
    { icon: FileText, text: "Custom document checklist" },
    { icon: Shield, text: "Based on real lending guidelines" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-8 py-4">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
            <Bot className="h-8 w-8 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl" data-testid="text-coach-welcome">
              Your AI Homebuyer Coach
            </h2>
            <p className="text-muted-foreground mt-3 leading-relaxed max-w-lg mx-auto">
              Think of me as your personal mortgage advisor. I'll learn about your situation,
              assess your readiness, and build a clear plan to get you into your home.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {VALUE_PROPS.map((vp) => (
            <div
              key={vp.text}
              className="flex flex-col items-center gap-2 rounded-xl border bg-card p-3 text-center"
              data-testid={`value-prop-${vp.text.substring(0, 12).replace(/\s/g, '-').toLowerCase()}`}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <vp.icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground leading-tight">{vp.text}</span>
            </div>
          ))}
        </div>

        {insights.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Personalized for you</p>
            {insights.slice(0, 2).map((insight, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5"
                data-testid={`welcome-insight-${insight.type}`}
              >
                <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{insight.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
                </div>
                {insight.action && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-xs"
                    onClick={() => onStart(insight.action!)}
                    data-testid={`button-welcome-insight-${insight.type}`}
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    Ask
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
            {insights.length > 0 ? "Or start a conversation" : "Start a conversation"}
          </p>
          {STARTER_CATEGORIES.map((cat) => (
            <div key={cat.heading} className="space-y-2">
              <p className="text-sm font-medium text-foreground px-1">{cat.heading}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {cat.items.map((s) => (
                  <Button
                    key={s.testId}
                    variant="outline"
                    className="justify-start gap-2.5 text-left h-auto py-3 px-4"
                    onClick={() => onStart(s.label)}
                    data-testid={`button-starter-${s.testId}`}
                  >
                    <s.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm leading-snug">{s.label}</span>
                    <ArrowRight className="h-3 w-3 ml-auto shrink-0 text-muted-foreground" />
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border bg-muted/30 p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            <span>Your conversations are private. No hard credit check. Free to use.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
}: {
  conversations: CoachConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2 mb-2"
        onClick={onNew}
        data-testid="button-new-conversation"
      >
        <Plus className="h-3.5 w-3.5" />
        New Conversation
      </Button>
      {conversations.map((c) => {
        const tier = c.readinessTier ? TIER_CONFIG[c.readinessTier] : null;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left p-2.5 rounded-lg text-sm transition-colors ${
              activeId === c.id
                ? "bg-primary/10 text-primary border border-primary/20"
                : "hover-elevate text-foreground"
            }`}
            data-testid={`button-conversation-${c.id}`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{c.title || "New Chat"}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 ml-5.5">
              {tier && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {tier.label}
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground">
                {new Date(c.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function getSourceContext(): { banner: string; autoMessage: string } | null {
  const params = new URLSearchParams(window.location.search);
  const source = params.get("source");
  const context = params.get("context");
  const type = params.get("type");

  if (source === "va" || type === "va" || context === "va") {
    return {
      banner: "VA Loan Guidance",
      autoMessage: "I'm a veteran and I'd like to explore VA loan options. Can you help me understand my eligibility and benefits?",
    };
  }
  if (source === "first-time" || context === "first-time") {
    return {
      banner: "First-Time Buyer",
      autoMessage: "I'm a first-time homebuyer and I want to understand what I need to get started. Can you assess my readiness?",
    };
  }
  if (source === "refinance" || type === "refinance") {
    return {
      banner: "Refinance Guidance",
      autoMessage: "I'm interested in refinancing my current mortgage. Can you help me understand my options?",
    };
  }
  if (source === "investor" || context === "investor") {
    return {
      banner: "Investment Property",
      autoMessage: "I'm looking at investment properties. Can you help me understand mortgage requirements for rental properties?",
    };
  }
  const propertyPrice = params.get("propertyPrice");
  const propertyAddress = params.get("propertyAddress");
  if (propertyPrice && propertyAddress) {
    const formattedPrice = parseFloat(propertyPrice).toLocaleString();
    return {
      banner: `Property Analysis`,
      autoMessage: `I'm looking at a property at ${decodeURIComponent(propertyAddress)} listed at $${formattedPrice}. Can you help me understand if this home fits my budget and what my monthly payments would look like?`,
    };
  }
  if (propertyPrice) {
    const formattedPrice = parseFloat(propertyPrice).toLocaleString();
    return {
      banner: "Property Analysis",
      autoMessage: `I'm considering a home priced at $${formattedPrice}. Can you help me understand if I can afford it and what loan options might work?`,
    };
  }
  return null;
}

export default function AICoach() {
  usePageView("/coach");
  const trackActivity = useTrackActivity();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [sourceHandled, setSourceHandled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const { data: conversations = [], isLoading: loadingConvs } = useQuery<CoachConversation[]>({
    queryKey: ["/api/coach/conversations"],
  });

  const { data: activeData, isLoading: loadingMessages } = useQuery<{
    conversation: CoachConversation;
    messages: CoachMessage[];
  }>({
    queryKey: ["/api/coach/conversations", activeConversationId],
    enabled: !!activeConversationId,
  });

  const { data: usage } = useQuery<CoachUsage>({
    queryKey: ["/api/coach/usage"],
  });

  const { data: insightsData } = useQuery<{ insights: CoachInsight[]; hasApplication: boolean; hasAssessment: boolean }>({
    queryKey: ["/api/coach/insights"],
  });

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/coach/message", {
        message,
        conversationId: activeConversationId || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.conversationId && !activeConversationId) {
        setActiveConversationId(data.conversationId);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/coach/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/conversations", data.conversationId || activeConversationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/usage"] });
    },
    onError: (error: Error) => {
      if (error.message.includes("429")) {
        toast({
          title: "Daily Limit Reached",
          description: "You've reached your daily message limit. It resets tomorrow.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to send message. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const toggleActionItem = useMutation({
    mutationFn: async (itemId: string) => {
      if (!activeConversationId) return;
      const res = await apiRequest("PATCH", `/api/coach/conversations/${activeConversationId}/action-plan/${itemId}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/conversations", activeConversationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/conversations"] });
      if (data?.toggled) {
        toast({
          title: data.toggled.completed ? "Nice work!" : "Unmarked",
          description: data.toggled.completed
            ? `"${data.toggled.title}" marked as complete.`
            : `"${data.toggled.title}" marked as incomplete.`,
        });
      }
    },
  });

  const [mobileConvOpen, setMobileConvOpen] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeData?.messages]);

  const trackCoachSession = useTrackCoachSession();
  const handleSend = (msg?: string) => {
    const text = (msg || inputValue).trim();
    if (!text || sendMessage.isPending || usage?.isLimited) return;
    if (!activeConversationId) {
      trackCoachSession("coach_session_start");
    }
    setInputValue("");
    sendMessage.mutate(text);
    trackActivity("coach_chat", "/coach");
  };

  const sourceContext = getSourceContext();
  useEffect(() => {
    if (sourceContext && !sourceHandled && !activeConversationId && conversations.length === 0 && !loadingConvs) {
      setSourceHandled(true);
      handleSend(sourceContext.autoMessage);
    }
  }, [sourceContext, sourceHandled, activeConversationId, conversations.length, loadingConvs]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const messages = activeData?.messages || [];
  const activeConv = activeData?.conversation;
  const profile = activeConv?.financialProfile as CoachProfile | null;
  const actionPlan = activeConv?.actionPlan as ActionPlanItem[] | null;
  const documentChecklist = activeConv?.documentChecklist as DocumentRequirement[] | null;
  const hasSidePanel = profile || actionPlan || documentChecklist;

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");
  const suggestions = lastAssistantMsg ? getFollowUpSuggestions(lastAssistantMsg.content) : [];
  const showSuggestions = messages.length > 0 && !sendMessage.isPending && suggestions.length > 0;

  const insights = insightsData?.insights || [];

  const sidePanelContent = (
    <div className="space-y-3" data-testid="coach-side-panel">
      {profile && <ReadinessPanel profile={profile} />}
      {actionPlan && actionPlan.length > 0 && (
        <ActionPlanPanel
          plan={actionPlan}
          conversationId={activeConversationId}
          onToggle={(itemId) => toggleActionItem.mutate(itemId)}
        />
      )}
      {documentChecklist && documentChecklist.length > 0 && <DocumentChecklistPanel docs={documentChecklist} />}
    </div>
  );

  const conversationListContent = (
    <>
      <div className="flex items-center gap-2 mb-4 px-1">
        <Bot className="h-5 w-5 text-emerald-500" />
        <h2 className="font-semibold text-foreground text-sm">AI Coach</h2>
      </div>
      {loadingConvs ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={(id) => { setActiveConversationId(id); setMobileConvOpen(false); }}
          onNew={() => { setActiveConversationId(null); setMobileConvOpen(false); }}
        />
      )}
    </>
  );

  const hasActiveChat = activeConversationId || messages.length > 0;

  return (
    <div className="flex h-[calc(100vh-4rem)]" data-testid="page-ai-coach">
      {showSidebar && (
        <div className="w-64 border-r p-3 overflow-y-auto hidden lg:block">
          {conversationListContent}
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {hasActiveChat && (
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Sheet open={mobileConvOpen} onOpenChange={setMobileConvOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" data-testid="button-mobile-conversations">
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-3">
                <SheetHeader className="pb-2">
                  <SheetTitle className="text-sm">Conversations</SheetTitle>
                </SheetHeader>
                {conversationListContent}
              </SheetContent>
            </Sheet>

            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium truncate" data-testid="text-active-conversation-title">
                {activeConv?.title || "New Conversation"}
              </p>
              {sourceContext && !activeConversationId && (
                <Badge variant="secondary" className="text-xs" data-testid="badge-source-context">
                  {sourceContext.banner}
                </Badge>
              )}
            </div>

            {hasSidePanel && (
              <Sheet open={mobilePanelOpen} onOpenChange={setMobilePanelOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="xl:hidden" data-testid="button-mobile-panel">
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 p-3 overflow-y-auto">
                  <SheetHeader className="pb-2">
                    <SheetTitle className="text-sm">Your Assessment</SheetTitle>
                  </SheetHeader>
                  {sidePanelContent}
                </SheetContent>
              </Sheet>
            )}
          </div>
        )}

        {!hasActiveChat ? (
          <WelcomeState
            onStart={(msg) => handleSend(msg)}
            insights={insights}
          />
        ) : (
          <>
            {insights.length > 0 && messages.length === 0 && (
              <InsightsBanner insights={insights} onAction={(msg) => handleSend(msg)} />
            )}
            <div className="flex-1 overflow-y-auto p-4" data-testid="chat-messages-container">
              <div className="mx-auto max-w-3xl space-y-4">
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                {sendMessage.isPending && (
                  <div className="flex gap-3">
                    <div className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="bg-muted rounded-xl px-4 py-3 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </>
        )}

        {hasActiveChat && (
          <div className="border-t p-3">
            <div className="max-w-3xl mx-auto space-y-2">
              {showSuggestions && (
                <SuggestedPrompts
                  suggestions={suggestions}
                  onSelect={(msg) => handleSend(msg)}
                  disabled={sendMessage.isPending || !!usage?.isLimited}
                />
              )}
              {usage && <UsageMeter usage={usage} />}
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={usage?.isLimited ? "Daily limit reached. Try again tomorrow." : "Ask about your mortgage readiness, documents, credit..."}
                  className="resize-none min-h-[44px] max-h-[120px] text-sm"
                  rows={1}
                  disabled={sendMessage.isPending || !!usage?.isLimited}
                  data-testid="input-coach-message"
                />
                <Button
                  size="icon"
                  onClick={() => handleSend()}
                  disabled={!inputValue.trim() || sendMessage.isPending || !!usage?.isLimited}
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {hasSidePanel && (
        <div className="w-80 border-l overflow-y-auto p-3 hidden xl:block">
          {sidePanelContent}
        </div>
      )}
    </div>
  );
}
