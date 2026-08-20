import { Link } from "wouter";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import type { LoanApplication } from "@shared/schema";

export interface LoanSummaryCardProps {
  application: LoanApplication;
}

export function LoanSummaryCard({ application }: LoanSummaryCardProps) {
  return (
    <Card data-testid="card-loan-summary">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Loan Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Purchase Price</p>
            <p className="text-lg font-semibold" data-testid="text-purchase-price">
              {formatCurrency(application.purchasePrice || "0")}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Down Payment</p>
            <p className="text-lg font-semibold" data-testid="text-down-payment">
              {formatCurrency(application.downPayment || "0")}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Pre-Approval Amount</p>
            <p className="text-lg font-semibold text-primary" data-testid="text-preapproval">
              {formatCurrency(application.preApprovalAmount || "0")}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Property Type</p>
            <p className="text-lg font-semibold capitalize" data-testid="text-property-type">
              {application.propertyType?.replace(/_/g, " ") || "Single Family"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The last card on the borrower's pipeline page — the one place the file itself
 * offers help.
 *
 * Both of its controls used to be leaf `<Button>`s with no `onClick`, no
 * `asChild` and no wrapping trigger: a borrower who read "your loan officer is
 * here to assist" and pressed either one got nothing at all, on the surface
 * where they are most likely to be stuck. "Schedule Call" was worse than inert
 * — the product has no scheduling anywhere (no route, no endpoint, no
 * integration), so it promised something that does not exist. It is gone rather
 * than wired, because the honest fix for a promise the product cannot keep is
 * to stop making it.
 *
 * What is left is the one thing that does work: `/messages`, the borrower's
 * thread with their loan team. `GET /api/team-members` falls back to all staff
 * for a borrower with nobody assigned yet
 * (`server/routes/borrower/messaging.ts:28-37`), so the destination has a
 * recipient even before a deal team exists.
 *
 * `<Button asChild><Link>` is the spelling DESIGN_SYSTEM §12.4 requires — a
 * link wrapped around a Button nests two interactive controls.
 */
export function NeedHelpCard() {
  return (
    <Card data-testid="card-need-help">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <MessageCircle className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-medium">Need Help?</p>
            <p className="text-sm text-muted-foreground">
              Your loan team can answer questions about this file
            </p>
          </div>
        </div>
        <Button asChild data-testid="button-message-lo">
          <Link href="/messages">
            <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
            Message your loan team
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
