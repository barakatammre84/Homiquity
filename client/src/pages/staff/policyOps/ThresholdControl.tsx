import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { PolicyThreshold } from "@shared/schema";

/**
 * The edit for one threshold row, as a partial PATCH body. Only the value
 * column the row actually uses is ever sent.
 */
export type ThresholdEdit = Partial<
  Pick<PolicyThreshold, "valueNumeric" | "valuePercent" | "valueBool" | "valueEnum">
>;

/**
 * Which value column a threshold row uses.
 *
 * policy_thresholds carries four mutually-exclusive value columns and the row
 * populates exactly one; that choice is what says whether the control is a
 * number, a percentage, a toggle or a fixed option. Reading it from the data
 * is the whole reason this editor does not need a hardcoded control per
 * threshold.
 *
 * A row with every column null is malformed rather than boolean-typed, so it
 * is reported as such instead of silently rendering as an off switch.
 */
export type ThresholdKind = "numeric" | "percent" | "bool" | "enum" | "unknown";

export function thresholdKind(t: PolicyThreshold): ThresholdKind {
  if (t.valueBool !== null && t.valueBool !== undefined) return "bool";
  if (t.valuePercent !== null && t.valuePercent !== undefined) return "percent";
  if (t.valueNumeric !== null && t.valueNumeric !== undefined) return "numeric";
  if (t.valueEnum !== null && t.valueEnum !== undefined) return "enum";
  return "unknown";
}

/** The row's current value, with any unsaved edit applied on top. */
export function currentValue(t: PolicyThreshold, edit: ThresholdEdit | undefined) {
  return {
    numeric: edit?.valueNumeric ?? t.valueNumeric,
    percent: edit?.valuePercent ?? t.valuePercent,
    bool: edit?.valueBool ?? t.valueBool,
    enumValue: edit?.valueEnum ?? t.valueEnum,
  };
}

/**
 * Is a numeric edit inside the row's own bounds?
 *
 * The server rejects out-of-bounds valueNumeric with a 400 ("Value must be
 * between X and Y"), so checking here is about telling the operator before
 * they hit Save rather than about trusting the client. Bounds are per-row and
 * optional — a row with no bounds accepts anything the server accepts.
 */
export function isOutOfBounds(t: PolicyThreshold, raw: string | null | undefined): boolean {
  if (raw === null || raw === undefined || raw === "") return false;
  const value = Number(raw);
  if (Number.isNaN(value)) return true;
  if (t.minBound !== null && value < Number(t.minBound)) return true;
  if (t.maxBound !== null && value > Number(t.maxBound)) return true;
  return false;
}

function boundsHint(t: PolicyThreshold): string | null {
  if (t.minBound === null && t.maxBound === null) return null;
  if (t.minBound !== null && t.maxBound !== null) return `Allowed range: ${t.minBound} – ${t.maxBound}`;
  if (t.minBound !== null) return `Minimum: ${t.minBound}`;
  return `Maximum: ${t.maxBound}`;
}

/**
 * One threshold, rendered from its own row: displayName is the label,
 * description is the help text, and the bounds are shown so the operator can
 * see the limit they are working inside.
 */
export function ThresholdControl({
  threshold,
  edit,
  onChange,
  disabled,
}: {
  threshold: PolicyThreshold;
  edit: ThresholdEdit | undefined;
  onChange: (next: ThresholdEdit) => void;
  disabled?: boolean;
}) {
  const kind = thresholdKind(threshold);
  const value = currentValue(threshold, edit);
  const label = threshold.displayName || threshold.thresholdKey;
  const hint = boundsHint(threshold);
  const testId = `threshold-${threshold.thresholdKey}`;

  const outOfBounds = kind === "numeric" && isOutOfBounds(threshold, value.numeric);

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor={testId} className="text-sm font-medium">
          {label}
        </Label>

        {kind === "bool" && (
          <Switch
            id={testId}
            checked={!!value.bool}
            disabled={disabled}
            onCheckedChange={(v) => onChange({ valueBool: v })}
            data-testid={`${testId}-switch`}
          />
        )}
      </div>

      {kind === "numeric" && (
        <Input
          id={testId}
          type="number"
          value={value.numeric ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ valueNumeric: e.target.value })}
          aria-invalid={outOfBounds}
          data-testid={`${testId}-input`}
        />
      )}

      {kind === "percent" && (
        <div className="relative">
          <Input
            id={testId}
            type="number"
            step="0.0001"
            value={value.percent ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ valuePercent: e.target.value })}
            data-testid={`${testId}-input`}
          />
          {/* value_percent is stored as a fraction (0.45 = 45%), per the
              column comment — labelled so nobody types 45 meaning 45%. */}
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            fraction (0.45 = 45%)
          </span>
        </div>
      )}

      {kind === "enum" && (
        <Input
          id={testId}
          value={value.enumValue ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ valueEnum: e.target.value })}
          data-testid={`${testId}-input`}
        />
      )}

      {kind === "unknown" && (
        <p className="text-sm text-destructive" data-testid={`${testId}-malformed`}>
          This threshold has no value set on any of its value columns and cannot be edited here.
        </p>
      )}

      {threshold.description && (
        <p className="text-xs text-muted-foreground">{threshold.description}</p>
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {outOfBounds && (
        <p className="text-xs text-destructive" data-testid={`${testId}-out-of-bounds`}>
          Outside the allowed range — the server will reject this value.
        </p>
      )}
      {threshold.guidelineReference && (
        <p className="text-xs text-muted-foreground">Guideline: {threshold.guidelineReference}</p>
      )}
    </div>
  );
}
