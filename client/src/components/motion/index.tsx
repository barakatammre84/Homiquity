import * as React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Motion primitives — the app's animation vocabulary.
 *
 * Deliberately THREE, not a library. Scattered one-off effects are what make a
 * page read as assembled (and, lately, as AI-generated); one orchestrated moment
 * reads as designed. Anything that cannot be expressed with `Reveal`, `Stagger`
 * and `StaggerItem` probably should not be animated.
 *
 * 🚨 EVERY primitive honours reduced motion, and it is NOT optional.
 * `client/src/index.css` zeroes CSS animation for `prefers-reduced-motion`, but
 * CSS cannot reach JS-driven animation — framer-motion sets inline transforms and
 * opacity, so the CSS floor does nothing for it. `useReducedMotion()` is the only
 * thing standing between this module and a visitor who asked for less motion
 * getting it anyway. When it returns true these render as plain elements with no
 * transform, no opacity ramp, and no observer.
 *
 * Durations and easing come from the tokens in `index.css`
 * (`--duration-base`, `--ease-entrance`) rather than being restated here, so the
 * scale stays in one place. framer-motion needs numbers and a cubic array, so the
 * values are mirrored below — the ONE duplication in this module, kept explicit
 * because a token read at runtime would cost a layout flush per element.
 */

/** Mirrors --duration-base (240ms) and --ease-entrance. Keep in step with index.css. */
const DURATION = 0.24;
const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

/** Distance an entering element travels. Small on purpose — motion that announces itself dates fast. */
const RISE = 12;

const revealVariants: Variants = {
  hidden: { opacity: 0, y: RISE },
  shown: { opacity: 1, y: 0, transition: { duration: DURATION, ease: EASE } },
};

/**
 * Whether it is safe to animate at all.
 *
 * 🚨 THESE PRIMITIVES HIDE CONTENT AND RELY ON JS TO BRING IT BACK. `initial:
 * hidden` sets inline `opacity: 0`, so if the animation never completes, the
 * content is never seen. That is not hypothetical — it was caught on the home
 * page: two journey cards sat at opacity 0 and two at 0.27 and 0.78, IDENTICAL
 * at 6s and 10s. Stalled, not slow.
 *
 * The cause is `document.hidden`. Browsers throttle `requestAnimationFrame` in
 * a background tab, and framer-motion drives on rAF, so a reveal that starts
 * while hidden can stop mid-ramp and leave the element part-transparent or
 * invisible. A page opened in a background tab is an ordinary thing to do.
 *
 * So a hidden document is treated exactly like reduced motion: render plainly,
 * no observer, no opacity ramp. Nobody is watching an animation in a tab they
 * cannot see — the only thing that matters there is that the content EXISTS.
 *
 * `visibilitychange` is still observed so a tab that starts hidden and is later
 * brought forward animates normally from then on, rather than being permanently
 * demoted.
 */
function useCanAnimate(): boolean {
  const reduced = useReducedMotion();
  const [hidden, setHidden] = React.useState(
    () => typeof document !== "undefined" && document.hidden,
  );

  React.useEffect(() => {
    const sync = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return !reduced && !hidden;
}

export interface MotionProps {
  children: React.ReactNode;
  className?: string;
  /** Delay in seconds before this element starts. Use sparingly; prefer Stagger. */
  delay?: number;
}

/**
 * Reveal — fades and rises an element the first time it scrolls into view.
 *
 * `once: true` is deliberate: re-animating on every scroll past is the single
 * most common way a "designed" page becomes an irritating one.
 */
export function Reveal({ children, className, delay = 0 }: MotionProps) {
  if (!useCanAnimate()) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount: 0.25 }}
      variants={revealVariants}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger — a parent whose `StaggerItem` children enter in sequence.
 *
 * This is the "one orchestrated moment" the direction calls for: a row of cards
 * arriving in order reads as composed, where the same cards each fading
 * independently reads as noise.
 */
export function Stagger({ children, className, delay = 0 }: MotionProps) {
  if (!useCanAnimate()) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: 0.07, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

/** A child of `Stagger`. Outside one it renders static — it inherits its parent's state. */
export function StaggerItem({ children, className }: Omit<MotionProps, "delay">) {
  if (!useCanAnimate()) return <div className={className}>{children}</div>;

  return (
    <motion.div className={cn(className)} variants={revealVariants}>
      {children}
    </motion.div>
  );
}

/**
 * ScenePauseButton — the WCAG 2.2.2 control for a page carrying looping scenes.
 *
 * Level A requires a mechanism to pause motion that starts automatically and lasts
 * over five seconds. A loop lasts forever, so any page with a playing `Scene` owes
 * the visitor this button. Render it once, near the scenes, not per scene.
 *
 * Deliberately a real button with visible text rather than an icon-only control:
 * the people most likely to need it are the least well served by a glyph they have
 * to decode.
 */
export function ScenePauseButton({
  paused,
  onToggle,
  className,
}: {
  paused: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={paused}
      className={cn(
        "min-h-11 rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground",
        "transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      data-testid="button-scene-pause"
    >
      {paused ? "Play animations" : "Pause animations"}
    </button>
  );
}
