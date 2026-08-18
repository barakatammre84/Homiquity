import {
  formatUsd,
  monthlyFromAnnual,
  sumAnnual,
  type DualUnitGroup,
} from "@/lib/dualUnitMath";

// Dual-unit financial display (docs/DESIGN-STANDARD.md §6, teardown §4.11):
// borrowers think in annual salary, underwriters think in monthly DTI — every
// amount renders in both. The monthly column is derived from the annual figure
// (never a second input), `—` marks not-applicable (never $0), and the caption
// is required so the table says what it measures.

export interface DualUnitTableProps {
  /** What this table measures, e.g. "Qualifying income". Required. */
  caption: string;
  groups: readonly DualUnitGroup[];
  /** Rendered as the grand-total row when given. */
  totalLabel?: string;
  className?: string;
  "data-testid"?: string;
}

export function DualUnitTable({
  caption,
  groups,
  totalLabel,
  className,
  "data-testid": testId = "dual-unit-table",
}: DualUnitTableProps) {
  const grandAnnual = groups.reduce((sum, g) => sum + sumAnnual(g.rows), 0);

  return (
    <div className={"overflow-x-auto " + (className ?? "")}>
      <table className="w-full text-sm" data-testid={testId}>
        <caption className="pb-3 text-left text-sm font-semibold text-foreground">
          {caption}
        </caption>
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-normal">
              Item
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-normal">
              Annual
            </th>
            <th scope="col" className="py-2 text-right font-normal">
              Monthly
            </th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.label}>
            <tr>
              <th
                scope="rowgroup"
                colSpan={3}
                className="pt-4 pb-1 text-left font-semibold text-foreground"
              >
                {group.label}
                {group.note && (
                  <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
                    {group.note}
                  </span>
                )}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr
                key={row.label}
                className="border-b border-border/60"
                data-testid={row.testId}
              >
                <td className="py-2 pr-4 text-foreground">{row.label}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-foreground">
                  {formatUsd(row.annual)}
                </td>
                <td className="py-2 text-right tabular-nums text-foreground">
                  {formatUsd(monthlyFromAnnual(row.annual))}
                </td>
              </tr>
            ))}
            {/* A subtotal of a single row would just repeat it. */}
            {group.rows.length > 1 && (
              <tr>
                <td className="py-2 pr-4 text-muted-foreground">
                  {group.label} subtotal
                </td>
                <td className="py-2 pr-4 text-right font-semibold tabular-nums">
                  {formatUsd(sumAnnual(group.rows))}
                </td>
                <td className="py-2 text-right font-semibold tabular-nums">
                  {formatUsd(monthlyFromAnnual(sumAnnual(group.rows)))}
                </td>
              </tr>
            )}
          </tbody>
        ))}
        {totalLabel && (
          <tfoot>
            <tr className="border-t-2 border-border">
              <td className="py-3 pr-4 font-semibold text-foreground">
                {totalLabel}
              </td>
              <td className="py-3 pr-4 text-right font-semibold tabular-nums">
                {formatUsd(grandAnnual)}
              </td>
              <td className="py-3 text-right font-semibold tabular-nums">
                {formatUsd(monthlyFromAnnual(grandAnnual))}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
