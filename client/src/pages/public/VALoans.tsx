import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SkipLink } from "@/components/SkipLink";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { VeteranFoundedBadge } from "@/components/VeteranFoundedBadge";
import { usePageView } from "@/hooks/useActivityTracker";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Flag,
  HandHeart,
  HelpCircle,
  Home,
  Medal,
  ShieldCheck,
  Users,
} from "lucide-react";

/**
 * Military-status pre-screen: every service-connected answer routes to the
 * funnel with the VA path prefilled (?type=va — PreApproval seeds isVeteran);
 * "None of these" goes to the standard funnel so nobody dead-ends.
 */
const SERVICE_OPTIONS = [
  { id: "veteran", label: "I'm a veteran", icon: Medal, href: "/apply?type=va" },
  { id: "active-duty", label: "I'm on active duty", icon: ShieldCheck, href: "/apply?type=va" },
  { id: "guard-reserve", label: "National Guard or Reserve", icon: Flag, href: "/apply?type=va" },
  { id: "surviving-spouse", label: "I'm a surviving spouse", icon: HandHeart, href: "/apply?type=va" },
  { id: "none", label: "None of these", icon: HelpCircle, href: "/apply" },
] as const;

const VA_BENEFITS = [
  {
    id: "no-down",
    icon: Home,
    title: "No down payment required",
    body: "Qualified buyers can finance the full purchase price of the home — the benefit that makes VA loans the strongest path to ownership most veterans have.",
  },
  {
    id: "no-pmi",
    icon: ShieldCheck,
    title: "No monthly mortgage insurance",
    body: "Unlike most low-down-payment programs, VA loans never charge monthly PMI. That money stays in your payment budget every single month.",
  },
  {
    id: "rates",
    icon: BadgeCheck,
    title: "Competitive rates",
    body: "Because the VA backs the loan, lenders can offer veterans some of the most competitive rates available. We'll show you yours before any hard credit pull.",
  },
  {
    id: "residual",
    icon: Users,
    title: "Underwritten the way the VA intends",
    body: "VA approval runs on residual income — the money left over each month for your household. We run that check up front, so your pre-approval actually holds.",
  },
];

export default function VALoans() {
  usePageView("/va-loans");
  const [, navigate] = useLocation();

  const softPullNote = (
    <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
      Soft credit check only — checking your options won't affect your credit score.
    </p>
  );

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="VA Home Loans - No Down Payment Required | Homiquity"
        description="Use the VA home loan benefit you earned: no down payment required, no monthly mortgage insurance, and underwriting built around the VA's residual-income standard. Built by a fellow veteran."
      />
      <SkipLink />

      <main id="main" tabIndex={-1} className="focus:outline-none">
        {/* Hero — dedicated conversion page: wordmark only, no global nav */}
        <section className="relative overflow-hidden bg-gradient-to-br from-precision-950 via-precision-900 to-precision-700 px-4 pb-36 pt-6 sm:px-6 lg:px-8">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-precision-700/25 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-precision-500/15 blur-3xl" />

          <div className="relative mx-auto max-w-6xl">
            <div className="flex items-center justify-between">
              <Link href="/" className="text-xl font-bold tracking-tight text-white" data-testid="link-va-home">
                homiquity
              </Link>
              <span className="hidden items-center gap-2 text-sm text-white/70 sm:flex">
                <ShieldCheck aria-hidden="true" className="h-4 w-4 text-precision-300" />
                No hard credit check
              </span>
            </div>

            <div className="mt-14 flex flex-col items-center text-center lg:mt-20">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/90 backdrop-blur-sm">
                <Medal aria-hidden="true" className="h-4 w-4 text-precision-300" />
                Built by a fellow veteran
              </div>
              <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl" data-testid="text-va-hero-title">
                You earned this benefit.
                <br />
                We'll help you use it.
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/80">
                VA home loans: no down payment required, no monthly mortgage insurance, and
                underwriting that follows the VA's own playbook — not a W-2 algorithm's.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/70">
                <span className="flex items-center gap-2">
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-precision-300" />
                  No hard credit check
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-precision-300" />
                  Free — no obligation
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-precision-300" />
                  About 3 minutes
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Pre-screen — the doctrine's "military service status question first" */}
        <section aria-labelledby="va-prescreen-heading" className="relative z-10 -mt-24 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle id="va-prescreen-heading" className="text-2xl">
                  Which best describes your service?
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  One tap — we'll set up the right path before you answer anything else.
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {SERVICE_OPTIONS.map((opt) => (
                    <Button
                      key={opt.id}
                      variant="outline"
                      size="lg"
                      className="h-auto justify-start gap-3 whitespace-normal py-4 text-left"
                      onClick={() => navigate(opt.href)}
                      data-testid={`button-va-service-${opt.id}`}
                    >
                      <opt.icon aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
                      <span className="font-medium">{opt.label}</span>
                      <ArrowRight aria-hidden="true" className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
                    </Button>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  Final VA eligibility is confirmed with your Certificate of Eligibility (COE) —
                  we help you request it during the process. National Guard and Reserve
                  eligibility depends on length and type of service; surviving-spouse
                  eligibility depends on your circumstances. Not military-connected? The same
                  3-minute check covers other low-down-payment programs too.
                </p>
                <div className="mt-4 border-t border-card-border pt-4">{softPullNote}</div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Benefits — clear legible cards, no stock photos */}
        <section aria-labelledby="va-benefits-heading" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 id="va-benefits-heading" className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              What makes a VA loan different
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-6">
              {VA_BENEFITS.map((benefit) => (
                <Card key={benefit.id} data-testid={`card-va-benefit-${benefit.id}`}>
                  <CardContent className="pt-6">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <benefit.icon aria-hidden="true" className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold">{benefit.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{benefit.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Differentiator — the human/veteran angle vs algorithmic lenders */}
        <section aria-labelledby="va-why-us-heading" className="px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl rounded-lg border border-card-border bg-card p-8">
            <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-left">
              <VeteranFoundedBadge
                variant="seal"
                showFlag
                caption="Built by a fellow veteran"
                className="shrink-0"
                data-testid="badge-va-veteran"
              />
              <div>
                <h2 id="va-why-us-heading" className="text-2xl font-semibold tracking-tight">
                  A fellow veteran on your side
                </h2>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  Homiquity was built by a military veteran with 15+ years in banking — someone
                  who has been on both sides of this transaction. VA loans have real quirks:
                  the VA appraisal, funding-fee exemptions, entitlement restoration, the
                  residual-income worksheet. Big online lenders bolt VA onto a conventional
                  workflow and hope. We built the workflow around the VA's rules from day one —
                  our application literally asks the residual-income questions most lenders
                  skip until underwriting.
                </p>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  That means fewer surprises after you're under contract, and a pre-approval
                  that means what it says.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ — objection handling via progressive disclosure */}
        <section aria-labelledby="va-faq-heading" className="px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 id="va-faq-heading" className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              Common questions
            </h2>
            <Accordion type="single" collapsible className="mt-8">
              <AccordionItem value="eligible">
                <AccordionTrigger data-testid="accordion-va-eligible">
                  Am I eligible for a VA loan?
                </AccordionTrigger>
                <AccordionContent>
                  Veterans, active-duty service members, many National Guard and Reserve
                  members, and some surviving spouses are eligible. The official proof is
                  your Certificate of Eligibility (COE) — if you don't have yours, we help
                  you request it as part of the process. Answering the one question above
                  starts you on the right path.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="down-payment">
                <AccordionTrigger data-testid="accordion-va-down">
                  Is it really no down payment?
                </AccordionTrigger>
                <AccordionContent>
                  For qualified buyers with full entitlement, yes — the VA loan is designed
                  so you can finance the full purchase price. You can always choose to put
                  money down if you want to (it can reduce the VA funding fee), but the
                  benefit exists so you don't have to wait years to save one.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="funding-fee">
                <AccordionTrigger data-testid="accordion-va-fee">
                  What is the VA funding fee?
                </AccordionTrigger>
                <AccordionContent>
                  It's a one-time fee set by the VA that keeps the program running, and it
                  can usually be rolled into the loan instead of paid in cash. The amount
                  depends on your down payment and whether you've used the benefit before —
                  and many veterans receiving VA disability compensation are exempt
                  entirely. You'll see your exact figure itemized in your Loan Estimate
                  before you commit to anything.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="reuse">
                <AccordionTrigger data-testid="accordion-va-reuse">
                  I've used my VA benefit before. Can I use it again?
                </AccordionTrigger>
                <AccordionContent>
                  Usually, yes. Entitlement can be restored once a prior VA loan is paid
                  off, and in some cases you can have two VA loans at once using remaining
                  entitlement. This is exactly the kind of situation where our team digs in
                  rather than letting software say no.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="appraisal">
                <AccordionTrigger data-testid="accordion-va-appraisal">
                  I've heard VA appraisals are strict. Should I worry?
                </AccordionTrigger>
                <AccordionContent>
                  The VA appraisal includes Minimum Property Requirements that protect you
                  from buying a home with serious problems — it's a feature, not a bug. It
                  does mean your team needs to know how to handle repair negotiations and
                  timelines. Ours does, and you'll see appraisal status tracked step by step
                  in your dashboard.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-gradient-to-br from-precision-950 via-precision-900 to-precision-700 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Three minutes. No pressure. Your benefit.
            </h2>
            <p className="mt-3 max-w-xl text-white/80">
              See what your VA benefit unlocks — before any hard credit pull, and before
              you talk to anyone.
            </p>
            <Link href="/apply?type=va" className="mt-8 w-full max-w-md sm:w-auto sm:max-w-none">
              <Button size="lg" className="w-full gap-2 font-semibold shadow-lg sm:w-auto" data-testid="button-va-apply-footer">
                Check My VA Loan Options
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
