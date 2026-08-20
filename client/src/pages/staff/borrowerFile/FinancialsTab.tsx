import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, loanApplicationKeys } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrencyDecimal, formatDate } from "@/lib/formatters";
import { Receipt, Scale } from "lucide-react";
import { LOAN_COST_CATEGORIES, type LoanCostCategory } from "@shared/costLedger";
import type { CostSummary } from "@shared/costLedger";
import type { ToleranceEvaluation } from "@shared/compliance/feeTolerance";

/**
 * Per-file financials — the staff surface for the last two open
 * UNCONSUMED_CAPABILITIES entries:
 *
 *   GET  /api/loan-applications/:id/le-tolerance  (F-4's read-only cure posture)
 *   GET  /api/loan-applications/:id/costs         (F-11's per-file ledger)
 *   POST /api/loan-applications/:id/costs         (staff cost entry)
 *
 * Honesty rules carried from the modules: the tolerance review is read-only
 * and never creates a baseline; "no baseline yet" is a normal state, not an
 * error; the ledger is append-only, so a correction is a negative reversal
 * row, never an edit; simulated spend is labelled, never blended.
 */

type ToleranceReview = {
  hasBaseline: boolean;
  baselineVersion: number | null;
  baselineIssuedAt: string | null;
  evaluation: ToleranceEvaluation | null;
};

type CostEntryRow = {
  id: string;
  category: string;
  vendor: string | null;
  amount: string;
  incurredAt: string;
  automatic: boolean;
  simulated: boolean;
  description: string | null;
};

type CostsResponse = { entries: CostEntryRow[]; summary: CostSummary };

const money = (value: number | string | null | undefined) =>
  value === null || value === undefined ? "—" : formatCurrencyDecimal(value);

const VERDICT_BADGE: Record<string, { label: string; variant: "success" | "warning" | "destructive" }> = {
  within_tolerance: { label: "Within tolerance", variant: "success" },
  increase_justified: { label: "Increase justified — redisclose", variant: "warning" },
  cure_required: { label: "Cure required", variant: "destructive" },
};

const CATEGORY_LABELS: Record<LoanCostCategory, string> = {
  credit_report: "Credit report",
  appraisal: "Appraisal",
  avm: "AVM",
  verification: "Verification",
  aus: "AUS",
  title: "Title",
  flood: "Flood",
  rate_lock_extension: "Rate-lock extension",
  marketing: "Marketing",
  other: "Other",
};

export function FinancialsTab({ applicationId }: { applicationId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [category, setCategory] = useState<LoanCostCategory>("appraisal");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");

  const { data: tolerance, isLoading: toleranceLoading } = useQuery<ToleranceReview>({
    queryKey: loanApplicationKeys.leTolerance(applicationId),
  });
  const { data: costs, isLoading: costsLoading } = useQuery<CostsResponse>({
    queryKey: loanApplicationKeys.costs(applicationId),
  });

  const amountNumber = Number(amount);
  // Negative is permitted on purpose: that is how a reversal is recorded on an
  // append-only ledger. Only zero and non-numbers are rejected.
  const amountValid = amount.trim() !== "" && Number.isFinite(amountNumber) && amountNumber !== 0;

  const addCost = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/loan-applications/${applicationId}/costs`, {
        category,
        amount: amountNumber,
        vendor: vendor.trim() || undefined,
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.costs(applicationId) });
      // A booked actual can change what the LE discloses (feeProvenance).
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.loanEstimate(applicationId) });
      setAmount("");
      setVendor("");
      setDescription("");
      toast({ title: "Cost recorded", description: "The ledger is append-only — corrections are negative reversal rows." });
    },
    onError: (error: Error) =>
      toast({ title: "Could not record the cost", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4" data-testid="tab-financials-content">
      {/* ---- TRID tolerance posture ---- */}
      <Card data-testid="card-le-tolerance">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            TRID fee tolerance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {toleranceLoading || !tolerance ? (
            <Skeleton className="h-16 w-full" data-testid="skeleton-tolerance" />
          ) : !tolerance.hasBaseline ? (
            <p className="text-muted-foreground" data-testid="text-no-baseline">
              No Loan Estimate has been delivered to the borrower yet, so there is no disclosure
              baseline to measure against. This is the normal pre-disclosure state — the baseline
              persists on first borrower delivery.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                {tolerance.evaluation && (
                  <Badge
                    variant={VERDICT_BADGE[tolerance.evaluation.verdict]?.variant ?? "warning"}
                    data-testid="badge-tolerance-verdict"
                  >
                    {VERDICT_BADGE[tolerance.evaluation.verdict]?.label ?? tolerance.evaluation.verdict}
                  </Badge>
                )}
                <span className="text-muted-foreground" data-testid="text-baseline-version">
                  Baseline v{tolerance.baselineVersion} · issued {formatDate(tolerance.baselineIssuedAt)}
                </span>
              </div>
              {tolerance.evaluation && (
                <>
                  <p data-testid="text-tolerance-message">{tolerance.evaluation.message}</p>
                  {tolerance.evaluation.cureAmount > 0 && (
                    <p className="font-medium" data-testid="text-cure-amount">
                      Cure exposure if closed on today&apos;s numbers:{" "}
                      {money(tolerance.evaluation.cureAmount)}
                    </p>
                  )}
                  {tolerance.evaluation.increases.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Charge</TableHead>
                          <TableHead>Tier</TableHead>
                          <TableHead className="text-right">Disclosed</TableHead>
                          <TableHead className="text-right">Today</TableHead>
                          <TableHead className="text-right">Increase</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tolerance.evaluation.increases.map((row) => (
                          <TableRow key={row.id} data-testid={`row-increase-${row.id}`}>
                            <TableCell>{row.label}</TableCell>
                            <TableCell className="text-xs">{row.bucket}</TableCell>
                            <TableCell className="text-right">{money(row.baselineAmount)}</TableCell>
                            <TableCell className="text-right">{money(row.revisedAmount)}</TableCell>
                            <TableCell className="text-right">{money(row.increase)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
              <p className="text-xs text-muted-foreground">
                Read-only review — it never creates or resets a baseline, and the figure gates a
                redisclosure decision; it is not a legal cure computation.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* ---- Per-file cost ledger ---- */}
      <Card data-testid="card-cost-ledger">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Cost ledger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {costsLoading || !costs ? (
            <Skeleton className="h-16 w-full" data-testid="skeleton-costs" />
          ) : (
            <>
              <div className="flex flex-wrap gap-4 text-sm" data-testid="text-cost-totals">
                <span>
                  Direct cost: <span className="font-medium">{money(costs.summary.totalCost)}</span>
                </span>
                {costs.summary.simulatedCost > 0 && (
                  <Badge variant="secondary" data-testid="badge-simulated-cost">
                    {money(costs.summary.simulatedCost)} simulated — excluded from margins
                  </Badge>
                )}
              </div>
              {costs.entries.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-costs">
                  No costs booked against this file yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Incurred</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costs.entries.map((entry) => (
                      <TableRow key={entry.id} data-testid={`row-cost-${entry.id}`}>
                        <TableCell>{CATEGORY_LABELS[entry.category as LoanCostCategory] ?? entry.category}</TableCell>
                        <TableCell>{entry.vendor ?? "—"}</TableCell>
                        <TableCell className="text-right">{money(entry.amount)}</TableCell>
                        <TableCell className="text-xs">{formatDate(entry.incurredAt)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Badge variant="secondary">{entry.automatic ? "Metered" : "Staff"}</Badge>
                            {entry.simulated && <Badge variant="warning">Simulated</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div className="grid gap-2 rounded-md border p-3 md:grid-cols-4" data-testid="form-add-cost">
                <div className="grid gap-1">
                  <Label htmlFor="cost-category">Category</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as LoanCostCategory)}>
                    <SelectTrigger id="cost-category" data-testid="select-cost-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOAN_COST_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="cost-amount">Amount ($; negative = reversal)</Label>
                  <Input
                    id="cost-amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="650"
                    data-testid="input-cost-amount"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="cost-vendor">Vendor</Label>
                  <Input
                    id="cost-vendor"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="AMC / bureau / county"
                    data-testid="input-cost-vendor"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    size="sm" className="touch-target"
                    onClick={() => addCost.mutate()}
                    disabled={!amountValid || addCost.isPending}
                    data-testid="button-add-cost"
                  >
                    {addCost.isPending ? "Recording…" : "Record cost"}
                  </Button>
                </div>
                <div className="grid gap-1 md:col-span-4">
                  <Label htmlFor="cost-description">Description (optional)</Label>
                  <Input
                    id="cost-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Invoice #, what it covers"
                    data-testid="input-cost-description"
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
