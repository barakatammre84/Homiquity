import { useEffect, useState } from "react";
import type { AutopilotStatus } from "@shared/autopilotStatus";

/**
 * Live Autopilot status for a loan file (Phase 4). Paints immediately from a
 * one-shot snapshot, then subscribes to the SSE stream for real-time
 * transitions ("We're reviewing…" → "Looks good!" / "A few items needed.").
 *
 * EventSource sends the session cookie same-origin and transparently reconnects
 * when the server closes the (bounded, serverless-friendly) connection, so the
 * banner keeps refreshing without any manual polling loop on the client.
 */
export function useAutopilotStatus(applicationId?: string | null): AutopilotStatus | null {
  const [status, setStatus] = useState<AutopilotStatus | null>(null);

  useEffect(() => {
    if (!applicationId) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    let es: EventSource | null = null;

    // Immediate snapshot so the banner shows without waiting for the stream.
    fetch(`/api/autopilot/status/${applicationId}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: AutopilotStatus | null) => {
        if (!cancelled && s) setStatus(s);
      })
      .catch(() => {
        /* the stream may still connect; a failed snapshot isn't fatal */
      });

    try {
      es = new EventSource(`/api/autopilot/stream/${applicationId}`, { withCredentials: true });
      es.addEventListener("status", (e) => {
        try {
          const s = JSON.parse((e as MessageEvent).data) as AutopilotStatus;
          if (!cancelled) setStatus(s);
        } catch {
          /* ignore malformed frame */
        }
      });
    } catch {
      /* EventSource unavailable — the initial fetch already populated the banner */
    }

    return () => {
      cancelled = true;
      es?.close();
    };
  }, [applicationId]);

  return status;
}
