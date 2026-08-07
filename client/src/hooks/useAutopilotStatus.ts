import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { autopilotKeys } from "@/lib/queryClient";
import type { AutopilotStatus } from "@shared/autopilotStatus";

/**
 * Whether the live channel is currently feeding the cache.
 *
 * "lost" is NOT cosmetic — it is the difference between a status the app can
 * still vouch for and one it merely remembers. See the header below.
 */
export type AutopilotLiveState = "connecting" | "live" | "lost";

export interface UseAutopilotStatusResult {
  /** The status to render. Fed by the snapshot query and by SSE frames alike. */
  status: AutopilotStatus | null;
  live: AutopilotLiveState;
  /** True only when we know NOTHING: the stream is down and the snapshot failed. */
  isError: boolean;
}

/**
 * Live Autopilot status for a loan file (Phase 4).
 *
 * The status lives in the QUERY CACHE, and the SSE stream is one more writer to
 * that entry (`setQueryData`) rather than a parallel store. That ordering is the
 * whole design:
 *
 *   - `GET /api/autopilot/status/:id` is a normal cached query, so the banner
 *     paints immediately, two mounts share one entry instead of opening two
 *     connections, and any mutation can invalidate it.
 *   - The stream pushes transitions into the same entry, so a live update and a
 *     refetch cannot disagree about which value is current.
 *
 * WHY `onerror` IS LOAD-BEARING. The server deliberately tears every stream down
 * on a 300s timer and leans on the browser's transparent reconnect
 * (server/routes/autopilot.ts — MAX_CONNECTION_MS). That works for a clean
 * close. It does NOT work for an HTTP error: per the EventSource spec a
 * reconnect that meets a non-200 (a 401 after the session expires, a 502 during
 * a deploy, a cold start) FAILS THE CONNECTION PERMANENTLY — the browser stops
 * retrying and fires `error`. This hook previously had no error listener and
 * held the status in `useState`, so under exactly those conditions the stream
 * died once, silently, and the borrower kept reading a confident, frozen
 * "we're reviewing your file" indefinitely.
 *
 * So a permanent stream failure now does three things: it marks the channel
 * `lost` (the banner says so instead of asserting), it invalidates the entry so
 * the snapshot endpoint re-answers, and it turns on a slow poll so the surface
 * self-heals when the server comes back — without ever pretending the frozen
 * value is live.
 */
export function useAutopilotStatus(
  applicationId?: string | null,
): UseAutopilotStatusResult {
  const [live, setLive] = useState<AutopilotLiveState>("connecting");
  // The PROVIDER's client, not the module singleton. A hook that writes to the
  // cache has to write to the same cache the component reading it subscribes
  // to; reaching for the singleton would work in the app and silently no-op
  // under any test or nested provider.
  const queryClient = useQueryClient();

  const { data, isError } = useQuery<AutopilotStatus | null>({
    queryKey: autopilotKeys.status(applicationId ?? ""),
    // Deliberately OFF while the stream is live, and it is not an optimisation.
    // The stream opens by pushing its own snapshot (server/routes/autopilot.ts
    // writes the initial status before subscribing), so a concurrent snapshot
    // fetch is both redundant AND a race: a slow response resolving after a
    // fresh frame would overwrite newer live data with an older read. Gating on
    // `live` makes the stream authoritative whenever it is up, by construction.
    enabled: !!applicationId && live !== "live",
    // The stream is the live channel, so no polling while it is up. Once it has
    // failed for good, this is the only way back — hence the fallback interval.
    refetchInterval: live === "lost" ? 30_000 : false,
  });

  useEffect(() => {
    if (!applicationId) {
      setLive("connecting");
      return;
    }
    // Rebuilt inside the effect: the factory returns a fresh array each call, so
    // it can never be a dependency. `applicationId` is the real dependency.
    const key = autopilotKeys.status(applicationId);
    setLive("connecting");

    let es: EventSource;
    try {
      es = new EventSource(`/api/autopilot/stream/${applicationId}`, {
        withCredentials: true,
      });
    } catch {
      // No EventSource at all (old browser, blocked). The snapshot query above
      // still answers; mark the channel lost so the fallback poll takes over.
      setLive("lost");
      return;
    }

    es.addEventListener("open", () => setLive("live"));

    es.addEventListener("status", (e) => {
      let next: AutopilotStatus;
      try {
        next = JSON.parse((e as MessageEvent).data) as AutopilotStatus;
      } catch {
        return; // malformed frame — keep the last good value
      }
      queryClient.setQueryData(key, next);
      setLive("live");
    });

    es.onerror = () => {
      // `error` fires for BOTH a transient drop the browser will retry
      // (readyState CONNECTING) and a permanent failure (readyState CLOSED).
      // Only the latter means the live channel is gone; treating a retry as a
      // failure would flash "lost" every time the 300s teardown re-handshakes.
      if (es.readyState !== EventSource.CLOSED) return;
      setLive("lost");
      queryClient.invalidateQueries({ queryKey: key });
    };

    return () => {
      es.close();
    };
  }, [applicationId, queryClient]);

  return {
    status: data ?? null,
    live,
    // Not `isError` alone: a failed snapshot while the stream is healthy still
    // leaves us with a current value pushed over SSE.
    isError: isError && live === "lost",
  };
}
