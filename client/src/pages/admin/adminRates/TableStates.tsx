import { type LucideIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The three pieces the rates table and the programs table rendered
 * identically, once each. Sharing them is what keeps the two tabs looking like
 * one screen — an admin who learns the delete affordance on Rates should not
 * meet a different one on Programs.
 */

export function TableLoadingRows() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function TableEmptyState({
  icon: Icon,
  message,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <Icon className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p className="mb-4">{message}</p>
      <Button onClick={onAction}>
        <Plus className="h-4 w-4 mr-2" />
        {actionLabel}
      </Button>
    </div>
  );
}

export function RowActions({
  entity,
  id,
  onEdit,
  onDelete,
  isDeleting,
}: {
  /** Only shapes the data-testid — `button-edit-rate-<id>` etc. */
  entity: "rate" | "program";
  id: string;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button
        variant="ghost"
        size="icon" aria-label="Edit"
        onClick={onEdit}
        data-testid={`button-edit-${entity}-${id}`}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon" aria-label="Delete"
        onClick={onDelete}
        disabled={isDeleting}
        data-testid={`button-delete-${entity}-${id}`}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
