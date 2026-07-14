import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Typographic scale primitives — enforce ONE heading/text scale so sizes aren't
 * hand-picked per page (the audit found bespoke h1s at text-xl→text-5xl). See
 * design_guidelines.md → Typography and visual-consistency-standard.md §1.
 *
 * Weights 600–700, tight tracking, per the design language. All sizes are
 * canonical tokens — pass `className` only for spacing/color, not to resize.
 */

/** Heading levels. Level 1 = the page <h1> (one rung: text-2xl sm:text-3xl). */
const headingStyles = {
  1: "text-2xl font-bold tracking-tight sm:text-3xl",
  2: "text-2xl font-semibold tracking-tight",
  3: "text-lg font-semibold tracking-tight",
  4: "text-base font-semibold",
} as const;

export type HeadingLevel = keyof typeof headingStyles;

export interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Visual + default semantic level (1–4). Defaults to 1. */
  level?: HeadingLevel;
  /**
   * Override the rendered tag independently of the visual level — e.g. a
   * visually-level-2 heading that must be an <h1> for document outline.
   */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ level = 1, as, className, ...props }, ref) => {
    const Tag = (as ?? `h${level}`) as React.ElementType;
    return (
      <Tag ref={ref} className={cn(headingStyles[level], className)} {...props} />
    );
  },
);
Heading.displayName = "Heading";

const textVariants = cva("", {
  variants: {
    variant: {
      body: "text-base leading-relaxed",
      lead: "text-lg leading-relaxed",
      muted: "text-sm text-muted-foreground",
      caption: "text-xs text-muted-foreground",
      // The standard small-caps section label (formerly applied ad hoc).
      eyebrow:
        "text-xs font-semibold uppercase tracking-wider text-muted-foreground",
    },
  },
  defaultVariants: { variant: "body" },
});

export interface TextProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof textVariants> {
  /** Rendered element. Defaults to <p>. */
  as?: React.ElementType;
}

const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ variant, as: Tag = "p", className, ...props }, ref) => (
    <Tag ref={ref} className={cn(textVariants({ variant }), className)} {...props} />
  ),
);
Text.displayName = "Text";

export { Heading, Text, headingStyles, textVariants };
