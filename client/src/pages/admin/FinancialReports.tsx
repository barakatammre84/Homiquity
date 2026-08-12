import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrencyDecimal } from "@/lib/formatters";
import {
  Banknote,
  Building2,
  Percent,
  Scale,
  ShieldAlert,
  Timer,
  TrendingDown,
} from "lucide-react";
import type { CycleTimeReport } from "@shared/cycleTimeReport";
import type { CompensationSummary, CompensationVariance } from "@shared/compensationLedger";
import type { CostSummary, UnitEconomics } from "@shared/costLedger";
import type { ClawbackRegister } from "@shared/compensationClawback";
import type { ContingentLiabilityRegister } from "@shared/contingentLiabilities";

/**
 * Admin financial reports — the consumer for the four report endpoints the
 * 2026-08-04 audit shipped (F-6/F-8/F-11/F-13), resolving the
 * UNCONSUMED_CAPABILITIES.md open entry the strong way (Consumed, not frozen).
 *
 * Honesty rules carried from the underlying modules, not re-derived here:
 *  - Gross margin is an UPPER BOUND (labour/overhead uncaptured) — the
 *    endpoint's own `notes` are rendered verbatim, never summarized away.
 *  - The contingent-liability sum is a FLOOR, never called a total, and the
 *    unquantified count always travels beside it.
 *  - Null metrics (pull-through with nothing resolved, unpriceable
 *    exposures) render as "—", never as a fake zero.
 */

type CompensationReport = CompensationSummary & {
  approvedLenderCount: number;
  discrepancies: (CompensationVariance & {
    submissionId: string;
    applicationId: string;
    lender: string;
    fundedAt: string | null;
  })[];
  clawbackExposure: ClawbackRegister;
  costs: CostSummary;
  unitEconomics: UnitEconomics;
};

const money = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : formatCurrencyDecimal(value);
const pct = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${value.toFixed(1)}%`;

const VARIANCE_BADGE: Record<CompensationVariance["status"], { label: string; variant: "success" | "warning" | "destructive" | "secondary" }> = {
  as_expected: { label: "As expected", variant: "success" },
  short_paid: { label: "Short-paid", variant: "destructive" },
  over_paid: { label: "Over-paid", variant: "warning" },
  pending: { label: "Pending", variant: "secondary" },
};

export default function FinancialReports() {
  const { data: comp, isLoading: compLoading } = useQuery<CompensationReport>({
    queryKey: ["/api/reports/compensation"],
  });
  const { data: liabilities, isLoading: liabLoading } = useQuery<ContingentLiabilityRegister>({
    queryKey: ["/api/reports/contingent-liabilities"],
  });
  const { data: cycle, isLoading: cycleLoading } = useQuery<CycleTimeReport>({
    queryKey: ["/api/reports/cycle-time"],
  });

  return (
    <div className="space-y-6 p-6" data-testid="page-financial-reports">
      <div>
        <h1 className="text-2xl font-semibold">Financial Reports</h1>
        <p className="text-sm text-muted-foreground">
          Funded-book revenue, unit economics, and contingent liabilities. Figures inherit the
          audit&apos;s honesty rules: margins are upper bounds, exposure sums are floors, and an
          unknown renders as &quot;—&quot;, never as zero.
        </p>
      </div>

      {compLoading || !comp ? (
        <Skeleton className="h-40 w-full" data-testid="skeleton-compensation" />
      ) : (
        <>
          {/* ---- Simulated activity (F-21) ----
              Every figure below counts REAL submissions only. Saying so
              matters most right now: with no approved lender every submission
              is simulated, so the revenue cards read $0 and pull-through reads
              "—". Unexplained, that looks like a broken dashboard rather than
              an accurate one, and the temptation is to "fix" it by counting
              the simulated rows — which is the defect this closes. */}
          {(comp.simulated.fundedCount > 0 ||
            comp.simulated.inFlightCount > 0 ||
            comp.simulated.deadCount > 0) && (
            <Card className="border-warning" data-testid="card-simulated-activity">
              <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4 text-sm">
                <Badge variant="warning" data-testid="badge-simulated-activity">
                  Simulated activity excluded
                </Badge>
                <span className="text-muted-foreground" data-testid="text-simulated-activity">
                  Every figure on this page counts real lender submissions only.{" "}
                  {comp.simulated.fundedCount} simulated funding(s) worth{" "}
                  {money(comp.simulated.fundedVolume)} — carrying{" "}
                  {money(comp.simulated.receivedCompensation)} of compensation nobody wired —
                  are excluded, along with {comp.simulated.inFlightCount} in flight and{" "}
                  {comp.simulated.deadCount} resolved. A submission is simulated until the
                  lender behind it has an executed broker agreement.
                </span>
              </CardContent>
            </Card>
          )}

          {/* ---- Revenue & counterparty capacity ---- */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Funded volume"
              value={money(comp.fundedVolume)}
              icon={Banknote}
              hint={`${comp.fundedCount} funded · ${comp.inFlightCount} in flight`}
              data-testid="stat-funded-volume"
            />
            <StatCard
              label="Compensation received"
              value={money(comp.receivedCompensation)}
              icon={Percent}
              tone={comp.compensationVariance < 0 ? "warning" : "success"}
              hint={
                comp.compensationVariance === 0
                  ? "Matches expectation"
                  : `${money(comp.compensationVariance)} vs expected · ${comp.shortPaidCount} short-paid · ${comp.awaitingRemittanceCount} awaiting remittance`
              }
              data-testid="stat-comp-received"
            />
            <div data-testid="stat-pull-through">
            <StatCard
              label="Pull-through"
              value={pct(comp.pullThroughPct)}
              icon={TrendingDown}
              hint={
                comp.pullThroughPct === null
                  ? "No resolved submissions yet — not zero, undefined"
                  : `${comp.fundedCount} funded of ${comp.fundedCount + comp.deadCount} resolved`
              }
            />
            </div>
            <div data-testid="stat-approved-lenders">
            <StatCard
              label="Approved lenders"
              value={comp.approvedLenderCount}
              icon={Building2}
              tone={comp.approvedLenderCount === 0 ? "destructive" : "success"}
              hint={
                comp.approvedLenderCount === 0
                  ? "Zero counterparties — production submissions are blocked (F-5)"
                  : "Signed broker agreements"
              }
            />
            </div>
          </div>

          {/* ---- Unit economics ---- */}
          <Card data-testid="card-unit-economics">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Unit economics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                  size="compact"
                  label="Cost per funded loan"
                  value={money(comp.unitEconomics.costPerFundedLoan)}
                  hint={`Cost per file touched: ${money(comp.unitEconomics.costPerFileTouched)} — flattering; divide by funded`}
                  data-testid="stat-cost-per-funded"
                />
                <StatCard
                  size="compact"
                  label="Margin per funded loan"
                  value={money(comp.unitEconomics.marginPerFundedLoan)}
                  data-testid="stat-margin-per-funded"
                />
                <StatCard
                  size="compact"
                  label="Gross margin (upper bound)"
                  value={pct(comp.unitEconomics.grossMarginPct)}
                  data-testid="stat-gross-margin"
                />
              </div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground" data-testid="list-economics-notes">
                {comp.unitEconomics.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* ---- EPO clawback ---- */}
          <Card data-testid="card-clawback">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                EPO clawback exposure
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-4">
                <span data-testid="text-clawback-at-risk">
                  <span className="font-medium">{money(comp.clawbackExposure.totalAtRisk)}</span>{" "}
                  reclaimable across {comp.clawbackExposure.atRiskCount} funded loan(s)
                </span>
                {comp.clawbackExposure.indeterminateCount > 0 && (
                  <Badge variant="warning" data-testid="badge-clawback-indeterminate">
                    {comp.clawbackExposure.indeterminateCount} exposed with unknown amount
                  </Badge>
                )}
                {comp.clawbackExposure.usesAssumedWindow && (
                  <Badge variant="secondary" data-testid="badge-clawback-assumed">
                    Window is a platform assumption — no contracted EPO term yet
                  </Badge>
                )}
                {comp.clawbackExposure.simulatedExcludedCount > 0 && (
                  <Badge variant="secondary" data-testid="badge-clawback-simulated-excluded">
                    {comp.clawbackExposure.simulatedExcludedCount} simulated funding(s) excluded —
                    no lender paid us, so nothing can be reclaimed
                  </Badge>
                )}
              </div>
              {comp.clawbackExposure.nextExpiry && (
                <p className="text-xs text-muted-foreground">
                  Next window expiry: {String(comp.clawbackExposure.nextExpiry).slice(0, 10)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* ---- Remittance discrepancies ---- */}
          <Card data-testid="card-discrepancies">
            <CardHeader>
              <CardTitle>Remittance discrepancies</CardTitle>
            </CardHeader>
            <CardContent>
              {comp.discrepancies.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-discrepancies">
                  Every funded loan&apos;s remittance matches its comp plan.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lender</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comp.discrepancies.map((row) => (
                      <TableRow key={row.submissionId} data-testid={`row-discrepancy-${row.submissionId}`}>
                        <TableCell>{row.lender}</TableCell>
                        <TableCell>
                          <Badge variant={VARIANCE_BADGE[row.status].variant}>
                            {VARIANCE_BADGE[row.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{money(row.expectedAmount)}</TableCell>
                        <TableCell className="text-right">{money(row.receivedAmount)}</TableCell>
                        <TableCell className="text-right">{money(row.variance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ---- Funnel: pull-through + cycle time (roadmap G-C) ---- */}
      {cycleLoading || !cycle ? (
        <Skeleton className="h-40 w-full" data-testid="skeleton-cycle-time" />
      ) : (
        <Card data-testid="card-cycle-time">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Funnel — last {cycle.windowDays} days
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div data-testid="stat-pull-through-resolved">
              <StatCard
                size="compact"
                label="Pull-through (resolved)"
                value={pct(cycle.pullThroughResolvedPct)}
                hint={
                  cycle.pullThroughResolvedPct === null
                    ? "Nothing resolved yet — not zero, undefined"
                    : `${cycle.outcomes.funded} funded of ${cycle.outcomes.funded + cycle.outcomes.denied + cycle.outcomes.withdrawn + cycle.outcomes.expired} resolved · gate is >70%`
                }
              />
              </div>
              <div data-testid="stat-median-cycle">
              <StatCard
                size="compact"
                label="Median cycle time"
                value={
                  cycle.cycleTime.medianDays === null
                    ? "—"
                    : `${cycle.cycleTime.medianDays.toFixed(1)} days`
                }
                hint={
                  cycle.cycleTime.medianDays === null
                    ? "No measurable funded files in the window"
                    : `p90 ${cycle.cycleTime.p90Days!.toFixed(1)} days over ${cycle.cycleTime.measuredCount} funded · gate is <12 days`
                }
              />
              </div>
              <div data-testid="stat-window-created">
              <StatCard
                size="compact"
                label="Created in window"
                value={cycle.totalCreated}
                hint={`${cycle.outcomes.inFlight} still in flight · overall pull-through ${pct(cycle.pullThroughOverallPct)}`}
              />
              </div>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground" data-testid="list-cycle-notes">
              {cycle.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ---- Contingent liabilities ---- */}
      {liabLoading || !liabilities ? (
        <Skeleton className="h-40 w-full" data-testid="skeleton-liabilities" />
      ) : (
        <Card data-testid="card-liabilities">
          <CardHeader>
            <CardTitle>Contingent liabilities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4" data-testid="stat-liability-floor">
              <StatCard
                size="compact"
                label="Quantified floor — not a total"
                value={money(liabilities.quantifiedFloor)}
                hint={`${liabilities.unquantifiedCount} real exposure(s) carry no figure here`}
                tone={liabilities.incomplete ? "warning" : "neutral"}
              />
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-liability-summary">
              {liabilities.summary}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exposure</TableHead>
                  <TableHead className="text-right">At risk</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Basis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liabilities.entries.map((entry) => (
                  <TableRow key={entry.category} data-testid={`row-exposure-${entry.category}`}>
                    <TableCell>
                      <div className="font-medium">{entry.label}</div>
                      <div className="text-xs text-muted-foreground">{entry.trigger}</div>
                    </TableCell>
                    <TableCell className="text-right">{money(entry.amount)}</TableCell>
                    <TableCell className="text-right">{entry.count}</TableCell>
                    <TableCell className="text-xs">{entry.window}</TableCell>
                    <TableCell>
                      <Badge variant={entry.basis === "computed" ? "secondary" : "warning"}>
                        {entry.basis === "computed" ? "Computed" : "Unquantified"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {liabilities.actions.length > 0 && (
              <div data-testid="list-liability-actions">
                <h3 className="mb-1 text-sm font-medium">Actions owed</h3>
                <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {liabilities.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
