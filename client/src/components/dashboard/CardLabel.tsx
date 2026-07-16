import * as React from "react";

/**
 * Uppercase section label with a short brand-accent underline — the consistent
 * card-header treatment for the borrower dashboard's right-column cards
 * (Pre-Approved / Contact / Loan Team). The underline uses `bg-primary` so it
 * re-skins per tenant (white-label). See visual-consistency-standard.md §7.
 */
export function CardLabel({
  children,
  "data-testid": testId,
}: {
  children: React.ReactNode;
  "data-testid"?: string;
}) {
  return (
    <div className="mb-3" data-testid={testId}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </p>
      <div className="mt-1 h-0.5 w-8 rounded-full bg-primary/60" />
    </div>
  );
}
