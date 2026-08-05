import { Phone, Calendar } from "lucide-react";
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

export function NeedHelpCard() {
  return (
    <Card data-testid="card-need-help">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Phone className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-medium">Need Help?</p>
            <p className="text-sm text-muted-foreground">
              Your loan officer is here to assist
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-schedule-call">
            <Calendar className="mr-2 h-4 w-4" />
            Schedule Call
          </Button>
          <Button data-testid="button-message-lo">
            <Phone className="mr-2 h-4 w-4" />
            Contact
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
