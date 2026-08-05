import { Check, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SaveStatusProps {
  isSaving: boolean;
  lastSavedAt: Date | null;
  onSave: () => void;
}

/** Header action: the aria-live save status plus the explicit Save button. */
export function SaveStatus({ isSaving, lastSavedAt, onSave }: SaveStatusProps) {
  return (
    <div className="flex items-center gap-4">
      <p aria-live="polite" className="text-xs text-muted-foreground" data-testid="text-urla-save-status">
        {isSaving ? (
          "Saving…"
        ) : lastSavedAt ? (
          <span className="flex items-center gap-1">
            <Check aria-hidden="true" className="h-3 w-3" />
            Saved at {lastSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </span>
        ) : (
          "Progress saves each time you continue"
        )}
      </p>
      <Button onClick={onSave} disabled={isSaving} variant="outline" className="gap-2" data-testid="button-save-urla-top">
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save
      </Button>
    </div>
  );
}
