// Shared shell for the admin content create/edit dialogs.
//
// The article, FAQ, and category dialogs each repeated the same ~25 lines of
// chrome — title and description that switch on "am I editing?", the <Form>
// wrapper, and a Cancel/Save footer whose label cycles Saving.../Update/Create.
// Only the fields in between actually differ, so those stay with each entity
// and this owns the chrome. Copy is templated from `entityLabel` and matches
// the previous per-dialog strings exactly.
import type { ReactNode } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";

export function AdminEntityDialog<TFormData extends FieldValues>({
  open,
  onOpenChange,
  /** Entity name as it appears in the TITLE, e.g. "Article" / "FAQ". */
  entityLabel,
  entityLabelLower,
  /** Truthy while editing an existing row; drives the title/description/button copy. */
  isEditing,
  form,
  onSubmit,
  isSaving,
  saveTestId,
  /** Escape hatch for the wider, scrollable article dialog. */
  contentClassName,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityLabel: string;
  /**
   * Entity name for the DESCRIPTION ("Update the article details below.").
   * Separate because the existing copy lowercases it there but not in the
   * title -- and "FAQ" stays uppercase in both. Defaults to entityLabel.
   */
  entityLabelLower?: string;
  isEditing: boolean;
  form: UseFormReturn<TFormData>;
  onSubmit: (data: TFormData) => void;
  isSaving: boolean;
  saveTestId: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  const descriptionLabel = entityLabelLower ?? entityLabel;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit ${entityLabel}` : `Create ${entityLabel}`}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update the ${descriptionLabel} details below.`
              : `Fill in the details to create a new ${descriptionLabel}.`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {children}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} data-testid={saveTestId}>
                {isSaving ? "Saving..." : isEditing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
