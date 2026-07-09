import { cn } from "@/lib/utils";

interface LifestyleImageProps {
  /** Bundled, same-origin image URL (from lifestyleImages). */
  src: string;
  /** Descriptive alt text — required (foreground images convey meaning). */
  alt: string;
  /** kebab-case test id, e.g. "img-founder-note". */
  testId: string;
  className?: string;
  /** Non-hero images should stay "lazy" (the default). */
  loading?: "lazy" | "eager";
  /** CSS object-position focal point, e.g. "center 30%". */
  position?: string;
}

/**
 * Foreground lifestyle photo for supporting marketing sections (trust bands,
 * education/calculator hubs). Rounded `object-cover` with required alt + test
 * id, mirroring the established <img> convention. Give it a sized container.
 */
export function LifestyleImage({
  src,
  alt,
  testId,
  className,
  loading = "lazy",
  position,
}: LifestyleImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      data-testid={testId}
      className={cn("h-full w-full rounded-2xl object-cover", className)}
      style={position ? { objectPosition: position } : undefined}
    />
  );
}
