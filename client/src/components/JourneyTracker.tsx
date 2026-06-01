import { CheckCircle2, Circle, FileText, Search, Shield, ClipboardCheck, Key, Banknote } from "lucide-react";

const JOURNEY_STEPS = [
  { 
    id: "submitted", 
    label: "Applied", 
    shortLabel: "Applied",
    icon: FileText,
    statuses: ["submitted", "analyzing"],
    estimate: "Minutes",
  },
  { 
    id: "pre_approved", 
    label: "Pre-Approved", 
    shortLabel: "Pre-Approved",
    icon: Shield,
    statuses: ["pre_approved"],
    estimate: "Same day",
  },
  { 
    id: "processing", 
    label: "Processing", 
    shortLabel: "Processing",
    icon: Search,
    statuses: ["doc_collection", "processing"],
    estimate: "3-5 days",
  },
  { 
    id: "underwriting", 
    label: "Underwriting", 
    shortLabel: "UW Review",
    icon: ClipboardCheck,
    statuses: ["underwriting", "conditional"],
    estimate: "1-3 days",
  },
  { 
    id: "clear_to_close", 
    label: "Clear to Close", 
    shortLabel: "CTC",
    icon: Key,
    statuses: ["clear_to_close", "closing"],
    estimate: "1-2 days",
  },
  { 
    id: "funded", 
    label: "Funded", 
    shortLabel: "Funded",
    icon: Banknote,
    statuses: ["funded"],
    estimate: "",
  },
];

function getStepIndex(status: string): number {
  const idx = JOURNEY_STEPS.findIndex(step => step.statuses.includes(status));
  return idx >= 0 ? idx : -1;
}

interface JourneyTrackerProps {
  status: string;
  className?: string;
  showEstimates?: boolean;
}

export function JourneyTracker({ status, className = "", showEstimates = false }: JourneyTrackerProps) {
  if (status === "draft" || status === "denied") return null;

  const currentIndex = getStepIndex(status);

  return (
    <div className={`w-full ${className}`} data-testid="journey-tracker">
      <div className="flex items-start justify-between gap-1 relative">
        {JOURNEY_STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          const StepIcon = step.icon;

          return (
            <div
              key={step.id}
              className="flex flex-col items-center flex-1 relative"
              data-testid={`journey-step-${step.id}`}
            >
              {index > 0 && (
                <div
                  className={`absolute top-4 right-1/2 w-full h-0.5 -z-10 transition-colors duration-500 ${
                    isCompleted ? "bg-emerald-500" : "bg-border"
                  }`}
                  data-testid={`journey-line-${step.id}`}
                />
              )}

              <div
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  isCompleted
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : isCurrent
                    ? "border-primary bg-primary text-primary-foreground shadow-md"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : isCurrent ? (
                  <>
                    <StepIcon className="h-4 w-4" />
                    <span className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-20" />
                  </>
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </div>

              <span
                className={`mt-1.5 text-center text-[10px] sm:text-xs leading-tight ${
                  isCurrent
                    ? "font-semibold text-foreground"
                    : isCompleted
                    ? "font-medium text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                }`}
                data-testid={`journey-label-${step.id}`}
              >
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">{step.shortLabel}</span>
              </span>

              {showEstimates && isCurrent && step.estimate && (
                <span
                  className="mt-0.5 text-[9px] sm:text-[10px] text-muted-foreground"
                  data-testid={`journey-estimate-${step.id}`}
                >
                  ~{step.estimate}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
