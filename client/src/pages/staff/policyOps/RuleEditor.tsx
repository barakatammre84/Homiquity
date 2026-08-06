// The per-category rule editor.
//
// This used to be four hardcoded forms — DTI 43%, minimum FICO 620, maximum
// LTV 97%, and so on, held in useState and "saved" by a toast that persisted
// nothing. It is now driven by the data it edits.
//
// That is less a design choice than a reading of the schema: policy_thresholds
// gives every row a category, a thresholdKey, a displayName, a description, a
// guidelineReference, optional min/max bounds, a displayOrder, and exactly one
// populated value column out of numeric / percent / bool / enum. A row already
// says what it is called, what it means, how it should be rendered and what
// range it may take — so there is no fixed mapping between controls and
// thresholds to invent. The rows ARE the form.
//
// Two consequences worth stating: adding a threshold in the database makes it
// appear here with no client change, and a category with no thresholds says so
// rather than showing fabricated defaults.
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Info, Save, Settings } from "lucide-react";
import type { PolicyThreshold } from "@shared/schema";
import { type RuleCategory } from "./model";
import { COCRuleBuilder } from "./COCRuleBuilder";
import {
  ThresholdControl,
  isOutOfBounds,
  thresholdKind,
  type ThresholdEdit,
} from "./ThresholdControl";

/**
 * Statuses the server refuses threshold edits on. Mirrors
 * IMMUTABLE_POLICY_STATUSES in server/routes/policy-ops.ts — the server is
 * still the enforcer; this only avoids offering an edit that will 400.
 */
const IMMUTABLE_STATUSES = new Set(["ACTIVE", "RETIRED", "PENDING_APPROVAL", "APPROVED"]);

export function RuleEditor({
  policyProfileId,
  policyStatus,
  category,
}: {
  policyProfileId: string | null;
  policyStatus: string | null;
  category: RuleCategory;
}) {
  const { toast } = useToast();
  const [edits, setEdits] = useState<Record<string, ThresholdEdit>>({});

  const {
    data: thresholds = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<PolicyThreshold[]>({
    queryKey: ["/api/policy-thresholds", { policyProfileId }],
    enabled: !!policyProfileId && category !== "COC",
  });

  const saveMutation = useMutation({
    mutationFn: async (dirty: [string, ThresholdEdit][]) => {
      // One PATCH per row: the API has no bulk endpoint, and each write is
      // separately audit-logged with its previous values — which is the record
      // an underwriting-policy change needs anyway.
      const failures: string[] = [];
      for (const [id, edit] of dirty) {
        try {
          await apiRequest("PATCH", `/api/policy-thresholds/${id}`, edit);
        } catch (err) {
          failures.push(err instanceof Error ? err.message : String(err));
        }
      }
      if (failures.length > 0) throw new Error(failures.join("; "));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-thresholds"] });
      setEdits({});
      toast({
        title: "Thresholds Updated",
        description: "Your changes have been saved to this policy draft.",
      });
    },
    onError: (err: Error) => {
      // Edits are deliberately NOT cleared: the operator keeps their work and
      // can retry or correct it. A partial failure reports which rows failed
      // rather than claiming the whole save succeeded.
      toast({
        title: "Changes Not Saved",
        description: err.message || "The thresholds could not be updated.",
        variant: "destructive",
      });
    },
  });

  if (category === "COC") {
    return <COCRuleBuilder />;
  }

  if (!policyProfileId) {
    return (
      <div className="py-12 text-center" data-testid="rule-editor-no-policy">
        <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">
          Select a policy on the Dashboard tab to view and edit its thresholds.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="rule-editor-loading">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
      </div>
    );
  }

  // A failed load must not render as "this category has no thresholds" — on a
  // policy console that reads as an unconfigured policy rather than an outage.
  if (isError) {
    return (
      <QueryErrorState
        error={error}
        onRetry={() => void refetch()}
        title="We couldn't load these thresholds"
        data-testid="rule-editor-error"
      />
    );
  }

  const inCategory = thresholds
    .filter((t) => t.category === category)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  if (inCategory.length === 0) {
    return (
      <div className="py-12 text-center" data-testid="rule-editor-empty">
        <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">
          This policy has no {category} thresholds configured.
        </p>
      </div>
    );
  }

  const locked = !!policyStatus && IMMUTABLE_STATUSES.has(policyStatus);
  const dirty = Object.entries(edits).filter(([id]) => inCategory.some((t) => t.id === id));
  const hasInvalid = inCategory.some(
    (t) =>
      thresholdKind(t) === "numeric" &&
      isOutOfBounds(t, edits[t.id]?.valueNumeric ?? t.valueNumeric),
  );

  return (
    <div className="space-y-8">
      {locked && (
        <Alert data-testid="alert-policy-locked">
          <Info className="h-4 w-4" />
          <AlertTitle>This policy is {policyStatus?.toLowerCase().replace(/_/g, " ")}</AlertTitle>
          <AlertDescription>
            Thresholds can only be edited while a policy is a draft. Clone it as a
            draft to make changes.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {inCategory.map((threshold) => (
          <ThresholdControl
            key={threshold.id}
            threshold={threshold}
            edit={edits[threshold.id]}
            disabled={locked || saveMutation.isPending}
            onChange={(next) =>
              setEdits((prev) => ({ ...prev, [threshold.id]: { ...prev[threshold.id], ...next } }))
            }
          />
        ))}
      </div>

      <Separator />

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => setEdits({})}
          disabled={dirty.length === 0 || saveMutation.isPending}
          data-testid="button-discard-changes"
        >
          Discard Changes
        </Button>
        <Button
          onClick={() => saveMutation.mutate(dirty)}
          disabled={locked || hasInvalid || dirty.length === 0 || saveMutation.isPending}
          data-testid="button-save-draft"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending
            ? "Saving…"
            : dirty.length === 0
              ? "Save Draft"
              : `Save ${dirty.length} change${dirty.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}
