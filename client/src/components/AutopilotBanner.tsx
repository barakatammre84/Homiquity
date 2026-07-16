import { Link } from "wouter";
import { Loader2, CheckCircle2, AlertTriangle, Send } from "lucide-react";
import type { AutopilotStatus } from "@shared/autopilotStatus";

/**
 * Borrower-facing Autopilot banner (Phase 4) — the three real-time states plus a
 * "package readiness" meter driving toward lender-ready. Broker packaging state,
 * never a credit decision; no approval language (Reg N).
 */
export function AutopilotBanner({ status }: { status: AutopilotStatus | null }) {
  if (!status) return null;

  const { phase, readiness, readyToSubmitToLender, outstandingConditions } = status;
  const pct = readiness.total > 0 ? Math.round((readiness.completed / readiness.total) * 100) : 0;

  const tone =
    phase === "items_needed"
      ? {
          wrap: "bg-warning-subtle text-warning-subtle-foreground",
          icon: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
        }
      : phase === "reviewing"
        ? {
            wrap: "bg-primary/10 text-primary",
            icon: <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />,
          }
        : {
            wrap: "bg-success-subtle text-success-subtle-foreground",
            icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
          };

  const headline =
    phase === "items_needed"
      ? `A few items needed${outstandingConditions > 0 ? ` (${outstandingConditions})` : ""}.`
      : status.message;

  return (
    <div
      className={`rounded-xl px-4 py-3 ${tone.wrap}`}
      role="status"
      aria-live="polite"
      data-testid="autopilot-banner"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-medium">
          {tone.icon}
          <span>{headline}</span>
        </div>
        {phase === "items_needed" && (
          <Link
            href="/tasks"
            className="text-xs font-semibold underline underline-offset-2 hover:no-underline"
            data-testid="autopilot-banner-tasks-link"
          >
            View tasks
          </Link>
        )}
      </div>

      {/* Package-readiness meter — how close the file is to lender-ready. */}
      {readiness.total > 0 && (
        <div className="mt-2.5">
          <div className="flex items-center justify-between text-[11px] font-medium opacity-80">
            <span className="inline-flex items-center gap-1">
              {readyToSubmitToLender && <Send className="h-3 w-3" aria-hidden="true" />}
              {readyToSubmitToLender
                ? "Package ready to submit to your lender"
                : `Package readiness: ${readiness.completed} of ${readiness.total} ready`}
            </span>
            <span aria-hidden="true">{pct}%</span>
          </div>
          <div
            className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Package readiness toward lender submission"
          >
            <div
              className="h-full rounded-full bg-current transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
