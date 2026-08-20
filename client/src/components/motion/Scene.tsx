import * as React from "react";
import { useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Scene — a still illustration that comes to life when it scrolls into view.
 *
 * This is the delivery mechanism behind the "cartoon animation" on money-brand
 * marketing sites, reverse-engineered from monzo.com rather than guessed at. Their
 * home page carries 27 of these and their savings page 12. The pattern is:
 *
 *   • a SQUARE poster still, served as avif at ~3x the rendered size
 *     (w=864 for a 288-320px slot), eager above the fold and lazy below it
 *   • a short MUTED .webm alongside it, `playsInline`, `autoplay={false}`
 *   • JavaScript starts it when the element enters the viewport
 *
 * Not Lottie, not SVG SMIL, not CSS keyframes — measured: zero of each on their
 * pages. Video wins here because illustrated character animation has far too many
 * moving parts to express as vectors at a sane file size.
 *
 * 🚨 The poster is NOT a fallback, it is the base layer. It renders always and the
 * video fades in over it once it can actually play. That way a slow connection, a
 * codec miss or a blocked autoplay degrades to a still picture rather than a hole
 * in the page — the failure mode this component exists to prevent.
 *
 * Reduced motion is honoured by NOT MOUNTING THE VIDEO AT ALL. Pausing it would
 * still download it and still leave a first frame that differs from the poster;
 * omitting the element is the only version that genuinely costs nothing and moves
 * nothing.
 *
 * ⚠️ ASSETS ARE NOT INCLUDED AND CANNOT BE. This ships the mechanism; the artwork
 * is a commission. See the brief in knowledge-base/design-identity/.
 */

export interface SceneProps {
  /** Square still. Always rendered — the base layer, never merely a fallback. */
  poster: string;
  /** Optional muted loop. Omit and this is simply a picture. */
  video?: string;
  /** Describes the illustration, or "" if it is purely decorative beside a heading. */
  alt: string;
  /** Above the fold: load eagerly and decode synchronously, as the hero should. */
  priority?: boolean;
  className?: string;
}

export function Scene({ poster, video, alt, priority = false, className }: SceneProps) {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = React.useState(false);

  // Play on entry, pause on exit. Pausing off-screen is not a nicety: a page with
  // a dozen of these decoding video the whole time flattens a laptop battery.
  React.useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void el.play().then(() => setPlaying(true)).catch(() => {
            // Autoplay refused (battery saver, data saver, policy). The poster is
            // already on screen, so there is nothing to recover — stay still.
          });
        } else {
          el.pause();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <div className={cn("relative aspect-square overflow-hidden rounded-3xl", className)}>
      <img
        src={poster}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        className="h-full w-full object-cover"
      />
      {video && !reduced ? (
        <video
          ref={ref}
          src={video}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
          tabIndex={-1}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
            playing ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
    </div>
  );
}
