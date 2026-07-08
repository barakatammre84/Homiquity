import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatPercent, getLoanTypeLabel } from "@/lib/formatters";
import type { LoanOption } from "@shared/schema";
import { Lock, Star } from "lucide-react";

// Better-Edge transparency matrix: every option's full cost anatomy in
// row-aligned columns so nothing hides in a card's fine print. Dense on
// purpose (p-2, tabular figures) — this is a comparison instrument, not
// an onboarding surface.

interface LoanComparisonMatrixProps {
  options: LoanOption[];
  steeringAcknowledged: boolean;
  lockPending: boolean;
  onLockRate: (optionId: string) => void;
}

function lockExpiry(option: LoanOption): { label: string; daysLeft: number } | null {
  if (!option.lockExpiresAt) return null;
  const expires = new Date(option.lockExpiresAt);
  const daysLeft = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86_400_000));
  return {
    label: expires.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    daysLeft,
  };
}

const money = (v: string | null | undefined) => formatCurrency(v || "0");

export function LoanComparisonMatrix({
  options,
  steeringAcknowledged,
  lockPending,
  onLockRate,
}: LoanComparisonMatrixProps) {
  const anyHoa = options.some((o) => parseFloat(o.hoaFees || "0") > 0);
  const anyMi = options.some((o) => parseFloat(o.pmi || "0") > 0);

  // Row model keeps label cells and value cells aligned by construction.
  const rows: {
    label: string;
    render: (o: LoanOption) => React.ReactNode;
    heavy?: boolean;
    section?: string;
  }[] = [
    { section: "Pricing", label: "Interest rate", render: (o) => formatPercent(o.interestRate) },
    // Reg Z §1026.24(c): APR styled identically to the note rate — never less conspicuous.
    { label: "APR", render: (o) => formatPercent(o.apr) },
    {
      label: "Discount points",
      render: (o) =>
        parseFloat(o.points || "0") > 0 ? `${o.points} (${money(o.pointsCost)})` : "None",
    },
    { section: "Monthly payment", label: "Principal & interest", render: (o) => money(o.principalAndInterest) },
    { label: "Property tax (est.)", render: (o) => money(o.propertyTax) },
    { label: "Home insurance (est.)", render: (o) => money(o.homeInsurance) },
    ...(anyMi
      ? [{
          label: "Mortgage insurance",
          render: (o: LoanOption) => (parseFloat(o.pmi || "0") > 0 ? `${money(o.pmi)}` : "—"),
        }]
      : []),
    ...(anyHoa
      ? [{
          label: "HOA dues",
          render: (o: LoanOption) => (parseFloat(o.hoaFees || "0") > 0 ? money(o.hoaFees) : "—"),
        }]
      : []),
    { label: "Total monthly (PITI)", render: (o) => money(o.monthlyPayment), heavy: true },
    { section: "Upfront & lifetime", label: "Down payment", render: (o) => `${money(o.downPaymentAmount)} (${o.downPaymentPercent}%)` },
    { label: "Closing costs (est.)", render: (o) => money(o.closingCosts) },
    { label: "Cash to close", render: (o) => money(o.cashToClose), heavy: true },
    { label: "Total interest (life of loan)", render: (o) => money(o.totalInterestPaid) },
  ];

  return (
    <Card className="overflow-hidden" data-testid="card-comparison-matrix">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm tabular-nums">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 p-2 pl-4 text-left font-medium text-muted-foreground backdrop-blur-sm">
                Compare
              </th>
              {options.map((o) => (
                <th key={o.id} className="p-2 text-right align-top" data-testid={`matrix-header-${o.id}`}>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-semibold">
                      {getLoanTypeLabel(o.loanType)} · {o.loanTerm} yr
                    </span>
                    <span className="flex gap-1">
                      {parseFloat(o.points || "0") > 0 && (
                        <Badge variant="secondary" className="text-[10px]">with points</Badge>
                      )}
                      {o.isRecommended && (
                        <Badge className="gap-0.5 text-[10px]">
                          <Star className="h-2.5 w-2.5" />
                          Recommended
                        </Badge>
                      )}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className={row.heavy ? "border-b bg-muted/30 font-semibold" : "border-b"}
              >
                <td className="sticky left-0 z-10 bg-card p-2 pl-4 text-left">
                  {row.section && (
                    <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {row.section}
                    </span>
                  )}
                  <span className={row.heavy ? "" : "text-muted-foreground"}>{row.label}</span>
                </td>
                {options.map((o) => (
                  <td key={o.id} className="whitespace-nowrap p-2 text-right">
                    {row.render(o)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="sticky left-0 z-10 bg-card p-2 pl-4" />
              {options.map((o) => {
                const expiry = lockExpiry(o);
                return (
                  <td key={o.id} className="p-2 text-right">
                    {o.isLocked && expiry ? (
                      <div className="inline-flex flex-col items-end gap-0.5">
                        <Badge variant="default" className="gap-1 bg-success text-success-foreground">
                          <Lock className="h-3 w-3" />
                          Locked
                        </Badge>
                        <span className="text-[11px] text-muted-foreground" data-testid={`matrix-lock-expiry-${o.id}`}>
                          Expires {expiry.label} ({expiry.daysLeft}d left)
                        </span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => onLockRate(o.id)}
                        disabled={lockPending || !steeringAcknowledged}
                        title={!steeringAcknowledged ? "Review the loan options disclosure above first" : undefined}
                        data-testid={`matrix-lock-${o.id}`}
                      >
                        <Lock className="mr-1.5 h-3.5 w-3.5" />
                        Lock rate
                      </Button>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="border-t px-4 py-2.5 text-[11px] text-muted-foreground">
        Taxes and insurance are estimates used for payment illustration; actual escrow is set at
        closing. Rates shown with APR reflect your profile and are not a commitment to lend.
      </p>
    </Card>
  );
}
