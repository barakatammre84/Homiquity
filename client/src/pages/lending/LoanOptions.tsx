import { useState, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";

import { ConsentGateCard } from "@/components/ConsentGateCard";
import { TermTooltip } from "@/components/TermTooltip";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency, formatPercent, getLoanTypeLabel } from "@/lib/formatters";
import type { LoanApplication, LoanOption } from "@shared/schema";
import {
  CheckCircle2,
  Star,
  Lock,
  TrendingUp,
  Percent,
  FileText,
  ArrowRight,
  Shield,
  Clock,
  AlertCircle,
  Download,
  Loader2,
  Rocket,
  Upload,
  UserCheck,
} from "lucide-react";

interface LoanOptionsData {
  application: LoanApplication;
  options: LoanOption[];
}

interface PricingBreakdown {
  finalRate: number;
  baseRate: number;
  adjustments: {
    creditScoreAndLtv: number;
    propertyType: number;
    condo: number;
    firstTimeBuyerWaiver: number;
  };
  totalLlpaPoints: number;
  rateEquivalent: number;
  llpaFeeAmount: number;
  inputs: { creditScore: number; ltv: number; loanAmount: number };
}

const ADJUSTMENT_LABELS: Record<keyof PricingBreakdown["adjustments"], string> = {
  creditScoreAndLtv: "Credit score & down payment (LLPA grid)",
  propertyType: "Property / occupancy type",
  condo: "Condo adjustment",
  firstTimeBuyerWaiver: "First-time buyer waiver",
};

/** "Why this rate?" — deterministic LLPA decomposition of the quoted rate. */
function RateBreakdown({ optionId }: { optionId: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery<PricingBreakdown>({
    queryKey: ["/api/loan-options", optionId, "pricing-breakdown"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/loan-options/${optionId}/pricing-breakdown`);
      return res.json();
    },
    enabled: open,
    staleTime: 60_000,
  });

  const fmtPts = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(3)} pts`;

  return (
    <div className="w-full">
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setOpen((o) => !o)}
        data-testid={`button-rate-breakdown-${optionId}`}
      >
        <Percent className="mr-2 h-4 w-4" />
        {open ? "Hide rate details" : "Why this rate?"}
      </Button>
      {open && (
        <div className="mt-3 rounded-lg border bg-muted/30 p-4 text-left text-sm" data-testid={`section-rate-breakdown-${optionId}`}>
          {isLoading || !data ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base market rate</span>
                <span className="font-medium">{data.baseRate.toFixed(3)}%</span>
              </div>
              {(Object.keys(data.adjustments) as (keyof PricingBreakdown["adjustments"])[])
                .filter((k) => data.adjustments[k] !== 0)
                .map((k) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{ADJUSTMENT_LABELS[k]}</span>
                    <span className="font-medium">{fmtPts(data.adjustments[k])}</span>
                  </div>
                ))}
              <div className="flex justify-between border-t pt-1.5">
                <span className="text-muted-foreground">
                  Total adjustments ({data.totalLlpaPoints.toFixed(3)} pts ≈ rate)
                </span>
                <span className="font-medium">
                  {data.rateEquivalent > 0 ? "+" : ""}
                  {data.rateEquivalent.toFixed(3)}%
                </span>
              </div>
              <div className="flex justify-between border-t pt-1.5 text-base">
                <span className="font-semibold">Your rate</span>
                <span className="font-bold text-primary" data-testid={`text-final-rate-${optionId}`}>
                  {data.finalRate.toFixed(3)}%
                </span>
              </div>
              <p className="pt-1 text-xs text-muted-foreground">
                Based on your {data.inputs.creditScore} credit score and {data.inputs.ltv}%
                loan-to-value. Adjustments follow standard GSE loan-level price adjustment
                grids — no discretion, no markup by profile.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PitiRow({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{formatCurrency(value)}</span>
    </div>
  );
}

/**
 * Radical-transparency payment panel: the headline number is the FULL monthly
 * payment (the engine computes PITI, not just P&I), itemized below so every
 * dollar is accounted for. Rows without escrow estimates (legacy options) fall
 * back to the plain "Principal & Interest" caption rather than implying a
 * breakdown we don't have.
 */
function MonthlyPaymentPanel({ option }: { option: LoanOption }) {
  const amount = (v: string | null) => (v == null ? 0 : parseFloat(v));
  const escrowed = amount(option.propertyTax) > 0 || amount(option.homeInsurance) > 0;

  return (
    <div>
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Monthly Payment</p>
        <p className="text-4xl font-bold" data-testid={`text-monthly-payment-${option.loanType}`}>
          {formatCurrency(option.monthlyPayment)}
        </p>
        <p className="text-xs text-muted-foreground">
          {escrowed ? (
            <>
              Full <TermTooltip term="piti" /> — taxes &amp; insurance included
            </>
          ) : (
            "Principal & Interest"
          )}
        </p>
      </div>

      {escrowed && (
        <div
          className="mt-4 space-y-2 rounded-lg bg-muted/50 p-4"
          data-testid={`section-piti-${option.loanType}`}
        >
          <PitiRow label="Principal & Interest" value={option.principalAndInterest} />
          {amount(option.propertyTax) > 0 && (
            <PitiRow label="Property taxes" value={option.propertyTax!} />
          )}
          {amount(option.homeInsurance) > 0 && (
            <PitiRow label="Homeowners insurance" value={option.homeInsurance!} />
          )}
          {amount(option.pmi) > 0 && (
            <PitiRow
              label={<TermTooltip term="pmi">Mortgage insurance</TermTooltip>}
              value={option.pmi!}
            />
          )}
          {amount(option.hoaFees) > 0 && <PitiRow label="HOA dues" value={option.hoaFees!} />}
          <p className="pt-1 text-xs text-muted-foreground">
            Taxes &amp; insurance are estimates, collected monthly in <TermTooltip term="escrow" />.
          </p>
        </div>
      )}
    </div>
  );
}

interface MarketOffer {
  lenderName: string;
  lenderCode: string;
  lenderId: string;
  productId: string;
  productName: string;
  productType: string;
  loanTerm: number;
  baseRate: number;
  adjustedRate: number;
  lockTerm: number;
  pricingBreakdown: {
    baseRate: number;
    llpaAdjustment: number;
    lockTermAdjustment: number;
    lenderAdjustments: { name: string; value: number }[];
    totalAdjustments: number;
    finalRate: number;
  };
  estimatedMonthlyPI: number;
  estimatedMonthlyMI: number;
  estimatedMonthlyTotal: number;
  labels: string[];
}

interface MarketOffersResponse {
  status: "PRICED" | "NO_ACTIVE_RATE_SHEETS" | "INSUFFICIENT_PROFILE" | "UNPRICEABLE_PROFILE";
  qualifier: "PRELIMINARY" | "VERIFIED";
  indicative: boolean;
  pricedAt: string;
  lockTermDays: number;
  assumptions: string[];
  missingItems: string[];
  offers: MarketOffer[];
}

const OFFER_LABELS: Record<string, string> = {
  LOWEST_RATE: "Lowest rate",
  LOWEST_PAYMENT: "Lowest payment",
};

const fmtRatePts = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(3)}%`;

/**
 * Live market pricing (Binding Contract 2): the borrower's profile priced
 * against active wholesale rate sheets, with the full deterministic rate
 * decomposition. Indicative until the profile is verified — locking stays
 * behind verification, so estimates are never dressed up as commitments.
 */
function MarketPricingSection({ market }: { market: MarketOffersResponse }) {
  const [openOffer, setOpenOffer] = useState<string | null>(null);

  if (market.status !== "PRICED") return null;

  const pricedTime = new Date(market.pricedAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const lenderCount = new Set(market.offers.map((o) => o.lenderId)).size;

  return (
    <div className="mb-12" data-testid="section-market-pricing">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">Live Market Pricing</h2>
            {market.indicative && (
              <Badge variant="outline" className="border-border text-warning-subtle-foreground">
                Indicative
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Your profile priced against {lenderCount} wholesale lender rate sheets
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Priced {pricedTime} · {market.lockTermDays}-day lock</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {market.offers.map((offer) => {
          const key = `${offer.lenderId}-${offer.productId}`;
          const bd = offer.pricingBreakdown;
          return (
            <Card
              key={key}
              className={offer.labels.includes("LOWEST_RATE") ? "ring-2 ring-primary" : ""}
              data-testid={`card-market-offer-${offer.productType.toLowerCase()}`}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{offer.lenderName}</CardTitle>
                    <CardDescription>{offer.productName}</CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {offer.labels.map((l) => (
                      <Badge key={l} variant="secondary">{OFFER_LABELS[l] ?? l}</Badge>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Rate</p>
                    <p className="text-2xl font-bold" data-testid={`text-offer-rate-${key}`}>
                      {offer.adjustedRate.toFixed(3)}%
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Est. monthly</p>
                    <p className="text-2xl font-bold">{formatCurrency(String(offer.estimatedMonthlyTotal))}</p>
                    <p className="text-xs text-muted-foreground">
                      P&I {formatCurrency(String(offer.estimatedMonthlyPI))}
                      {offer.estimatedMonthlyMI > 0 && <> + MI {formatCurrency(String(offer.estimatedMonthlyMI))}</>}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setOpenOffer(openOffer === key ? null : key)}
                  data-testid={`button-offer-breakdown-${key}`}
                >
                  <Percent className="mr-2 h-4 w-4" />
                  {openOffer === key ? "Hide rate details" : "Why this rate?"}
                </Button>
                {openOffer === key && (
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sheet base rate</span>
                        <span className="font-medium">{bd.baseRate.toFixed(3)}%</span>
                      </div>
                      {bd.llpaAdjustment !== 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Credit score & LTV (LLPA)</span>
                          <span className="font-medium">{fmtRatePts(bd.llpaAdjustment)}</span>
                        </div>
                      )}
                      {bd.lockTermAdjustment !== 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{offer.lockTerm}-day lock</span>
                          <span className="font-medium">{fmtRatePts(bd.lockTermAdjustment)}</span>
                        </div>
                      )}
                      {bd.lenderAdjustments.map((a) => (
                        <div key={a.name} className="flex justify-between">
                          <span className="text-muted-foreground">{a.name}</span>
                          <span className="font-medium">{fmtRatePts(a.value)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t pt-1.5 text-base">
                        <span className="font-semibold">Final rate</span>
                        <span className="font-bold text-primary">{bd.finalRate.toFixed(3)}%</span>
                      </div>
                    </div>
                  </div>
                )}

                {market.indicative && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    <span>Verify your income & assets to make this rate lockable</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 space-y-0.5">
        {market.assumptions.map((a) => (
          <p key={a} className="text-xs text-muted-foreground">· {a}</p>
        ))}
      </div>
    </div>
  );
}

export default function LoanOptions() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<LoanOptionsData>({
    queryKey: ['/api/loan-applications', id, 'options'],
    enabled: !!id,
  });

  // Live wholesale pricing — repriced server-side on every request from the
  // active rate sheets, so vendor-fed market updates show up automatically.
  const { data: market } = useQuery<MarketOffersResponse>({
    queryKey: ['/api/loan-applications', id, 'offers'],
    enabled: !!id,
    staleTime: 60_000,
  });
  const marketPriced = market?.status === "PRICED";

  // Reg Z anti-steering: the loan-options disclosure must be acknowledged
  // before a rate can be locked. The server enforces this on the lock
  // endpoint; this query drives the disclosure card and button state.
  const { data: steeringConsent } = useQuery<{ hasConsent: boolean }>({
    queryKey: ['/api/consents/check', id, 'anti_steering'],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/consents/check/${id}/anti_steering`);
      return res.json();
    },
    enabled: !!id,
  });
  const steeringAcknowledged = steeringConsent?.hasConsent === true;

  const lockRateMutation = useMutation({
    mutationFn: async (optionId: string) => {
      return await apiRequest("POST", `/api/loan-options/${optionId}/lock`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loan-applications', id, 'options'] });
      toast({
        title: "Rate Locked!",
        description: "Your rate has been locked for 30 days.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to lock rate. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <Skeleton className="mx-auto h-8 w-64" />
            <Skeleton className="mx-auto mt-4 h-4 w-96" />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-96 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <h2 className="mt-4 text-xl font-semibold">Unable to load loan options</h2>
          <p className="mt-2 text-muted-foreground">Please try again later.</p>
          <Link href="/apply">
            <Button className="mt-6">Start New Application</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { application, options } = data;
  const preApprovalAmount = application.preApprovalAmount
    ? formatCurrency(application.preApprovalAmount)
    : formatCurrency(application.purchasePrice || "0");
  // Only a pre-approved (or further-along) file gets the congratulations
  // header. Anything still in front of an underwriter gets the honest state.
  const awaitingDecision = ["draft", "submitted", "analyzing", "under_review", "denied"].includes(
    application.status,
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-b from-primary/5 to-background py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {awaitingDecision ? (
              <>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-warning-subtle px-4 py-1.5">
                  <Clock className="h-4 w-4 text-warning-subtle-foreground" />
                  <span className="text-sm font-medium text-warning-subtle-foreground">
                    Under Review
                  </span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Your application is with our underwriting team
                </h1>
                <p className="mt-4 text-muted-foreground" data-testid="text-under-review">
                  A licensed underwriter is reviewing your numbers — check your dashboard for what
                  was flagged. The scenarios below are estimates, not offers.
                </p>
              </>
            ) : (
              <>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-success-subtle px-4 py-1.5">
                  <CheckCircle2 className="h-4 w-4 text-success-subtle-foreground" />
                  <span className="text-sm font-medium text-success-subtle-foreground">
                    Pre-Approved
                  </span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Congratulations! You're pre-approved for
                </h1>
                <p className="mt-4 text-5xl font-bold text-primary" data-testid="text-preapproval-amount">
                  {preApprovalAmount}
                </p>
                <p className="mt-4 text-muted-foreground">
                  Compare your loan options below and lock in your rate today.
                </p>
              </>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <GenerateLetterButton applicationId={application.id} status={application.status} />
              <PreQualLetterButton applicationId={application.id} status={application.status} />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {!steeringAcknowledged && (
          <div className="mb-8 flex justify-center" data-testid="section-anti-steering">
            <ConsentGateCard
              applicationId={id!}
              consentType="anti_steering"
              onConsented={() =>
                queryClient.invalidateQueries({ queryKey: ['/api/consents/check', id, 'anti_steering'] })
              }
            />
          </div>
        )}
        {market && <MarketPricingSection market={market} />}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{marketPriced ? "Payment Scenarios" : "Your Loan Options"}</h2>
            <p className="text-muted-foreground">
              {marketPriced
                ? "Illustrative payment breakdowns by loan program"
                : "Based on your profile, here are your best options"}
            </p>
          </div>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
            <Shield className="h-4 w-4" />
            <span>Rates as of today</span>
          </div>
        </div>

        {options.length === 0 ? (
          <Card className="p-12 text-center">
            <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Analyzing Your Application</h3>
            <p className="mt-2 text-muted-foreground">
              Your scenarios are being computed against underwriting guidelines. This usually takes less than a minute.
            </p>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {options.map((option) => (
              <Card
                key={option.id}
                className={`relative overflow-hidden ${
                  option.isRecommended ? "ring-2 ring-primary" : ""
                }`}
                data-testid={`card-loan-option-${option.loanType}`}
              >
                {option.isRecommended && (
                  <div className="absolute right-0 top-0 rounded-bl-lg bg-primary px-3 py-1">
                    <div className="flex items-center gap-1 text-xs font-medium text-primary-foreground">
                      <Star className="h-3 w-3" />
                      Recommended
                    </div>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">
                        {getLoanTypeLabel(option.loanType)}
                      </CardTitle>
                      <CardDescription>
                        {option.loanTerm}-year {parseFloat(option.points || "0") > 0 ? "with points" : "no points"}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">
                      {option.loanTerm} yr
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  <MonthlyPaymentPanel option={option} />

                  <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Percent className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Rate</span>
                      </div>
                      <p className="text-lg font-semibold">{formatPercent(option.interestRate)}</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <TermTooltip term="apr" className="text-sm text-muted-foreground" />
                      </div>
                      <p className="text-lg font-semibold">{formatPercent(option.apr)}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Loan Amount</span>
                      <span className="font-medium">{formatCurrency(option.loanAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Down Payment</span>
                      <span className="font-medium">
                        {formatCurrency(option.downPaymentAmount || "0")} ({option.downPaymentPercent}%)
                      </span>
                    </div>
                    {parseFloat(option.points || "0") > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <TermTooltip term="points" className="text-muted-foreground">Points</TermTooltip>
                        <span className="font-medium">
                          {option.points} ({formatCurrency(option.pointsCost || "0")})
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <TermTooltip term="closingCosts" className="text-muted-foreground">Closing Costs</TermTooltip>
                      <span className="font-medium">{formatCurrency(option.closingCosts || "0")}</span>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex items-center justify-between">
                        <TermTooltip term="cashToClose" className="font-medium">Cash to Close</TermTooltip>
                        <span className="text-lg font-bold text-primary">
                          {formatCurrency(option.cashToClose || "0")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {option.pmi && parseFloat(option.pmi) > 0 && (
                    <div className="rounded-lg border border-border bg-warning-subtle p-3">
                      <p className="text-xs text-warning-subtle-foreground">
                        {option.loanType === "fha" ? (
                          <>
                            Includes {formatCurrency(option.pmi)}/mo FHA mortgage insurance (MIP),
                            which usually lasts the life of the loan. Many buyers refinance out of
                            it after reaching 20% equity.
                          </>
                        ) : (
                          <>
                            Includes {formatCurrency(option.pmi)}/mo{" "}
                            <TermTooltip term="pmi" showIcon={false} />. It's temporary — you can
                            request removal once you reach 20% equity.
                          </>
                        )}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {option.isLocked ? (
                      <Button className="w-full" variant="secondary" disabled>
                        <Lock className="mr-2 h-4 w-4" />
                        Rate Locked
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => lockRateMutation.mutate(option.id)}
                        disabled={lockRateMutation.isPending || !steeringAcknowledged}
                        title={!steeringAcknowledged ? "Review the loan options disclosure above first" : undefined}
                        data-testid={`button-lock-rate-${option.loanType}`}
                      >
                        <Lock className="mr-2 h-4 w-4" />
                        {lockRateMutation.isPending ? "Locking..." : "Lock This Rate"}
                      </Button>
                    )}
                    <RateBreakdown optionId={option.id} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-12 space-y-6">
          <div>
            <h2 className="text-2xl font-bold" data-testid="text-next-steps-heading">What Happens Next</h2>
            <p className="text-muted-foreground mt-1">
              {options.some(o => o.isLocked)
                ? "Great, your rate is locked. Complete these steps to finalize your mortgage."
                : "Lock your preferred rate above, then complete these steps to move forward."}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card data-testid="card-next-step-journey">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <Rocket className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">Your Journey</h3>
                    <p className="text-xs text-muted-foreground">Personalized checklist to closing</p>
                  </div>
                </div>
                <Link href="/onboarding">
                  <Button variant="outline" size="sm" className="w-full gap-2 mt-3" data-testid="button-next-journey">
                    View Journey
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card data-testid="card-next-step-documents">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <Upload className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">Upload Documents</h3>
                    <p className="text-xs text-muted-foreground">Pay stubs, tax returns, bank statements</p>
                  </div>
                </div>
                <Link href="/documents">
                  <Button variant="outline" size="sm" className="w-full gap-2 mt-3" data-testid="button-next-documents">
                    Upload Documents
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card data-testid="card-next-step-verification">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <UserCheck className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">Verify Identity</h3>
                    <p className="text-xs text-muted-foreground">Quick compliance check</p>
                  </div>
                </div>
                <Link href="/identity-verification">
                  <Button variant="outline" size="sm" className="w-full gap-2 mt-3" data-testid="button-next-verification">
                    Verify Identity
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center pt-2">
            <Link href="/dashboard">
              <Button className="gap-2" data-testid="button-go-to-dashboard">
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function PreQualLetterButton({ applicationId, status }: { applicationId: string; status: string }) {
  const { toast } = useToast();

  const prequalStatusQuery = useQuery<{ hasLetter: boolean; letterNumber?: string; estimatedAmount?: string }>({
    queryKey: ["/api/loan-applications", applicationId, "prequal-status"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/loan-applications/${applicationId}/generate-prequal`);
      return res.json();
    },
    onSuccess: (data: { letterNumber: string }) => {
      toast({ title: "Letter Generated", description: `Pre-qualification letter #${data.letterNumber} is ready.` });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-applications", applicationId, "prequal-status"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate pre-qualification letter.", variant: "destructive" });
    },
  });

  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/loan-applications/${applicationId}/prequal-pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pre-qualification-letter.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "Failed to download letter.", variant: "destructive" });
    }
  };

  const validStatuses = ["submitted", "analyzing", "pre_approved", "verified", "underwriting", "approved"];
  if (!validStatuses.includes(status)) return null;

  if (status === "pre_approved") return null;

  const hasLetter = prequalStatusQuery.data?.hasLetter;

  return (
    <>
      {!hasLetter && (
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          variant="outline"
          className="gap-2"
          data-testid="button-generate-prequal"
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {generateMutation.isPending ? "Generating..." : "Get Pre-Qualification Letter"}
        </Button>
      )}
      {hasLetter && (
        <Button onClick={handleDownload} variant="outline" className="gap-2" data-testid="button-download-prequal">
          <Download className="h-4 w-4" />
          Download Pre-Qualification Letter
        </Button>
      )}
    </>
  );
}

function GenerateLetterButton({ applicationId, status }: { applicationId: string; status: string }) {
  const { toast } = useToast();

  const letterStatusQuery = useQuery<{ hasLetter: boolean; letterNumber?: string }>({
    queryKey: ["/api/loan-applications", applicationId, "letter-status"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/loan-applications/${applicationId}/generate-letter`);
      return res.json();
    },
    onSuccess: (data: { letterNumber: string }) => {
      toast({ title: "Letter Generated", description: `Pre-approval letter #${data.letterNumber} is ready.` });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-applications", applicationId, "letter-status"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate letter. Please try again.", variant: "destructive" });
    },
  });

  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/loan-applications/${applicationId}/letter-pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pre-approval-letter.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "Failed to download letter.", variant: "destructive" });
    }
  };

  if (status !== "pre_approved") return null;

  const hasLetter = letterStatusQuery.data?.hasLetter;

  return (
    <>
      {!hasLetter && (
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="gap-2"
          data-testid="button-generate-letter"
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {generateMutation.isPending ? "Generating..." : "Generate Pre-Approval Letter"}
        </Button>
      )}
      {hasLetter && (
        <Button onClick={handleDownload} variant="outline" className="gap-2" data-testid="button-download-letter">
          <Download className="h-4 w-4" />
          Download Pre-Approval Letter
        </Button>
      )}
    </>
  );
}
