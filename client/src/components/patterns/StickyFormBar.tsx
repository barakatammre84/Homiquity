import { Button } from "@/components/ui/button";
import { Icons } from "@/lib/icons";

// Sticky Support-left / Submit-right bar on every multi-field flow
// (docs/DESIGN-STANDARD.md §6, teardown §4.2). Two guarantees: Submit is never
// something you scroll to find, and help is one click away at the moment of
// confusion. The right cluster reserves space for the Coach launcher bubble so
// the two never overlap.

// The human escape hatch, offered as a first-class pill — the real third
// option, confident rather than defensive.
export function SupportPill({
  phone,
  href,
  label = "Talk to a human",
  "data-testid": testId = "support-pill",
}: {
  phone?: string;
  href?: string;
  label?: string;
  "data-testid"?: string;
}) {
  const target = phone ? `tel:${phone}` : href;
  if (!target) return null;
  return (
    <Button asChild variant="outline" className="rounded-full" data-testid={testId}>
      <a href={target}>
        <Icons.phone className="mr-2 h-4 w-4" aria-hidden="true" />
        {label}
      </a>
    </Button>
  );
}

export interface StickyFormBarProps {
  /** Left side — usually a <SupportPill>. */
  support?: React.ReactNode;
  /** Right side — the commitment button(s). */
  children: React.ReactNode;
  className?: string;
  "data-testid"?: string;
}

export function StickyFormBar({
  support,
  children,
  className,
  "data-testid": testId = "sticky-form-bar",
}: StickyFormBarProps) {
  return (
    <div
      className={
        "sticky bottom-0 z-30 -mx-4 border-t border-border bg-background/95 px-4 " +
        "pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6 " +
        (className ?? "")
      }
      data-testid={testId}
    >
      <div className="flex items-center justify-between gap-3">
        <div>{support}</div>
        {/* mr reserves the Coach-launcher corner (teardown §4.2). */}
        <div className="mr-14 flex items-center gap-2 sm:mr-16">{children}</div>
      </div>
    </div>
  );
}
