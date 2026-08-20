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
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

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
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

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
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div className={cn(className)} variants={revealVariants}>
      {children}
    </motion.div>
  );
}
