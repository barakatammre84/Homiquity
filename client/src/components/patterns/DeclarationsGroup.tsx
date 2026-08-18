import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Icons } from "@/lib/icons";

// The bulk-answer escape hatch for mandatory declaration walls
// (docs/DESIGN-STANDARD.md §6, teardown §4.12 — the best pattern found in the
// benchmark). Every question still renders and stays individually answerable
// (the regulator gets a complete record); the shortcut is announced BEFORE the
// wall; and the master checkbox is DERIVED from the answers, never stored, so
// changing any single answer releases it and the two controls cannot disagree.
//
// Question definitions arrive as props — the real URLA declarations live with
// the URLA form. This component deliberately does not carry its own copy of
// them (one source of truth).

export type DeclarationAnswer = "yes" | "no";

export interface DeclarationQuestion {
  id: string;
  label: string;
}

export interface DeclarationsGroupProps {
  /** The group heading. The required marker sits here — never on options. */
  legend: string;
  required?: boolean;
  /** Announced BEFORE the wall. */
  announcement?: string;
  masterLabel?: string;
  questions: readonly DeclarationQuestion[];
  answers: Readonly<Record<string, DeclarationAnswer | undefined>>;
  onAnswersChange: (next: Record<string, DeclarationAnswer | undefined>) => void;
  className?: string;
  "data-testid"?: string;
}

export function DeclarationsGroup({
  legend,
  required = false,
  announcement = "The following questions cover uncommon situations we are required to ask about. If none apply to you, you can answer “No” to all of them at once by checking the box below. Additional questions may be asked based on your answers.",
  masterLabel = "None of these apply to me — answer “No” to all",
  questions,
  answers,
  onAnswersChange,
  className,
  "data-testid": testId = "declarations-group",
}: DeclarationsGroupProps) {
  // Derived, never stored: the master is checked exactly when every question
  // is answered "no".
  const allNo =
    questions.length > 0 && questions.every((q) => answers[q.id] === "no");

  const setAll = (answer: DeclarationAnswer | undefined) => {
    const next: Record<string, DeclarationAnswer | undefined> = { ...answers };
    for (const q of questions) next[q.id] = answer;
    onAnswersChange(next);
  };

  const setOne = (id: string, answer: DeclarationAnswer) => {
    onAnswersChange({ ...answers, [id]: answer });
  };

  return (
    <fieldset className={className} data-testid={testId}>
      <legend className="text-base font-semibold text-foreground">
        {legend}
        {required && (
          <span className="ml-1 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </legend>

      <div className="mt-3 rounded-xl bg-info-subtle p-4 text-info-subtle-foreground">
        <p className="text-sm">{announcement}</p>
        <div className="mt-3 flex items-start gap-3">
          <Checkbox
            id={`${testId}-master`}
            checked={allNo}
            onCheckedChange={(value) => setAll(value === true ? "no" : undefined)}
            className="mt-0.5"
            data-testid={`${testId}-master`}
          />
          <Label
            htmlFor={`${testId}-master`}
            className="text-sm font-semibold leading-6"
          >
            {masterLabel}
          </Label>
        </div>
      </div>

      <ul className="mt-4 space-y-4">
        {questions.map((q) => {
          const answer = answers[q.id];
          return (
            <li
              key={q.id}
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            >
              <p className="text-sm leading-6 text-foreground">{q.label}</p>
              <div
                className="inline-flex shrink-0 self-start rounded-full bg-muted p-1"
                role="group"
                aria-label={q.label}
              >
                {(["yes", "no"] as const).map((option) => {
                  const selected = answer === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setOne(q.id, option)}
                      data-testid={`${testId}-${q.id}-${option}`}
                      className={
                        "inline-flex h-9 min-w-16 items-center justify-center gap-1.5 rounded-full px-4 text-sm transition-colors " +
                        (selected
                          ? "bg-background font-semibold text-foreground shadow-sm"
                          : "text-muted-foreground")
                      }
                    >
                      {selected && (
                        <Icons.done
                          className="h-4 w-4 text-primary"
                          aria-hidden="true"
                        />
                      )}
                      {option === "yes" ? "Yes" : "No"}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
