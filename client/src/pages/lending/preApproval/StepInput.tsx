import { type UseFormReturn } from "react-hook-form";
import { type PreApprovalFormData } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { maskCurrencyDigits } from "@/lib/formatters";
import { DollarSign, AlertCircle, Check, ShieldCheck } from "lucide-react";
import { type Question } from "./questions";
import { StateStep } from "./StateStep";
import { IncomeSourcesStep } from "./IncomeSourcesStep";
import { FUNNEL_SOFT_PULL_CONSENT_TEXT } from "@shared/creditConsentCopy";

/**
 * Renders the per-question-type input for the pre-approval funnel's current
 * step. Extracted verbatim from PreApproval.tsx's renderInput() — the switch
 * on currentQ.type, the field wiring, and the final-step consent disclosure
 * (still rendered from the SHARED FUNNEL_SOFT_PULL_CONSENT_TEXT constant so
 * the on-screen words and the persisted credit_consents.disclosure_text
 * cannot drift, per F-034).
 */
export function StepInput({
  currentQ,
  form,
  watchedValues,
  onKeyDown,
  onAdvance,
  consentAcknowledged,
  onConsentChange,
}: {
  currentQ: Question;
  form: UseFormReturn<PreApprovalFormData>;
  watchedValues: PreApprovalFormData;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onAdvance: (values: PreApprovalFormData) => void;
  consentAcknowledged: boolean;
  onConsentChange: (checked: boolean) => void;
}) {
  const IconComponent = currentQ.icon;

  switch (currentQ.type) {
    case "currency": {
      const fieldName = currentQ.field as keyof PreApprovalFormData;
      const watchedValue = form.watch(fieldName);
      const displayValue = typeof watchedValue === 'string' ? watchedValue : "";
      const fieldError = form.formState.errors[fieldName];
      return (
        <div className="w-full max-w-md mx-auto">
          <div className="relative">
            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 text-primary" />
            <Input
              key={`currency-${fieldName}`}
              autoFocus
              data-testid={`input-${currentQ.field}`}
              value={displayValue}
              onChange={(e) => {
                const formatted = maskCurrencyDigits(e.target.value);
                form.setValue(fieldName, formatted as never, { shouldValidate: true, shouldDirty: true });
              }}
              className={`pl-16 h-20 text-4xl border-0 border-b-2 rounded-none focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/40 ${fieldError ? "border-destructive focus-visible:border-destructive" : "border-muted focus-visible:border-primary"}`}
              placeholder={currentQ.placeholder}
              onKeyDown={onKeyDown}
            />
          </div>
          {fieldError && (
            <p role="alert" className="mt-2 text-sm text-destructive flex items-center gap-1.5" data-testid={`error-${currentQ.field}`}>
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {fieldError.message as string}
            </p>
          )}
        </div>
      );
    }

    case "number": {
      const fieldName = currentQ.field as keyof PreApprovalFormData;
      const watchedValue = form.watch(fieldName);
      const displayValue = typeof watchedValue === 'string' ? watchedValue : "";
      const fieldError = form.formState.errors[fieldName];
      return (
        <div className="w-full max-w-md mx-auto">
          <div className="relative">
            {IconComponent && <IconComponent className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 text-primary" />}
            <Input
              key={`number-${fieldName}`}
              autoFocus
              data-testid={`input-${currentQ.field}`}
              type="text"
              inputMode="numeric"
              value={displayValue}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                form.setValue(fieldName, value as never, { shouldValidate: true, shouldDirty: true });
              }}
              className={`pl-16 h-20 text-4xl border-0 border-b-2 rounded-none focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/40 ${fieldError ? "border-destructive focus-visible:border-destructive" : "border-muted focus-visible:border-primary"}`}
              placeholder={currentQ.placeholder}
              onKeyDown={onKeyDown}
            />
          </div>
          {fieldError && (
            <p role="alert" className="mt-2 text-sm text-destructive flex items-center gap-1.5" data-testid={`error-${currentQ.field}`}>
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {fieldError.message as string}
            </p>
          )}
        </div>
      );
    }

    case "choice":
      return (
        <div className="grid gap-3 w-full max-w-lg mx-auto">
          {currentQ.options?.map((option) => {
            const OptionIcon = option.icon;
            const fieldVal = form.watch(currentQ.field as keyof PreApprovalFormData);
            const isSelected = currentQ.id === "hasAdditionalIncome"
              ? (option.value === "yes" ? fieldVal === true : fieldVal === false)
              : fieldVal === option.value;
            return (
              <button
                key={option.value}
                type="button"
                data-testid={`option-${currentQ.field}-${option.value}`}
                onClick={() => {
                  if (currentQ.id === "hasAdditionalIncome") {
                    form.setValue("hasAdditionalIncome", (option.value === "yes") as never);
                    if (option.value === "no") {
                      form.setValue("incomeSources", [] as never);
                    }
                  } else {
                    form.setValue(currentQ.field as keyof PreApprovalFormData, option.value as never);
                  }
                  // The machine recomputes the route from the answers, so
                  // injected steps (complex income) appear/disappear here.
                  setTimeout(() => onAdvance(form.getValues()), 200);
                }}
                className={`flex items-center gap-4 p-5 text-left text-lg font-medium border-2 rounded-xl transition-all duration-200 group hover:scale-[1.02] active:scale-[0.99]
                  ${isSelected
                    ? "border-primary bg-primary/5"
                    : "border-transparent bg-muted/40 hover:bg-muted"
                  }`}
              >
                {OptionIcon && (
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors
                    ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"}`}>
                    <OptionIcon className="h-5 w-5" />
                  </div>
                )}
                <span className={`flex-1 ${isSelected ? "text-primary" : "text-foreground"}`}>
                  {option.label}
                </span>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                  ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                  {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
              </button>
            );
          })}
        </div>
      );

    case "state":
      return (
        <StateStep
          value={form.watch("propertyState")}
          onSelectState={(v) => form.setValue("propertyState", v, { shouldValidate: true })}
          onAdvance={() => onAdvance(form.getValues())}
        />
      );

    case "income_sources": {
      // Single source of truth: the step derives its whole UI from
      // form.incomeSources, so a restore that resets the form is all a
      // restore has to do.
      return (
        <IncomeSourcesStep
          employmentType={form.getValues("employmentType")}
          value={watchedValues.incomeSources}
          onChange={(entries) => form.setValue("incomeSources", entries as never)}
        />
      );
    }

    case "boolean_pair":
      return (
        <div className="grid gap-4 w-full max-w-lg mx-auto">
          {currentQ.booleanFields?.map((field) => {
            const FieldIcon = field.icon;
            const isChecked = form.watch(field.field) as boolean;
            return (
              <button
                key={field.field}
                type="button"
                data-testid={`toggle-${field.field}`}
                onClick={() => {
                  form.setValue(field.field, !isChecked as never);
                }}
                className={`flex items-center gap-4 p-5 text-left text-lg font-medium border-2 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]
                  ${isChecked
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-primary/50"
                  }`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors
                  ${isChecked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <FieldIcon className="h-5 w-5" />
                </div>
                <span className={`flex-1 ${isChecked ? "text-primary" : "text-foreground"}`}>
                  {field.label}
                </span>
                <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors
                  ${isChecked ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                  {isChecked && <Check className="w-4 h-4 text-primary-foreground" />}
                </div>
              </button>
            );
          })}
        </div>
      );

    case "final": {
      return (
        <div className="w-full max-w-md mx-auto text-left">
          <label
            className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors
              ${consentAcknowledged ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"}`}
            data-testid="label-soft-pull-consent"
          >
            <Checkbox
              checked={consentAcknowledged}
              onCheckedChange={(checked) => onConsentChange(checked === true)}
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

    default:
      return null;
  }
}
