import {
  ArrowRight,
  Bot,
  CreditCard,
  DollarSign,
  FileText,
  Home,
  Lightbulb,
  ListChecks,
  Shield,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CoachInsight } from "./types";

// Welcome + insights, moved from the old page-local components in AICoach.tsx
// (markup unchanged).

export function InsightsBanner({
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
          className="flex items-start gap-3 p-3 rounded-lg border border-border/20 bg-warning/5"
          data-testid={`insight-${insight.type}`}
        >
          <Lightbulb className="h-4 w-4 text-warning-subtle-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{insight.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
          </div>
          {insight.action && (
            <Button
              variant="outline"
              size="sm"
              className="touch-target shrink-0 text-xs"
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

export function WelcomeState({ onStart, insights }: { onStart: (msg: string) => void; insights: CoachInsight[] }) {
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
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-success/20 to-success/20 flex items-center justify-center">
            <Bot className="h-8 w-8 text-success-subtle-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl" data-testid="text-coach-welcome">
              Your AI Homebuyer Coach
            </h2>
            <p className="text-muted-foreground mt-3 leading-relaxed max-w-lg mx-auto">
              Tell me about your situation and I'll organize everything for you — your answers are
              saved to your pre-app profile as we talk, and you always see exactly what's captured.
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
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10">
                <vp.icon className="h-4 w-4 text-success-subtle-foreground" />
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
                className="flex items-start gap-3 p-3 rounded-lg border border-border/20 bg-warning/5"
                data-testid={`welcome-insight-${insight.type}`}
              >
                <Lightbulb className="h-4 w-4 text-warning-subtle-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{insight.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
                </div>
                {insight.action && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="touch-target shrink-0 text-xs"
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
