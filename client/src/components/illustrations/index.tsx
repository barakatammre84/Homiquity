import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Spot illustrations — the app's branded graphic layer (the authenticated app had
 * none; empty states fell back to a bare lucide icon in a gray circle, which read
 * as "stock"). These are inline SVG built from SEMANTIC tokens (fill-primary /
 * fill-muted / fill-card / stroke-border), so they:
 *   • re-skin per tenant (the brand hue drives `--primary`), and
 *   • stay design-token-guard safe (no palette literals, no inline hex).
 *
 * Decorative — always `aria-hidden`. Default size h-24 w-24; override via className.
 * Primarily for EmptyState (see ui/empty-state.tsx) and hero/onboarding moments.
 * See DESIGN_SYSTEM.md → Graphics & illustration.
 */

export interface IllustrationProps {
  className?: string;
  /**
   * Optional hook for tests. Declared because it is NOT free: props absent from
   * this interface are dropped without reaching the DOM, so a `data-testid`
   * passed to one of these would silently never render and any test targeting
   * it would fail for a reason nowhere near the cause.
   */
  "data-testid"?: string;
}

/** "You're all caught up" — a check in a ring. */
export function AllCaughtUpArt({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className={cn("h-24 w-24", className)}
    >
      <circle cx="60" cy="60" r="46" className="fill-muted" />
      <circle
        cx="60"
        cy="60"
        r="30"
        className="fill-card stroke-primary"
        strokeWidth="3"
      />
      <path
        d="M49 61 57 69 73 51"
        className="stroke-primary"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="95" cy="33" r="4" className="fill-primary/50" />
      <circle cx="27" cy="83" r="3" className="fill-primary/40" />
    </svg>
  );
}

/** Empty inbox / no messages — an open envelope. */
export function EmptyInboxArt({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className={cn("h-24 w-24", className)}
    >
      <circle cx="60" cy="60" r="46" className="fill-muted" />
      <rect
        x="34"
        y="44"
        width="52"
        height="34"
        rx="6"
        className="fill-card stroke-border"
        strokeWidth="2.5"
      />
      <path
        d="M35 48 60 65 85 48"
        className="stroke-primary"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Empty documents — a single sheet with lines. */
export function EmptyDocsArt({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className={cn("h-24 w-24", className)}
    >
      <circle cx="60" cy="60" r="46" className="fill-muted" />
      <rect
        x="42"
        y="34"
        width="40"
        height="52"
        rx="6"
        className="fill-card stroke-border"
        strokeWidth="2.5"
      />
      <line
        x1="50"
        y1="49"
        x2="74"
        y2="49"
        className="stroke-primary"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="50"
        y1="60"
        x2="74"
        y2="60"
        className="stroke-border"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="50"
        y1="71"
        x2="66"
        y2="71"
        className="stroke-border"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
