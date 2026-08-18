import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Lock,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatCurrency } from "@/lib/formatters";
import { calculateBreakeven, formatRate } from "./offerMath";
import { labelConfig, type BorrowerOffer } from "./types";

export interface OfferCardProps {
  offer: BorrowerOffer;
  baseOffer: BorrowerOffer | undefined;
  loanAmount: number;
  showPoints: boolean;
  isExpanded: boolean;
  isComparing: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  isCocBlocked: boolean;
  compareCount: number;
  onToggleExpanded: () => void;
  onToggleCompare: () => void;
  onSelect: () => void;
}

export function OfferCard({
  offer,
  baseOffer,
  loanAmount,
  showPoints,
  isExpanded,
  isComparing,
  isSelected,
  isDisabled,
  isCocBlocked,
  compareCount,
  onToggleExpanded,
  onToggleCompare,
  onSelect,
}: OfferCardProps) {
  const label = offer.labels[0];
  const labelInfo = label ? labelConfig[label] : null;
  const LabelIcon = labelInfo?.icon || Check;

  const breakevenMonths = baseOffer && offer.points > 0
    ? calculateBreakeven(
        offer.points * loanAmount / 100,
        baseOffer.monthlyPayment - offer.monthlyPayment
      )
    : 0;

  return (
    <Card
      className={`transition-all ${isSelected ? "ring-2 ring-primary" : ""} ${isDisabled ? "opacity-60" : ""}`}
      data-testid={`card-offer-${offer.offerId}`}
    >
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg" data-testid={`text-option-label-${offer.id}`}>
              {offer.optionLabel}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{offer.productName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isComparing}
              onCheckedChange={onToggleCompare}
              disabled={isDisabled || (compareCount >= 2 && !isComparing)}
              data-testid={`checkbox-compare-${offer.id}`}
            />
            <Label className="text-sm text-muted-foreground">Compare</Label>
          </div>
        </div>
        {(labelInfo || isSelected) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
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
        )}
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
              <span data-testid={`text-points-${offer.id}`}>{offer.points} points ({formatCurrency(offer.points * loanAmount / 100)})</span>
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
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground">Points Cost</p>
                <p className="font-medium">{formatCurrency(offer.points * loanAmount / 100)}</p>
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

        <Collapsible open={isExpanded} onOpenChange={onToggleExpanded}>
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
                    <Check className="h-3 w-3 text-success-subtle-foreground" />
                    {condition}
                  </li>
                ))}
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
      <CardFooter className="pt-0">
        <Button
          className="w-full"
          onClick={onSelect}
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
}
