import { preApprovalFormSchema, type PreApprovalFormData } from "@shared/schema";
import { toNum as toNumber } from "@shared/lib/number";

/**
 * Deterministic state machine for the PreApproval funnel (/apply).
 *
 * The machine owns SEQUENCING and COMPLIANCE GATES; react-hook-form continues
 * to own field editing and per-field validation. The route (which steps exist
 * and in what order) is a pure function of the answers — the same answers
 * always produce the same route, so restore/back/forward can never strand a
 * user on a step that shouldn't exist.
 *
 * Dynamic routing rules:
 * - `incomeSources` (the complex-income block) is injected when the borrower
 *   says they have additional income, when they are self-employed (1099 income
 *   must be detailed for underwriting), or when they already hold multiple
 *   rental properties.
 * - The military/first-time question is asked BEFORE purchase price and down
 *   payment so VA eligibility can drive the zero-down path: a VA-eligible
 *   purchase allows a $0 down payment and suppresses PMI guidance (VA loans
 *   carry no PMI).
 * - `householdFamilySize` and `homeSquareFootage` are injected for veterans:
 *   both feed the VA residual-income evaluation (regional residual table and
 *   the $0.14/sqft utility deduction), which cannot run without them.
 *
 * NOTE: no SSN is collected at this stage by design — pre-approval runs a
 * SOFT credit pull gated on FCRA consent (see the `final` gate), not on SSN.
 * SSN enters later, server-side, at the full 1003/DU stage.
 */

export type FunnelStepId =
  | "intro"
  | "loanPurpose"
  | "propertyType"
  | "veteranAndFirstTime"
  | "purchasePrice"
  | "downPayment"
  | "propertyState"
  | "householdFamilySize"
  | "homeSquareFootage"
  | "annualIncome"
  | "employmentType"
  | "employmentYears"
  | "hasAdditionalIncome"
  | "incomeSources"
  | "monthlyDebts"
  | "creditScore"
  | "final";

/** Every step the funnel can ever contain, in canonical order. */
export const CANONICAL_ORDER: readonly FunnelStepId[] = [
  "intro",
  "loanPurpose",
  "propertyType",
  "veteranAndFirstTime",
  "purchasePrice",
  "downPayment",
  "propertyState",
  "householdFamilySize",
  "homeSquareFootage",
  "annualIncome",
  "employmentType",
  "employmentYears",
  "hasAdditionalIncome",
  "incomeSources",
  "monthlyDebts",
  "creditScore",
  "final",
];

export const PRE_APPROVAL_DEFAULTS: PreApprovalFormData = {
  annualIncome: "",
  employmentType: "employed",
  employmentYears: "",
  monthlyDebts: "",
  creditScore: "",
  loanPurpose: "purchase",
  propertyType: "single_family",
  purchasePrice: "",
  downPayment: "",
  isVeteran: false,
  isFirstTimeBuyer: false,
  propertyState: "",
  householdFamilySize: "",
  homeSquareFootage: "",
  hasAdditionalIncome: false,
  incomeSources: [],
};

export interface FunnelFlags {
  /** VA-eligible purchase: $0 down allowed, no PMI. */
  vaZeroDown: boolean;
  /** Income needs the complex-income block regardless of "additional income". */
  complexIncome: boolean;
  /** PMI guidance applies (conventional path, < 20% down). */
  pmiLikely: boolean;
}

export function computeFlags(answers: PreApprovalFormData): FunnelFlags {
  const rental = (answers.incomeSources ?? []).find((s) => s.type === "rental");
  const multipleProperties = (rental?.rentalProperties?.length ?? 0) >= 2;
  const complexIncome = answers.employmentType === "self_employed" || multipleProperties;

  const vaZeroDown = answers.isVeteran === true && answers.loanPurpose === "purchase";

  const price = toNumber(answers.purchasePrice);
  const down = toNumber(answers.downPayment);
  const pmiLikely =
    !vaZeroDown && price > 0 && !isNaN(down) && down / price < 0.2;

  return { vaZeroDown, complexIncome, pmiLikely };
}

/**
 * The ONLY answers `computeFlags` and `computeRoute` read.
 *
 * `state.answers` exists to derive the route and the flags — nothing else reads
 * it (NEXT/BACK/checkGate/submit all receive fresh `form.getValues()` from the
 * caller), so an ANSWERS_CHANGED dispatch that cannot move either output is
 * pure cost. The React binding uses `routingSignature` to skip those: without
 * it, every keystroke in every text step dispatched, rebuilt the context value,
 * and re-rendered the whole funnel a second time.
 *
 * Keep this list in step with computeFlags/computeRoute above.
 * `preApprovalMachine.test.ts` proves it is complete — it mutates every field
 * NOT listed here and asserts neither output moves — so adding a field to
 * computeFlags without adding it here fails the build rather than silently
 * freezing the route.
 */
export const ROUTING_ANSWER_FIELDS: readonly (keyof PreApprovalFormData)[] = [
  "isVeteran", // route: injects the VA residual-income steps; flags: vaZeroDown
  "loanPurpose", // flags: vaZeroDown
  "employmentType", // flags: complexIncome
  "hasAdditionalIncome", // route: injects incomeSources
  "incomeSources", // route + flags: rental count drives complexIncome
  "purchasePrice", // flags: pmiLikely
  "downPayment", // flags: pmiLikely
];

/**
 * A stable string over exactly the routing-relevant answers. Equal signature ⇒
 * identical route and flags, so the binding can skip the dispatch.
 */
export function routingSignature(answers: PreApprovalFormData): string {
  return JSON.stringify(ROUTING_ANSWER_FIELDS.map((field) => answers[field] ?? null));
}

/** The route is a pure function of the answers. Same answers → same route. */
export function computeRoute(answers: PreApprovalFormData): FunnelStepId[] {
  const flags = computeFlags(answers);
  const route: FunnelStepId[] = [
    "intro",
    "loanPurpose",
    "propertyType",
    "veteranAndFirstTime",
    "purchasePrice",
    "downPayment",
    "propertyState",
  ];
  // VA residual-income inputs (38 CFR 36.4340(e)): family size and square
  // footage are required to underwrite any veteran, so the steps are injected
  // whenever the borrower reports military service.
  if (answers.isVeteran) {
    route.push("householdFamilySize", "homeSquareFootage");
  }
  route.push("annualIncome", "employmentType", "employmentYears", "hasAdditionalIncome");
  const hasEnteredSources = (answers.incomeSources?.length ?? 0) > 0;
  if (answers.hasAdditionalIncome || flags.complexIncome || hasEnteredSources) {
    route.push("incomeSources");
  }
  route.push("monthlyDebts", "creditScore", "final");
  return route;
}

// ---------------------------------------------------------------------------
// Validation gates — compliance/cross-field checks that block NEXT.
// Per-field format validation stays in react-hook-form (zod resolver); gates
// cover what a single field can't know.
// ---------------------------------------------------------------------------

export interface FunnelConsent {
  /** FCRA soft-pull authorization, re-acknowledged every session (never persisted). */
  softPullAcknowledged: boolean;
}

export interface GateResult {
  ok: boolean;
  errors: string[];
}

const GATE_OK: GateResult = { ok: true, errors: [] };

export function stepGate(
  stepId: FunnelStepId,
  answers: PreApprovalFormData,
  consent: FunnelConsent,
): GateResult {
  const flags = computeFlags(answers);

  switch (stepId) {
    case "downPayment": {
      const down = toNumber(answers.downPayment);
      const price = toNumber(answers.purchasePrice);
      if (isNaN(down)) {
        return flags.vaZeroDown
          ? { ok: false, errors: ["Enter a down payment — 0 is allowed with your VA benefit."] }
          : { ok: false, errors: ["Please enter your planned down payment."] };
      }
      if (down === 0 && !flags.vaZeroDown) {
        return {
          ok: false,
          errors: ["A down payment is required for non-VA loans. Veterans may qualify for $0 down."],
        };
      }
      if (!isNaN(price) && down > price) {
        return { ok: false, errors: ["Down payment cannot be more than the purchase price."] };
      }
      return GATE_OK;
    }

    case "incomeSources": {
      const sources = answers.incomeSources ?? [];
      if (sources.length === 0) {
        if (flags.complexIncome && answers.employmentType === "self_employed") {
          return {
            ok: false,
            errors: ["Please detail your self-employment income — underwriting needs it to verify 1099/business earnings."],
          };
        }
        if (answers.hasAdditionalIncome) {
          return { ok: false, errors: ["Please add at least one income source, or go back and answer “No”."] };
        }
        return GATE_OK;
      }
      const allValid = sources.every((s) => {
        if (s.type === "rental") {
          const props = s.rentalProperties ?? [];
          return (
            props.length > 0 &&
            props.every(
              (p) =>
                p.address &&
                p.monthlyRentalIncome &&
                toNumber(p.monthlyRentalIncome) > 0,
            )
          );
        }
        return !!s.annualAmount && s.annualAmount.length > 0;
      });
      if (!allValid) {
        return {
          ok: false,
          errors: [
            "Each income source needs at least an annual amount. Rental properties need an address and monthly income.",
          ],
        };
      }
      return GATE_OK;
    }

    case "final": {
      const errors: string[] = [];
      if (!consent.softPullAcknowledged) {
        errors.push("Please authorize the soft credit check to continue.");
      }
      const parsed = preApprovalFormSchema.safeParse(answers);
      if (!parsed.success) {
        for (const issue of parsed.error.issues.slice(0, 3)) {
          errors.push(issue.message);
        }
      }
      return errors.length > 0 ? { ok: false, errors } : GATE_OK;
    }

    default:
      return GATE_OK;
  }
}

// ---------------------------------------------------------------------------
// The machine: a pure reducer. All transitions are deterministic functions of
// (state, event) — no timers, no IO, no reading globals.
// ---------------------------------------------------------------------------

export interface FunnelState {
  stepId: FunnelStepId;
  /** 1 = advancing, -1 = going back; drives the slide animation. */
  direction: 1 | -1;
  /**
   * ROUTING-AUTHORITATIVE ONLY. Current for every field in
   * `ROUTING_ANSWER_FIELDS`; every other field may lag the form, because the
   * binding skips ANSWERS_CHANGED when it cannot move the route or the flags.
   * Read this to derive sequencing — never to read a borrower's answer. NEXT,
   * BACK, `checkGate` and the submit path all take fresh `form.getValues()`
   * from the caller for exactly that reason.
   */
  answers: PreApprovalFormData;
  consent: FunnelConsent;
  /** Result of the last blocked NEXT, stamped so effects can toast once. */
  blockedGate: (GateResult & { at: number }) | null;
}

export type FunnelEvent =
  | { type: "ANSWERS_CHANGED"; answers: PreApprovalFormData }
  | { type: "CONSENT_ACKNOWLEDGED"; acknowledged: boolean }
  | { type: "NEXT"; answers?: PreApprovalFormData }
  | { type: "BACK"; answers?: PreApprovalFormData }
  | { type: "GO_TO"; stepId: FunnelStepId }
  | { type: "HYDRATE"; stepId: FunnelStepId; answers: PreApprovalFormData };

export function createFunnelState(
  answers: PreApprovalFormData = PRE_APPROVAL_DEFAULTS,
): FunnelState {
  return {
    stepId: "intro",
    direction: 1,
    answers,
    consent: { softPullAcknowledged: false },
    blockedGate: null,
  };
}

/**
 * Where does `stepId` live in `route`? If the step was routed OUT by an answer
 * change (e.g. income sources removed), fall back to the nearest preceding
 * step that still exists — deterministically, via the canonical order.
 */
export function resolveRouteIndex(route: FunnelStepId[], stepId: FunnelStepId): number {
  const direct = route.indexOf(stepId);
  if (direct !== -1) return direct;
  let canonicalIdx = CANONICAL_ORDER.indexOf(stepId);
  while (canonicalIdx > 0) {
    canonicalIdx -= 1;
    const fallback = route.indexOf(CANONICAL_ORDER[canonicalIdx]);
    if (fallback !== -1) return fallback;
  }
  return 0;
}

export function funnelReducer(state: FunnelState, event: FunnelEvent): FunnelState {
  switch (event.type) {
    case "ANSWERS_CHANGED":
      return { ...state, answers: event.answers };

    case "CONSENT_ACKNOWLEDGED":
      return { ...state, consent: { softPullAcknowledged: event.acknowledged } };

    case "NEXT": {
      const answers = event.answers ?? state.answers;
      const gate = stepGate(state.stepId, answers, state.consent);
      if (!gate.ok) {
        return { ...state, answers, blockedGate: { ...gate, at: Date.now() } };
      }
      const route = computeRoute(answers);
      const idx = resolveRouteIndex(route, state.stepId);
      const nextId = route[Math.min(idx + 1, route.length - 1)];
      return { ...state, answers, stepId: nextId, direction: 1, blockedGate: null };
    }

    case "BACK": {
      const answers = event.answers ?? state.answers;
      const route = computeRoute(answers);
      const idx = resolveRouteIndex(route, state.stepId);
      const prevId = route[Math.max(idx - 1, 0)];
      return { ...state, answers, stepId: prevId, direction: -1, blockedGate: null };
    }

    case "GO_TO": {
      const route = computeRoute(state.answers);
      const idx = resolveRouteIndex(route, event.stepId);
      return { ...state, stepId: route[idx], direction: 1, blockedGate: null };
    }

    case "HYDRATE": {
      const route = computeRoute(event.answers);
      const idx = resolveRouteIndex(route, event.stepId);
      return {
        ...state,
        answers: event.answers,
        stepId: route[idx],
        direction: 1,
        blockedGate: null,
      };
    }

    default:
      return state;
  }
}

export interface FunnelProgress {
  /** Index of the current step within the active route (intro = 0). */
  index: number;
  /** Number of question steps (route length minus the intro). */
  total: number;
  /** 0..100, for the progress bar. */
  percent: number;
}

export function routeProgress(route: FunnelStepId[], stepId: FunnelStepId): FunnelProgress {
  const index = resolveRouteIndex(route, stepId);
  const total = route.length - 1;
  return { index, total, percent: total > 0 ? (index / total) * 100 : 0 };
}
