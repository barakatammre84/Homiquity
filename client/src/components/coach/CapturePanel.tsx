import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, FileText, UserCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CAPTURE_FIELDS,
  SKIP_REASON_LABELS,
  formatCaptureValue,
  type CapturedEvent,
  type CoachIntake,
} from "./types";

// The "Pre-App Profile" panel — the visible trail for auto-saved chat data.
// Baseline values come from GET /api/coach/intake/latest (merged across
// conversations); live `captured` SSE events overlay the current turn's saves
// with a "saved just now" flash, and skipped fields explain themselves.
export function CapturePanel({ captured }: { captured: CapturedEvent[] }) {
  const { data: latest } = useQuery<{
    intake: CoachIntake | null;
    readinessTier?: string | null;
    completionPercentage?: number | null;
  } | null>({
    queryKey: ["/api/coach/intake/latest"],
  });

  const { values, justSaved, savedToApplication, skippedNotes } = useMemo(() => {
    const merged: Record<string, string | number | boolean> = { ...(latest?.intake ?? {}) } as Record<
      string,
      string | number | boolean
    >;
    const flash = new Map<string, number>();
    let appId: string | null = null;
    const skipped: Array<{ field: string; reason: string }> = [];

    for (const event of captured) {
      if (event.applicationId) appId = event.applicationId;
      for (const f of event.applied) {
        merged[f.field] = f.value;
        flash.set(f.field, event.at);
      }
      for (const s of event.skipped) {
        if (s.reason !== "unchanged") skipped.push(s);
      }
    }
    return { values: merged, justSaved: flash, savedToApplication: appId, skippedNotes: skipped.slice(-4) };
  }, [captured, latest]);

  const filled = CAPTURE_FIELDS.filter(
    (f) => formatCaptureValue(f.kind, values[f.key] as never) !== null,
  ).length;

  return (
    <Card data-testid="card-capture-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <UserCircle2 className="h-4 w-4 text-primary" />
            Pre-App Profile
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
            Self-reported
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>{filled} of {CAPTURE_FIELDS.length} details captured</span>
            {savedToApplication && (
              <span className="flex items-center gap-1 text-success-subtle-foreground" data-testid="text-saved-to-draft">
                <BadgeCheck className="h-3 w-3" />
                Saved to your draft
              </span>
            )}
          </div>
          <Progress value={(filled / CAPTURE_FIELDS.length) * 100} className="h-1.5" data-testid="progress-capture" />
        </div>

        <div className="space-y-1" data-testid="capture-field-list">
          {CAPTURE_FIELDS.map((field) => {
            const display = formatCaptureValue(field.kind, values[field.key] as never);
            const flashed = justSaved.has(field.key);
            const Icon = field.icon;
            return (
              <div
                key={field.key}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                  flashed ? "bg-primary/5 ring-1 ring-primary/30" : ""
                }`}
                data-testid={`capture-field-${field.key}`}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${display ? "text-primary" : "text-muted-foreground/50"}`} />
                <span className={`flex-1 min-w-0 truncate ${display ? "text-foreground" : "text-muted-foreground"}`}>
                  {field.label}
                </span>
                {display ? (
                  <span className="font-medium text-foreground shrink-0">{display}</span>
                ) : (
                  <span className="text-xs text-muted-foreground/70 shrink-0">—</span>
                )}
                {flashed && (
                  <Badge className="text-[9px] px-1 py-0 shrink-0" data-testid={`badge-just-saved-${field.key}`}>
                    saved
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        {skippedNotes.length > 0 && (
          <div className="space-y-0.5 pt-1 border-t" data-testid="capture-skipped-notes">
            {skippedNotes.map((s, i) => {
              const def = CAPTURE_FIELDS.find((f) => f.key === s.field);
              return (
                <p key={`${s.field}-${i}`} className="text-[10px] text-muted-foreground leading-snug">
                  {def?.label ?? s.field}: {SKIP_REASON_LABELS[s.reason] ?? s.reason}
                </p>
              );
            })}
          </div>
        )}

        <div className="pt-2 border-t space-y-2">
          <Button asChild variant="outline" className="w-full gap-2 text-sm">
            <Link href="/profile" data-testid="link-capture-profile">
              <UserCircle2 className="h-4 w-4" />
              View My Profile
              <ArrowRight className="h-3.5 w-3.5 ml-auto" />
            </Link>
          </Button>
          <Button asChild className="w-full gap-2 text-sm">
            <Link href="/apply?source=coach" data-testid="link-capture-apply">
              <FileText className="h-4 w-4" />
              Continue to Pre-Approval
              <ArrowRight className="h-3.5 w-3.5 ml-auto" />
            </Link>
          </Button>
          <p className="text-[10px] text-muted-foreground text-center leading-snug">
            Everything Homi captures pre-fills your application.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
