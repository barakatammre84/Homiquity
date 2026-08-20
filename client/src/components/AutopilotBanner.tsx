import type { ReactElement } from "react";
import { Link } from "wouter";
import { Loader2, CheckCircle2, AlertTriangle, Send, WifiOff, Clock, HelpCircle } from "lucide-react";
import type { AutopilotLiveState } from "@/hooks/useAutopilotStatus";
import type { AutopilotStatus } from "@shared/autopilotStatus";

/**
 * Borrower-facing Autopilot banner (Phase 4) — the real-time status phases plus
 * a "package readiness" meter driving toward lender-ready. Broker packaging
 * state, never a credit decision; no approval language (Reg N).
 *
 * The success treatment belongs to exactly one phase. `clean` means items were
 * raised on this file and every one is resolved. `no_items_yet` (nothing has
 * ever been raised) and `unavailable` (the conditions could not be read) are
 * NOT that, and both used to render as the green "Looks good! No issues found."
 * — an assertion that a review happened and came back empty, on files where
 * neither was true. See shared/autopilotStatus.ts.
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

  // Keyed by phase rather than chained, because the chain's ELSE branch was the
  // defect: every phase that was not `items_needed` or `reviewing` — including
  // a file nothing had been raised on, and a file whose conditions could not be
  // read — fell through to the green check and "Looks good! No issues found."
  // Only `clean` earns the success treatment now; the two states that know
  // nothing get a neutral one that asserts nothing.
  const tone: Record<AutopilotStatus["phase"], { wrap: string; icon: ReactElement }> = {
    items_needed: {
      wrap: "bg-warning-subtle text-warning-subtle-foreground",
      icon: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
    },
    reviewing: {
      wrap: "bg-primary/10 text-primary",
      icon: <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />,
    },
    clean: {
      wrap: "bg-success-subtle text-success-subtle-foreground",
      icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
    },
    no_items_yet: {
      wrap: "bg-muted text-muted-foreground",
      icon: <Clock className="h-4 w-4" aria-hidden="true" />,
    },
    unavailable: {
      wrap: "bg-muted text-muted-foreground",
      icon: <HelpCircle className="h-4 w-4" aria-hidden="true" />,
    },
  };
  const { wrap, icon } = tone[phase] ?? tone.no_items_yet;

  const headline =
    phase === "items_needed"
      ? `A few items needed${outstandingConditions > 0 ? ` (${outstandingConditions})` : ""}.`
      : status.message;

  return (
    <div
      className={`rounded-xl px-4 py-3 ${wrap}`}
      role="status"
      aria-live="polite"
      data-testid="autopilot-banner"
      data-phase={phase}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
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
