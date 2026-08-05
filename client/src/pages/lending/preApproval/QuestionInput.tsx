import type { UseFormReturn } from "react-hook-form";
import { AlertCircle, Check, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { maskCurrencyDigits } from "@/lib/formatters";
import type { PreApprovalFormData, RentalPropertyEntry } from "@shared/schema";
import type { Question } from "./questions";
import { StateStep } from "./StateStep";
import { IncomeSourcesStep } from "./IncomeSourcesStep";

export interface QuestionInputProps {
  currentQ: Question;
  form: UseFormReturn<PreApprovalFormData>;
  next: (answers?: PreApprovalFormData) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  softPullAcknowledged: boolean;
  onConsentChange: (checked: boolean) => void;
  selectedIncomeTypes: string[];
  incomeDetails: Record<string, { annualAmount: string; employerName: string; yearsInRole: string }>;
  rentalProperties: RentalPropertyEntry[];
  setSelectedIncomeTypes: (types: string[]) => void;
  setIncomeDetails: (details: Record<string, { annualAmount: string; employerName: string; yearsInRole: string }>) => void;
  setRentalProperties: (properties: RentalPropertyEntry[]) => void;
}

/** Renders the current step's input control, keyed off currentQ.type. Extracted verbatim from PreApproval.tsx's renderInput(). */
export function QuestionInput({
  currentQ,
  form,
  next,
  handleKeyDown,
  softPullAcknowledged,
  onConsentChange,
  selectedIncomeTypes,
  incomeDetails,
  rentalProperties,
  setSelectedIncomeTypes,
  setIncomeDetails,
  setRentalProperties,
}: QuestionInputProps) {
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
              onKeyDown={handleKeyDown}
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
              onKeyDown={handleKeyDown}
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
                  setTimeout(() => next(form.getValues()), 200);
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
          onAdvance={() => next(form.getValues())}
        />
      );

    case "income_sources": {
      return (
        <IncomeSourcesStep
          employmentType={form.getValues("employmentType")}
          selectedIncomeTypes={selectedIncomeTypes}
          incomeDetails={incomeDetails}
          rentalProperties={rentalProperties}
          setSelectedIncomeTypes={setSelectedIncomeTypes}
          setIncomeDetails={setIncomeDetails}
          setRentalProperties={setRentalProperties}
          setIncomeSources={(entries) => form.setValue("incomeSources", entries as never)}
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
      const acknowledged = softPullAcknowledged;
      return (
        <div className="w-full max-w-md mx-auto text-left">
          <label
            className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors
              ${acknowledged ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"}`}
            data-testid="label-soft-pull-consent"
          >
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(checked) => onConsentChange(checked === true)}
              className="mt-0.5"
              data-testid="checkbox-soft-pull-consent"
            />
            <span className="text-sm text-muted-foreground leading-relaxed">
              I authorize Homiquity to obtain my credit report using a{" "}
              <span className="font-medium text-foreground">soft inquiry</span>, which will not
              affect my credit score. This authorization is required by the Fair Credit
              Reporting Act (FCRA) and is not an application for credit.
            </span>
          </label>
        </div>
      );
    }

    default:
      return null;
  }
}
