import { useState } from "react";
import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign,
  Percent,
  Calendar,
  Home,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Info,
  Check,
  AlertTriangle,
  Shield,
  Clock,
  TrendingDown,
  Zap,
  Lock,
  RefreshCw,
  ArrowRight,
} from "lucide-react";

interface LenderOffer {
  id: string;
  offerId: string;
  lenderName: string;
  lenderCode: string;
  productName: string;
  rate: number;
  apr: number;
  points: number;
  monthlyPayment: number;
  cashToClose: number;
  lockTerm: number;
  estimatedCloseTime: string;
  labels: string[];
  fees: {
    origination: number;
    underwriting: number;
    appraisal: number;
    title: number;
    other: number;
  };
  conditions: string[];
  totalCost3yr: number;
  totalCost5yr: number;
}

interface EligibilityContext {
  isValid: boolean;
  snapshotId: string;
  loanAmount: number;
  loanType: string;
  occupancy: string;
  creditTier: string;
  lockPeriod: number;
  cocStatus: "CLEAR" | "PENDING" | "MATERIAL_CHANGE";
  lastUpdated: string;
}

const mockEligibility: EligibilityContext = {
  isValid: true,
  snapshotId: "SNAP-2026-001234",
  loanAmount: 425000,
  loanType: "Conventional 30-Year Fixed",
  occupancy: "Primary Residence",
  creditTier: "740-759",
  lockPeriod: 30,
  cocStatus: "CLEAR",
  lastUpdated: "2026-01-25T14:30:00Z",
};

const mockOffers: LenderOffer[] = [
  {
    id: "offer-1",
    offerId: "OFF-2026-0001",
    lenderName: "United Wholesale Mortgage",
    lenderCode: "UWM",
    productName: "Conventional 30-Year Fixed",
    rate: 6.625,
    apr: 6.782,
    points: 0,
    monthlyPayment: 2724,
    cashToClose: 18500,
    lockTerm: 30,
    estimatedCloseTime: "25-30 days",
    labels: ["LOWEST_PAYMENT"],
    fees: { origination: 1500, underwriting: 995, appraisal: 550, title: 1200, other: 450 },
    conditions: ["Standard income verification", "Property appraisal required"],
    totalCost3yr: 116364,
    totalCost5yr: 181940,
  },
  {
    id: "offer-2",
    offerId: "OFF-2026-0002",
    lenderName: "Rocket Mortgage",
    lenderCode: "RKT",
    productName: "Conventional 30-Year Fixed",
    rate: 6.500,
    apr: 6.891,
    points: 1.25,
    monthlyPayment: 2686,
    cashToClose: 23812,
    lockTerm: 30,
    estimatedCloseTime: "21-28 days",
    labels: ["LOWEST_TOTAL_COST"],
    fees: { origination: 2000, underwriting: 895, appraisal: 600, title: 1150, other: 500 },
    conditions: ["Standard income verification", "Property appraisal required"],
    totalCost3yr: 120508,
    totalCost5yr: 184972,
  },
  {
    id: "offer-3",
    offerId: "OFF-2026-0003",
    lenderName: "PennyMac",
    lenderCode: "PNY",
    productName: "Conventional 30-Year Fixed",
    rate: 6.750,
    apr: 6.824,
    points: 0,
    monthlyPayment: 2761,
    cashToClose: 17200,
    lockTerm: 30,
    estimatedCloseTime: "18-22 days",
    labels: ["FASTEST_CLOSE"],
    fees: { origination: 1200, underwriting: 795, appraisal: 525, title: 1100, other: 380 },
    conditions: ["Streamlined verification", "Express underwriting available"],
    totalCost3yr: 116596,
    totalCost5yr: 182860,
  },
  {
    id: "offer-4",
    offerId: "OFF-2026-0004",
    lenderName: "loanDepot",
    lenderCode: "LDI",
    productName: "Conventional 30-Year Fixed",
    rate: 6.375,
    apr: 6.952,
    points: 2.0,
    monthlyPayment: 2649,
    cashToClose: 27700,
    lockTerm: 45,
    estimatedCloseTime: "28-35 days",
    labels: ["BEST_SHORT_TERM"],
    fees: { origination: 1800, underwriting: 995, appraisal: 575, title: 1250, other: 580 },
    conditions: ["Standard income verification", "Property appraisal required", "45-day lock recommended"],
    totalCost3yr: 123064,
    totalCost5yr: 186664,
  },
];

const labelConfig: Record<string, { text: string; icon: typeof DollarSign; color: string }> = {
  LOWEST_PAYMENT: { text: "Lowest Monthly Payment", icon: DollarSign, color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  LOWEST_TOTAL_COST: { text: "Lowest Total Cost (5 yrs)", icon: TrendingDown, color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  BEST_SHORT_TERM: { text: "Best Short-Term Option", icon: Zap, color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  FASTEST_CLOSE: { text: "Fastest Closing", icon: Clock, color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
};

function formatRate(rate: number): string {
  return rate.toFixed(3) + "%";
}

function calculateBreakeven(pointsCost: number, monthlySavings: number): number {
  if (monthlySavings <= 0) return Infinity;
  return Math.ceil(pointsCost / monthlySavings);
}

export default function BorrowerDealComparison() {
  const [showPoints, setShowPoints] = useState(false);
  const [expandedOffers, setExpandedOffers] = useState<Set<string>>(new Set());
  const [compareOffers, setCompareOffers] = useState<string[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<LenderOffer | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [attestationChecked, setAttestationChecked] = useState(false);
  const [offerLocked, setOfferLocked] = useState(false);
  const { toast } = useToast();

  const eligibility = mockEligibility;
  const offers = mockOffers;

  const toggleExpanded = (offerId: string) => {
    const newExpanded = new Set(expandedOffers);
    if (newExpanded.has(offerId)) {
      newExpanded.delete(offerId);
    } else {
      newExpanded.add(offerId);
    }
    setExpandedOffers(newExpanded);
  };

  const toggleCompare = (offerId: string) => {
    if (compareOffers.includes(offerId)) {
      setCompareOffers(compareOffers.filter((id) => id !== offerId));
    } else if (compareOffers.length < 2) {
      setCompareOffers([...compareOffers, offerId]);
    } else {
      toast({
        title: "Comparison Limit",
        description: "You can compare up to 2 offers at a time.",
        variant: "destructive",
      });
    }
  };

  const handleSelectOffer = (offer: LenderOffer) => {
    if (eligibility.cocStatus === "PENDING") {
      toast({
        title: "Selection Not Available",
        description: "We're reviewing changes to your information. Please wait until the review is complete.",
        variant: "destructive",
      });
      return;
    }
    setSelectedOffer(offer);
    setShowConfirmModal(true);
    setAttestationChecked(false);
  };

  const isCocBlocked = eligibility.cocStatus === "PENDING";

  const handleConfirmSelection = () => {
    if (!attestationChecked || !selectedOffer) return;
    
    setOfferLocked(true);
    setShowConfirmModal(false);
    toast({
      title: "Offer Selected",
      description: "Your selection has been recorded. Lock confirmation pending.",
    });
  };

  const baseOffer = offers.find((o) => o.points === 0);

  if (!eligibility.isValid || eligibility.cocStatus === "MATERIAL_CHANGE") {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Alert variant="destructive" data-testid="alert-eligibility-invalid">
          <RefreshCw className="h-4 w-4" />
          <AlertTitle>Information Update Required</AlertTitle>
          <AlertDescription>
            We need to refresh your information before showing options. Please contact your loan officer to update your application.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const comparedOffers = offers.filter((o) => compareOffers.includes(o.id));

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-card border-b shadow-sm" data-testid="context-bar">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 md:gap-6">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Loan Amount</p>
                  <p className="font-semibold" data-testid="text-loan-amount">{formatCurrency(eligibility.loanAmount)}</p>
                </div>
              </div>
              <Separator orientation="vertical" className="h-10 hidden md:block" />
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Loan Type</p>
                  <p className="font-semibold text-sm" data-testid="text-loan-type">{eligibility.loanType}</p>
                </div>
              </div>
              <Separator orientation="vertical" className="h-10 hidden md:block" />
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Occupancy</p>
                  <p className="font-semibold text-sm" data-testid="text-occupancy">{eligibility.occupancy}</p>
                </div>
              </div>
              <Separator orientation="vertical" className="h-10 hidden md:block" />
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Credit Tier</p>
                  <p className="font-semibold" data-testid="text-credit-tier">{eligibility.creditTier}</p>
                </div>
              </div>
              <Separator orientation="vertical" className="h-10 hidden md:block" />
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Lock Period</p>
                  <p className="font-semibold" data-testid="text-lock-period">{eligibility.lockPeriod} days</p>
                </div>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-info-tooltip">
                  <Info className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs p-4">
                <p className="text-sm">
                  These options are based on your verified financial information and current market pricing. 
                  Your broker's compensation does not change based on which option you choose.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {eligibility.cocStatus === "PENDING" && (
          <Alert className="mb-6" variant="destructive" data-testid="alert-coc-pending">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Review in Progress</AlertTitle>
            <AlertDescription>
              We're reviewing potential changes to your financial information. You can view offers but cannot lock a rate until the review is complete.
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2" data-testid="text-page-title">Your Loan Options</h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Compare your personalized offers and select the best option for your situation.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Switch
              checked={showPoints}
              onCheckedChange={setShowPoints}
              id="points-toggle"
              data-testid="switch-show-points"
            />
            <Label htmlFor="points-toggle" className="cursor-pointer">
              Show options with points
            </Label>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Points are upfront fees you pay to lower your interest rate. Toggle this to see options that include buying down your rate.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          {compareOffers.length > 0 && (
            <Badge variant="secondary" data-testid="badge-compare-count">
              {compareOffers.length} selected for comparison
            </Badge>
          )}
        </div>

        {compareOffers.length === 2 && (
          <Card className="mb-6" data-testid="card-comparison">
            <CardHeader>
              <CardTitle className="text-lg">Side-by-Side Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4">Feature</th>
                      {comparedOffers.map((offer) => (
                        <th key={offer.id} className="text-center py-2 px-4">
                          {offer.lenderCode}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 pr-4 text-muted-foreground">Interest Rate</td>
                      {comparedOffers.map((offer) => (
                        <td key={offer.id} className="text-center py-2 px-4 font-medium">{formatRate(offer.rate)}</td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4 text-muted-foreground">APR</td>
                      {comparedOffers.map((offer) => (
                        <td key={offer.id} className="text-center py-2 px-4">{formatRate(offer.apr)}</td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4 text-muted-foreground">Monthly Payment</td>
                      {comparedOffers.map((offer) => (
                        <td key={offer.id} className="text-center py-2 px-4 font-medium">{formatCurrency(offer.monthlyPayment)}</td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4 text-muted-foreground">Points</td>
                      {comparedOffers.map((offer) => (
                        <td key={offer.id} className="text-center py-2 px-4">{offer.points > 0 ? offer.points.toFixed(2) : "None"}</td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4 text-muted-foreground">Cash to Close</td>
                      {comparedOffers.map((offer) => (
                        <td key={offer.id} className="text-center py-2 px-4">{formatCurrency(offer.cashToClose)}</td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4 text-muted-foreground">Total Cost @ 3 Years</td>
                      {comparedOffers.map((offer) => (
                        <td key={offer.id} className="text-center py-2 px-4">{formatCurrency(offer.totalCost3yr)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 text-muted-foreground">Total Cost @ 5 Years</td>
                      {comparedOffers.map((offer) => (
                        <td key={offer.id} className="text-center py-2 px-4">{formatCurrency(offer.totalCost5yr)}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setCompareOffers([])} data-testid="button-clear-comparison">
                  Clear Comparison
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {offers
            .filter((offer) => showPoints || offer.points === 0)
            .map((offer) => {
              const label = offer.labels[0];
              const labelInfo = label ? labelConfig[label] : null;
              const LabelIcon = labelInfo?.icon || Check;
              const isExpanded = expandedOffers.has(offer.id);
              const isComparing = compareOffers.includes(offer.id);
              const isSelected = offerLocked && selectedOffer?.id === offer.id;
              const isDisabled = offerLocked && selectedOffer?.id !== offer.id;

              const breakevenMonths = baseOffer && offer.points > 0
                ? calculateBreakeven(
                    offer.points * eligibility.loanAmount / 100,
                    baseOffer.monthlyPayment - offer.monthlyPayment
                  )
                : 0;

              return (
                <Card
                  key={offer.id}
                  className={`transition-all ${isSelected ? "ring-2 ring-primary" : ""} ${isDisabled ? "opacity-60" : ""}`}
                  data-testid={`card-offer-${offer.offerId}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        {labelInfo && (
                          <Badge className={labelInfo.color} data-testid={`badge-label-${offer.id}`}>
                            <LabelIcon className="h-3 w-3 mr-1" />
                            {labelInfo.text}
                          </Badge>
                        )}
                        {isSelected && (
                          <Badge variant="default" className="bg-primary">
                            <Lock className="h-3 w-3 mr-1" />
                            Pending Lock
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isComparing}
                          onCheckedChange={() => toggleCompare(offer.id)}
                          disabled={isDisabled || (compareOffers.length >= 2 && !isComparing)}
                          data-testid={`checkbox-compare-${offer.id}`}
                        />
                        <Label className="text-sm text-muted-foreground">Compare</Label>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Interest Rate</p>
                        <p className="text-2xl font-bold" data-testid={`text-rate-${offer.id}`}>{formatRate(offer.rate)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">APR</p>
                        <p className="text-lg font-semibold text-muted-foreground" data-testid={`text-apr-${offer.id}`}>{formatRate(offer.apr)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Monthly Payment</p>
                        <p className="text-2xl font-bold" data-testid={`text-payment-${offer.id}`}>{formatCurrency(offer.monthlyPayment)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Cash to Close</p>
                        <p className="text-lg font-semibold" data-testid={`text-cash-to-close-${offer.id}`}>{formatCurrency(offer.cashToClose)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
                      {offer.points > 0 && (
                        <div className="flex items-center gap-1">
                          <Percent className="h-4 w-4" />
                          <span data-testid={`text-points-${offer.id}`}>{offer.points} points ({formatCurrency(offer.points * eligibility.loanAmount / 100)})</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{offer.lockTerm}-day lock</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{offer.estimatedCloseTime}</span>
                      </div>
                    </div>

                    {showPoints && offer.points > 0 && baseOffer && (
                      <div className="p-3 bg-muted/50 rounded-lg mb-4" data-testid={`section-points-analysis-${offer.id}`}>
                        <p className="text-sm font-medium mb-2">Points Analysis</p>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Points Cost</p>
                            <p className="font-medium">{formatCurrency(offer.points * eligibility.loanAmount / 100)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Monthly Savings</p>
                            <p className="font-medium">{formatCurrency(baseOffer.monthlyPayment - offer.monthlyPayment)}/mo</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Break-even</p>
                            <p className="font-medium">{breakevenMonths === Infinity ? "N/A" : `${breakevenMonths} months`}</p>
                          </div>
                        </div>
                        {breakevenMonths > 60 && breakevenMonths !== Infinity && (
                          <Alert className="mt-3" variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              This option may not make sense if you refinance or sell earlier than {breakevenMonths} months.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}

                    <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(offer.id)}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full justify-between" data-testid={`button-expand-${offer.id}`}>
                          <span>View Details</span>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-4 space-y-4">
                        <div>
                          <p className="text-sm font-medium mb-2">Fee Breakdown</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Origination</span>
                              <span>{formatCurrency(offer.fees.origination)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Underwriting</span>
                              <span>{formatCurrency(offer.fees.underwriting)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Appraisal</span>
                              <span>{formatCurrency(offer.fees.appraisal)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Title</span>
                              <span>{formatCurrency(offer.fees.title)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Other</span>
                              <span>{formatCurrency(offer.fees.other)}</span>
                            </div>
                          </div>
                        </div>
                        <Separator />
                        <div>
                          <p className="text-sm font-medium mb-2">Conditions</p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {offer.conditions.map((condition, idx) => (
                              <li key={idx} className="flex items-center gap-2">
                                <Check className="h-3 w-3 text-green-500" />
                                {condition}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <Separator />
                        <div>
                          <p className="text-sm font-medium mb-2">Lender</p>
                          <p className="text-sm text-muted-foreground">{offer.lenderName}</p>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button
                      className="w-full"
                      onClick={() => handleSelectOffer(offer)}
                      disabled={isDisabled || isCocBlocked}
                      data-testid={`button-select-${offer.id}`}
                    >
                      {isSelected ? (
                        <>
                          <Lock className="h-4 w-4 mr-2" />
                          Selected - Pending Lock
                        </>
                      ) : (
                        <>
                          Select This Option
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
        </div>

        {offerLocked && selectedOffer && (
          <Card className="mt-6 border-primary" data-testid="card-next-steps">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                What Happens Next
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">1</div>
                  <div>
                    <p className="font-medium">Lock Confirmation</p>
                    <p className="text-sm text-muted-foreground">Your broker will confirm your rate lock with the lender.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-medium">2</div>
                  <div>
                    <p className="font-medium">Loan Estimate</p>
                    <p className="text-sm text-muted-foreground">You'll receive an official Loan Estimate within 3 business days.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-medium">3</div>
                  <div>
                    <p className="font-medium">Document Collection</p>
                    <p className="text-sm text-muted-foreground">We'll guide you through providing any additional documents needed.</p>
                  </div>
                </li>
              </ol>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-md" data-testid="dialog-confirm-selection">
          <DialogHeader>
            <DialogTitle>Confirm Your Selection</DialogTitle>
            <DialogDescription>
              Please review your selected option before proceeding.
            </DialogDescription>
          </DialogHeader>
          {selectedOffer && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Interest Rate</p>
                    <p className="font-bold text-lg">{formatRate(selectedOffer.rate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Monthly Payment</p>
                    <p className="font-bold text-lg">{formatCurrency(selectedOffer.monthlyPayment)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cash to Close</p>
                    <p className="font-medium">{formatCurrency(selectedOffer.cashToClose)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Lock Term</p>
                    <p className="font-medium">{selectedOffer.lockTerm} days</p>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <Checkbox
                  id="attestation"
                  checked={attestationChecked}
                  onCheckedChange={(checked) => setAttestationChecked(checked === true)}
                  data-testid="checkbox-attestation"
                />
                <Label htmlFor="attestation" className="text-sm leading-relaxed cursor-pointer">
                  I understand I reviewed multiple options and selected this one. I confirm that my financial information has not changed since my application.
                </Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmModal(false)} data-testid="button-cancel-selection">
              Go Back
            </Button>
            <Button
              onClick={handleConfirmSelection}
              disabled={!attestationChecked}
              data-testid="button-confirm-selection"
            >
              <Check className="h-4 w-4 mr-2" />
              Confirm Selection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
