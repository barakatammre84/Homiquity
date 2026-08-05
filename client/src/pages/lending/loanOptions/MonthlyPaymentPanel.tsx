import type { ReactNode } from "react";
import { TermTooltip } from "@/components/TermTooltip";
import { formatCurrency } from "@/lib/formatters";
import type { LoanOption } from "@shared/schema";

function PitiRow({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{formatCurrency(value)}</span>
    </div>
  );
}

/**
 * Radical-transparency payment panel: the headline number is the FULL monthly
 * payment (the engine computes PITI, not just P&I), itemized below so every
 * dollar is accounted for. Rows without escrow estimates (legacy options) fall
 * back to the plain "Principal & Interest" caption rather than implying a
 * breakdown we don't have.
 */
export function MonthlyPaymentPanel({ option }: { option: LoanOption }) {
  const amount = (v: string | null) => (v == null ? 0 : parseFloat(v));
  const escrowed = amount(option.propertyTax) > 0 || amount(option.homeInsurance) > 0;

  return (
    <div>
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Monthly Payment</p>
        <p className="text-4xl font-bold" data-testid={`text-monthly-payment-${option.loanType}`}>
          {formatCurrency(option.monthlyPayment)}
        </p>
        <p className="text-xs text-muted-foreground">
          {escrowed ? (
            <>
              Full <TermTooltip term="piti" /> — taxes &amp; insurance included
            </>
          ) : (
            "Principal & Interest"
          )}
        </p>
      </div>

      {escrowed && (
        <div
          className="mt-4 space-y-2 rounded-lg bg-muted/50 p-4"
          data-testid={`section-piti-${option.loanType}`}
        >
          <PitiRow label="Principal & Interest" value={option.principalAndInterest} />
          {amount(option.propertyTax) > 0 && (
            <PitiRow label="Property taxes" value={option.propertyTax!} />
          )}
          {amount(option.homeInsurance) > 0 && (
            <PitiRow label="Homeowners insurance" value={option.homeInsurance!} />
          )}
          {amount(option.pmi) > 0 && (
            <PitiRow
              label={<TermTooltip term="pmi">Mortgage insurance</TermTooltip>}
              value={option.pmi!}
            />
          )}
          {amount(option.hoaFees) > 0 && <PitiRow label="HOA dues" value={option.hoaFees!} />}
          <p className="pt-1 text-xs text-muted-foreground">
            Taxes &amp; insurance are estimates, collected monthly in <TermTooltip term="escrow" />.
          </p>
        </div>
      )}
    </div>
  );
}
