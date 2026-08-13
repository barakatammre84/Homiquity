import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ClipboardCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ReviewItem } from "@shared/schema";

/**
 * Income Review workbench (UAL P5) — the exception-only staff surface. Renders
 * ONLY the actionable tiers (one-click confirmations and flagged
 * contradictions); auto-accepted data never appears here. Resolutions become
 * the accuracy loop's labeled ground truth and trigger a decision recalc
 * server-side.
 */

export function ReviewWorkbenchPanel({
  borrowerUserId,
  applicationId,
}: {
  borrowerUserId: string;
  applicationId?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const listUrl = `/api/tax-intelligence/review-items?userId=${encodeURIComponent(borrowerUserId)}${applicationId ? `&applicationId=${encodeURIComponent(applicationId)}` : ""}`;
  const { data, isLoading } = useQuery<{ items: ReviewItem[] }>({ queryKey: [listUrl] });
  const [overrideValues, setOverrideValues] = useState<Record<string, string>>({});

  const resolve = useMutation({
    mutationFn: async (input: { id: string; action: "confirmed" | "overridden" | "dismissed"; correctedValue?: string }) => {
      const res = await apiRequest("POST", `/api/tax-intelligence/review-items/${input.id}/resolve${applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : ""}`, {
        action: input.action,
        ...(input.correctedValue !== undefined ? { correctedValue: input.correctedValue } : {}),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [listUrl] });
      toast({ title: "Review item resolved" });
    },
    onError: (e: Error) => toast({ title: "Couldn't resolve item", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <Card data-testid="review-workbench-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4" />
            Income Review
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  const items = data?.items ?? [];
  const flagged = items.filter((i) => i.tier === "flagged");
  const oneClick = items.filter((i) => i.tier === "one_click");

  return (
    <Card data-testid="review-workbench-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4" />
          Income Review
          {items.length > 0 && (
            <Badge variant={flagged.length > 0 ? "warning" : "info"} data-testid="badge-open-count">
              {items.length} open
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Only the items the machine is unsure about — everything else is auto-accepted and
          collapsed. Resolutions are recorded as human-verified ground truth.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-no-review-items">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Nothing needs a human right now.
          </div>
        ) : (
          <ul className="space-y-4" data-testid="review-items-list">
            {[...flagged, ...oneClick].map((item, idx) => (
              <li key={item.id} className="space-y-2">
                {idx > 0 && <Separator className="mb-2" />}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {item.tier === "flagged" ? (
                        <Badge variant="warning" data-testid={`badge-tier-${idx}`}>
                          <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
                          Flagged
                        </Badge>
                      ) : (
                        <Badge variant="info" data-testid={`badge-tier-${idx}`}>One-click</Badge>
                      )}
                      <span className="text-sm font-medium" data-testid={`review-item-title-${idx}`}>
                        {item.title}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => resolve.mutate({ id: item.id, action: "confirmed" })}
                    disabled={resolve.isPending}
                    data-testid={`button-confirm-${idx}`}
                  >
                    Confirm
                  </Button>
                  {item.tier === "flagged" && (
                    <>
                      <Input
                        className="h-8 w-40"
                        placeholder="Corrected value"
                        aria-label="Corrected value"
                        value={overrideValues[item.id] ?? ""}
                        onChange={(e) => setOverrideValues((s) => ({ ...s, [item.id]: e.target.value }))}
                        data-testid={`input-override-${idx}`}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resolve.isPending || !(overrideValues[item.id] ?? "").trim()}
                        onClick={() =>
                          resolve.mutate({ id: item.id, action: "overridden", correctedValue: overrideValues[item.id].trim() })
                        }
                        data-testid={`button-override-${idx}`}
                      >
                        Override
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => resolve.mutate({ id: item.id, action: "dismissed" })}
                    disabled={resolve.isPending}
                    data-testid={`button-dismiss-${idx}`}
                  >
                    Dismiss
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
