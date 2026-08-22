import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Charcoal Emerald atoms — hierarchy through value, not hue:
 *  default   = Layer 2: emerald conversion fill (hover deepens via the elevate system)
 *  secondary = frosted chip on the ramp
 *  outline   = Layer 1: white + hairline (elevate supplies the hover tint)
 *  destructive = semantic pop (danger red, outside the ramp)
 */
/**
 * Radius and weight, 2026-08-20: `rounded-md` (8px) → `rounded-full`, and
 * `font-medium` → `font-semibold`.
 *
 * Measured off Habito's live CTA rather than chosen by taste: border-radius 32px
 * on a 48px control (a full pill), padding 0 32px, font-weight 700. Monzo's
 * display sits at 800. A pill reads as a deliberate control; an 8px rectangle is
 * what every shadcn app ships unmodified, which is precisely the "generic"
 * complaint this work exists to answer.
 *
 * font-semibold rather than the reference's 700, because this app pairs it with
 * Inter/Geist rather than Roobert — 700 in Inter at 14px goes muddy where
 * Roobert stays crisp. The reference is a reference, not a spec.
 *
 * Every variant and size inherits this, so the change reaches every button in
 * the app without touching a single call site. Nothing asserts button classes in
 * the test suite, verified before editing.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transition-all duration-150 ease-in-out" +
  " hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground",
        destructive:
          "bg-destructive text-destructive-foreground",
        outline:
          "border border-input bg-card text-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        ghost: "text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
