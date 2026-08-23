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
 * Refinance — one house, two offers side by side.
 *
 * Deliberately makes NO directional claim: the two cards are the same height
 * and carry no figures. An illustration implying a saving is an unsubstantiated
 * advertising claim, and text inside artwork cannot be translated or read
 * aloud. What is true and shown: we put your file in front of more than one
 * lender. Whether that is cheaper is the lender'"'"'s answer, not our picture.
 */
export function RefinanceCompareArt({ className, "data-testid": testId }: IllustrationProps) {
  return (
    <svg viewBox="0 0 320 180" fill="none" aria-hidden="true"
      className={cn("h-auto w-full", className)} data-testid={testId}>
      {/* No ground panel. The brief says transparent background, always — and a
          `fill-muted` panel is INVISIBLE on the mint bands these sit on today
          while appearing as a box the moment one is placed on white. An
          illustration that changes shape with its surroundings is a trap, not a
          container. */}
      <rect x="24" y="139" width="272" height="3" rx="1.5" className="fill-primary/25" />
      {/* The house you already own */}
      <path d="M36 78 76 46l40 32" className="stroke-primary/50" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="46" y="78" width="60" height="61" rx="5" className="fill-card stroke-border" strokeWidth="2" />
      <rect x="66" y="104" width="20" height="35" rx="3" className="stroke-primary/30" strokeWidth="2" />
      {/* Two offers, weighed against each other */}
      <rect x="146" y="56" width="70" height="76" rx="6" className="fill-card stroke-border" strokeWidth="2" />
      <rect x="158" y="70" width="34" height="4" rx="2" className="fill-primary/70" />
      <rect x="158" y="84" width="46" height="3" rx="1.5" className="fill-primary/25" />
      <rect x="158" y="94" width="40" height="3" rx="1.5" className="fill-primary/25" />
      <rect x="158" y="110" width="26" height="8" rx="4" className="fill-flare" />
      <rect x="228" y="56" width="70" height="76" rx="6" className="fill-card stroke-border" strokeWidth="2" />
      <rect x="240" y="70" width="34" height="4" rx="2" className="fill-primary/70" />
      <rect x="240" y="84" width="46" height="3" rx="1.5" className="fill-primary/25" />
      <rect x="240" y="94" width="40" height="3" rx="1.5" className="fill-primary/25" />
      <rect x="240" y="110" width="26" height="8" rx="4" className="fill-primary/40" />
    </svg>
  );
}
