import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import {
  estimateBuyingPower,
  saveBuyingPowerScenario,
  type BuyingPowerScenario,
} from "@/lib/buyingPowerScenario";
import { ArrowRight, CheckCircle2, Loader2, Lock } from "lucide-react";

const GOALS: { value: BuyingPowerScenario["goal"]; label: string }[] = [
  { value: "first", label: "Buying my first home" },
  { value: "next", label: "Buying my next home" },
  { value: "refi", label: "Refinancing" },
  { value: "research", label: "Just researching" },
];

const DEBT_BANDS = [
  { value: 0, label: "None" },
  { value: 125, label: "Under $250" },
  { value: 500, label: "$250–$750" },
  { value: 1125, label: "$750–$1,500" },
  { value: 2000, label: "$1,500+" },
];

const DOWN_BANDS = [
  { value: 10000, label: "~$10k" },
  { value: 25000, label: "~$25k" },
  { value: 50000, label: "~$50k" },
  { value: 100000, label: "$100k+" },
  { value: 25000, label: "Not sure", key: "unsure" },
];

const PHASES = ["Goal", "Numbers", "Estimate"];

function Chip({
  selected,
  onClick,
  children,
  testId,
  compact,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "rounded-lg border text-left font-medium transition-colors",
        compact ? "px-2.5 py-2 text-xs" : "p-3 text-sm",
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-input bg-background text-foreground hover:border-primary/50",
      )}
    >
      {children}
    </button>
  );
}

export function BuyingPowerEstimator() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<BuyingPowerScenario["goal"] | null>(null);
  const [annualIncome, setAnnualIncome] = useState(100000);
  const [debtBand, setDebtBand] = useState<number | null>(null);
  const [downBand, setDownBand] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [estimate, setEstimate] = useState<{ low: number; high: number } | null>(null);

  const downValue =
    DOWN_BANDS.find((b) => (b.key ?? String(b.value)) === downBand)?.value ?? 0;

  function selectGoal(value: BuyingPowerScenario["goal"]) {
    setGoal(value);
    // One decision on this view — auto-advance, no Continue button.
    setTimeout(() => setStep(2), 250);
  }

  function handleEstimate() {
    if (debtBand === null || downBand === null) return;
    setCalculating(true);
    // Deliberate 600–900ms: instant results read as uncalculated.
    setTimeout(() => {
      setEstimate(estimateBuyingPower(annualIncome, debtBand, downValue));
      setCalculating(false);
      setStep(3);
    }, 750);
  }

  function seedAndGo(path: string) {
    saveBuyingPowerScenario({
      goal: goal ?? "research",
      annualIncome,
      monthlyDebts: debtBand ?? 0,
      downPayment: downValue,
    });
    navigate(path);
  }

  return (
    <Card className="w-full shadow-2xl" data-testid="card-buying-power-estimator">
      <CardContent className="p-6 sm:p-8">
        <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Estimator progress">
          {PHASES.map((phase, i) => (
            <li
              key={phase}
              className={cn(
                "border-t-2 pt-1.5 text-[10px] font-semibold uppercase tracking-wider",
                i < step ? "border-primary text-primary" : "border-border text-muted-foreground",
              )}
            >
              {phase}
            </li>
          ))}
        </ol>

        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-bold">What brings you here?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              One decision at a time — about a minute total.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="group" aria-label="Your goal">
              {GOALS.map((g) => (
                <Chip
                  key={g.value}
                  selected={goal === g.value}
                  onClick={() => selectGoal(g.value)}
                  testId={`chip-goal-${g.value}`}
                >
                  {g.label}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {step === 2 && goal === "refi" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-bold">Let's look at your refinance</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Buying-power math isn't the right tool for a refi — our refinance
              check compares your current loan against today's options instead.
            </p>
            <Link href="/refinance">
              <Button className="mt-5 w-full gap-2 font-semibold" data-testid="button-estimator-refi">
                Check refinance options
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="mt-3 w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground"
              data-testid="button-estimator-back-goal"
            >
              ← Different goal
            </button>
          </div>
        )}

        {step === 2 && goal !== "refi" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-bold">Your numbers, roughly</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ballpark is fine — you can refine everything later.
            </p>

            <div className="mt-5">
              <div className="flex items-baseline justify-between">
                <label htmlFor="estimator-income" className="text-sm font-medium">
                  Household income (yearly)
                </label>
                <span className="text-lg font-bold" data-testid="text-estimator-income">
                  {formatCurrency(annualIncome)}
                </span>
              </div>
              <Slider
                id="estimator-income"
                className="mt-2"
                min={30000}
                max={500000}
                step={5000}
                value={[annualIncome]}
                onValueChange={([v]) => setAnnualIncome(v)}
                aria-label="Household yearly income"
                data-testid="slider-estimator-income"
              />
            </div>

            <p className="mt-5 text-sm font-medium">Monthly debt payments (loans, cards, leases)</p>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5" role="group" aria-label="Monthly debts">
              {DEBT_BANDS.map((b) => (
                <Chip
                  key={b.value}
                  compact
                  selected={debtBand === b.value}
                  onClick={() => setDebtBand(b.value)}
                  testId={`chip-debts-${b.value}`}
                >
                  {b.label}
                </Chip>
              ))}
            </div>

            <p className="mt-5 text-sm font-medium">Cash available for a down payment</p>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5" role="group" aria-label="Down payment">
              {DOWN_BANDS.map((b) => {
                const key = b.key ?? String(b.value);
                return (
                  <Chip
                    key={key}
                    compact
                    selected={downBand === key}
                    onClick={() => setDownBand(key)}
                    testId={`chip-down-${key}`}
                  >
                    {b.label}
                  </Chip>
                );
              })}
            </div>

            <Button
              className="mt-6 w-full gap-2 font-semibold"
              size="lg"
              disabled={debtBand === null || downBand === null || calculating}
              onClick={handleEstimate}
              data-testid="button-estimator-continue"
            >
              {calculating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Calculating…
                </>
              ) : (
                <>
                  See my buying power
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300" aria-live="polite">
            {estimate ? (
              <>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Estimate ready
                </p>
                <h2 className="mt-2 text-xl font-bold">Your estimated buying power</h2>
                <p className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl" data-testid="text-estimator-result">
                  {formatCurrency(estimate.low)} – {formatCurrency(estimate.high)}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  An estimate from the ranges you picked, using conservative
                  assumptions — not an offer, rate quote, or approval.
                </p>
                <Button
                  className="mt-5 w-full gap-2 font-semibold"
                  size="lg"
                  onClick={() => seedAndGo("/afford")}
                  data-testid="button-estimator-afford"
                >
                  Try it on a real home
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="mt-2.5 w-full gap-2"
                  onClick={() => seedAndGo("/apply")}
                  data-testid="button-estimator-apply"
                >
                  Start my pre-approval
                </Button>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold">Let's build a plan first</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  With those numbers a purchase would be tight right now — that's
                  exactly what a plan is for. We'll show you what moves the needle.
                </p>
                <Link href="/first-time-buyer">
                  <Button className="mt-5 w-full gap-2 font-semibold" data-testid="button-estimator-plan">
                    See where I stand
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={() => setStep(2)}
              className="mt-3 w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground"
              data-testid="button-estimator-back"
            >
              ← Adjust my numbers
            </button>
          </div>
        )}

        <p className="mt-6 flex items-center gap-2 border-t pt-4 text-[11px] text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          No credit check, no contact info — this stays on your device until you
          decide to continue.
        </p>
      </CardContent>
    </Card>
  );
}
