import { Link } from "wouter";
import { Loader2, CheckCircle2, AlertTriangle, Send, WifiOff } from "lucide-react";
import type { AutopilotLiveState } from "@/hooks/useAutopilotStatus";
import type { AutopilotStatus } from "@shared/autopilotStatus";

/**
 * Borrower-facing Autopilot banner (Phase 4) — the three real-time states plus a
 * "package readiness" meter driving toward lender-ready. Broker packaging state,
 * never a credit decision; no approval language (Reg N).
 *
 * Takes `live` as well as `status` because the two are not the same claim. A
 * status the SSE stream is still feeding is current; the same status after the
 * stream has failed for good is only the last thing we heard. This banner used
 * to receive the value alone and could not tell those apart, so a stream killed
 * by a 401 or a 502 left it asserting "we're reviewing your file" forever. When
 * the channel is lost it says so — it never silently vouches for a frozen value.
 */
export function AutopilotBanner({
  status,
  live = "live",
}: {
  status: AutopilotStatus | null;
  live?: AutopilotLiveState;
}) {
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

      {/* The live channel is gone for good (see useAutopilotStatus). Say so
          rather than let the value above read as current — a frozen packaging
          status presented as live is the failure this banner is guarding. The
          hook's fallback poll is already trying to reconnect. */}
      {live === "lost" && (
        <p
          className="mt-2 flex items-center gap-1.5 text-xs opacity-80"
          data-testid="autopilot-banner-stale"
        >
          <WifiOff className="h-3 w-3 shrink-0" aria-hidden="true" />
          Live updates paused — this is the last status we confirmed. Reconnecting…
        </p>
      )}

      {/* Package-readiness meter — how close the file is to lender-ready. */}
      {readiness.total > 0 && (
        <div className="mt-2.5">
          <div className="flex items-center justify-between text-xs font-medium opacity-80">
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
