// Post-auth replay of a pre-approval the borrower finished while signed out.
//
// The funnel lets a visitor answer every question before they have an account.
// When they reach the final step unauthenticated, the page stashes the answers
// plus a PENDING_SUBMIT marker and sends them to sign up; whichever page they
// land on afterwards routes them back to /apply, where this hook finishes the
// submit they already completed.
//
// It is a marker, not a queue: the key is consumed SYNCHRONOUSLY on the first
// pass so a remount, a second auth transition, or two tabs racing cannot submit
// the same application twice. `replayed` outlives the key for the rest of the
// mount, because the restore banner must stay suppressed while the deferred
// submit is still in flight — offering to "restore" answers that are mid-POST
// would double-consume them.
import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { PreApprovalFormData } from "@shared/schema";
import { PREAPPROVAL_AUTOSAVE_KEY, PREAPPROVAL_PENDING_SUBMIT_KEY } from "@/lib/pendingAttribution";

/**
 * How long to wait before replaying. The funnel paints its submit state
 * (VerificationPulse) off the mutation, so firing on the same tick as the
 * post-auth mount would flash the whole thing before the page has settled.
 */
const REPLAY_DELAY_MS = 500;

interface UseDeferredSubmitArgs {
  form: UseFormReturn<PreApprovalFormData>;
  isAuthenticated: boolean;
  /** Restores the final-step consent acknowledgment that gated the marker. */
  setConsent: (acknowledged: boolean) => void;
  /** Fires the real submit. Stable across renders (a react-query mutation). */
  submit: (values: PreApprovalFormData) => void;
}

export interface UseDeferredSubmitResult {
  /**
   * True once a replay has been claimed on this mount. Read by the restore
   * banner, which must not offer answers a deferred submit already owns.
   */
  hasPendingSubmit: () => boolean;
}

export function useDeferredSubmit({
  form,
  isAuthenticated,
  setConsent,
  submit,
}: UseDeferredSubmitArgs): UseDeferredSubmitResult {
  const replayed = useRef(false);
  const [staged, setStaged] = useState<PreApprovalFormData | null>(null);

  // Everything the effects call, held in a ref so their ONLY dependencies are
  // the two things that should actually re-run them. Previously these were
  // closed over with `[isAuthenticated]` deps anyway — honest here rather than
  // silently stale, and it keeps a new `form`/`submit` identity from re-arming.
  const latest = useRef({ form, setConsent, submit });
  latest.current = { form, setConsent, submit };

  // CLAIM. Consumes the marker and stages the payload — no timer here.
  useEffect(() => {
    if (!isAuthenticated || replayed.current) return;

    let saved: string | null;
    try {
      if (!localStorage.getItem(PREAPPROVAL_PENDING_SUBMIT_KEY)) return;
      // Claimed before anything can await: this is what makes it exactly-once.
      replayed.current = true;
      saved = localStorage.getItem(PREAPPROVAL_AUTOSAVE_KEY);
      localStorage.removeItem(PREAPPROVAL_PENDING_SUBMIT_KEY);
    } catch {
      return; // private mode / storage disabled — nothing to replay
    }
    if (!saved) return;

    let values: PreApprovalFormData;
    try {
      values = JSON.parse(saved) as PreApprovalFormData;
    } catch {
      // Corrupt autosave. The marker stays consumed on purpose — one that can
      // never be honoured would suppress the restore banner on every visit.
      return;
    }

    latest.current.form.reset(values);
    // The marker is only ever written AFTER the final step's consent gate
    // passed, so the acknowledgment is restored, not assumed.
    latest.current.setConsent(true);
    setStaged(values);
  }, [isAuthenticated]);

  // ARM. Deliberately a SECOND effect keyed on the staged payload rather than a
  // timer inside the claim above.
  //
  // Sharing one effect meant its cleanup ran on every `isAuthenticated`
  // transition, so a momentary auth flap inside the delay cancelled the timer
  // while the marker was already consumed — the borrower's finished application
  // would have been dropped in silence. Keyed on `staged` (which changes once),
  // the only thing that can cancel an armed replay is an unmount.
  //
  // An unmount inside the window does drop it, which is correct: nothing should
  // POST for a page nobody is on. The answers themselves survive in
  // PREAPPROVAL_AUTOSAVE_KEY — only `clearAutosave` on a successful submit
  // removes those — so the restore banner offers them again on the next visit.
  useEffect(() => {
    if (!staged) return;
    const timer = setTimeout(() => latest.current.submit(staged), REPLAY_DELAY_MS);
    // The cleanup this replaced did not exist at all: a bare setTimeout still
    // POSTed a loan application after the page was gone.
    return () => clearTimeout(timer);
  }, [staged]);

  const hasPendingSubmit = useCallback(() => {
    if (replayed.current) return true;
    try {
      return !!localStorage.getItem(PREAPPROVAL_PENDING_SUBMIT_KEY);
    } catch {
      return false;
    }
  }, []);

  return { hasPendingSubmit };
}
