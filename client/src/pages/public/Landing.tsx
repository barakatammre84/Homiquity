import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navigation } from "@/components/Navigation";
import { SkipLink } from "@/components/SkipLink";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { CoachPromptBar } from "@/components/CoachPromptBar";
import { VeteranFoundedBadge } from "@/components/VeteranFoundedBadge";
import { lifestyleImages } from "@/lib/lifestyleImages";
import { usePageView } from "@/hooks/useActivityTracker";
import { Icons, iconSize } from "@/lib/icons";

/**
 * The public home page.
 *
 * Deliberately short. The previous version ran eight stacked sections — hero,
 * estimator, six audience cards, a four-step explainer, an image band, a rates
 * teaser, a four-card trust grid and a founder note — which is a sitemap, not a
 * front door. This is one dominant hero built around the AI Coach, three ways in,
 * a single trust row, and the footer.
 *
 * What the coach replaced: the hero used to ask the visitor to self-select from
 * six personas before anything would answer them. Asking a question in their own
 * words is a better first move, and the coach can route to the same six paths.
 *
 * Advertising rails on this surface: no rate, payment, term or APR figure appears
 * here at all (Reg Z §1026.24 trigger terms — the rates teaser moved off the home
 * page and lives at /rates with its disclosures), and nothing is framed as an
 * approval or a commitment (Reg N). Proof points are limited to facts we can
 * substantiate about the company, never volume or outcome claims.
 */

/** The three ways in, matching the top-level nav. Fewer, larger, unmissable. */
const PATHS = [
  {
    id: "buy",
    icon: Icons.home,
    title: "Buy a home",
    description:
      "See what fits your budget, then start a pre-approval you can shop with.",
    cta: "Start your pre-approval",
    href: "/apply",
  },
  {
    id: "refinance",
    icon: Icons.trend,
    title: "Refinance",
    description:
      "Check whether a new loan would improve on the one you have.",
    cta: "Check refinance options",
    href: "/refinance",
  },
  {
    id: "equity",
    icon: Icons.assets,
    title: "Use your equity",
    description:
      "Find out how much you could borrow against the home you already own.",
    cta: "Explore home equity",
    href: "/apply?type=heloc",
  },
] as const;

/** Substantiated, non-numeric-offer proof points. No volume or outcome claims. */
const TRUST_POINTS = [
  {
    id: "experience",
    icon: Icons.person,
    label: "15+ years in banking and lending",
  },
  {
    id: "rules",
    icon: Icons.tasks,
    label: "Rules-based decisions, not a black box",
  },
  {
    id: "fair-lending",
    icon: Icons.done,
    label: "Built to Fannie Mae and Freddie Mac guidelines",
  },
  {
    id: "security",
    icon: Icons.security,
    label: "Encrypted, and never sold",
  },
] as const;

export default function Landing() {
  usePageView("/");

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Homiquity — Ask about buying, refinancing, or your equity"
        description="Ask Homiquity's AI Coach a question in your own words and get a clear, educational answer about buying a home, refinancing, or using your equity. Estimates and guidance, not an approval."
        ogType="website"
        ogImage={lifestyleImages.landingHero.src}
      />
      <SkipLink />
      <Navigation />

      <main id="main" tabIndex={-1} className="focus:outline-none">
        {/* Hero — the whole page's centre of gravity. */}
        <section
          className="bg-gradient-to-br from-precision-950 via-precision-900 to-precision-700 px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
          data-testid="section-hero"
        >
          <div className="mx-auto max-w-4xl text-center">
            <p
              className="text-sm font-medium text-primary-foreground/75"
              data-testid="text-hero-eyebrow"
            >
              Built by a military veteran with 15+ years in banking
            </p>

            <h1
              className="mt-5 text-balance text-4xl font-bold leading-tight tracking-tight text-primary-foreground sm:text-5xl lg:text-6xl"
              data-testid="text-hero-title"
            >
              Ask anything about your mortgage. Get a straight answer.
            </h1>

            <p
              className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-primary-foreground/80"
              data-testid="text-hero-subtitle"
            >
              Our AI Coach walks you through buying, refinancing, or tapping your
              equity — in plain language, at your pace, with no sales pressure.
            </p>

            <div className="mx-auto mt-10 max-w-3xl text-left">
              <CoachPromptBar />
            </div>

            <p className="mt-8 text-sm text-primary-foreground/80">
              Rather not sign up yet?{" "}
              <Link
                href="/afford"
                className="font-semibold text-primary-foreground underline underline-offset-4 hover:no-underline"
                data-testid="link-hero-afford"
              >
                See your buying power
              </Link>{" "}
              — no account, no credit check.
            </p>
          </div>
        </section>

        {/* Three ways in. */}
        <section className="px-4 py-20 sm:px-6 lg:px-8" data-testid="section-paths">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Or pick where you're headed
            </h2>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {PATHS.map((path) => {
                const Icon = path.icon;
                return (
                  <Card
                    key={path.id}
                    className="hover-elevate"
                    data-testid={`card-path-${path.id}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className={iconSize.feature} aria-hidden="true" />
                      </div>
                      <h3
                        className="mt-5 text-xl font-semibold"
                        data-testid={`text-path-title-${path.id}`}
                      >
                        {path.title}
                      </h3>
                      <p className="mt-2 leading-relaxed text-muted-foreground">
                        {path.description}
                      </p>
                      <Button
                        asChild
                        variant="ghost"
                        className="-ml-2 mt-4 gap-1.5"
                        data-testid={`button-path-${path.id}`}
                      >
                        <Link href={path.href}>
                          {path.cta}
                          <Icons.next className={iconSize.dense} aria-hidden="true" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* One trust row, replacing the old four-card grid plus founder note. */}
        <section
          className="border-y bg-muted/30 px-4 py-14 sm:px-6 lg:px-8"
          data-testid="section-trust"
        >
          <div className="mx-auto max-w-6xl">
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {TRUST_POINTS.map((point) => {
                const Icon = point.icon;
                return (
                  <li
                    key={point.id}
                    className="flex items-start gap-3"
                    data-testid={`item-trust-${point.id}`}
                  >
                    <Icon
                      className={`${iconSize.emphasis} mt-0.5 shrink-0 text-primary`}
                      aria-hidden="true"
                    />
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      {point.label}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-10 flex justify-center border-t pt-8">
              <VeteranFoundedBadge data-testid="badge-landing-veteran" />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
