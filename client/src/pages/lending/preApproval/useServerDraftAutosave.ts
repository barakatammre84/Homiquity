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
//  - A field the borrower actually CLEARED is the one exception, and it is
//    detected as a TRANSITION rather than a state. See buildDraftClears.
//  - The adopted draft id is surfaced to the page so the eventual submit and
//    this autosave target the same container row.
import { useEffect, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
// Table-free module, not the @shared/schema barrel — a value import of the
// barrel ships all 174 Drizzle tables to the browser (#482).
import { isClearableIntakeField } from "@shared/intakeClearable";
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

/** Is this answer absent? Blank strings and empty arrays both count. */
function isEmptyAnswer(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Fields the borrower CLEARED — emptied after this session had seen them hold
 * a value.
 *
 * THE SIGNAL IS A TRANSITION, NOT A STATE, and that distinction is the whole
 * design. `null` now means "clear this" on the wire (CLEARABLE_INTAKE_FIELDS,
 * shared/intakeClearable.ts), so it is tempting to simply send null for every
 * empty field. That would be catastrophic here: the funnel form starts BLANK
 * on every visit, while the server draft may already hold a full set of
 * answers from another device. The first debounce would null out the entire
 * draft — turning "resume where you left off" into "lose everything you had".
 * Emptiness cannot tell "not reached yet" from "deleted"; only the transition
 * can.
 *
 * `heldValue` is that memory: the fields this session has observed carrying a
 * value, whether the borrower typed it or the restore banner hydrated it. A
 * field never in that set is one we have no business clearing — we have no
 * evidence the borrower ever saw it filled in.
 *
 * Two shapes of clear, because the two columns disagree about what empty is:
 *   - scalars send `null`, the wire's clear;
 *   - `incomeSources` sends `[]`, which the schema already accepts and which is
 *     the honest value for "I removed them all". It needs no catalog entry and
 *     no schema change.
 *
 * Anything NOT in the catalog is omitted rather than nulled. A null on a field
 * whose validator rejects it would 400 the WHOLE PATCH, and this hook swallows
 * failures by design — one bad key would silently stop persisting every other
 * answer on the page. Exported for tests.
 */
export function buildDraftClears(
  heldValue: ReadonlySet<string>,
  values: PreApprovalFormData,
): Record<string, null | never[]> {
  const clears: Record<string, null | never[]> = {};
  for (const [key, value] of Object.entries(values)) {
    if (key === "hasAdditionalIncome") continue; // UI-only helper
    if (!heldValue.has(key) || !isEmptyAnswer(value)) continue;

    if (Array.isArray(value)) {
      clears[key] = [];
    } else if (isClearableIntakeField(key)) {
      clears[key] = null;
    }
    // else: no wire representation for clearing it, and the funnel offers no
    // way to empty a select anyway. Omit, exactly as before.
  }
  return clears;
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
  // Fields this session has seen hold a value. Empty at mount on purpose: a
  // visit that has not filled anything in can never clear anything.
  const heldValueRef = useRef<Set<string>>(new Set());

  // Depend on the serialized snapshot, not the object identity — form.watch()
  // returns a fresh object every render, which would reset the debounce on
  // renders where nothing actually changed.
  const snapshotJson = JSON.stringify(values);

  // Remember every field seen holding a value, on EVERY observed change rather
  // than only at debounce time. The restore banner hydrates the form in one
  // shot (useDraftRestore's form.reset), and a borrower who restores and then
  // immediately clears a field must still have that clear travel — waiting for
  // a debounce to notice the value would miss exactly that case.
  useEffect(() => {
    for (const [key, value] of Object.entries(values)) {
      if (!isEmptyAnswer(value)) heldValueRef.current.add(key);
    }
  }, [snapshotJson]); // eslint-disable-line react-hooks/exhaustive-deps

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

        const sending = valuesRef.current;
        const clears = buildDraftClears(heldValueRef.current, sending);
        const payload = { ...buildDraftPatchPayload(sending), ...clears };
        if (Object.keys(payload).length === 0) return;
        await apiRequest("PATCH", `/api/loan-applications/${id}`, payload);
        // Forget the cleared fields only once the clear has actually landed:
        // before this, every later tick would re-send the same nulls; if the
        // request failed, dropping them would lose the clear in silence, which
        // is the defect this whole thread is about.
        for (const key of Object.keys(clears)) heldValueRef.current.delete(key);
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
