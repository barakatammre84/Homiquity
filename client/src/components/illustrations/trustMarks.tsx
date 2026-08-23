/**
 * Trust-row spot marks — Tier 1 of the illustration system, the tier the brief
 * calls highest-value and lowest-cost, and the one that answers the original
 * complaint most directly: the icons look generic because they are Lucide, the
 * most-used glyph set on the web.
 *
 * These are drawings, not glyphs. They are deliberately SMALL and simple: the
 * brief's rule is that a spot mark must read at 36px or it has failed, and
 * detail that disappears at that size is cost with no return. Judge them zoomed
 * out.
 *
 * Semantic tokens only, so they re-skin per tenant and stay token-guard safe.
 * Each is passed to `SpotArt` as its `fallback`, so an uploaded file for the
 * same concept supersedes it without a code change.
 *
 * Own module, never the barrel — that is reachable from an eager chunk.
 */
import { cn } from "@/lib/utils";

interface MarkProps {
  className?: string;
}

const BOX = "h-full w-full";

/** Homi answers questions — a mark, not a chat bubble. */
export function GuidanceMark({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={cn(BOX, className)}>
      <rect x="6" y="8" width="36" height="26" rx="8" className="fill-card stroke-primary" strokeWidth="2.5" />
      <path d="M16 38v-6l8 2z" className="fill-card stroke-primary" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M19 17a5 5 0 1 1 5 5v3" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="24" cy="29" r="1.6" className="fill-flare" />
    </svg>
  );
}

/** Business returns get their own worksheet — a page with a turned corner. */
export function IncomeMark({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={cn(BOX, className)}>
      <path d="M11 6h18l8 8v28a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
        className="fill-card stroke-primary" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M29 6v8h8" className="stroke-primary" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="15" y="22" width="18" height="2.5" rx="1.25" className="fill-primary/40" />
      <rect x="15" y="29" width="12" height="2.5" rx="1.25" className="fill-primary/40" />
      <rect x="15" y="36" width="9" height="3" rx="1.5" className="fill-flare" />
    </svg>
  );
}

/** We work for you — one form standing in front of another. */
export function AdvocacyMark({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={cn(BOX, className)}>
      <circle cx="31" cy="16" r="6" className="stroke-primary/40" strokeWidth="2.5" />
      <path d="M22 40c0-6 4-10 9-10s9 4 9 10" className="stroke-primary/40" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="18" cy="17" r="7" className="fill-card stroke-primary" strokeWidth="2.5" />
      <path d="M7 41c0-7 5-12 11-12s11 5 11 12" className="fill-card stroke-primary" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="18" cy="17" r="1.8" className="fill-flare" />
    </svg>
  );
}

/** Licensed and regulated — a seal, not a padlock. */
export function LicensingMark({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={cn(BOX, className)}>
      <circle cx="24" cy="19" r="13" className="fill-card stroke-primary" strokeWidth="2.5" />
      <path d="M18 19.5 22.5 24 30 15" className="stroke-flare" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 30 14 43l10-4 10 4-3-13" className="stroke-primary" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}
