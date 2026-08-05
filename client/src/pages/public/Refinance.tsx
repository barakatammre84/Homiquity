import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SkipLink } from "@/components/SkipLink";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { FramedPhoto } from "@/components/FramedPhoto";
import { ImageTextSection } from "@/components/ImageTextSection";
import { lifestyleImages } from "@/lib/lifestyleImages";
import { formatCurrency } from "@/lib/formatters";
import { usePageView } from "@/hooks/useActivityTracker";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  ShieldCheck,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { calculateRefi } from "./refinance/refiMath";

/** Currency field: displays formatted digits, stores a plain number. */
function CurrencyInput({
  id,
  value,
  onChange,
  testId,
}: {
  id: string;
  value: number;
  onChange: (v: number) => void;
  testId: string;
}) {
  return (
    <div className="relative">
      <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        $
      </span>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        className="pl-7 tabular-nums"
        value={value > 0 ? value.toLocaleString("en-US") : ""}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "").slice(0, 9)))}
        data-testid={testId}
      />
    </div>
  );
}

const NEW_TERM_OPTIONS = [15, 20, 30] as const;

export default function Refinance() {
  usePageView("/refinance");

  const [balance, setBalance] = useState(300_000);
  const [currentRate, setCurrentRate] = useState(7.0);
  const [yearsRemaining, setYearsRemaining] = useState(26);
  const [newRate, setNewRate] = useState(6.0);
  const [newTermYears, setNewTermYears] = useState<number>(30);
  const [closingCosts, setClosingCosts] = useState(0);
  const [costsOpen, setCostsOpen] = useState(false);

  const results = useMemo(
    () => calculateRefi({ balance, currentRate, yearsRemaining, newRate, newTermYears, closingCosts }),
    [balance, currentRate, yearsRemaining, newRate, newTermYears, closingCosts],
  );

  const hasInputs = balance > 0;
  const saves = results.monthlyDiff > 0.5;
  const costsMore = results.monthlyDiff < -0.5;
  const interestGoesUp = results.newInterest > results.currentInterest;

  const softPullNote = (
    <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
      Soft credit check only — checking your options won't affect your credit score.
    </p>
  );

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Refinance Your Mortgage - See What You Could Save | Homiquity"
        description="Run your own refinance numbers in under a minute. No sign-up, no hard credit check. Compare your current payment against a new rate and term, then see your real options."
        ogImage={lifestyleImages.refinance.src}
      />
      <SkipLink />

      <main id="main" tabIndex={-1} className="focus:outline-none">
        {/* Hero — dedicated conversion page: wordmark only, no global nav */}
        <section className="border-b bg-gradient-to-b from-primary/5 to-background px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pb-20">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-center justify-between">
              <Link href="/" className="text-xl font-bold tracking-tight text-foreground" data-testid="link-refi-home">
                homiquity
              </Link>
              <span className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
                <ShieldCheck aria-hidden="true" className="h-4 w-4 text-primary" />
                No hard credit check
              </span>
            </div>

            <div className="mt-10 grid items-center gap-12 lg:mt-14 lg:grid-cols-2 lg:gap-16">
              <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
                <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl" data-testid="text-refi-hero-title">
                  Could refinancing lower your monthly payment?
                </h1>
                <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                  Run your own numbers in under a minute — no sign-up required.
                  Then see your real options with a soft credit check that won't touch your score.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground lg:justify-start">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />
                    No hard credit check
                  </span>
                  <span className="flex items-center gap-2">
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />
                    Free — no obligation
                  </span>
                  <span className="flex items-center gap-2">
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />
                    Built by a military veteran with 15+ years in banking
                  </span>
                </div>
              </div>

              <FramedPhoto
                src={lifestyleImages.refinance.src}
                alt={lifestyleImages.refinance.alt}
                testId="img-hero-refi"
                position="center 35%"
                loading="eager"
                className="mx-auto w-full max-w-lg lg:max-w-none"
              />
            </div>
          </div>
        </section>

        {/* Calculator — high on the page, overlapping the hero */}
        <section aria-labelledby="refi-calc-heading" className="px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-5xl">
            <Card>
              <CardHeader>
                <CardTitle id="refi-calc-heading" className="text-2xl">
                  Run your refinance numbers
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Everything stays on this page — we don't collect or store any of it.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-8 lg:grid-cols-2">
                  {/* Inputs */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="refi-balance">Current loan balance</Label>
                      <CurrencyInput id="refi-balance" value={balance} onChange={setBalance} testId="input-refi-balance" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="refi-current-rate">Current interest rate</Label>
                        <span className="text-sm font-medium tabular-nums" data-testid="text-refi-current-rate">
                          {currentRate.toFixed(3).replace(/\.?0+$/, "")}%
                        </span>
                      </div>
                      <Slider
                        id="refi-current-rate"
                        min={2}
                        max={10}
                        step={0.125}
                        value={[currentRate]}
                        onValueChange={([v]) => setCurrentRate(v)}
                        aria-label="Current interest rate"
                        data-testid="slider-refi-current-rate"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="refi-years-remaining">Years left on your loan</Label>
                        <span className="text-sm font-medium tabular-nums" data-testid="text-refi-years-remaining">
                          {yearsRemaining} {yearsRemaining === 1 ? "year" : "years"}
                        </span>
                      </div>
                      <Slider
                        id="refi-years-remaining"
                        min={1}
                        max={30}
                        step={1}
                        value={[yearsRemaining]}
                        onValueChange={([v]) => setYearsRemaining(v)}
                        aria-label="Years left on your loan"
                        data-testid="slider-refi-years-remaining"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="refi-new-rate">Hypothetical new rate</Label>
                        <span className="text-sm font-medium tabular-nums" data-testid="text-refi-new-rate">
                          {newRate.toFixed(3).replace(/\.?0+$/, "")}%
                        </span>
                      </div>
                      <Slider
                        id="refi-new-rate"
                        min={2}
                        max={10}
                        step={0.125}
                        value={[newRate]}
                        onValueChange={([v]) => setNewRate(v)}
                        aria-label="Hypothetical new interest rate"
                        data-testid="slider-refi-new-rate"
                      />
                      <p className="text-xs text-muted-foreground">
                        We don't know your rate yet — drag to compare scenarios.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="refi-new-term">New loan term</Label>
                      <Select value={String(newTermYears)} onValueChange={(v) => setNewTermYears(Number(v))}>
                        <SelectTrigger id="refi-new-term" data-testid="select-refi-new-term">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NEW_TERM_OPTIONS.map((years) => (
                            <SelectItem key={years} value={String(years)}>
                              {years} years
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Collapsible open={costsOpen} onOpenChange={setCostsOpen}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-auto gap-1 px-2 -mx-2 whitespace-normal text-left" data-testid="button-refi-toggle-costs">
                          <ChevronDown
                            aria-hidden="true"
                            className={`h-4 w-4 shrink-0 transition-transform ${costsOpen ? "rotate-180" : ""}`}
                          />
                          Add estimated closing costs to see your break-even point
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-3">
                        <div className="space-y-2">
                          <Label htmlFor="refi-closing-costs">Estimated closing costs</Label>
                          <CurrencyInput
                            id="refi-closing-costs"
                            value={closingCosts}
                            onChange={setClosingCosts}
                            testId="input-refi-closing-costs"
                          />
                          <p className="text-xs text-muted-foreground">
                            Refinances usually involve third-party fees (appraisal, title, recording).
                            You'll see yours itemized in a Loan Estimate before committing to anything.
                          </p>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>

                  {/* Results */}
                  <div className="rounded-lg border border-card-border bg-muted/40 p-6" aria-live="polite">
                    {hasInputs ? (
                      <div className="space-y-5">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {saves ? "Estimated monthly savings" : costsMore ? "Estimated monthly increase" : "Estimated monthly change"}
                          </p>
                          <p
                            className={`mt-1 text-4xl font-semibold tabular-nums ${saves ? "text-success-subtle-foreground" : costsMore ? "text-warning-subtle-foreground" : "text-foreground"}`}
                            data-testid="text-refi-monthly-diff"
                          >
                            {formatCurrency(Math.round(Math.abs(results.monthlyDiff)))}
                            <span className="text-base font-normal text-muted-foreground">/mo</span>
                          </p>
                        </div>

                        <dl className="space-y-2 text-sm">
                          <div className="flex items-center justify-between gap-4">
                            <dt className="text-muted-foreground">Current payment (P&I)</dt>
                            <dd className="font-medium tabular-nums" data-testid="text-refi-current-payment">
                              {formatCurrency(Math.round(results.currentPayment))}/mo
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <dt className="text-muted-foreground">New payment (P&I)</dt>
                            <dd className="font-medium tabular-nums" data-testid="text-refi-new-payment">
                              {formatCurrency(Math.round(results.newPayment))}/mo
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <dt className="text-muted-foreground">Interest left on current path</dt>
                            <dd className="font-medium tabular-nums">{formatCurrency(Math.round(results.currentInterest))}</dd>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <dt className="text-muted-foreground">Total interest on new loan</dt>
                            <dd className="font-medium tabular-nums">{formatCurrency(Math.round(results.newInterest))}</dd>
                          </div>
                          {results.breakEvenMonths !== null && (
                            <div className="flex items-center justify-between gap-4">
                              <dt className="text-muted-foreground">Break-even on closing costs</dt>
                              <dd className="font-medium tabular-nums" data-testid="text-refi-break-even">
                                ≈ {results.breakEvenMonths} months
                              </dd>
                            </div>
                          )}
                        </dl>

                        {saves && interestGoesUp && (
                          <p className="text-sm text-warning-subtle-foreground" data-testid="text-refi-interest-warning">
                            Heads up: a longer term can lower the monthly payment while increasing the
                            total interest you pay over time. Compare both lines above.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Enter your loan balance to see the comparison.</p>
                    )}

                    <p className="mt-6 border-t border-card-border pt-4 text-xs leading-relaxed text-muted-foreground">
                      Estimates for illustration only, calculated from the numbers you enter. Principal
                      and interest only — excludes taxes, insurance, and fees. This is not a loan offer,
                      rate quote, or commitment to lend. Your actual rate and terms depend on your
                      credit, home equity, and loan program.
                    </p>
                  </div>
                </div>

                {/* Dual CTAs */}
                <div className="mt-8 flex flex-col items-center gap-3">
                  <div className="flex w-full max-w-md flex-col items-center gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:gap-4">
                    <Link href="/apply?type=refinance" className="w-full sm:w-auto">
                      <Button size="lg" className="w-full gap-2 font-semibold sm:w-auto" data-testid="button-refi-apply">
                        See My Refinance Options
                        <ArrowRight aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href="/rates" className="w-full sm:w-auto">
                      <Button variant="outline" size="lg" className="w-full sm:w-auto" data-testid="button-refi-rates">
                        Just researching? Browse today's rates
                      </Button>
                    </Link>
                  </div>
                  {softPullNote}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Why homeowners refinance — educational, no numeric claims */}
        <ImageTextSection
          testId="section-refi-life"
          eyebrow="More than a rate"
          title="Refinance around your life — not just today's number"
          image={lifestyleImages.founderNote.src}
          imageAlt={lifestyleImages.founderNote.alt}
          imagePosition="center 30%"
          className="border-t bg-muted/30"
        >
          <p>
            Lowering your payment is one reason to refinance. Shortening your term,
            consolidating debt, or tapping equity for a remodel are others. We lay out the real
            tradeoffs of each — the monthly change and the long-run cost — so you can choose what
            fits your plans.
          </p>
          <p>
            Run the numbers yourself first. When you want to go further, a soft credit check
            keeps your score untouched.
          </p>
        </ImageTextSection>

        <section aria-labelledby="refi-why-heading" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 id="refi-why-heading" className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              Why homeowners refinance
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-6">
              <Card data-testid="card-refi-why-payment">
                <CardContent className="pt-6">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <TrendingDown aria-hidden="true" className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">Lower the monthly payment</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    If rates have dropped since you closed — or your credit has improved — a new loan
                    can reduce what you pay each month.
                  </p>
                </CardContent>
              </Card>
              <Card data-testid="card-refi-why-term">
                <CardContent className="pt-6">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Clock aria-hidden="true" className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">Pay the home off sooner</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Moving to a shorter term usually means a higher payment but far less interest over
                    the life of the loan — and a mortgage-free date you can circle.
                  </p>
                </CardContent>
              </Card>
              <Card data-testid="card-refi-why-cash">
                <CardContent className="pt-6">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Wallet aria-hidden="true" className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">Put equity to work</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    A cash-out refinance converts part of your home's equity into funds for renovations,
                    consolidating debt, or other goals. It's still a loan you repay — we'll show the
                    full cost before you decide.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* FAQ — objection handling via progressive disclosure */}
        <section aria-labelledby="refi-faq-heading" className="px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 id="refi-faq-heading" className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              Common questions
            </h2>
            <Accordion type="single" collapsible className="mt-8">
              <AccordionItem value="credit">
                <AccordionTrigger data-testid="accordion-refi-credit">
                  Will checking my refinance options hurt my credit score?
                </AccordionTrigger>
                <AccordionContent>
                  No. Seeing your options uses a soft credit check, which doesn't affect your score. A
                  hard credit pull only happens later in the process, and only after you explicitly
                  authorize it.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="when">
                <AccordionTrigger data-testid="accordion-refi-when">
                  When does refinancing actually make sense?
                </AccordionTrigger>
                <AccordionContent>
                  The honest answer: when the math works for how long you'll keep the home. If the
                  monthly savings repay the closing costs well before you plan to move — or a shorter
                  term fits your budget and cuts years of interest — it's worth a serious look. The
                  break-even figure in the calculator above is the number to watch.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="cost">
                <AccordionTrigger data-testid="accordion-refi-cost">
                  What does refinancing cost?
                </AccordionTrigger>
                <AccordionContent>
                  Like your original mortgage, a refinance involves closing costs, including third-party
                  fees such as the appraisal, title work, and county recording. You'll see every fee
                  itemized in your official Loan Estimate shortly after you apply — before you commit to
                  anything or pay anything.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="time">
                <AccordionTrigger data-testid="accordion-refi-time">
                  How long does a refinance take?
                </AccordionTrigger>
                <AccordionContent>
                  Checking your options takes about three minutes. A full refinance typically runs a few
                  weeks from application to closing, depending mostly on the appraisal and how quickly
                  documents come together. You'll see each step and what's needed next in your dashboard
                  the whole way.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-gradient-to-br from-precision-950 via-precision-900 to-precision-700 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Ready to see your actual options?
            </h2>
            <p className="mt-3 max-w-xl text-white/80">
              Three minutes, a soft credit check, and you'll know exactly where you stand.
            </p>
            <Link href="/apply?type=refinance" className="mt-8 w-full max-w-md sm:w-auto sm:max-w-none">
              <Button size="lg" className="w-full gap-2 font-semibold shadow-lg sm:w-auto" data-testid="button-refi-apply-footer">
                See My Refinance Options
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Button>
            </Link>
            <p className="mt-4 flex items-center gap-2 text-sm text-white/70">
              <ShieldCheck aria-hidden="true" className="h-4 w-4 text-precision-300" />
              Soft credit check only — your score is safe.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
