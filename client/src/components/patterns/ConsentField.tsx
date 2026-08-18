import { useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// Consent capture (knowledge-base/handbook/design/DESIGN_SYSTEM.md §13; teardown §6.3 — Better shipped
// an opt-out with a double negative and a threat). This component makes that
// unavailable: positive opt-in only, there is deliberately NO `defaultChecked`
// prop, the consequence of consenting is stated neutrally OUTSIDE the label,
// and dev warns on negative-language labels and on consent that arrives
// pre-granted.

const NEGATIVE_LANGUAGE = /\b(?:don't|do not|not|never|decline|opt out|unless|penalt\w*)\b/i;

export interface ConsentFieldProps {
  id: string;
  /** The positive opt-in statement, e.g. "I agree to a soft credit check". */
  label: string;
  /**
   * What consenting does / what happens next — stated neutrally, outside the
   * label, never as a penalty for declining.
   */
  consequence?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  "data-testid"?: string;
}

export function ConsentField({
  id,
  label,
  consequence,
  checked,
  onCheckedChange,
  className,
  "data-testid": testId = "consent-field",
}: ConsentFieldProps) {
  const warned = useRef(false);
  if (import.meta.env.DEV && !warned.current) {
    warned.current = true;
    if (checked) {
      console.warn(
        `[ConsentField:${id}] consent arrived pre-granted (checked on first ` +
          `render). Consent is a positive opt-in and must start unchecked ` +
          `(DESIGN_SYSTEM.md §13, Honesty).`,
      );
    }
    if (NEGATIVE_LANGUAGE.test(label)) {
      console.warn(
        `[ConsentField:${id}] the label "${label}" reads as negative language. ` +
          `State the opt-in positively; put consequences in \`consequence\`, ` +
          `outside the label (DESIGN_SYSTEM.md §13, Honesty).`,
      );
    }
  }

  return (
    <div className={className} data-testid={testId}>
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          className="mt-0.5"
          data-testid={`${testId}-checkbox`}
        />
        <Label htmlFor={id} className="text-sm font-normal leading-6 text-foreground">
          {label}
        </Label>
      </div>
      {consequence && (
        <p
          className="mt-2 pl-7 text-sm text-muted-foreground"
          data-testid={`${testId}-consequence`}
        >
          {consequence}
        </p>
      )}
    </div>
  );
}
