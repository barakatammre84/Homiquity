import { cn } from "@/lib/utils";

interface HeroPhotoBackdropProps {
  /** Bundled, same-origin image URL (from lifestyleImages). */
  src: string;
  /** CSS object-position focal point, e.g. "center 30%". Defaults to "center". */
  position?: string;
  /**
   * Scrim shape, matched to where the hero copy sits:
   * - "side" (default): copy is left-aligned (Landing) → darkest on the left,
   *   clearing toward the right so the photo reads in the open space.
   * - "center": copy is centered (persona pages) → a symmetric wash so text
   *   stays legible over faces on either side.
   */
  variant?: "side" | "center";
  /** Extra classes for the <img> (rarely needed). */
  className?: string;
}

const SCRIM: Record<NonNullable<HeroPhotoBackdropProps["variant"]>, string> = {
  side: "bg-gradient-to-r from-precision-950/85 via-precision-950/55 to-precision-900/25",
  center: "bg-gradient-to-b from-precision-950/75 via-precision-950/60 to-precision-950/75",
};

/**
 * Decorative photo layer for the dark landing/persona heroes. Renders an eager
 * <img> beneath a charcoal→emerald scrim so the existing white hero text keeps
 * WCAG AA contrast (the scrim is darkest at the top-left where the headline
 * sits, letting the photo read more openly toward the bottom-right).
 *
 * Purely presentational: the hero heading carries the meaning, so the image is
 * aria-hidden with empty alt. Drop this as the FIRST child of a `relative`
 * hero <section>; the content wrapper (also `relative`) then stacks on top.
 */
export function HeroPhotoBackdrop({
  src,
  position = "center",
  variant = "side",
  className,
}: HeroPhotoBackdropProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden bg-precision-950"
      aria-hidden="true"
      data-testid="hero-photo-backdrop"
    >
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="async"
        className={cn("h-full w-full object-cover", className)}
        style={{ objectPosition: position }}
      />
      {/* Charcoal/emerald scrim so the photo stays visible while white hero
          text keeps WCAG AA contrast. Shape follows the copy (see `variant`). */}
      <div className={cn("absolute inset-0", SCRIM[variant])} />
      {variant === "side" && (
        // Extra bottom deepening for the value-prop cards below a left-aligned hero.
        <div className="absolute inset-0 bg-gradient-to-b from-precision-950/35 via-transparent to-precision-950/45" />
      )}
    </div>
  );
}
