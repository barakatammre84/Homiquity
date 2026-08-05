/**
 * SLA-class badge styling.
 *
 * The badge used to build its classes by interpolation —
 * `bg-${sla.colorCode}-500/10 text-${sla.colorCode}-600 …` — which never
 * worked: Tailwind extracts class names statically, so an interpolated name is
 * never generated and every badge rendered unstyled. Writing the literals out
 * instead is not an option either; `scripts/design-token-guard.cjs` bans exactly
 * those palette names (red/orange/amber/blue/gray/slate/…).
 *
 * So the stored colorCode maps to the design system's semantic subtle tokens —
 * the same vocabulary SlaHeatmap already uses for the on-track / at-risk /
 * breached bars. Six palette values compress onto four severity tiers, so S0+S1
 * (immediate + critical, both file-blocking) share the destructive tier and
 * S4+S5 (low + informational, neither file-blocking) share the muted one.
 */

/** colorCode as seeded in server/seedData/taskEngineSla.ts. */
export const SLA_BADGE_CLASSES: Record<string, string> = {
  red: "bg-destructive-subtle text-destructive-subtle-foreground border-transparent",
  orange: "bg-destructive-subtle text-destructive-subtle-foreground border-transparent",
  amber: "bg-warning-subtle text-warning-subtle-foreground border-transparent",
  blue: "bg-info-subtle text-info-subtle-foreground border-transparent",
  gray: "bg-muted text-muted-foreground border-transparent",
  slate: "bg-muted text-muted-foreground border-transparent",
};

/** Falls back to the muted tier — the schema default for colorCode is "gray". */
export const SLA_BADGE_FALLBACK = SLA_BADGE_CLASSES.gray;

export function slaBadgeClass(colorCode: string | undefined): string {
  return (colorCode && SLA_BADGE_CLASSES[colorCode]) || SLA_BADGE_FALLBACK;
}
