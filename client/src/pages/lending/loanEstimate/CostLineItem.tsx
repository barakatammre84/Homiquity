import { formatCurrency } from "@/lib/formatters";

/** One labelled dollar row; `bold` marks a subtotal or total. */
export function CostLineItem({ label, amount, bold = false }: { label: string; amount: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{formatCurrency(amount)}</span>
    </div>
  );
}
