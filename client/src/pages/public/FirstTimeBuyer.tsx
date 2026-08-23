import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SkipLink } from "@/components/SkipLink";
import { Footer } from "@/components/Footer";
import { RelatedGuides } from "@/components/RelatedGuides";
import { SEOHead } from "@/components/SEOHead";
import { FramedPhoto } from "@/components/FramedPhoto";
import { ImageTextSection } from "@/components/ImageTextSection";
import { lifestyleImages } from "@/lib/lifestyleImages";
import { OffsetBlock } from "@/components/layout/OffsetBlock";
import { FirstKeyArt } from "@/components/illustrations/FirstKeyArt";
import { AdvocacyArt } from "@/components/illustrations/AdvocacyArt";
import { formatCurrency } from "@/lib/formatters";
import { usePageView } from "@/hooks/useActivityTracker";
import { loanSupportedByPayment } from "@shared/lib/amortization";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Compass,
  Home,
  Key,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

/**
 * Share of a monthly housing budget assumed available for principal &
 * interest; the rest is reserved for taxes, insurance, and possible PMI.
 * Deliberately conservative for an anxiety-prone audience — disclosed
 * in the copy right under the result.
 */
const PI_SHARE = 0.75;
const TERM_MONTHS = 360;

/** Loan amount a given monthly P&I payment supports (present value of annuity). */
const supportableLoan = loanSupportedByPayment;

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

const MYTHS = [
  {
    id: "twenty-down",
    title: '"I need a huge down payment"',
    body: "The single biggest myth in home buying. Low down payment programs are widely available, first-time buyers often qualify for assistance programs, and veterans may need no down payment at all. What you've saved is a starting point — not a gate.",
  },
  {
    id: "perfect-credit",
    title: '"My credit has to be perfect"',
    body: "It doesn't. Programs exist across a wide range of credit profiles, and checking where you stand uses a soft pull that never touches your score. You don't even need to know your exact number — a rough range is enough to start.",
  },
  {
    id: "paperwork",
    title: '"It\'s a mountain of paperwork"',
    body: "Buying a home involves real documents — but it doesn't have to feel like a filing cabinet fell on you. Our application is a few minutes of plain-language questions, and afterward you get one custom checklist and a dashboard that shows exactly what's next.",
  },
];

const HOW_IT_WORKS = [
  {
    id: "answer",
    icon: Compass,
    title: "1. Answer a few questions",
    body: "About three minutes, in plain language, one question at a time. Estimates are fine — and it's a soft credit check, so your score is untouched.",
  },
  {
    id: "know",
    icon: ClipboardList,
    title: "2. Know exactly where you stand",
    body: "See your buying power and get a custom checklist for your situation — first-time buyer programs flagged, no guessing what underwriting wants.",
  },
  {
    id: "shop",
    icon: Key,
    title: "3. Shop with confidence",
    body: "Take your pre-approval house hunting, and follow every step to closing in a dashboard that explains each one before it happens.",
  },
];

export default function FirstTimeBuyer() {
  usePageView("/first-time-buyer");

  const [monthlyRent, setMonthlyRent] = useState(2_000);
  const [downSavings, setDownSavings] = useState(15_000);
  const [rate, setRate] = useState(6.5);

  const results = useMemo(() => {
    const piBudget = monthlyRent * PI_SHARE;
    const loan = supportableLoan(piBudget, rate, TERM_MONTHS);
    return { piBudget, loan, price: loan + downSavings };
  }, [monthlyRent, downSavings, rate]);

  const hasInputs = monthlyRent > 0;

  const softPullNote = (
    <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
      Soft credit check only — checking your options won't affect your credit score.
    </p>
  );

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="First-Time Home Buyer? Start Here | Homiquity"
        description="See what your rent could buy instead. Plain-language guidance for first-time buyers: low down payment programs, a 3-minute check with no hard credit pull, and a step-by-step path to your first home."
        ogImage={lifestyleImages.firstTimeBuyer.src}
      />
      <SkipLink />

      <main id="main" tabIndex={-1} className="focus:outline-none">
        {/* Hero — dedicated conversion page: wordmark only, no global nav */}
        <section className="bg-muted px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pb-20">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-center justify-between">
              <Link href="/" className="text-xl font-bold tracking-tight text-foreground" data-testid="link-ftb-home">
                homiquity
              </Link>
              <span className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
                <ShieldCheck aria-hidden="true" className="h-4 w-4 text-primary" />
                No hard credit check
              </span>
            </div>

            <div className="mt-10 grid items-center gap-12 lg:mt-14 lg:grid-cols-2 lg:gap-16">
              <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
                  <Sparkles aria-hidden="true" className="h-4 w-4 text-primary" />
                  Made for first-time buyers
                </div>
                <h1 className="font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl lg:text-6xl" data-testid="text-ftb-hero-title">
                  Your first home is closer than you think.
                </h1>
                <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                  You already make a housing payment every month — it's called rent. See what
                  that same payment could buy instead, then find out exactly where you stand.
                  Plain language, no pressure.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground lg:justify-start">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />
                    Know exactly where you stand
                  </span>
                  <span className="flex items-center gap-2">
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />
                    No hard credit check
                  </span>
                  <span className="flex items-center gap-2">
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />
                    Free — no obligation
                  </span>
                </div>
              </div>

              <FirstKeyArt
                className="mx-auto w-full max-w-lg lg:max-w-none"
                data-testid="img-hero-firsttimebuyer"
              />
            </div>
          </div>
        </section>

        {/* Rent-reframe calculator */}
        <section aria-labelledby="ftb-calc-heading" className="px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-5xl">
            <Card>
              <CardHeader>
                <CardTitle id="ftb-calc-heading" className="text-2xl">
                  What could your rent buy?
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Everything stays on this page — we don't collect or store any of it.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-8 lg:grid-cols-2">
                  {/* Inputs — three, gentle */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="ftb-rent">Your current monthly rent</Label>
                      <CurrencyInput id="ftb-rent" value={monthlyRent} onChange={setMonthlyRent} testId="input-ftb-rent" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ftb-savings">Saved toward a down payment so far</Label>
                      <CurrencyInput id="ftb-savings" value={downSavings} onChange={setDownSavings} testId="input-ftb-savings" />
                      <p className="text-xs text-muted-foreground">
                        Whatever you have is fine — low down payment programs exist, and
                        first-time buyers often qualify for assistance.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="ftb-rate">Hypothetical interest rate</Label>
                        <span className="text-sm font-medium tabular-nums" data-testid="text-ftb-rate">
                          {rate.toFixed(3).replace(/\.?0+$/, "")}%
                        </span>
                      </div>
                      <Slider
                        id="ftb-rate"
                        min={3}
                        max={10}
                        step={0.125}
                        value={[rate]}
                        onValueChange={([v]) => setRate(v)}
                        aria-label="Hypothetical interest rate"
                        data-testid="slider-ftb-rate"
                      />
                      <p className="text-xs text-muted-foreground">
                        We don't know your rate yet — drag to compare scenarios (30-year fixed assumed).
                      </p>
                    </div>
                  </div>

                  {/* Results */}
                  <div className="rounded-lg border border-card-border bg-muted/40 p-6" aria-live="polite">
                    {hasInputs ? (
                      <div className="space-y-5">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            A monthly payment like your rent could shop around
                          </p>
                          <p className="mt-1 text-4xl font-semibold tabular-nums text-foreground" data-testid="text-ftb-price">
                            {formatCurrency(Math.round(results.price / 1000) * 1000)}
                          </p>
                        </div>

                        <dl className="space-y-2 text-sm">
                          <div className="flex items-center justify-between gap-4">
                            <dt className="text-muted-foreground">Goes to the loan itself (P&I)</dt>
                            <dd className="font-medium tabular-nums" data-testid="text-ftb-pi-budget">
                              {formatCurrency(Math.round(results.piBudget))}/mo
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <dt className="text-muted-foreground">Reserved for taxes & insurance</dt>
                            <dd className="font-medium tabular-nums">
                              {formatCurrency(Math.round(monthlyRent - results.piBudget))}/mo
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <dt className="text-muted-foreground">Estimated loan that supports</dt>
                            <dd className="font-medium tabular-nums" data-testid="text-ftb-loan">
                              {formatCurrency(Math.round(results.loan))}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <dt className="text-muted-foreground">Plus your down payment savings</dt>
                            <dd className="font-medium tabular-nums">{formatCurrency(downSavings)}</dd>
                          </div>
                        </dl>

                        <p className="text-sm text-muted-foreground">
                          The point isn't the exact number — it's that the payment you
                          already make every month is real buying power.
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Enter your monthly rent to see the comparison.</p>
                    )}

                    <p className="mt-6 border-t border-card-border pt-4 text-xs leading-relaxed text-muted-foreground">
                      Estimates for illustration only, calculated from the numbers you enter.
                      Assumes a 30-year fixed loan with about a quarter of the payment
                      reserved for taxes, insurance, and possible mortgage insurance —
                      your actual costs vary by home and location. This is not a loan
                      offer, rate quote, or commitment to lend, and it isn't a qualification
                      decision: lenders also weigh income, debts, and credit.
                    </p>
                  </div>
                </div>

                {/* Dual CTAs */}
                <div className="mt-8 flex flex-col items-center gap-3">
                  <div className="flex w-full max-w-md flex-col items-center gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:gap-4">
                    <Button asChild size="lg" className="w-full gap-2 font-semibold sm:w-auto" data-testid="button-ftb-apply">
                      <Link href="/apply?type=first-time">
                        See Where I Actually Stand
                        <ArrowRight aria-hidden="true" className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg" className="w-full sm:w-auto" data-testid="button-ftb-afford">
                      <Link href="/afford">
                        Curious about a specific home?
                      </Link>
                    </Button>
                  </div>
                  {softPullNote}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Myth-busting — education for the anxious first-timer */}
        <ImageTextSection
          testId="section-ftb-guided"
          eyebrow="You're not on your own"
          title="New to all this? That's exactly who we built it for."
          illustration={<AdvocacyArt />}
          reverse
          className="bg-muted"
        >
          <p>
            First-time buying comes with unfamiliar words and big decisions. Homiquity walks
            you through each step in plain language — what you can afford, what to save, and
            what happens next — so you're never guessing.
          </p>
          <p>No jargon and no pressure. When you're ready, a real person reviews your file.</p>
        </ImageTextSection>

        <section aria-labelledby="ftb-myths-heading" className="px-4 py-16 sm:px-6 lg:px-8">
          <OffsetBlock side="left" className="max-w-5xl" data-testid="offset-ftb-myths">
            <h2 id="ftb-myths-heading" className="lg:text-left text-2xl font-semibold tracking-tight sm:text-3xl">
              The myths keeping renters renting
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-6">
              {MYTHS.map((myth) => (
                <Card key={myth.id} data-testid={`card-ftb-myth-${myth.id}`}>
                  <CardContent className="pt-6">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Home aria-hidden="true" className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold">{myth.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{myth.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </OffsetBlock>
        </section>

        {/* How it works — three steps, all code-true */}
        <section aria-labelledby="ftb-how-heading" className="bg-muted px-4 py-16 sm:px-6 lg:px-8">
          <OffsetBlock side="right" className="max-w-5xl" data-testid="offset-ftb-how">
            <h2 id="ftb-how-heading" className="lg:text-left text-2xl font-semibold tracking-tight sm:text-3xl">
              How it works
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-6">
              {HOW_IT_WORKS.map((step) => (
                <Card key={step.id} data-testid={`card-ftb-how-${step.id}`}>
                  <CardContent className="pt-6">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <step.icon aria-hidden="true" className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </OffsetBlock>
        </section>

        {/* FAQ — objection handling via progressive disclosure */}
        <section aria-labelledby="ftb-faq-heading" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 id="ftb-faq-heading" className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              Common questions
            </h2>
            <Accordion type="single" collapsible className="mt-8">
              <AccordionItem value="down-payment">
                <AccordionTrigger data-testid="accordion-ftb-down">
                  How much do I really need for a down payment?
                </AccordionTrigger>
                <AccordionContent>
                  Almost certainly less than you think. Low down payment programs are widely
                  available, many states and cities offer first-time buyer assistance, and
                  veterans may qualify with no down payment at all. Flag yourself as a
                  first-time buyer in the application and your options get reviewed with
                  that in mind. Buying in Illinois? Our guides to the{" "}
                  <Link href="/learn/illinois-down-payment-assistance-2026" className="underline underline-offset-2" data-testid="link-ftb-dpa-ihda">
                    IHDA statewide programs
                  </Link>
                  , the{" "}
                  <Link href="/learn/chicago-homegrown-purchase-assistance" className="underline underline-offset-2" data-testid="link-ftb-dpa-homegrown">
                    Chicago HomeGrown grant
                  </Link>
                  , and the{" "}
                  <Link href="/learn/cook-county-down-payment-assistance-2026" className="underline underline-offset-2" data-testid="link-ftb-dpa-cook">
                    Cook County program
                  </Link>{" "}
                  break down what each one offers.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="credit">
                <AccordionTrigger data-testid="accordion-ftb-credit">
                  What credit score do I need?
                </AccordionTrigger>
                <AccordionContent>
                  There's no single magic number — programs exist across a wide range of
                  credit profiles. You don't even need to know your score to start: the
                  application takes a rough range, and the soft credit check we use to
                  verify it never affects your score.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="afford">
                <AccordionTrigger data-testid="accordion-ftb-afford">
                  How do lenders decide what I can afford?
                </AccordionTrigger>
                <AccordionContent>
                  Mostly by comparing your monthly income to your monthly debts — the
                  calculator above is a rough sketch of the same idea. Income, existing
                  debts, down payment, and credit all factor in, which is why the 3-minute
                  check gives you a much more real answer than any calculator, ours
                  included.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="closing-costs">
                <AccordionTrigger data-testid="accordion-ftb-closing">
                  What are closing costs?
                </AccordionTrigger>
                <AccordionContent>
                  One-time costs paid when the purchase completes — things like the
                  appraisal, title work, and county recording fees, some of which go to
                  third parties. You'll see every fee itemized in your official Loan
                  Estimate shortly after you apply, before you commit to anything. In some
                  markets, sellers can agree to cover part of them.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="ready">
                <AccordionTrigger data-testid="accordion-ftb-ready">
                  How do I know if I'm even ready?
                </AccordionTrigger>
                <AccordionContent>
                  If you pay rent reliably every month, you owe it to yourself to find out —
                  that's the honest answer. Checking is free, takes about three minutes, and
                  doesn't touch your credit score. And if the answer is "not quite yet,"
                  you'll know exactly what to work on instead of wondering.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-gradient-to-br from-precision-950 via-precision-900 to-precision-700 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Stop wondering. Start knowing.
            </h2>
            <p className="mt-3 max-w-xl text-white/80">
              Three minutes from now you could know your buying power, your program
              options, and your exact next step.
            </p>
            <Button asChild size="lg" className="mt-8 max-w-md sm:max-w-none w-full gap-2 font-semibold shadow-lg sm:w-auto" data-testid="button-ftb-apply-footer">
              <Link href="/apply?type=first-time">
                See Where I Stand
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
            <p className="mt-4 flex items-center gap-2 text-sm text-white/70">
              <ShieldCheck aria-hidden="true" className="h-4 w-4 text-precision-300" />
              Soft credit check only — your score is safe.
            </p>
          </div>
        </section>
      </main>

      <RelatedGuides families={["fha", "conventional"]} heading="First-time buyer guides" />

      <Footer />
    </div>
  );
}
