// Server-side funnel autosave (roadmap A1): the authenticated leg of the
// funnel's "finish later" story. localStorage autosave (useFunnelAutosave)
// survives a reload on THIS device; this hook additionally keeps the user's
// ONE server draft row current — find-or-create via POST /api/loan-applications/draft,
// then debounced PATCHes into the EXISTING drafts-only edit route — so
// progress survives a device switch and the restore banner can offer it
// anywhere they sign in.
//
// Contracts:
//  - Silent by design. Server autosave is belt-and-suspenders over the
//    localStorage copy; a failure (paused intake, mid-typing validation 400,
//    network) must never interrupt the funnel. No toasts, no retries — the
//    next debounce tick tries again.
//  - Empty answers are OMITTED, never sent: the PATCH schema requires
//    non-empty values for present fields, and an absent field means
//    "unchanged", so partial progress can't blank earlier answers.
//  - The adopted draft id is surfaced to the page so the eventual submit and
//    this autosave target the same container row.
import { useEffect, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { PreApprovalFormData } from "@shared/schema";

const DEBOUNCE_MS = 2500;

/**
 * Only real answers travel: empty answers are OMITTED, never sent — the
 * PATCH schema requires non-empty values for present fields, and an absent
 * field means "unchanged", so partial progress can't blank earlier answers.
 * UI-only helpers stay client-side. Exported for tests.
 */
export function buildDraftPatchPayload(values: PreApprovalFormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (key === "hasAdditionalIncome") continue; // UI-only helper
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    payload[key] = value;
  }
  return payload;
}

interface UseServerDraftAutosaveArgs {
  isAuthenticated: boolean;
  values: PreApprovalFormData;
  /** False on the intro step and once a submit is in flight or done. */
  enabled: boolean;
  hasMeaningfulData: (values: PreApprovalFormData) => boolean;
  /** The already-adopted draft id (useDraftRestore's), when one exists. */
  applicationId: string | null;
  /** Called once when this hook creates the draft container. */
  onDraftAdopted: (id: string) => void;
}

export function useServerDraftAutosave({
  isAuthenticated,
  values,
  enabled,
  hasMeaningfulData,
  applicationId,
  onDraftAdopted,
}: UseServerDraftAutosaveArgs) {
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const idRef = useRef<string | null>(null);
  if (applicationId) idRef.current = applicationId;
  const creatingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Depend on the serialized snapshot, not the object identity — form.watch()
  // returns a fresh object every render, which would reset the debounce on
  // renders where nothing actually changed.
  const snapshotJson = JSON.stringify(values);

  useEffect(() => {
    if (!isAuthenticated || !enabled) return;
    if (!hasMeaningfulData(valuesRef.current)) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        let id = idRef.current;
        if (!id) {
          if (creatingRef.current) return; // one container, ever
          creatingRef.current = true;
          const res = await apiRequest("POST", "/api/loan-applications/draft", {});
          const draft = (await res.json()) as { id: string };
          creatingRef.current = false;
          id = draft.id;
          idRef.current = id;
          onDraftAdopted(id);
        }

        const payload = buildDraftPatchPayload(valuesRef.current);
        if (Object.keys(payload).length === 0) return;
        await apiRequest("PATCH", `/api/loan-applications/${id}`, payload);
      } catch {
        creatingRef.current = false;
        // Deliberately swallowed — see the module contract.
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotJson, isAuthenticated, enabled]);
}
