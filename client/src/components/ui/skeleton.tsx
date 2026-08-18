import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // Precision loading state: field-level Frost→Paper pulse (see
      // DESIGN_SYSTEM.md) instead of a generic gray shimmer. Dark mode
      // falls back to a muted pulse on the ramp's deep end.
      className={cn(
        "rounded-md bg-precision-100 animate-skeleton-precision dark:bg-muted dark:animate-pulse",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
