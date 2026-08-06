import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SEOHead } from "@/components/SEOHead";
import { formatInputCurrency, parseCurrencyInput } from "@/lib/formatters";
import {
  assessApprovalStrength,
  type ApprovalStrengthInputs,
  type CreditBand,
  type Factor,
  type IncomeShape,
  type PriceBand,
} from "@/lib/approvalStrength";
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  DollarSign,
  Gauge,
  HelpCircle,
  Lock,
  MinusCircle,
  AlertTriangle,
  ShieldQuestion,
  Sparkles,
} from "lucide-react";

// Everything on this page is client-side arithmetic on the visitor's own
// inputs — no network calls, nothing collected or stored, and deliberately
// no rate, payment, or priced result. See client/src/lib/approvalStrength.ts
// for the educational scoring model and its compliance framing.

const INCOME_SHAPES: { value: IncomeShape; label: string; hint: string }[] = [
  { value: "w2_2plus", label: "W-2 employee", hint: "2+ years" },
  { value: "w2_under2", label: "W-2 employee", hint: "under 2 years" },
  { value: "self_employed_2plus", label: "Self-employed", hint: "2+ years" },
  { value: "self_employed_under2", label: "Self-employed", hint: "under 2 years" },
];

const CREDIT_BANDS: { value: CreditBand; label: string }[] = [
  { value: "760_plus", label: "760+" },
  { value: "720_759", label: "720–759" },
  { value: "680_719", label: "680–719" },
  { value: "640_679", label: "640–679" },
  { value: "620_639", label: "620–639" },
  { value: "below_620", label: "Below 620" },
];

const PRICE_BANDS: { value: PriceBand; label: string }[] = [
  { value: "under_200k", label: "Under $200k" },
  { value: "200_350k", label: "$200k–$350k" },
  { value: "350_500k", label: "$350k–$500k" },
  { value: "500_750k", label: "$500k–$750k" },
  { value: "750k_plus", label: "$750k+" },
  { value: "not_sure", label: "Not sure yet" },
];

function FactorStatusIcon({ status }: { status: Factor["status"] }) {
  if (status === "helping") return <CheckCircle2 className="h-5 w-5 text-success shrink-0" />;
  if (status === "hurting") return <AlertTriangle className="h-5 w-5 text-warning shrink-0" />;
  if (status === "unknown") return <HelpCircle className="h-5 w-5 text-muted-foreground shrink-0" />;
  return <MinusCircle className="h-5 w-5 text-muted-foreground shrink-0" />;
}

const STATUS_LABELS: Record<Factor["status"], string> = {
  helping: "Working for you",
  neutral: "Holding steady",
  hurting: "Working against you",
  unknown: "Needs more info",
};

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  columns,
  testIdPrefix,
}: {
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  columns: string;
  testIdPrefix: string;
}) {
  return (
    <div className={`grid gap-2 ${columns}`}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={`rounded-md border px-3 py-2 text-sm text-left transition-colors ${
              selected
                ? "border-primary bg-primary/10 text-foreground font-medium"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
            data-testid={`${testIdPrefix}-${option.value}`}
          >
            <span className="block">{option.label}</span>
            {option.hint && <span className="block text-xs text-muted-foreground">{option.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function ApprovalStrength() {
  const [, navigate] = useLocation();
  const [inputs, setInputs] = useState<ApprovalStrengthInputs>({
    incomeShape: "w2_2plus",
    annualIncome: 85000,
    monthlyDebts: 400,
    downPaymentSaved: 25000,
    creditBand: "680_719",
    priceBand: "200_350k",
  });

  const result = useMemo(() => assessApprovalStrength(inputs), [inputs]);

  return (
    <div className="min-h-screen bg-background">
      {/* Mirrors the "/approval-strength" entry in shared/seo/routeMeta.ts — keep
          the two in sync (that registry is what a crawler actually sees). */}
      <SEOHead
        title="Approval Strength Check - See Where You Stand | Homiquity"
        description="Answer a few questions and see which parts of your profile are working for you and which need attention. An educational readout of your file's strengths, not a credit decision. Nothing collected, nothing stored."
      />
      <div className="bg-primary/5 dark:bg-primary/10 border-b">
        <div className="max-w-4xl mx-auto px-4 py-12 md:py-16 text-center">
          <Link href="/">
            <span className="text-2xl font-bold tracking-tight text-primary cursor-pointer" data-testid="text-brand-logo">
              homiquity
            </span>
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mt-6 mb-3" data-testid="text-page-title">
            How Strong Is Your Approval Case?
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Every mortgage site tells you how fast or how cheap. This tool answers the question
            underneath: where do you actually stand? Rough numbers in, an honest read out —
            which factors are working for you, and which need attention first.
          </p>
          <p className="text-sm text-muted-foreground mt-4 flex items-center justify-center gap-1.5" data-testid="text-privacy-note">
            <Lock className="h-3.5 w-3.5" />
            Everything stays on this page — we don't collect or store any of it.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-6 items-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CircleDollarSign className="h-5 w-5 text-primary" />
                Your Rough Numbers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>How is your income earned?</Label>
                <SegmentedControl
                  options={INCOME_SHAPES}
                  value={inputs.incomeShape}
                  onChange={(v) => setInputs({ ...inputs, incomeShape: v })}
                  columns="grid-cols-2"
                  testIdPrefix="option-income-shape"
                />
              </div>

              <div className="space-y-2">
                <Label>Annual Household Income (gross)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    inputMode="numeric"
                    value={formatInputCurrency(inputs.annualIncome)}
                    onChange={(e) => setInputs({ ...inputs, annualIncome: parseCurrencyInput(e.target.value) })}
                    data-testid="input-annual-income"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Monthly Debt Payments (car, student loans, cards — not rent)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    inputMode="numeric"
                    value={formatInputCurrency(inputs.monthlyDebts)}
                    onChange={(e) => setInputs({ ...inputs, monthlyDebts: parseCurrencyInput(e.target.value) })}
                    data-testid="input-monthly-debts"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Down Payment Saved So Far</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    inputMode="numeric"
                    value={formatInputCurrency(inputs.downPaymentSaved)}
                    onChange={(e) => setInputs({ ...inputs, downPaymentSaved: parseCurrencyInput(e.target.value) })}
                    data-testid="input-down-payment"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Price Range You're Shopping</Label>
                <SegmentedControl
                  options={PRICE_BANDS}
                  value={inputs.priceBand}
                  onChange={(v) => setInputs({ ...inputs, priceBand: v })}
                  columns="grid-cols-3"
                  testIdPrefix="option-price-band"
                />
              </div>

              <div className="space-y-2">
                <Label>Credit Score Range (your best guess is fine)</Label>
                <SegmentedControl
                  options={CREDIT_BANDS}
                  value={inputs.creditBand}
                  onChange={(v) => setInputs({ ...inputs, creditBand: v })}
                  columns="grid-cols-3"
                  testIdPrefix="option-credit-band"
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-primary" />
                  Your Approval Strength Read
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold" data-testid="text-strength-band">
                  {result.bandLabel}
                </p>
                <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden" aria-hidden="true">
                  <div
                    className={`h-full rounded-full transition-all ${
                      result.band === "strong" || result.band === "solid" ? "bg-success" : result.band === "mixed" ? "bg-warning" : "bg-destructive"
                    }`}
                    style={{ width: `${result.score}%` }}
                    data-testid="bar-strength-score"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-4" data-testid="text-strength-summary">
                  {result.summary}
                </p>
                <Separator className="my-4" />
                <p className="text-xs text-muted-foreground" data-testid="text-educational-disclaimer">
                  Educational estimate only, based solely on the ranges you entered. This is not a
                  loan approval, prequalification, offer of credit, or commitment to lend, and no
                  credit report was reviewed. Actual program guidelines vary by lender and change
                  over time.
                </p>
              </CardContent>
            </Card>

            <div className="space-y-3" data-testid="list-factors">
              {result.factors.map((factor) => (
                <Card key={factor.id} data-testid={`card-factor-${factor.id}`}>
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-3">
                      <FactorStatusIcon status={factor.status} />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{factor.label}</p>
                          <span
                            className={`text-xs font-medium ${
                              factor.status === "helping"
                                ? "text-success-subtle-foreground"
                                : factor.status === "hurting"
                                  ? "text-warning-subtle-foreground"
                                  : "text-muted-foreground"
                            }`}
                            data-testid={`text-factor-status-${factor.id}`}
                          >
                            {STATUS_LABELS[factor.status]}
                          </span>
                        </div>
                        <p className="text-sm mt-1" data-testid={`text-factor-headline-${factor.id}`}>
                          {factor.headline}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1.5">{factor.detail}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button
              size="lg"
              className="w-full gap-2"
              onClick={() => navigate("/apply")}
              data-testid="button-start-application"
            >
              Turn This Read Into a Real Answer
              <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Start an application and we'll assess your actual file — documents, not guesses.
              No hard credit check to begin.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <ShieldQuestion className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">An Honest Read, Not a Sales Pitch</h3>
              <p className="text-sm text-muted-foreground">
                No rate teasers, no payment quotes. Just where your file stands on the factors
                lenders actually weigh.
              </p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Every Factor Is Movable</h3>
              <p className="text-sm text-muted-foreground">
                Each read comes with the specific lever that moves it — so "not yet" comes with
                a "here's how."
              </p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Nothing Leaves Your Browser</h3>
              <p className="text-sm text-muted-foreground">
                The math runs entirely on this page. No account, no email, no data collected
                or stored.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
