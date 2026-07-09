import { Link } from "wouter";
import { usePageView } from "@/hooks/useActivityTracker";
import { PageShell } from "@/components/PageShell";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent } from "@/components/ui/card";
import {
  Home,
  Calculator,
  TrendingDown,
  Scale,
  Calendar,
  Wallet,
  Zap,
  PiggyBank,
  Star,
  ArrowRight,
} from "lucide-react";

interface CalcLink {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const generalCalculators: CalcLink[] = [
  {
    href: "/calculators/affordability",
    title: "Home affordability calculator",
    description: "Explore home prices affordable for you and see what a lender could prequalify you for.",
    icon: Home,
  },
  {
    href: "/calculators/mortgage",
    title: "Mortgage calculator",
    description: "Thinking of buying a house? Estimate your monthly loan payment including taxes and insurance.",
    icon: Calculator,
  },
  {
    href: "/refinance",
    title: "Refinance calculator",
    description: "Find out if refinancing could lower your monthly payment.",
    icon: TrendingDown,
  },
  {
    href: "/calculators/rent-vs-buy",
    title: "Rent vs. buy calculator",
    description: "Discover the costs and benefits of both to see which could be better for you.",
    icon: Scale,
  },
  {
    href: "/calculators/amortization",
    title: "Amortization calculator",
    description: "See how much of each mortgage payment reduces your loan balance and how much goes to interest.",
    icon: Calendar,
  },
  {
    href: "/calculators/home-equity",
    title: "Home equity calculator",
    description: "Learn how much cash you have in your home based on its value and what you still owe.",
    icon: Wallet,
  },
  {
    href: "/calculators/payoff",
    title: "Mortgage payoff calculator",
    description: "Find refinancing options that could help you pay off your mortgage faster.",
    icon: Zap,
  },
  {
    href: "/calculators/down-payment",
    title: "Down payment calculator",
    description: "Learn how much cash you need to buy the home you have in mind.",
    icon: PiggyBank,
  },
];

const militaryCalculators: CalcLink[] = [
  {
    href: "/calculators/bah",
    title: "Basic allowance for housing calculator",
    description: "See how your housing allowance can help you afford a home off base.",
    icon: Star,
  },
];

function CalculatorCard({ calc }: { calc: CalcLink }) {
  const Icon = calc.icon;
  return (
    <Link href={calc.href}>
      <Card
        className="group h-full cursor-pointer transition-all hover:border-primary hover:shadow-md"
        data-testid={`card-calc-${calc.href.split("/").pop()}`}
      >
        <CardContent className="flex h-full flex-col p-6">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="font-semibold">{calc.title}</h3>
          <p className="mt-2 flex-1 text-sm text-muted-foreground">{calc.description}</p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
            Open calculator
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function CalculatorsHub() {
  usePageView("/calculators");

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Mortgage Calculators — Affordability, Payments, Refinance & More"
        description="Free mortgage calculators from Homiquity: home affordability, monthly payment, refinance, rent vs. buy, amortization, home equity, payoff, down payment, and VA/BAH — no sign-up required."
        canonical="/calculators"
      />
      <PageShell width="wide">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" data-testid="text-page-title">
            Mortgage Calculators
          </h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
            Run the numbers on every part of your homebuying journey — free, instant, and no
            sign-up required.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {generalCalculators.map((calc) => (
            <CalculatorCard key={calc.href} calc={calc} />
          ))}
        </div>

        <div className="mt-14">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Star className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight" data-testid="text-military-heading">
                Active-duty service members
              </h2>
              <p className="text-sm text-muted-foreground">Tools built for the VA loan benefit</p>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {militaryCalculators.map((calc) => (
              <CalculatorCard key={calc.href} calc={calc} />
            ))}
          </div>
        </div>
      </PageShell>
    </div>
  );
}
