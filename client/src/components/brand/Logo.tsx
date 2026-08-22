import * as React from "react";

import { cn } from "@/lib/utils";
import { useBranding } from "./BrandingProvider";

/**
 * The one brand lockup. Replaces the ~13 copy-pasted `homiquity` wordmark spans
 * (which varied in weight/size/color). Branding-aware: on a private surface with
 * an active tenant it shows the tenant logo/brand name; otherwise the Homiquity
 * wordmark + logomark. See DESIGN_SYSTEM.md → Brand & white-label.
 *
 * Phase 2 ships this component but does NOT swap it into the existing spans yet
 * (that migration + mounting BrandingProvider is Phase 4), so it is inert.
 */

const wordmarkSize = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
} as const;

const markSize = {
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-7 w-7",
} as const;

const imgHeight = {
  sm: "h-6",
  md: "h-7",
  lg: "h-9",
} as const;

const toneClass = {
  brand: "text-flare", // the wordmark carries the orange accent on light surfaces.
  // WCAG 1.4.3 exempts logotypes from contrast, which is why the BRIGHT flare is
  // permitted here and nowhere a person has to read prose (use --flare-ink there).
  onDark: "text-sidebar-foreground", // on the royal sidebar / dark surfaces
  mono: "text-foreground", // neutral
} as const;

export interface LogoProps {
  size?: keyof typeof wordmarkSize;
  variant?: "wordmark" | "mark" | "lockup";
  tone?: keyof typeof toneClass;
  className?: string;
  "data-testid"?: string;
}

/**
 * Homiquity logomark — the app's first real mark. A rising roofline (home +
 * upward momentum). `currentColor` so it inherits the tokenized text color and
 * re-skins per tenant; no palette literals (design-token-guard safe).
 */
function Logomark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M3 12.5 11.2 5a1.2 1.2 0 0 1 1.6 0L21 12.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 11v7.5a1 1 0 0 0 1 1H17.5a1 1 0 0 0 1-1V11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 19.5V14h5v5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  size = "md",
  variant = "lockup",
  tone = "brand",
  className,
  "data-testid": testId = "logo",
}: LogoProps) {
  const { isWhiteLabeled, logoUrl, brandName } = useBranding();

  // White-label: a tenant logo image wins when present.
  if (isWhiteLabeled && logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={brandName ?? "Brand logo"}
        className={cn("object-contain w-auto", imgHeight[size], className)}
        data-testid={testId}
      />
    );
  }

  const label = isWhiteLabeled && brandName ? brandName : "homiquity";
  const showMark = variant !== "wordmark";
  const showWord = variant !== "mark";

  return (
    <span
      className={cn("inline-flex items-center gap-2", toneClass[tone], className)}
      data-testid={testId}
    >
      {showMark && <Logomark className={markSize[size]} />}
      {showWord && (
        <span className={cn("font-bold tracking-tight", wordmarkSize[size])}>
          {label}
        </span>
      )}
    </span>
  );
}
