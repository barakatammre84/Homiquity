import { Link } from "wouter";
import { usePageView } from "@/hooks/useActivityTracker";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  Home,
  Calculator,
  Shield,
  ChevronRight,
  Lightbulb,
  PiggyBank,
  ArrowRight,
  BookOpen,
  Target,
  HelpCircle,
  CreditCard,
} from "lucide-react";

const JOURNEY_STEPS = [
  {
    step: 1,
    title: "Check Your Readiness",
    description: "Review your credit, savings, and debt-to-income ratio to see where you stand.",
    icon: Target,
    action: "Use Gap Calculator",
    href: "/gap-calculator",
    tips: [
      "Review your credit report for accuracy before applying",
      "Know your current debt-to-income ratio — it's a key underwriting input",
      "Track your credit report for free at AnnualCreditReport.com",
    ],
  },
  {
    step: 2,
    title: "Understand Your Budget",
    description: "Estimate your monthly payment and see how different scenarios affect your budget.",
    icon: Calculator,
    action: "Affordability Calculator",
    href: "/calculators/affordability",
    tips: [
      "The 28/36 rule: housing costs shouldn't exceed 28% of gross income",
      "Remember to factor in property taxes, insurance, and HOA fees",
      "Consider your comfort level with monthly payments, not just the maximum loan amount",
    ],
  },
  {
    step: 3,
    title: "Compare Renting vs. Buying",
    description: "See the real cost comparison of renting versus buying in your area and situation.",
    icon: Home,
    action: "Rent vs. Buy Calculator",
    href: "/calculators/rent-vs-buy",
    tips: [
      "Consider how long you plan to stay — buying typically makes sense after 3-5 years",
      "Factor in home appreciation, tax benefits, and equity building",
      "Don't forget maintenance costs (typically 1-2% of home value per year)",
    ],
  },
  {
    step: 4,
    title: "Find Down Payment Help",
    description: "Explore grants, forgivable loans, and assistance programs that reduce your upfront costs.",
    icon: PiggyBank,
    action: "Explore DPA Programs",
    href: "/down-payment-wizard",
    tips: [
      "Many programs offer 3-5% of the purchase price as grants or forgivable loans",
      "State and local programs may have additional assistance",
      "Some employers offer homebuyer assistance benefits",
    ],
  },
  {
    step: 5,
    title: "Get Pre-Approved",
    description: "Start the pre-approval process to strengthen your position with sellers.",
    icon: Shield,
    action: "Start Pre-Approval",
    href: "/apply",
    tips: [
      "Pre-approval is not a commitment — it shows sellers you have lender backing",
      "A pre-approval letter typically lasts 60-90 days",
      "We use a soft credit pull that won't affect your score",
    ],
  },
  {
    step: 6,
    title: "Start House Hunting",
    description: "Check if specific homes fit your budget using your pre-approval parameters.",
    icon: Home,
    action: "Can I Afford This Home?",
    href: "/afford",
    tips: [
      "Look for homes within your comfortable price range, not your maximum",
      "Use the property comparison tool to review listing details",
      "Consider the neighborhood, schools, and commute — not just the house",
    ],
  },
];

const LOAN_PROGRAMS = [
  {
    name: "Conventional",
    minDown: "3%",
    minCredit: "620",
    pmi: "Required if < 20% down",
    description: "Standard mortgage backed by Fannie Mae or Freddie Mac. Minimum requirements determined during underwriting.",
    color: "bg-info/10 text-info",
  },
  {
    name: "FHA",
    minDown: "3.5%",
    minCredit: "580",
    pmi: "Required for life of loan",
    description: "Government-insured loan with lower credit and down payment requirements. Great for first-time buyers.",
    color: "bg-success/10 text-success-subtle-foreground",
  },
  {
    name: "VA",
    minDown: "0%",
    minCredit: "580",
    pmi: "No PMI required",
    description: "Exclusive to veterans and active military. Zero down payment with no mortgage insurance.",
    color: "bg-primary/10 text-primary",
  },
  {
    name: "USDA",
    minDown: "0%",
    minCredit: "640",
    pmi: "Reduced guarantee fee",
    description: "Zero down payment for eligible rural and suburban areas. Income limits apply.",
    color: "bg-warning/10 text-warning-subtle-foreground",
  },
];

const COMMON_MISTAKES = [
  { title: "Making large purchases before closing", description: "Buying a car or furniture on credit can change your DTI and delay the closing process." },
  { title: "Switching jobs during the process", description: "Lenders want to see stable employment. Changing jobs creates uncertainty." },
  { title: "Skipping the home inspection", description: "An inspection protects you from costly surprises after you move in." },
  { title: "Emptying your savings for the down payment", description: "Lenders want to see reserves. Keep 3-6 months of expenses in the bank." },
  { title: "Opening or closing credit accounts", description: "Any credit changes during the process can trigger a re-pull and delay closing." },
  { title: "Ignoring closing costs", description: "Budget 2-5% of the purchase price for closing costs on top of your down payment." },
];

export default function FirstTimeBuyerHub() {
  usePageView("/first-time-buyer");

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" data-testid="first-time-buyer-hub">
      <SEOHead title="First-Time Homebuyer Guide" description="Everything you need to know about buying your first home. Learn about down payments, credit scores, mortgage types, and the home buying process." />
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground md:text-2xl" data-testid="text-hub-title">First-Time Buyer Hub</h1>
            <p className="text-sm text-muted-foreground">Everything you need to go from renting to owning, step by step.</p>
          </div>
        </div>
      </div>

      <Card className="mb-6 border-primary/20" data-testid="card-cta">
        <CardContent className="py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-foreground">Ready to start your journey?</p>
              <p className="text-sm text-muted-foreground">Get pre-approved in as little as 3 minutes with a soft credit pull.</p>
            </div>
            <Button asChild data-testid="button-get-started">
              <Link href="/apply">
                Get Pre-Approved
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mb-8">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Your Step-by-Step Roadmap
        </h2>
        <div className="space-y-1" data-testid="journey-roadmap">
          {JOURNEY_STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.step} className="flex gap-3" data-testid={`roadmap-step-${step.step}`}>
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground shrink-0 text-sm font-bold">
                    {step.step}
                  </div>
                  {index < JOURNEY_STEPS.length - 1 && <div className="w-0.5 flex-1 min-h-[24px] bg-muted" />}
                </div>
                <div className="flex-1 pb-5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                  <div className="mt-2 space-y-1">
                    {step.tips.map((tip, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <Lightbulb className="h-3 w-3 text-warning-subtle-foreground mt-0.5 shrink-0" />
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="mt-2" asChild data-testid={`button-step-${step.step}`}>
                    <Link href={step.href}>
                      {step.action}
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Understanding Loan Programs
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="loan-programs-grid">
          {LOAN_PROGRAMS.map((program) => (
            <Card key={program.name} data-testid={`card-program-${program.name.toLowerCase()}`}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className={program.color}>{program.name}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{program.description}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-[10px] text-muted-foreground">Min Down</p>
                    <p className="text-sm font-bold text-foreground">{program.minDown}</p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-[10px] text-muted-foreground">Min Credit</p>
                    <p className="text-sm font-bold text-foreground">{program.minCredit}</p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-[10px] text-muted-foreground">PMI</p>
                    <p className="text-[10px] font-medium text-foreground">{program.pmi}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          Common Mistakes to Avoid
        </h2>
        <Card data-testid="card-mistakes">
          <CardContent className="pt-4 pb-3">
            <div className="space-y-3">
              {COMMON_MISTAKES.map((mistake, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="mt-0.5 shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-destructive/10">
                    <span className="text-[10px] font-bold text-destructive">{i + 1}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{mistake.title}</p>
                    <p className="text-xs text-muted-foreground">{mistake.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-bottom-cta">
        <CardContent className="py-6 text-center">
          <GraduationCap className="mx-auto h-8 w-8 text-primary mb-3" />
          <h3 className="font-bold text-foreground mb-1">Ready to take the next step?</h3>
          <p className="text-sm text-muted-foreground mb-4">We'll guide you through the entire process — from pre-approval to closing day.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild data-testid="button-apply-now">
              <Link href="/apply">
                Start Pre-Approval
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
            <Button variant="outline" asChild data-testid="button-learn-more">
              <Link href="/learn">
                Browse Learning Center
                <BookOpen className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
