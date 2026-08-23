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

/** First-time buyer — a door, and the key that opens it. */
export function FirstKeyArt({ className, "data-testid": testId }: IllustrationProps) {
  return (
    <svg viewBox="0 0 320 180" fill="none" aria-hidden="true"
      className={cn("h-auto w-full", className)} data-testid={testId}>
      {/* No ground panel. The brief says transparent background, always — and a
          `fill-muted` panel is INVISIBLE on the mint bands these sit on today
          while appearing as a box the moment one is placed on white. An
          illustration that changes shape with its surroundings is a trap, not a
          container. */}
      <rect x="24" y="139" width="272" height="3" rx="1.5" className="fill-primary/25" />
      {/* Door frame */}
      <rect x="72" y="40" width="96" height="99" rx="6" className="fill-card stroke-border" strokeWidth="2" />
      <rect x="84" y="52" width="72" height="75" rx="4" className="stroke-primary/30" strokeWidth="2" />
      <circle cx="146" cy="92" r="4" className="fill-primary" />
      {/* Roofline above the door — a house, implied not drawn */}
      <path d="M60 40 120 12l60 28" className="stroke-primary/50" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* The key */}
      <circle cx="222" cy="84" r="15" className="fill-card stroke-border" strokeWidth="2" />
      <circle cx="222" cy="84" r="5" className="fill-flare" />
      <rect x="235" y="81" width="48" height="6" rx="3" className="fill-card stroke-border" strokeWidth="2" />
      <rect x="264" y="87" width="5" height="9" rx="2.5" className="fill-card stroke-border" strokeWidth="2" />
      <rect x="274" y="87" width="5" height="9" rx="2.5" className="fill-card stroke-border" strokeWidth="2" />
    </svg>
  );
}
