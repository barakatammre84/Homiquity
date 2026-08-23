import { cn } from "@/lib/utils";
import type { IllustrationProps } from "./index";

/**
 * ITS OWN MODULE ON PURPOSE — do not fold this back into `index.tsx`.
 *
 * That barrel is imported by an EAGER chunk as well as lazy ones, and Rollup
 * hoists a module shared between the two WHOLE into the eager chunk. Adding
 * this art there grew the eager entry by 151 bytes for a graphic that only one
 * lazily-loaded marketing page ever renders. `guard:bundle` caught it. Moving
 * the bytes is the fix; raising the baseline would have been the cover-up.
 *
 * The type import is `import type`, so it erases at build and creates no
 * runtime edge back to the barrel.
 */

/**
 * Self-employed hero — a desk that pays irregularly: a business return, a
 * laptop, a coffee. Replaces the posed stock photograph that sat here, which
 * was the single most generic thing on the page and belonged to no system.
 *
 * 16:9 on purpose. That is the ratio the illustrator's Tier 2 scenes are
 * commissioned at (see ILLUSTRATION_BRIEF.md), so when
 * `attached_assets/scenes/self-employed_poster.png` lands it drops into the
 * same slot without a layout change. This is the honest interim: on-system and
 * token-driven, but NOT a commissioned illustrator's work, and it should be
 * replaced by one.
 */
export function SelfEmployedDeskArt({ className, "data-testid": testId }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 320 180"
      fill="none"
      aria-hidden="true"
      className={cn("h-auto w-full", className)}
      data-testid={testId}
    >
      {/* Ground panel — the mint container the rest sits inside. */}
      {/* No ground panel. The brief says transparent background, always — and a
          `fill-muted` panel is INVISIBLE on the mint bands these sit on today
          while appearing as a box the moment one is placed on white. An
          illustration that changes shape with its surroundings is a trap, not a
          container. */}

      {/* Desk line. */}
      <rect x="24" y="139" width="272" height="3" rx="1.5" className="fill-primary/25" />

      {/* Laptop — screen, then the base slab. */}
      <rect x="38" y="58" width="104" height="66" rx="6" className="fill-card stroke-border" strokeWidth="2" />
      <rect x="48" y="70" width="58" height="4" rx="2" className="fill-primary/70" />
      <rect x="48" y="82" width="76" height="3" rx="1.5" className="fill-primary/30" />
      <rect x="48" y="92" width="66" height="3" rx="1.5" className="fill-primary/30" />
      <rect x="48" y="102" width="40" height="3" rx="1.5" className="fill-primary/30" />
      <rect x="28" y="124" width="124" height="9" rx="4.5" className="fill-card stroke-border" strokeWidth="2" />

      {/* The business return — thicker than expected, which is the whole point. */}
      <rect x="176" y="52" width="80" height="88" rx="5" className="fill-card stroke-border" strokeWidth="2" />
      <rect x="184" y="46" width="80" height="88" rx="5" className="fill-card stroke-border" strokeWidth="2" />
      <rect x="194" y="60" width="46" height="4" rx="2" className="fill-primary/70" />
      <rect x="194" y="74" width="60" height="3" rx="1.5" className="fill-primary/25" />
      <rect x="194" y="84" width="60" height="3" rx="1.5" className="fill-primary/25" />
      <rect x="194" y="94" width="44" height="3" rx="1.5" className="fill-primary/25" />
      {/* One flare mark: the figure that actually matters on the page. */}
      <rect x="194" y="108" width="30" height="8" rx="4" className="fill-flare" />

      {/* Coffee. */}
      <rect x="270" y="112" width="26" height="24" rx="4" className="fill-card stroke-border" strokeWidth="2" />
      <path d="M296 118h6a5 5 0 0 1 0 10h-6" className="stroke-border" strokeWidth="2" />
      <rect x="276" y="104" width="3" height="6" rx="1.5" className="fill-primary/40" />
      <rect x="286" y="102" width="3" height="8" rx="1.5" className="fill-primary/30" />
    </svg>
  );
}
