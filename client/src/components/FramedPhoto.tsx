import { cn } from "@/lib/utils";

interface FramedPhotoProps {
  /** Bundled, same-origin image URL (from lifestyleImages). */
  src: string;
  /** Descriptive alt text — required. */
  alt: string;
  /** kebab-case test id, e.g. "img-hero-landing". */
  testId: string;
  /** CSS object-position focal point, e.g. "center 30%". */
  position?: string;
  /**
   * Aspect ratio / sizing utilities for the frame (default `aspect-[4/3]`).
   * Pass e.g. "aspect-square" or "aspect-[3/2]" to override.
   */
  className?: string;
  /** Hero photos should be "eager"; supporting photos stay "lazy" (default). */
  loading?: "lazy" | "eager";
  /** Show the soft emerald accent shape offset behind the photo (default true). */
  decoration?: boolean;
}

/**
 * A bright, rounded, framed photo with a soft emerald accent shape peeking out
 * behind it — the "photo as a crisp content block on a light page" treatment
 * (vs. a darkened full-bleed background). Reused in split heroes and in
 * alternating image+text sections. Undarkened, so photos read clearly.
 */
export function FramedPhoto({
  src,
  alt,
  testId,
  position,
  className,
  loading = "lazy",
  decoration = true,
}: FramedPhotoProps) {
  return (
    <div className={cn("relative aspect-[4/3]", className)}>
      {decoration && (
        <div
          aria-hidden="true"
          className="absolute inset-0 translate-x-4 translate-y-4 rounded-[1.75rem] bg-primary/10 sm:translate-x-5 sm:translate-y-5"
        />
      )}
      <div className="absolute inset-0 overflow-hidden rounded-[1.75rem] border border-border bg-muted shadow-xl shadow-primary/5">
        <img
          src={src}
          alt={alt}
          data-testid={testId}
          loading={loading}
          decoding="async"
          className="h-full w-full object-cover"
          style={position ? { objectPosition: position } : undefined}
        />
      </div>
    </div>
  );
}
