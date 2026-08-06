import { type LucideIcon, AlertCircle, Check, DollarSign, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { maskCurrencyDigits } from "@/lib/formatters";
import { FUNNEL_SOFT_PULL_CONSENT_TEXT } from "@shared/creditConsentCopy";
import { type PreApprovalFormData } from "@shared/schema";
import { type QuestionOption } from "./questions";

/**
 * The funnel's per-step input controls (extracted from PreApproval.tsx's
 * renderInput switch). Presentation only — every one of these takes its value
 * and reports changes upward; none of them touch the form, the machine, or
 * storage. The step-selection rules they render live in ./choiceAnswers.ts.
 */

const FIELD_INPUT_CLASS =
  "pl-16 h-20 text-4xl border-0 border-b-2 rounded-none focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/40";

function FieldError({ field, message }: { field: string; message: string }) {
  return (
    <p
      role="alert"
      className="mt-2 text-sm text-destructive flex items-center gap-1.5"
      data-testid={`error-${field}`}
    >
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  );
}

/**
 * The `currency` and `number` steps: one big underlined field with a leading
 * icon. They differ only in the mask (thousands separators vs digits-only),
 * the icon, and the numeric keyboard hint — everything else was duplicated
 * character-for-character before this merge.
 */
export function TextEntryStep({
  variant,
  fieldName,
  value,
  error,
  placeholder,
  icon,
  onChange,
  onKeyDown,
}: {
  variant: "currency" | "number";
  fieldName: keyof PreApprovalFormData;
  value: string;
  error?: string;
  placeholder?: string;
  icon?: LucideIcon;
  onChange: (masked: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const isCurrency = variant === "currency";
  const Icon = isCurrency ? DollarSign : icon;
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative">
        {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 text-primary" />}
        <Input
          key={`${variant}-${fieldName}`}
          autoFocus
          data-testid={`input-${fieldName}`}
          type={isCurrency ? undefined : "text"}
          inputMode={isCurrency ? undefined : "numeric"}
          value={value}
          onChange={(e) =>
            onChange(isCurrency ? maskCurrencyDigits(e.target.value) : e.target.value.replace(/\D/g, ""))
          }
          className={`${FIELD_INPUT_CLASS} ${error ? "border-destructive focus-visible:border-destructive" : "border-muted focus-visible:border-primary"}`}
          placeholder={placeholder}
          onKeyDown={onKeyDown}
        />
      </div>
      {error && <FieldError field={fieldName} message={error} />}
    </div>
  );
}

export function ChoiceStep({
  field,
  options,
  isSelected,
  onSelect,
}: {
  field: string;
  options: QuestionOption[];
  isSelected: (optionValue: string) => boolean;
  onSelect: (optionValue: string) => void;
}) {
  return (
    <div className="grid gap-3 w-full max-w-lg mx-auto">
      {options.map((option) => {
        const OptionIcon = option.icon;
        const selected = isSelected(option.value);
        return (
          <button
            key={option.value}
            type="button"
            data-testid={`option-${field}-${option.value}`}
            onClick={() => onSelect(option.value)}
            className={`flex items-center gap-4 p-5 text-left text-lg font-medium border-2 rounded-xl transition-all duration-200 group hover:scale-[1.02] active:scale-[0.99]
                    ${selected
                      ? "border-primary bg-primary/5"
                      : "border-transparent bg-muted/40 hover:bg-muted"
                    }`}
          >
            {OptionIcon && (
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors
                      ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"}`}>
                <OptionIcon className="h-5 w-5" />
              </div>
            )}
            <span className={`flex-1 ${selected ? "text-primary" : "text-foreground"}`}>
              {option.label}
            </span>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                    ${selected ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
              {selected && <Check className="w-3 h-3 text-primary-foreground" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function BooleanPairStep({
  fields,
  isChecked,
  onToggle,
}: {
  fields: { field: keyof PreApprovalFormData; label: string; icon: LucideIcon }[];
  isChecked: (field: keyof PreApprovalFormData) => boolean;
  onToggle: (field: keyof PreApprovalFormData) => void;
}) {
  return (
    <div className="grid gap-4 w-full max-w-lg mx-auto">
      {fields.map((entry) => {
        const FieldIcon = entry.icon;
        const checked = isChecked(entry.field);
        return (
          <button
            key={entry.field}
            type="button"
            data-testid={`toggle-${entry.field}`}
            onClick={() => onToggle(entry.field)}
            className={`flex items-center gap-4 p-5 text-left text-lg font-medium border-2 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]
                    ${checked
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-primary/50"
                    }`}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors
                    ${checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              <FieldIcon className="h-5 w-5" />
            </div>
            <span className={`flex-1 ${checked ? "text-primary" : "text-foreground"}`}>
              {entry.label}
            </span>
            <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors
                    ${checked ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
              {checked && <Check className="w-4 h-4 text-primary-foreground" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function SoftPullConsentStep({
  acknowledged,
  onChange,
}: {
  acknowledged: boolean;
  onChange: (acknowledged: boolean) => void;
}) {
  return (
    <div className="w-full max-w-md mx-auto text-left">
      <label
        className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors
                ${acknowledged ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"}`}
        data-testid="label-soft-pull-consent"
      >
        <Checkbox
          checked={acknowledged}
          onCheckedChange={(checked) => onChange(checked === true)}
          className="mt-0.5"
          data-testid="checkbox-soft-pull-consent"
        />
        {/*
          Rendered from the SHARED constant the server also persists as
          `credit_consents.disclosure_text`, so the words on screen and the
          words in the evidence record cannot drift (F-034). Split only to
          emphasise "soft inquiry" — the concatenation is byte-identical to
          the constant, so fidelity is preserved. Edit the copy in
          shared/creditConsentCopy.ts, never here.
        */}
        <span
          className="text-sm text-muted-foreground leading-relaxed"
          data-testid="text-soft-pull-consent"
        >
          {FUNNEL_SOFT_PULL_CONSENT_TEXT.split("soft inquiry")[0]}
          <span className="font-medium text-foreground">soft inquiry</span>
          {FUNNEL_SOFT_PULL_CONSENT_TEXT.split("soft inquiry")[1]}
        </span>
      </label>
      {/*
        Data-handling reassurance at the funnel's most sensitive moment.
        This copy already existed but only in the auth-gate overlay and the
        FunnelFooter, both of which sit below the fold of the centred
        question card — so the visitor deciding whether to authorise a
        credit pull never saw it.

        Deliberately OUTSIDE the <label> above: everything inside that
        element is the verbatim disclosure persisted as
        `credit_consents.disclosure_text`, and rendered text that is not in
        FUNNEL_SOFT_PULL_CONSENT_TEXT must never appear to be part of it
        (F-034). This is page chrome, not disclosure — it makes no claim
        about the inquiry itself, which the consent copy already covers.
      */}
      <p
        className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground"
        data-testid="text-consent-security-note"
      >
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        Your information is encrypted and never sold.
      </p>
    </div>
  );
}
