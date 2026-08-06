import { CreditCard, DollarSign, Home, Info, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/formatters";
import type { EligibilityContext } from "./types";

/**
 * Sticky bar pinning the terms every offer below is priced against. The
 * tooltip carries the compensation-neutrality statement — the borrower's
 * choice between options does not change what the broker earns.
 */
export function EligibilityContextBar({ eligibility }: { eligibility: EligibilityContext }) {
  return (
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
              <Button variant="ghost" size="icon" aria-label="More information" data-testid="button-info-tooltip">
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
  );
}
