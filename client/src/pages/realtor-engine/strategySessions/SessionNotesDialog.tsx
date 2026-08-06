import { formatDateSafe } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { NotesForm, StrategySession } from "./types";

export interface SessionNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: StrategySession | null;
  /** True when saving should also mark the session completed. */
  isCompleting: boolean;
  form: NotesForm;
  onFormChange: (form: NotesForm) => void;
  onSave: () => void;
  isPending: boolean;
}

export function SessionNotesDialog({
  open,
  onOpenChange,
  session,
  isCompleting,
  form,
  onFormChange,
  onSave,
  isPending,
}: SessionNotesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isCompleting ? "Complete Session" : "Session Notes"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {session && (
            <div className="text-sm text-muted-foreground" data-testid="text-dialog-session-info">
              {session.topic || "Untitled Session"} -{" "}
              {formatDateSafe(session.scheduledAt, "MMM d, yyyy", "Not scheduled")}
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-foreground">Notes</label>
            <Textarea
              value={form.notes}
              onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
              placeholder="Session notes, outcomes, discussion points..."
              className="mt-1"
              rows={4}
              data-testid="input-dialog-notes"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Action Items (one per line)</label>
            <Textarea
              value={form.actionItems}
              onChange={(e) => onFormChange({ ...form, actionItems: e.target.value })}
              placeholder={"Follow up on deal #1234\nSend market report to agent\nSchedule next review"}
              className="mt-1"
              rows={4}
              data-testid="input-dialog-action-items"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={onSave}
              disabled={isPending}
              data-testid="button-save-notes"
            >
              {isPending
                ? "Saving..."
                : isCompleting
                  ? "Complete & Save"
                  : "Save Notes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
