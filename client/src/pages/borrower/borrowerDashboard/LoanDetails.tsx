import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronUp,
  DollarSign,
  FileText,
  Home,
  Percent,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LoanApplication } from "@shared/schema";

/** Collapsible loan-details card (extracted from Dashboard.tsx): offers link,
 * pre-approval expiry (hidden once expired — the next-action card owns that),
 * pre-approved terms, and the HMDA government-monitoring prompt. */
export function LoanDetails({
  application,
  hasOffers,
  offerCount,
  rateRange,
  hmdaCompleted,
  expirationInfo,
  isPreApproved,
}: {
  application: LoanApplication;
  hasOffers: boolean;
  offerCount: number;
  rateRange: string | null;
  hmdaCompleted: boolean;
  expirationInfo: { label: string; daysLeft: number; urgency: "expired" | "urgent" | "normal" } | null;
  isPreApproved: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const items: Array<{ icon: React.ElementType; label: string; value: string; href?: string; color?: string; testId: string }> = [];

  if (hasOffers) {
    items.push({
      icon: TrendingUp,
      label: "Loan Offers",
      value: `${offerCount} available${rateRange ? ` (${rateRange})` : ""}`,
      href: `/pipeline/${application.id}/offers`,
      color: "text-success-subtle-foreground",
      testId: "detail-offers",
    });
  }

  if (expirationInfo && expirationInfo.urgency !== "expired") {
    items.push({
      icon: Calendar,
      label: "Pre-Approval Valid Until",
      value: expirationInfo.label,
      color: expirationInfo.urgency === "urgent" ? "text-warning-subtle-foreground" : undefined,
      testId: "detail-expiration",
    });
  }

  if (isPreApproved) {
    const purchasePrice = formatCurrency(application.preApprovalAmount || application.purchasePrice || "0");
    const downPayment = formatCurrency(application.downPayment || "0");
    const loanType = application.preferredLoanType || "Conventional";
    items.push(
      { icon: Home, label: "Purchase Price", value: purchasePrice, testId: "detail-purchase-price" },
      { icon: DollarSign, label: "Down Payment", value: downPayment, testId: "detail-down-payment" },
      { icon: Percent, label: "Loan Type", value: loanType, testId: "detail-loan-type" },
    );
  }

  // The Loan Estimate — the borrower's only route to their own TRID disclosure
  // (ux-30). Retrieving it behind e_disclosure consent is what stamps
  // `leIssuedDate` and audit-logs `trid.loan_estimate_delivered`
  // (server/routes/underwriting/delivery.ts:93-105); that writer fires ONLY for
  // the borrower, so with no borrower-reachable link it had never fired from a
  // UI click and TRID-triggered files went permanently unadvanceable.
  //
  // Gated on BOTH conditions on purpose, so this never links to an error:
  //  - `tridTriggeredAt` — before the six-piece trigger there is no disclosure
  //    to make, and the LE clock has not started.
  //  - `loCompensationModel` — `generateLoanEstimate` fails closed without a
  //    §1026.36(d)(2) election (services/loanEstimate.ts:511-514), which staff
  //    perform on the file. Linking an unelected file would show the borrower
  //    an error, not a disclosure.
  // Once issued the row stays, showing the delivery date rather than the prompt.
  if (application.tridTriggeredAt && application.loCompensationModel) {
    items.push({
      icon: FileText,
      label: "Loan Estimate",
      value: application.leIssuedDate
        ? `Delivered ${application.leIssuedDate}`
        : "Ready to view",
      href: `/loan-estimate/${application.id}`,
      testId: "detail-loan-estimate",
    });
  }

  if (!hmdaCompleted) {
    items.push({
      icon: Users,
      label: "Government Monitoring",
      value: "Not yet completed",
      href: `/hmda/${application.id}`,
      testId: "detail-hmda",
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="section-loan-details">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="touch-target flex w-full items-center gap-2 text-left group"
        data-testid="button-toggle-details"
      >
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Loan Details
        </h3>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        {!expanded && (
          <Badge variant="secondary" className="text-xs" data-testid="badge-detail-count">
            {items.length}
          </Badge>
        )}
      </button>

      {expanded && (
        <Card className="shadow-card animate-in fade-in slide-in-from-top-1 duration-200" data-testid="card-loan-details">
          <CardContent className="p-4">
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.testId} className="flex items-center justify-between gap-3 flex-wrap" data-testid={item.testId}>
                  <div className="flex items-center gap-2.5">
                    <item.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium ${item.color || ""}`}>{item.value}</span>
                    {item.href && (
                      <Button asChild variant="ghost" size="sm" className="touch-target" data-testid={`button-${item.testId}`}>
                        <Link href={item.href} data-testid={`link-${item.testId}`}>
                          View
                          <ArrowRight className="h-3 w-3 ml-0.5" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
