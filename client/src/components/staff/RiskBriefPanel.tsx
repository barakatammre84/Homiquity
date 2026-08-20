import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Icons, iconSize } from "@/lib/icons";
import type { RiskBriefResult } from "@shared/riskBrief";

/**
 * Staff-facing AI "file risk brief" (roadmap A4) — an ADVISORY narration of
 * the deterministic engines' outputs. Figures shown as figures come from
 * `result.facts` (engine values), never from narrative text. Generation is a
 * button-triggered mutation on purpose: each call spends model tokens and
 * writes an ai_interactions governance row, so it must never auto-fire.
 */
export function RiskBriefPanel({ applicationId }: { applicationId: string }) {
  const briefMutation = useMutation({
    mutationFn: async (): Promise<RiskBriefResult> => {
      const res = await apiRequest("POST", `/api/loan-applications/${applicationId}/risk-brief`);
      return (await res.json()) as RiskBriefResult;
    },
  });

  const brief = briefMutation.data;
  const metrics = brief?.facts.decision.metrics ?? null;

  return (
    <Card className="shadow-card" data-testid="risk-brief-panel">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Icons.analytics className={iconSize.emphasis} />
            Risk brief
            <Badge variant="outline" data-testid="badge-risk-brief-ai">
              AI-generated — advisory
            </Badge>
            {brief?.degraded && (
              <Badge variant="secondary" data-testid="badge-risk-brief-degraded">
                Offline template
              </Badge>
            )}
          </CardTitle>
          <Button
            size="sm" className="touch-target"
            onClick={() => briefMutation.mutate()}
            disabled={briefMutation.isPending}
            data-testid="button-generate-risk-brief"
          >
            {briefMutation.isPending ? "Generating…" : brief ? "Refresh" : "Generate"}
          </Button>
        </div>
        <CardDescription>
          Advisory only — not a credit decision; not for adverse-action use. Narrates the
          deterministic decision, pre-underwriting flags, readiness, and predictive signals.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {briefMutation.isPending && (
          <div className="space-y-3" data-testid="risk-brief-loading">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {briefMutation.isError && !briefMutation.isPending && (
          <p className="text-sm text-destructive" role="alert" data-testid="risk-brief-error">
            Could not generate the risk brief. Try again, or use the instant-decision and
            readiness panels directly.
          </p>
        )}

        {!brief && !briefMutation.isPending && !briefMutation.isError && (
          <p className="text-sm text-muted-foreground" data-testid="risk-brief-idle">
            Generate an AI narration of this file's current risk picture. Nothing runs until you
            ask; every run is logged for governance.
          </p>
        )}

        {brief && !briefMutation.isPending && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2" data-testid="risk-brief-facts">
              {brief.facts.decision.decision && (
                <Badge
                  variant={
                    brief.facts.decision.decision === "REJECTED"
                      ? "destructive"
                      : brief.facts.decision.decision === "APPROVED"
                        ? "success"
                        : "info"
                  }
                  data-testid="badge-risk-brief-decision"
                >
                  {brief.facts.decision.decision}
                </Badge>
              )}
              <Badge variant="outline" data-testid="badge-risk-brief-qualifier">
                {brief.facts.provenanceQualifier}
              </Badge>
              {metrics && (
                <>
                  <Badge variant="outline">LTV {metrics.ltv.toFixed(1)}%</Badge>
                  <Badge variant="outline">DTI {metrics.dti.toFixed(1)}%</Badge>
                  <Badge variant="outline">Reserves {metrics.monthsOfReserves.toFixed(1)} mo</Badge>
                </>
              )}
            </div>

            <p className="text-sm" data-testid="text-risk-brief-summary">
              {brief.narrative.summary}
            </p>

            {brief.narrative.keyRisks.length > 0 && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-2 text-sm font-medium">
                  <Icons.warning className={iconSize.inline} />
                  Key risks
                </h4>
                <ul className="space-y-2" data-testid="list-risk-brief-risks">
                  {brief.narrative.keyRisks.map((risk, i) => (
                    <li key={i} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">{risk.factor}</p>
                      <p className="text-muted-foreground">{risk.why}</p>
                      <p className="mt-1">
                        <span className="font-medium">Resolve:</span> {risk.remediation}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {brief.narrative.strengths.length > 0 && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-2 text-sm font-medium">
                  <Icons.done className={iconSize.inline} />
                  Strengths
                </h4>
                <ul
                  className="list-disc pl-5 text-sm text-muted-foreground"
                  data-testid="list-risk-brief-strengths"
                >
                  {brief.narrative.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {brief.narrative.suggestedBorrowerQuestions.length > 0 && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-2 text-sm font-medium">
                  <Icons.tasks className={iconSize.inline} />
                  Ask the borrower
                </h4>
                <ul
                  className="list-disc pl-5 text-sm text-muted-foreground"
                  data-testid="list-risk-brief-questions"
                >
                  {brief.narrative.suggestedBorrowerQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />
            <p className="text-xs text-muted-foreground" data-testid="text-risk-brief-disclaimer">
              {brief.disclaimer}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
