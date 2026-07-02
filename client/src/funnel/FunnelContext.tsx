import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import type { PreApprovalFormData } from "@shared/schema";
import {
  computeFlags,
  computeRoute,
  createFunnelState,
  funnelReducer,
  routeProgress,
  stepGate,
  type FunnelFlags,
  type FunnelProgress,
  type FunnelState,
  type FunnelStepId,
  type GateResult,
} from "./preApprovalMachine";

/**
 * React binding for the pre-approval funnel machine. The provider owns the
 * machine state; react-hook-form (in the page) owns field editing. The page
 * mirrors form values into the machine via syncAnswers, and passes fresh
 * values on next/back so transitions never act on stale answers.
 */

export interface FunnelContextValue {
  state: FunnelState;
  stepId: FunnelStepId;
  route: FunnelStepId[];
  flags: FunnelFlags;
  progress: FunnelProgress;
  /** Advance if the current step's gate passes; otherwise records blockedGate. */
  next: (answers?: PreApprovalFormData) => void;
  back: (answers?: PreApprovalFormData) => void;
  goTo: (stepId: FunnelStepId) => void;
  hydrate: (stepId: FunnelStepId, answers: PreApprovalFormData) => void;
  /** Mirror the latest form values into the machine (no navigation). */
  syncAnswers: (answers: PreApprovalFormData) => void;
  setConsent: (acknowledged: boolean) => void;
  /** Run a step's gate without navigating (used by the final submit). */
  checkGate: (stepId: FunnelStepId, answers: PreApprovalFormData) => GateResult;
}

const FunnelContext = createContext<FunnelContextValue | null>(null);

export function FunnelProvider({
  initialAnswers,
  children,
}: {
  initialAnswers?: PreApprovalFormData;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(funnelReducer, initialAnswers, createFunnelState);

  const next = useCallback(
    (answers?: PreApprovalFormData) => dispatch({ type: "NEXT", answers }),
    [],
  );
  const back = useCallback(
    (answers?: PreApprovalFormData) => dispatch({ type: "BACK", answers }),
    [],
  );
  const goTo = useCallback((stepId: FunnelStepId) => dispatch({ type: "GO_TO", stepId }), []);
  const hydrate = useCallback(
    (stepId: FunnelStepId, answers: PreApprovalFormData) =>
      dispatch({ type: "HYDRATE", stepId, answers }),
    [],
  );
  const syncAnswers = useCallback(
    (answers: PreApprovalFormData) => dispatch({ type: "ANSWERS_CHANGED", answers }),
    [],
  );
  const setConsent = useCallback(
    (acknowledged: boolean) => dispatch({ type: "CONSENT_ACKNOWLEDGED", acknowledged }),
    [],
  );
  const checkGate = useCallback(
    (stepId: FunnelStepId, answers: PreApprovalFormData) =>
      stepGate(stepId, answers, state.consent),
    [state.consent],
  );

  const value = useMemo<FunnelContextValue>(() => {
    const route = computeRoute(state.answers);
    return {
      state,
      stepId: state.stepId,
      route,
      flags: computeFlags(state.answers),
      progress: routeProgress(route, state.stepId),
      next,
      back,
      goTo,
      hydrate,
      syncAnswers,
      setConsent,
      checkGate,
    };
  }, [state, next, back, goTo, hydrate, syncAnswers, setConsent, checkGate]);

  return <FunnelContext.Provider value={value}>{children}</FunnelContext.Provider>;
}

export function useFunnel(): FunnelContextValue {
  const ctx = useContext(FunnelContext);
  if (!ctx) throw new Error("useFunnel must be used within a FunnelProvider");
  return ctx;
}
