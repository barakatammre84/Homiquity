import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Save } from "lucide-react";

/**
 * The per-category rule editor is a prototype: it reads no policy and writes
 * none. Every value in it is a hardcoded useState default (DTI 43%, minimum
 * FICO 620, maximum LTV 97%, 2 months' reserves…) that looks exactly like real
 * configured policy, and Save Draft used to raise a "Draft Saved — changes
 * saved to draft, publish when ready" toast while persisting nothing at all.
 *
 * That combination is the dangerous part. An underwriter or admin — this
 * console is role-gated to exactly those two — could tighten a DTI cap, get a
 * success confirmation, and leave believing the policy had moved. On an
 * underwriting-policy surface, a false success claim is worse than a dead
 * button, because a dead button at least tells the truth about what happened.
 *
 * The notice and the disabled footer below state the position plainly until
 * the editor is wired to the policy-threshold API that already exists
 * (GET/POST/PATCH/DELETE /api/policy-thresholds, server/routes/policy-ops.ts).
 * Wiring it needs a decision this code cannot make on its own: which threshold
 * record each control maps to, and whether editing creates a new draft profile
 * or patches the active one. Guessing that mapping would write wrong policy,
 * which is a worse failure than writing none.
 */
export function NotConnectedNotice() {
  return (
    <Alert variant="destructive" data-testid="alert-rule-editor-not-connected">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>These values are placeholders, not your policy</AlertTitle>
      <AlertDescription>
        This editor is not yet connected to policy storage. The figures shown are
        built-in defaults, not the thresholds currently in force, and changes made
        here are not saved. Use the policy profiles list to view and submit real
        policy changes.
      </AlertDescription>
    </Alert>
  );
}

/**
 * Footer for the rule-editor categories. The controls are disabled rather than
 * hidden so the intended workflow stays legible, and neither claims success.
 */
export function DisconnectedEditorFooter() {
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled data-testid="button-discard-changes">
          Discard Changes
        </Button>
        <Button disabled data-testid="button-save-draft">
          <Save className="h-4 w-4 mr-2" />
          Save Draft
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Saving is disabled until this editor is connected to policy storage.
      </p>
    </div>
  );
}
