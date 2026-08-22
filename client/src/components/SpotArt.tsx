/**
 * SpotArt — renders a bespoke spot illustration when one exists, and the
 * canonical Lucide glyph when it does not.
 *
 * The fallback is the point. See `client/src/lib/spotArt.ts` for why zero
 * artwork has to be a working state, and
 * knowledge-base/design-identity/ILLUSTRATION_BRIEF.md for what to commission.
 */
import { Icons, iconSize, type IconName, type IconSizeRung } from "@/lib/icons";
import { getSpotArt } from "@/lib/spotArt";
import { cn } from "@/lib/utils";

export interface SpotArtProps {
  /** A concept from the icon registry. The drawing, if any, is named after it. */
  name: IconName;
  /** Registry size rung. Spot art is designed at 36-48px, so `empty` (40px) is the default. */
  size?: IconSizeRung;
  /**
   * Describes the drawing for anyone who cannot see it. Leave unset when the
   * adjacent heading already says the same thing — a spot icon beside the words
   * it illustrates is decoration, and announcing it twice is worse than silence.
   */
  alt?: string;
  className?: string;
}

export function SpotArt({ name, size = "empty", alt, className }: SpotArtProps) {
  const drawing = getSpotArt(name);
  const box = cn(iconSize[size], className);

  if (drawing) {
    return (
      <img
        src={drawing}
        // "" is a deliberate, meaningful value here: it marks the image
        // decorative so screen readers skip it, which is correct when the
        // heading beside it already carries the meaning.
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        className={cn(box, "object-contain")}
        data-testid={`spot-art-${name}`}
      />
    );
  }

  const Glyph = Icons[name];
  return (
    <Glyph
      className={box}
      aria-hidden={alt ? undefined : true}
      aria-label={alt}
      role={alt ? "img" : undefined}
      data-testid={`spot-glyph-${name}`}
    />
  );
}
