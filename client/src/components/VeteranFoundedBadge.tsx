import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * VeteranFoundedBadge — a contained trust mark for the founder's veteran status.
 *
 * Design intent (see the branding decision, 2026-07-08): we deliberately do NOT
 * repaint the app red/white/blue. The house trust palette (Calm Emerald) stays
 * intact; the veteran story lives in this one contained seal instead. Gold
 * + navy are intentional off-palette accents (defined as scoped `--veteran-*`
 * CSS variables in index.css, not semantic status tokens) used only here, on the
 * footer / About / VA surfaces — never as global UI chrome.
 *
 * The claim is factual ("Veteran-Founded") — do not upgrade the copy to a
 * certification claim (e.g. "Certified Veteran-Owned") unless a real NaVOBA/VBE
 * certification backs it, which would be a Reg N / UDAAP misrepresentation.
 */
type VeteranFoundedBadgeVariant = "compact" | "seal";

interface VeteranFoundedBadgeProps {
  /** `compact` = inline medallion + label (footer, nav). `seal` = stacked medallion + caption (landing, About). */
  variant?: VeteranFoundedBadgeVariant;
  /**
   * Adds a restrained red/white/blue tricolor accent under/after the medallion.
   * Reserved for the military/VA surface (e.g. VALoans) — leave it OFF elsewhere
   * so the mark reads as a trust seal, not a patriotic repaint.
   */
  showFlag?: boolean;
  /** Caption line for the `seal` variant. */
  caption?: string;
  className?: string;
  "data-testid"?: string;
}

/** Gold-ringed cream medallion with a navy star — legible on light pages and the dark footer alike. */
function Medallion({ size }: { size: number }) {
  const star = Math.round(size * 0.5);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: "hsl(var(--veteran-seal-bg))",
        border: "2px solid hsl(var(--veteran-gold))",
        boxShadow: "inset 0 0 0 1px hsl(var(--veteran-gold) / 0.3)",
      }}
      aria-hidden="true"
    >
      <Star
        style={{
          width: star,
          height: star,
          color: "hsl(var(--veteran-navy))",
          fill: "hsl(var(--veteran-navy))",
        }}
      />
    </span>
  );
}

/** Restrained old-glory tricolor bar — VA/military surfaces only. */
function FlagAccent() {
  return (
    <span
      className="inline-flex overflow-hidden rounded-full"
      style={{ width: 32, height: 4, border: "0.5px solid hsl(var(--veteran-gold) / 0.4)" }}
      aria-hidden="true"
    >
      <span style={{ flex: 1, backgroundColor: "hsl(var(--veteran-red))" }} />
      <span style={{ flex: 1, backgroundColor: "hsl(var(--veteran-seal-bg))" }} />
      <span style={{ flex: 1, backgroundColor: "hsl(var(--veteran-navy))" }} />
    </span>
  );
}

export function VeteranFoundedBadge({
  variant = "compact",
  showFlag = false,
  caption = "Built by a military veteran",
  className,
  "data-testid": testId = "badge-veteran-founded",
}: VeteranFoundedBadgeProps) {
  if (variant === "seal") {
    return (
      <div className={cn("flex flex-col items-center gap-2 text-center", className)} data-testid={testId}>
        <Medallion size={56} />
        {showFlag && <FlagAccent />}
        <div>
          <p className="text-sm font-semibold leading-tight">Veteran-Founded</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>
        </div>
      </div>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)} data-testid={testId}>
      <Medallion size={28} />
      <span className="text-xs font-medium">Veteran-Founded</span>
      {showFlag && <FlagAccent />}
    </span>
  );
}
