import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { homeownershipGoalKeys } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { HomeReadinessPassport } from "@/components/HomeReadinessPassport";
import { TaxReturnInsightCard } from "@/components/TaxReturnInsightCard";
import { PartnerSharingCard } from "@/components/PartnerSharingCard";
import { formatCurrency } from "@/lib/formatters";
import {
  ArrowRight,
  Bot,
  Calculator,
  ClipboardList,
  Home,
  PiggyBank,
  Scale,
  Search,
  Target,
} from "lucide-react";

/**
 * The Incubator: home surface for authenticated users with no loan
 * application yet (renters and prospective buyers). Composes the existing
 * homeownership-goal engine, the readiness passport, and the calculator
 * toolkit into one path-to-homeownership view, teeing users up for the
 * origination journey (/apply -> Dashboard).
 */

interface HomeownershipGoalRecord {
  currentSavingsBalance: string | null;
  currentMonthlySavings: string | null;
  currentRent: string | null;
  targetDownPayment: string | null;
  targetHomePrice: string | null;
  currentPhase: string | null;
  journeyDay: number | null;
}

interface GoalResponse {
  goal: HomeownershipGoalRecord | null;
}

const TOOLKIT = [
  {
    href: "/calculators/rent-vs-buy",
    icon: Scale,
    title: "Rent vs. Buy",
    description: "See how your rent compares to owning in your area.",
    testId: "renter-tool-rent-vs-buy",
  },
  {
    href: "/calculators/affordability",
    icon: Calculator,
    title: "Buying Power",
    description: "How much home your income and debts support.",
    testId: "renter-tool-affordability",
  },
  {
    href: "/calculators/rent-to-own",
    icon: Home,
    title: "Rent-to-Own Path",
    description: "Structured plans for getting to the down payment.",
    testId: "renter-tool-rent-to-own",
  },
  {
    // The rent ledger's front door for the renter persona. Shipped 2026-08-17 as an
    // orphan route — the audit found /my-lease had zero inbound links anywhere.
    href: "/my-lease",
    icon: ClipboardList,
    title: "My Lease & Rent Record",
    description: "Keep a record of your lease and rent payments.",
    testId: "renter-tool-my-lease",
  },
  {
    href: "/ai-coach",
    icon: Bot,
    title: "AI Coach",
    description: "Ask anything — credit, savings, timelines, programs.",
    testId: "renter-tool-coach",
  },
];

export function RenterHome({
  userName,
}: {
  userName?: string;
}) {
  // Pre-signup attribution (CPA /cpa and LO /ref codes) is applied centrally by
  // usePendingAttribution in PrivateLayout as soon as the user authenticates, so
  // it lands regardless of whether they first hit the incubator or went straight
  // to /apply — no per-surface consumption needed here anymore.
  const { data: goalData } = useQuery<GoalResponse>({
    queryKey: homeownershipGoalKeys.all(),
  });

  // Single source of truth for readiness: the server-side /100 score (the same
  // one the HomeReadinessPassport renders below). This replaces a former
  // client-side heuristic % that could disagree with the passport on-screen.
  const { data: graph } = useQuery<{ readiness: { score: number } }>({
    queryKey: ["/api/borrower-graph"],
    staleTime: 60000,
  });
  const readinessScore = graph?.readiness?.score ?? null;

  const goal = goalData?.goal ?? null;
  const target = goal?.targetDownPayment ? Number(goal.targetDownPayment) : null;
  const saved = goal?.currentSavingsBalance ? Number(goal.currentSavingsBalance) : 0;
  const monthly = goal?.currentMonthlySavings ? Number(goal.currentMonthlySavings) : 0;
  const remaining = target !== null ? Math.max(0, target - saved) : null;
  const progressRatio = target ? Math.min(saved / target, 1) : 0;
  const monthsToGoal =
    remaining !== null && remaining > 0 && monthly > 0 ? Math.ceil(remaining / monthly) : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-10 space-y-8">
        {/* Greeting + readiness score */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-renter-greeting">
              {userName ? `Hi, ${userName}` : "Welcome"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Let's get you home-ready — one step at a time.
            </p>
          </div>
          {readinessScore !== null && (
            <div className="text-right shrink-0" data-testid="text-renter-readiness">
              <span className="text-3xl font-bold text-primary">{readinessScore}</span>
              <span className="text-lg font-semibold text-muted-foreground">/100</span>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">home-ready</p>
            </div>
          )}
        </div>

        {/* Progress-sharing with a referring partner (PH-2). Self-hides when the
            renter has no partner referrer. */}
        <PartnerSharingCard />

        {/* Down-payment goal */}
        {goal && target ? (
          <Card data-testid="card-renter-goal">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Down payment goal</p>
                </div>
                <Link href="/gap-calculator" className="text-xs font-medium text-primary">
                  Adjust
                </Link>
              </div>
              <Progress value={progressRatio * 100} />
              <p className="text-sm">
                {remaining !== null && remaining > 0 ? (
                  <>
                    You're <span className="font-semibold">{formatCurrency(remaining)}</span> away
                    from your <span className="font-semibold">{formatCurrency(target)}</span> goal
                    {goal.targetHomePrice
                      ? ` on a ${formatCurrency(Number(goal.targetHomePrice))} home`
                      : ""}
                    .
                  </>
                ) : (
                  <>
                    Goal reached — you've saved{" "}
                    <span className="font-semibold">{formatCurrency(saved)}</span>. Time to get
                    pre-approved.
                  </>
                )}
              </p>
              {monthsToGoal !== null && (
                <p className="text-xs text-muted-foreground">
                  About {monthsToGoal} {monthsToGoal === 1 ? "month" : "months"} to go at{" "}
                  {formatCurrency(monthly)}/mo.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Link href="/gap-calculator">
            <Card className="hover-elevate cursor-pointer" data-testid="card-renter-set-goal">
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">Set your down payment goal</p>
                    <p className="text-xs text-muted-foreground">
                      Tell us your target and we'll map the fastest path to it.
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Readiness passport (credit / income / assets verification state) */}
        <HomeReadinessPassport compact />

        {/* Tax return upload → income readiness signals */}
        <TaxReturnInsightCard />

        {/* Toolkit */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Your toolkit
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {TOOLKIT.map((tool) => (
              <Link key={tool.href} href={tool.href}>
                <Card className="h-full hover-elevate cursor-pointer" data-testid={tool.testId}>
                  <CardContent className="p-4 space-y-1.5">
                    <tool.icon className="h-5 w-5 text-primary" />
                    <p className="text-sm font-semibold leading-tight">{tool.title}</p>
                    <p className="text-xs text-muted-foreground leading-snug">{tool.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* The on-ramp to the origination journey */}
        <Card className="bg-sidebar text-sidebar-foreground border-transparent" data-testid="card-renter-cta">
          <CardContent className="p-5 space-y-3">
            <p className="text-base font-semibold">Ready sooner than you think?</p>
            <p className="text-sm opacity-80">
              A pre-approval takes about 3 minutes, uses a soft credit check, and shows sellers
              you're serious.
            </p>
            <div className="flex gap-2">
              <Link href="/apply">
                <Button data-testid="button-renter-preapproval">
                  Start pre-approval
                </Button>
              </Link>
              <Link href="/properties">
                <Button
                  variant="ghost"
                  className="text-sidebar-foreground"
                  data-testid="button-renter-browse"
                >
                  <Search className="h-4 w-4" />
                  Browse homes
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
