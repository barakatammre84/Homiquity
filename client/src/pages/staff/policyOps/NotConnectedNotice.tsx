import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

/**
 * Shown by COCRuleBuilder, which still has no store behind it.
 *
 * The per-category threshold editor used to need this too: it read no policy,
 * wrote none, and raised a "Draft Saved" toast over hardcoded useState
 * defaults. That one is now genuinely wired to /api/policy-thresholds, so it
 * no longer renders this.
 *
 * Change-of-circumstance rules are a different case. There is no COC table and
 * no COC endpoint anywhere in the schema or in server/routes/policy-ops.ts —
 * only profiles, thresholds, overlays and approvals. A COC rule also does not
 * fit a threshold row: it carries a trigger type, a trigger value, a severity
 * and a list of GSEs it applies to, and policy_thresholds has no column for
 * that last part. Storing it needs a schema decision rather than an inference,
 * so this builder stays visibly disconnected until that decision is made —
 * which is far better than letting an underwriter believe a change-of-
 * circumstance rule had been recorded.
 */
export function NotConnectedNotice() {
  return (
    <Alert variant="destructive" data-testid="alert-rule-editor-not-connected">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>These values are placeholders, not your policy</AlertTitle>
      <AlertDescription>
        This builder is not yet connected to policy storage. The rules shown are
        built-in examples, not the change-of-circumstance rules in force, and
        changes made here are not saved.
      </AlertDescription>
    </Alert>
  );
}
