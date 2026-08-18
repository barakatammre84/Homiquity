import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icons } from "@/lib/icons";

// Repeating entities have three states — empty → editing → saved
// (docs/DESIGN-STANDARD.md §5, teardown §4.7). The saved state keeps each
// question BESIDE its answer, removing the "wait, what did I put?" anxiety
// without a separate review screen. Edit is neutral; Delete is a red OUTLINE
// (present, not inviting); Add lives on the collection, outside the card.

export interface EntitySummaryRow {
  question: string;
  answer: string;
}

export type EntityCardState = "empty" | "editing" | "saved";

export interface EntityCardProps {
  title: string;
  state: EntityCardState;
  /** Saved-state rows: each question rendered beside its answer. */
  summary?: readonly EntitySummaryRow[];
  /** Editing-state form fields. */
  children?: React.ReactNode;
  emptyPrompt?: string;
  startLabel?: string;
  onStart?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  className?: string;
  "data-testid"?: string;
}

export function EntityCard({
  title,
  state,
  summary = [],
  children,
  emptyPrompt = "Nothing added here yet.",
  startLabel = "Start",
  onStart,
  onEdit,
  onDelete,
  onSave,
  onCancel,
  className,
  "data-testid": testId = "entity-card",
}: EntityCardProps) {
  if (state === "empty") {
    return (
      <div
        className={
          "flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-6 text-center " +
          (className ?? "")
        }
        data-testid={testId}
      >
        <p className="text-sm text-muted-foreground">{emptyPrompt}</p>
        {onStart && (
          <Button variant="outline" size="sm" onClick={onStart}>
            {startLabel}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={className} data-testid={testId}>
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-base font-semibold text-foreground">{title}</h4>
          {state === "saved" && (
            <div className="flex items-center gap-2">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEdit}
                  data-testid={`${testId}-edit`}
                >
                  <Icons.edit className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Edit
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDelete}
                  className="border-destructive/40 text-destructive"
                  data-testid={`${testId}-delete`}
                >
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>

        {state === "saved" ? (
          <dl className="mt-4 space-y-2" data-testid={`${testId}-summary`}>
            {summary.map((row) => (
              <div
                key={row.question}
                className="flex items-baseline justify-between gap-6"
              >
                <dt className="text-sm text-muted-foreground">{row.question}</dt>
                <dd className="text-right text-sm text-foreground">{row.answer}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="mt-4 space-y-4">
            {children}
            {(onSave || onCancel) && (
              <div className="flex items-center gap-2 pt-2">
                {onSave && (
                  <Button size="sm" onClick={onSave} data-testid={`${testId}-save`}>
                    Save
                  </Button>
                )}
                {onCancel && (
                  <Button variant="ghost" size="sm" onClick={onCancel}>
                    Cancel
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// The collection owns Add — outside every card — so "add another" is never
// confused with editing the one you're in.
export function EntityCollection({
  label,
  addLabel,
  onAdd,
  children,
  className,
  "data-testid": testId = "entity-collection",
}: {
  label: string;
  addLabel: string;
  onAdd?: () => void;
  children: React.ReactNode;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <section className={className} data-testid={testId} aria-label={label}>
      <h3 className="text-base font-semibold text-foreground">{label}</h3>
      <div className="mt-3 space-y-4">{children}</div>
      {onAdd && (
        <Button
          variant="outline"
          className="mt-4"
          onClick={onAdd}
          data-testid={`${testId}-add`}
        >
          <Icons.add className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {addLabel}
        </Button>
      )}
    </section>
  );
}
