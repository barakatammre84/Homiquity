import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Navigation } from "@/components/Navigation";
import { BuyingPowerEstimator } from "@/components/BuyingPowerEstimator";
import { SkipLink } from "@/components/SkipLink";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { FramedPhoto } from "@/components/FramedPhoto";
import { ImageTextSection } from "@/components/ImageTextSection";
import { LifestyleImage } from "@/components/LifestyleImage";
import { lifestyleImages } from "@/lib/lifestyleImages";
import { VeteranFoundedBadge } from "@/components/VeteranFoundedBadge";
import { useQuery } from "@tanstack/react-query";
import { usePageView } from "@/hooks/useActivityTracker";
import { 
  CheckCircle2,
  ArrowRight,
  Shield,
  Home,
  FileText,
  TrendingUp,
  Scale,
  Bot,
  Building2,
  Briefcase,
  Key,
} from "lucide-react";
// Users icon replaced by a lifestyle photo in the founder-note band.

// Monochromatic by design: differentiation comes from the icon, not a rainbow
// of chip colors (Charcoal Emerald sweep — precision ramp only on this page).
const AUDIENCE_PATHS = [
  {
    id: "first-time",
    icon: Key,
    title: "First-Time Buyers",
    description: "Not sure where to start? We'll walk you through it step by step.",
    cta: "See Where You Stand",
    href: "/first-time-buyer",
  },
  {
    id: "homeowners",
    icon: Home,
    title: "Current Homeowners",
    description: "See if refinancing could lower your payment or unlock your equity.",
    cta: "Check Refinance Options",
    href: "/refinance",
  },
  {
    id: "move-up",
    icon: TrendingUp,
    title: "Move-Up Buyers",
    description: "Ready for your next home? Get pre-approved and start shopping.",
    cta: "Get Pre-Approved",
    href: "/apply",
  },
  {
    id: "affluent",
    icon: Briefcase,
    title: "Complex Income",
    description: "Self-employed, multiple properties, or non-traditional income? We handle it.",
    cta: "See How We Handle It",
    href: "/self-employed",
  },
  {
    id: "veterans",
    icon: Shield,
    title: "Veterans & Military",
    description: "VA loans with no down payment. Built by a fellow veteran.",
    cta: "Explore VA Loans",
    href: "/va-loans",
  },
  {
    id: "investors",
    icon: Building2,
    title: "Real Estate Investors",
    description: "Finance your next investment property with confidence.",
    cta: "Get Started",
    href: "/apply?type=investment",
  },
];

export default function Landing() {
  usePageView("/");
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Homiquity - Clarity for Every Stage of Homeownership"
        description="Homiquity gives you clarity, organization, and confidence in every stage of homeownership. Pre-approval, property search, AI coaching, and smart tools — all in one place."
        ogType="website"
        ogImage={lifestyleImages.landingHero.src}
      />
      <SkipLink />
      <Navigation />

      <main id="main" tabIndex={-1} className="focus:outline-none">
      <section className="border-b bg-gradient-to-b from-primary/5 to-background px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
                <Shield className="h-4 w-4 text-primary" />
                Built by a military veteran with 15+ years in banking
              </div>

              <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl" data-testid="text-hero-title">
                Clarity for every stage{" "}
                <span className="text-primary">of homeownership.</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground" data-testid="text-hero-subtitle">
                Whether you're buying your first home, refinancing, or investing,
                Homiquity helps you understand your options and move forward with confidence.
              </p>

              <div className="mt-8 flex w-full max-w-md flex-col items-center gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:gap-4">
                <Link href="/apply" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full gap-2 font-semibold shadow-lg shadow-primary/25 sm:w-auto"
                    data-testid="button-hero-preapprove"
                  >
                    Start Your Pre-Approval
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/afford" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full gap-2 sm:w-auto"
                    data-testid="button-hero-afford"
                  >
                    Can I Afford This Home?
                  </Button>
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground lg:justify-start">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  No hard credit check
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Takes about 3 minutes
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  100% free
                </span>
              </div>
            </div>

            <FramedPhoto
              src={lifestyleImages.landingHero.src}
              alt={lifestyleImages.landingHero.alt}
              testId="img-hero-landing"
              position="center 25%"
              loading="eager"
              className="mx-auto w-full max-w-lg lg:max-w-none"
            />
          </div>
        </div>
      </section>

      {/* Buying-power estimator — its own light band right under the hero */}
      <section className="border-b bg-muted/30 px-4 py-16 sm:px-6 lg:px-8 lg:py-20" data-testid="section-estimator">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">See your buying power</p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Find out what you could afford — in about a minute
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              Answer a few quick questions and get a realistic estimate. No sign-up, no hard credit
              check, and nothing leaves your device until you decide to continue.
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              <div data-testid="card-value-clarity">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <p className="font-semibold">Clarity</p>
                <p className="mt-1 text-sm text-muted-foreground">Know exactly where you stand at every step</p>
              </div>
              <div data-testid="card-value-organization">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <p className="font-semibold">Organization</p>
                <p className="mt-1 text-sm text-muted-foreground">Documents, decisions, and progress — all in one place</p>
              </div>
              <div data-testid="card-value-confidence">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <p className="font-semibold">Confidence</p>
                <p className="mt-1 text-sm text-muted-foreground">Make better decisions with real data, not guesswork</p>
              </div>
            </div>
          </div>
          <BuyingPowerEstimator />
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8" data-testid="section-audience-paths">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Where are you on your journey?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Pick your situation and we'll show you the right next step
            </p>
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AUDIENCE_PATHS.map((path) => {
              const Icon = path.icon;
              return (
                <Card key={path.id} className="hover-elevate" data-testid={`card-audience-${path.id}`}>
                  <CardContent className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold" data-testid={`text-audience-title-${path.id}`}>{path.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {path.description}
                    </p>
                    <Button asChild variant="ghost" size="sm" className="mt-4 gap-1.5 -ml-2" data-testid={`button-audience-${path.id}`}>
                      <Link href={path.href}>
                        {path.cta}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How it works
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Four steps from start to offer
            </p>
          </div>
          
          <div className="mt-16 grid gap-8 sm:grid-cols-4">
            {[
              { step: 1, title: "Answer a few questions", desc: "Tell us about your income, debts, and what you're looking for. Takes about 3 minutes." },
              { step: 2, title: "Get your answer", desc: "We evaluate your profile against real lending guidelines and give you a clear decision." },
              { step: 3, title: "Upload your documents", desc: "We tell you exactly what's needed and keep everything organized in one place." },
              { step: 4, title: "Shop with confidence", desc: "Use your pre-approval letter to make competitive offers on homes you love." },
            ].map((item) => (
              <div key={item.step} className="relative text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-lg shadow-primary/25">
                  {item.step}
                </div>
                <h3 className="mt-5 text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ImageTextSection
        testId="section-know-afford"
        eyebrow="Before you shop"
        title="Know what you can afford — before you fall for a house"
        image={lifestyleImages.learning.src}
        imageAlt={lifestyleImages.learning.alt}
        imagePosition="center 30%"
        reverse
        className="border-b"
      >
        <p>
          Shopping without a number is how people fall for a home they can't get approved
          for. Homiquity checks your income, debts, and goals against real lending
          guidelines and shows you a clear range — before you tour a single house.
        </p>
        <p>
          No hard credit check, no sales pressure. Just a straight answer you can plan around.
        </p>
      </ImageTextSection>

      <RatesTeaser />

      <section className="border-y bg-muted/30 px-4 py-16 sm:px-6 lg:px-8" data-testid="section-why-trust">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built on experience you can trust
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              15+ years of banking and lending, now available to you online.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card data-testid="card-trust-experience">
              <CardContent className="p-6 text-center">
                <p className="text-3xl font-bold text-primary" data-testid="text-trust-years">15+</p>
                <p className="mt-2 text-sm text-muted-foreground">Years of banking and lending experience</p>
                <div className="mt-4 flex justify-center border-t pt-4">
                  <VeteranFoundedBadge variant="compact" data-testid="badge-landing-veteran" />
                </div>
              </CardContent>
            </Card>
            <Card data-testid="card-trust-rules">
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-semibold">Rules-Based Decisions</p>
                <p className="mt-1 text-xs text-muted-foreground">No black-box AI approvals. Clear, deterministic rules.</p>
              </CardContent>
            </Card>
            <Card data-testid="card-trust-compliance">
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <Scale className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-semibold">Fair Lending First</p>
                <p className="mt-1 text-xs text-muted-foreground">Every decision follows Fannie Mae & Freddie Mac guidelines.</p>
              </CardContent>
            </Card>
            <Card data-testid="card-trust-security">
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-semibold">Bank-Grade Security</p>
                <p className="mt-1 text-xs text-muted-foreground">256-bit encryption. Your data is never sold, and it's shared only as needed to process your loan.</p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 rounded-2xl border bg-card p-8 sm:p-10" data-testid="card-founder-note">
            <div className="flex flex-col items-center text-center lg:flex-row lg:text-left lg:gap-8">
              <div className="mb-6 h-44 w-full shrink-0 overflow-hidden rounded-2xl sm:h-52 lg:mb-0 lg:h-40 lg:w-64">
                <LifestyleImage
                  src={lifestyleImages.founderNote.src}
                  alt={lifestyleImages.founderNote.alt}
                  testId="img-founder-note"
                  position="center 30%"
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold">A note from our team</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-3xl">
                  We built Homiquity because we believe the mortgage process should feel clear, not confusing. 
                  As a military veteran with over 15 years in commercial banking and lending, I've seen firsthand 
                  how overwhelming the homebuying process can be — and how much harder it is without the right guidance. 
                  Homiquity exists to change that — to give every person the clarity and 
                  confidence they deserve when making the biggest financial decision of their life. We're just getting started, 
                  and we'd love for you to be part of the journey.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Find out what you qualify for
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            Answer a few questions and get a clear decision in minutes. No commitment required.
          </p>
          
          <div className="mt-10 flex w-full max-w-md mx-auto flex-col items-center gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:justify-center sm:gap-4">
            <Link href="/apply" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full gap-2 font-semibold shadow-lg shadow-primary/25 sm:w-auto"
                data-testid="button-cta-preapprove"
              >
                Start Your Pre-Approval
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/ai-coach" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full gap-2 sm:w-auto"
                data-testid="button-cta-coach"
              >
                <Bot className="h-4 w-4" />
                Not sure yet? Talk to our AI Coach
              </Button>
            </Link>
          </div>
          
          <p className="mt-6 text-sm text-muted-foreground">
            No hard credit check. Free to use. No strings attached.
          </p>
        </div>
      </section>
      </main>

      <Footer />
    </div>
  );
}

interface RatePreview {
  id: number;
  programName: string;
  interestRate: string;
  apr: string;
  loanType: string;
}

function RatesTeaser() {
  const { data: rates, isLoading } = useQuery<RatePreview[]>({
    queryKey: ["/api/rates"],
  });

  const topRates = (rates || []).slice(0, 3);
  const hasRates = topRates.length > 0;

  if (!isLoading && !hasRates) return null;

  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8" data-testid="section-rates-teaser">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Today's mortgage rates
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Transparent rates updated daily
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {isLoading
            ? [1, 2, 3].map((i) => (
                <Card key={i} className="text-center">
                  <CardContent className="flex flex-col items-center p-6">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-3 h-10 w-24" />
                    <Skeleton className="mt-2 h-4 w-20" />
                    <Skeleton className="mt-3 h-3 w-16" />
                  </CardContent>
                </Card>
              ))
            : topRates.map((rate) => (
                <Card key={rate.id} className="text-center" data-testid={`card-rate-teaser-${rate.id}`}>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-muted-foreground" data-testid={`text-rate-name-${rate.id}`}>{rate.programName}</p>
                    {/* Reg Z §1026.24(c): note rate never more conspicuous than APR. */}
                    <div className="mt-2 flex items-baseline justify-center gap-4">
                      <div>
                        <p className="text-2xl font-bold text-primary" data-testid={`text-rate-value-${rate.id}`}>{rate.interestRate}%</p>
                        <p className="text-xs text-muted-foreground">Rate</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-primary" data-testid={`text-rate-apr-${rate.id}`}>{rate.apr}%</p>
                        <p className="text-xs text-muted-foreground">APR</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">{rate.loanType}</p>
                  </CardContent>
                </Card>
              ))}
        </div>

        <div className="mt-8 text-center">
          <Button asChild variant="outline" className="gap-2" data-testid="button-view-all-rates">
            <Link href="/rates">
              View All Rates
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Rates are for illustrative purposes. Your rate may vary based on credit, property, and loan terms.
          </p>
        </div>
      </div>
    </section>
  );
}
