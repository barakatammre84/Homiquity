import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Info, RefreshCw } from "lucide-react";
import type { BorrowerOffer } from "./borrowerDealComparison/types";
import { mockEligibility, mockOffers } from "./borrowerDealComparison/fixtures";
import { EligibilityContextBar } from "./borrowerDealComparison/EligibilityContextBar";
import { ComparisonTable } from "./borrowerDealComparison/ComparisonTable";
import { OfferCard } from "./borrowerDealComparison/OfferCard";
import { NextStepsCard } from "./borrowerDealComparison/NextStepsCard";
import { ConfirmSelectionDialog } from "./borrowerDealComparison/ConfirmSelectionDialog";

export default function BorrowerDealComparison() {
  const [showPoints, setShowPoints] = useState(false);
  const [expandedOffers, setExpandedOffers] = useState<Set<string>>(new Set());
  const [compareOffers, setCompareOffers] = useState<string[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<BorrowerOffer | null>(null);
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

  const handleSelectOffer = (offer: BorrowerOffer) => {
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
    <div className="min-h-screen">
      <EligibilityContextBar eligibility={eligibility} />

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
          <ComparisonTable offers={comparedOffers} onClear={() => setCompareOffers([])} />
        )}

        <div className="space-y-4">
          {offers
            .filter((offer) => showPoints || offer.points === 0)
            .map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                baseOffer={baseOffer}
                loanAmount={eligibility.loanAmount}
                showPoints={showPoints}
                isExpanded={expandedOffers.has(offer.id)}
                isComparing={compareOffers.includes(offer.id)}
                isSelected={offerLocked && selectedOffer?.id === offer.id}
                isDisabled={offerLocked && selectedOffer?.id !== offer.id}
                isCocBlocked={isCocBlocked}
                compareCount={compareOffers.length}
                onToggleExpanded={() => toggleExpanded(offer.id)}
                onToggleCompare={() => toggleCompare(offer.id)}
                onSelect={() => handleSelectOffer(offer)}
              />
            ))}
        </div>

        {offerLocked && selectedOffer && <NextStepsCard />}
      </div>

      <ConfirmSelectionDialog
        open={showConfirmModal}
        onOpenChange={setShowConfirmModal}
        offer={selectedOffer}
        attestationChecked={attestationChecked}
        onAttestationChange={setAttestationChecked}
        onConfirm={handleConfirmSelection}
      />
    </div>
  );
}
