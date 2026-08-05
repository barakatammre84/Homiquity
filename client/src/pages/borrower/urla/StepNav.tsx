import { ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface StepNavProps {
  isFirstStep: boolean;
  isLastStep: boolean;
  onBack: () => void;
  onContinue: () => void;
  isSaving: boolean;
}

export function StepNav({ isFirstStep, isLastStep, onBack, onContinue, isSaving }: StepNavProps) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
      <Button
        variant="ghost"
        className="gap-2"
        onClick={onBack}
        disabled={isFirstStep}
        data-testid="button-urla-back"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </Button>
      <Button
        className="gap-2"
        onClick={onContinue}
        disabled={isSaving}
        data-testid={isLastStep ? "button-save-urla" : "button-urla-continue"}
      >
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isLastStep ? (
          <Save className="h-4 w-4" />
        ) : null}
        {isLastStep ? "Save application" : "Save & continue"}
        {!isLastStep && <ChevronRight className="h-4 w-4" />}
      </Button>
    </div>
  );
}
