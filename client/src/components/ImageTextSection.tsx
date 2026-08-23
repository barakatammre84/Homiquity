import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FramedPhoto } from "@/components/FramedPhoto";

interface ImageTextSectionProps {
  /**
   * A rendered illustration. Preferred over `image`: it is token-driven, so it
   * re-skins per tenant and carries no stock-photography licence or Fair
   * Housing representation question.
   */
  illustration?: ReactNode;
  /** Bundled, same-origin photo URL. Ignored when `illustration` is given. */
  image?: string;
  /** Descriptive alt text — required when `image` is used. */
  imageAlt?: string;
  /** kebab-case test id for the section, e.g. "section-afford". */
  testId: string;
  /** Small emerald label above the title. */
  eyebrow?: string;
  /** Section heading. */
  title: string;
  /** Body content — paragraph text, bullet lists, CTA buttons, etc. */
  children: ReactNode;
  /** Put the image on the LEFT (text right) instead of the default image-right. */
  reverse?: boolean;
  /** CSS object-position focal point for the photo. */
  imagePosition?: string;
  /** Extra classes on the <section> (e.g. a `bg-muted/30` band). */
  className?: string;
}

/**
 * An alternating image + text content row — the building block for the
 * photo-rich marketing pages. Stack the image on top on mobile; on large
 * screens it sits beside the copy, side chosen by `reverse` so consecutive
 * sections can zig-zag (image-right → image-left → …).
 */
export function ImageTextSection({
  illustration,
  image,
  imageAlt,
  testId,
  eyebrow,
  title,
  children,
  reverse = false,
  imagePosition,
  className,
}: ImageTextSectionProps) {
  return (
    <section className={cn("px-4 py-16 sm:px-6 lg:px-8 lg:py-20", className)} data-testid={testId}>
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className={cn(reverse && "lg:order-2")}>
          {eyebrow && (
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>
          )}
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
          <div className="mt-5 space-y-4 text-lg leading-relaxed text-muted-foreground">{children}</div>
        </div>
        {illustration ? (
          <div className={cn(reverse && "lg:order-1")} data-testid={`${testId}-image`}>
            {illustration}
          </div>
        ) : image ? (
          <FramedPhoto
            src={image}
            alt={imageAlt ?? ""}
            testId={`${testId}-image`}
            position={imagePosition}
            className={cn(reverse && "lg:order-1")}
          />
        ) : null}
      </div>
    </section>
  );
}
