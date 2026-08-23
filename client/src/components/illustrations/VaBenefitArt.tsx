import { cn } from "@/lib/utils";
import type { IllustrationProps } from "./index";

/**
 * ITS OWN MODULE ON PURPOSE — do not fold this into `index.tsx`. That barrel is
 * reachable from an eager chunk, and Rollup hoists a shared module WHOLE into
 * it. See SelfEmployedDeskArt.tsx for the 106-byte version of this lesson.
 *
 * Same visual language as the other persona scenes: a mint ground panel, white
 * cards on a hairline stroke, primary-tinted detail, exactly one flare mark.
 * 16:9 — the ratio the illustrator's Tier 2 scenes are commissioned at, so real
 * artwork drops into the same slot without a layout change.
 */

/**
 * VA — a home behind a shield. The shield reads as an EARNED protection, and it
 * is deliberately geometric: no flag, no insignia, no rank. Service iconography
 * borrowed literally is both a cliche and a misrepresentation risk, since we do
 * not act for the VA.
 */
export function VaBenefitArt({ className, "data-testid": testId }: IllustrationProps) {
  return (
    <svg viewBox="0 0 320 180" fill="none" aria-hidden="true"
      className={cn("h-auto w-full", className)} data-testid={testId}>
      {/* No ground panel. The brief says transparent background, always — and a
          `fill-muted` panel is INVISIBLE on the mint bands these sit on today
          while appearing as a box the moment one is placed on white. An
          illustration that changes shape with its surroundings is a trap, not a
          container. */}
      <rect x="24" y="139" width="272" height="3" rx="1.5" className="fill-primary/25" />
      <path d="M92 72 148 30l56 42" className="stroke-primary/50" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="104" y="72" width="88" height="67" rx="5" className="fill-card stroke-border" strokeWidth="2" />
      <rect x="118" y="88" width="24" height="20" rx="3" className="stroke-primary/30" strokeWidth="2" />
      <rect x="156" y="102" width="22" height="37" rx="3" className="stroke-primary/30" strokeWidth="2" />
      {/* Shield */}
      <path d="M232 60h44v34c0 20-14 30-22 34-8-4-22-14-22-34V60Z" className="fill-card stroke-border" strokeWidth="2" />
      <path d="M244 92 252 100 266 82" className="stroke-flare" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
