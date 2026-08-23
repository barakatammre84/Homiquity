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
 * "A human reads your file" — a person and a document, used on every persona
 * page in the ImageTextSection slot.
 *
 * The figure is an abstract geometric silhouette on purpose: no skin tone, no
 * age, no family composition, nothing that could read as who this product is
 * FOR. That is the same Fair Housing representation rule that governs
 * lifestyleImages, applied to drawn people.
 */
export function AdvocacyArt({ className, "data-testid": testId }: IllustrationProps) {
  return (
    <svg viewBox="0 0 320 180" fill="none" aria-hidden="true"
      className={cn("h-auto w-full", className)} data-testid={testId}>
      {/* No ground panel. The brief says transparent background, always — and a
          `fill-muted` panel is INVISIBLE on the mint bands these sit on today
          while appearing as a box the moment one is placed on white. An
          illustration that changes shape with its surroundings is a trap, not a
          container. */}
      <rect x="24" y="147" width="272" height="3" rx="1.5" className="fill-primary/25" />
      {/* The file, open */}
      <rect x="132" y="42" width="92" height="105" rx="6" className="fill-card stroke-border" strokeWidth="2" />
      <rect x="146" y="60" width="46" height="4" rx="2" className="fill-primary/70" />
      <rect x="146" y="76" width="64" height="3" rx="1.5" className="fill-primary/25" />
      <rect x="146" y="86" width="64" height="3" rx="1.5" className="fill-primary/25" />
      <rect x="146" y="96" width="48" height="3" rx="1.5" className="fill-primary/25" />
      <rect x="146" y="114" width="34" height="8" rx="4" className="fill-flare" />
      {/* The person reading it */}
      <circle cx="72" cy="66" r="19" className="fill-card stroke-border" strokeWidth="2" />
      <path d="M38 147c0-20 15-34 34-34s34 14 34 34" className="fill-card stroke-border" strokeWidth="2" />
      <rect x="248" y="86" width="40" height="4" rx="2" className="fill-primary/30" />
      <rect x="248" y="100" width="28" height="4" rx="2" className="fill-primary/20" />
    </svg>
  );
}
