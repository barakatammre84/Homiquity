import { CheckCircle2, Circle, FileText, Search, Shield, ClipboardCheck, Key, FileSignature, Banknote } from "lucide-react";

const JOURNEY_STEPS = [
  {
    id: "submitted",
    label: "Application Received",
    icon: FileText,
    statuses: ["submitted", "analyzing"],
    estimate: "Minutes",
  },
  {
    id: "pre_approved",
    label: "Pre-Approved",
    icon: Shield,
    statuses: ["pre_approved"],
    estimate: "Same day",
  },
  {
    id: "processing",
    label: "Documents Under Review",
    icon: Search,
    statuses: ["doc_collection", "processing"],
    estimate: "3-5 days",
  },
  {
    id: "underwriting",
    label: "Underwriting Review",
    icon: ClipboardCheck,
    statuses: ["underwriting", "conditional"],
    estimate: "1-3 days",
  },
  {
    id: "clear_to_close",
    label: "Clear to Close",
    icon: Key,
    statuses: ["clear_to_close"],
    estimate: "1-2 days",
  },
  {
    id: "closing",
    // The borrower at the closing table signing docs — a distinct milestone from
    // Clear to Close (the underwriter sign-off that precedes it). Backend tracks
    // this as its own `closing` status; the tracker must too.
    label: "Signing",
    icon: FileSignature,
    statuses: ["closing"],
    estimate: "1-3 days",
  },
  {
    id: "funded",
    label: "Funded",
    icon: Banknote,
    statuses: ["funded"],
    estimate: "",
  },
];

function getStepIndex(status: string): number {
  const idx = JOURNEY_STEPS.findIndex(step => step.statuses.includes(status));
  return idx >= 0 ? idx : -1;
}

/** One-line description per step — shown only in the vertical timeline variant. */
const STEP_DESCRIPTIONS: Record<string, string> = {
  submitted: "We've received your application and started the review.",
  pre_approved: "You're pre-approved. Time to shop with confidence.",
  processing: "We're verifying the documents you provided.",
  underwriting: "An underwriter is reviewing your complete file.",
  clear_to_close: "Approved — we're preparing your closing.",
  closing: "Sign your final documents at closing.",
  funded: "Your loan is funded. Welcome home!",
};

interface JourneyTrackerProps {
  status: string;
  className?: string;
  showEstimates?: boolean;
  /**
   * "responsive" (default) = the horizontal desktop stepper / compact mobile card.
   * "vertical" = a top-to-bottom timeline with COMPLETE / CURRENT / UPCOMING states
   * and a colored connector (the borrower-dashboard "Loan Progress" card).
   */
  variant?: "responsive" | "vertical";
}

export function JourneyTracker({ status, className = "", showEstimates = false, variant = "responsive" }: JourneyTrackerProps) {
  if (status === "draft" || status === "denied") return null;

  const currentIndex = getStepIndex(status);
  const current = currentIndex >= 0 ? JOURNEY_STEPS[currentIndex] : null;
  const next =
    currentIndex >= 0 && currentIndex < JOURNEY_STEPS.length - 1
      ? JOURNEY_STEPS[currentIndex + 1]
      : null;
  const CurrentIcon = current?.icon ?? Circle;

  if (variant === "vertical") {
    return (
      <ol className={`w-full ${className}`} data-testid="journey-tracker">
        {JOURNEY_STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isLast = index === JOURNEY_STEPS.length - 1;
          const StepIcon = step.icon;
          const tag = isCompleted ? "Complete" : isCurrent ? "Current" : "Upcoming";
          const tagColor = isCompleted
            ? "text-success-subtle-foreground"
            : isCurrent
            ? "text-primary"
            : "text-muted-foreground";

          return (
            <li
              key={step.id}
              className="relative flex gap-3 pb-6 last:pb-0"
              data-testid={`journey-step-${step.id}`}
            >
              {/* Connector: green once the step is complete, else a hairline. */}
              {!isLast && (
                <span
                  className={`absolute left-4 top-4 h-full w-0.5 -translate-x-1/2 ${
                    isCompleted ? "bg-success" : "bg-border"
                  }`}
                  aria-hidden="true"
                  data-testid={`journey-line-${step.id}`}
                />
              )}

              {/* Node */}
              <div
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                  isCompleted
                    ? "border-success bg-success text-success-foreground"
                    : isCurrent
                    ? "border-primary bg-primary text-primary-foreground"
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

              {/* Text */}
              <div className="min-w-0 flex-1 pb-1">
                <p
                  className={`text-[10px] font-semibold uppercase tracking-wider ${tagColor}`}
                  data-testid={`journey-tag-${step.id}`}
                >
                  {tag}
                </p>
                <p
                  className={`text-sm leading-tight ${
                    isCurrent
                      ? "font-semibold text-foreground"
                      : isCompleted
                      ? "font-semibold text-foreground"
                      : "font-medium text-muted-foreground"
                  }`}
                  data-testid={`journey-label-${step.id}`}
                >
                  {step.label}
                </p>
                {STEP_DESCRIPTIONS[step.id] && (
                  <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                    {STEP_DESCRIPTIONS[step.id]}
                  </p>
                )}
                {showEstimates && isCurrent && step.estimate && (
                  <p className="mt-1 text-[11px] text-muted-foreground" data-testid={`journey-estimate-${step.id}`}>
                    ~{step.estimate}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <div className={`w-full ${className}`} data-testid="journey-tracker">
      {/* Mobile (<640px): a compact status card + segmented progress bar. A 7-across
          horizontal stepper is too dense on a phone (labels wrap to 2-3 lines), so
          mobile answers the borrower's three questions directly — where am I, how far
          along, what's next — while the segments still convey the whole 7-step journey. */}
      {current && (
        <div className="sm:hidden" data-testid="journey-compact">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary text-primary-foreground">
                <CurrentIcon className="h-4 w-4" />
                <span className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-20" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground" data-testid="journey-compact-label">
                  {current.label}
                </div>
                {showEstimates && current.estimate && (
                  <div className="text-[11px] text-muted-foreground">~{current.estimate}</div>
                )}
              </div>
            </div>
            <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
              Step {currentIndex + 1} of {JOURNEY_STEPS.length}
            </span>
          </div>

          <div className="mt-2.5 flex gap-1" aria-hidden="true">
            {JOURNEY_STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                  index < currentIndex
                    ? "bg-success"
                    : index === currentIndex
                    ? "bg-primary"
                    : "bg-border"
                }`}
              />
            ))}
          </div>

          {next && (
            <div className="mt-1.5 text-[11px] text-muted-foreground">
              Up next: <span className="text-foreground">{next.label}</span>
            </div>
          )}
        </div>
      )}

      {/* Desktop (≥640px): the full horizontal stepper with every milestone labelled. */}
      <div className="hidden sm:block">
        <div className="flex items-start justify-between gap-1 relative">
          {JOURNEY_STEPS.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;

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
                      isCompleted ? "bg-success" : "bg-border"
                    }`}
                    data-testid={`journey-line-${step.id}`}
                  />
                )}

                <div
                  className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                    isCompleted
                      ? "border-border bg-success text-success-foreground"
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
                  className={`mt-1.5 text-center text-xs leading-tight ${
                    isCurrent
                      ? "font-semibold text-foreground"
                      : isCompleted
                      ? "font-medium text-success-subtle-foreground"
                      : "text-muted-foreground"
                  }`}
                  data-testid={`journey-label-${step.id}`}
                >
                  {step.label}
                </span>

                {showEstimates && isCurrent && step.estimate && (
                  <span
                    className="mt-0.5 text-[10px] text-muted-foreground"
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
    </div>
  );
}
