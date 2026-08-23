// Borrower income summary — C1 post-decision transparency + the educational
// analyzing state (Borrower Clarity PR 7, kb log 2026-08-04 §4).
//
// Post-decision (server-gated: approved-grade status + decision-grade
// provenance) the borrower sees how their verified income was calculated —
// per-source monthly figures with Selling Guide citations, the qualifying
// total, and the not-a-commitment disclaimer. Pre-decision the same card is
// educational: which income sources are under analysis, framed as finding
// the borrower's full purchasing power — no figures (live math is a recorded
// binding rejection; the SERVER decides which state, never this component).
//
// Every row is what a source CONTRIBUTED, so the rows sum to the total beneath
// them. They did not before: the rental row carried the portfolio's NET while
// the total counted only its positive offsets, and the subject property's unit
// rent joined the total with no row at all — a duplex buyer saw one $6,000 line
// under a $7,125 total. Rows the server cannot reconcile are not rendered as a
// partial breakdown; it says so instead.
import { useQuery } from "@tanstack/react-query";
import { loanApplicationKeys } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calculator, Search } from "lucide-react";
import type { BorrowerIncomeSummary } from "@shared/borrowerIncomeView";

export function IncomeSummaryCard({ applicationId }: { applicationId: string }) {
  const { data } = useQuery<BorrowerIncomeSummary>({
    queryKey: loanApplicationKeys.incomeSummary(applicationId),
    enabled: !!applicationId,
  });

  if (!data) return null;

  if (!data.available) {
    return (
      <Card data-testid="card-income-analyzing">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4 text-primary" />
            Finding your full purchasing power
          </CardTitle>
          <CardDescription>{data.education}</CardDescription>
        </CardHeader>
        {data.sourcesUnderReview.length > 0 && (
          <CardContent>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Under analysis
            </p>
            <div className="flex flex-wrap gap-2" data-testid="list-income-sources">
              {data.sourcesUnderReview.map((source) => (
                <Badge
                  key={source}
                  variant="outline"
                  className="text-xs border-border text-muted-foreground"
                >
                  {source}
                </Badge>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <Card data-testid="card-income-summary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4 text-primary" />
          How your qualifying income was calculated
        </CardTitle>
        <CardDescription>
          Verified figures from your file — the same math your approval used.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.breakdownAvailable ? (
          data.paths.map((path) => (
            <div
              key={path.pathId}
              className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 rounded-lg bg-muted/30 p-3"
              data-testid={`row-income-path-${path.pathId}`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{path.label}</p>
                {path.citations.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {path.citations.map((c) => `${c.doc} ${c.section}`).join(" · ")}
                  </p>
                )}
                {path.monthlyObligationApplied > 0 && (
                  <p
                    className="text-xs text-muted-foreground mt-1 leading-snug"
                    data-testid={`text-income-obligation-${path.pathId}`}
                  >
                    {formatCurrency(path.monthlyObligationApplied)}/mo of this
                    {" "}property loss counts toward your monthly debts instead of your income.
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold">
                  {formatCurrency(path.monthlyIncomeApplied)}/mo
                </p>
                <Badge variant="outline" className="text-[10px] border-border text-success-subtle-foreground">
                  Counted
                </Badge>
              </div>
            </div>
          ))
        ) : (
          <p
            className="text-sm text-muted-foreground leading-snug"
            data-testid="text-income-breakdown-unavailable"
          >
            {data.breakdownUnavailable}
          </p>
        )}
        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-sm font-semibold">Qualifying monthly income</p>
          <p className="text-base font-bold" data-testid="text-income-total">
            {formatCurrency(data.totalMonthlyQualifyingIncome)}
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug" data-testid="text-income-disclaimer">
          {data.disclaimer}
        </p>
      </CardContent>
    </Card>
  );
}
