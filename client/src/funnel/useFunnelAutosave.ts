import { useCallback, useEffect, useRef } from "react";

/**
 * Debounced localStorage persistence for funnel progress. Writes {values,
 * stepId} after the user pauses typing, so a drop-off can be restored to the
 * exact step. Deliberately localStorage (not the backend) per keystroke:
 * server drafts persist on submit/auth via the existing
 * /api/loan-applications draft flow — hammering Neon on every keystroke would
 * be all cost and no benefit.
 *
 * Consent acknowledgements are intentionally NOT persisted — compliance
 * acknowledgements must be re-affirmed each session.
 */

export interface FunnelSaved<TValues> {
  values: TValues;
  stepId: string;
}

export function useFunnelAutosave<TValues>({
  storageKey,
  stepStorageKey,
  values,
  stepId,
  enabled,
  debounceMs = 800,
  shouldPersist,
}: {
  storageKey: string;
  stepStorageKey: string;
  values: TValues;
  stepId: string;
  /** Persist only while true (e.g. past the intro, not yet submitted). */
  enabled: boolean;
  debounceMs?: number;
  /** Skip writes for effectively-empty forms so we don't nag with restores. */
  shouldPersist?: (values: TValues) => boolean;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        if (shouldPersist && !shouldPersist(values)) return;
        localStorage.setItem(storageKey, JSON.stringify(values));
        localStorage.setItem(stepStorageKey, stepId);
      } catch {
        // Private browsing / quota — autosave is best-effort by design.
      }
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [values, stepId, enabled, debounceMs, storageKey, stepStorageKey, shouldPersist]);

  const readSaved = useCallback((): FunnelSaved<TValues> | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      const savedStep = localStorage.getItem(stepStorageKey);
      if (!raw || !savedStep) return null;
      return { values: JSON.parse(raw) as TValues, stepId: savedStep };
    } catch {
      return null;
    }
  }, [storageKey, stepStorageKey]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(stepStorageKey);
    } catch {}
  }, [storageKey, stepStorageKey]);

  return { readSaved, clear };
}
