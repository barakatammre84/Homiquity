import { describe, expect, it } from "vitest";
import {
  computeFlags,
  computeRoute,
  createFunnelState,
  funnelReducer,
  PRE_APPROVAL_DEFAULTS,
  resolveRouteIndex,
  routeProgress,
  stepGate,
  type FunnelState,
} from "../client/src/funnel/preApprovalMachine";
import type { PreApprovalFormData } from "../shared/schema";

const NO_CONSENT = { softPullAcknowledged: false };
const CONSENT = { softPullAcknowledged: true };

function answers(overrides: Partial<PreApprovalFormData> = {}): PreApprovalFormData {
  return { ...PRE_APPROVAL_DEFAULTS, ...overrides };
}

/** Complete, valid answer set (passes the full zod schema). */
function completeAnswers(overrides: Partial<PreApprovalFormData> = {}): PreApprovalFormData {
  return answers({
    annualIncome: "120,000",
    employmentType: "employed",
    employmentYears: "5",
    monthlyDebts: "1,500",
    creditScore: "760",
    loanPurpose: "purchase",
    propertyType: "single_family",
    purchasePrice: "500,000",
    downPayment: "100,000",
    propertyState: "CA",
    ...overrides,
  });
}

describe("computeRoute — deterministic dynamic routing", () => {
  it("produces the base route with no complex income", () => {
    const route = computeRoute(answers());
    expect(route).toEqual([
      "intro",
      "loanPurpose",
      "propertyType",
      "veteranAndFirstTime",
      "purchasePrice",
      "downPayment",
      "propertyState",
      "annualIncome",
      "employmentType",
      "employmentYears",
      "hasAdditionalIncome",
      "monthlyDebts",
      "creditScore",
      "final",
    ]);
  });

  it("asks about military service before the down payment (VA zero-down ordering)", () => {
    const route = computeRoute(answers());
    expect(route.indexOf("veteranAndFirstTime")).toBeLessThan(route.indexOf("downPayment"));
  });

  it("injects the complex-income block when the user reports additional income", () => {
    const route = computeRoute(answers({ hasAdditionalIncome: true }));
    expect(route).toContain("incomeSources");
    expect(route.indexOf("incomeSources")).toBe(route.indexOf("hasAdditionalIncome") + 1);
  });

  it("forces the complex-income block for self-employed borrowers", () => {
    const route = computeRoute(answers({ employmentType: "self_employed", hasAdditionalIncome: false }));
    expect(route).toContain("incomeSources");
  });

  it("keeps the complex-income block for multi-property landlords", () => {
    const route = computeRoute(
      answers({
        hasAdditionalIncome: false,
        incomeSources: [
          {
            type: "rental",
            annualAmount: "36,000",
            rentalProperties: [
              { address: "1 Main St", monthlyRentalIncome: "1,500", monthlyDebtPayment: "" },
              { address: "2 Oak Ave", monthlyRentalIncome: "1,500", monthlyDebtPayment: "" },
            ],
          },
        ],
      }),
    );
    expect(route).toContain("incomeSources");
  });

  it("is deterministic: identical answers yield identical routes", () => {
    const a = answers({ employmentType: "self_employed" });
    expect(computeRoute(a)).toEqual(computeRoute({ ...a }));
  });

  it("injects the VA residual-income steps for veterans only", () => {
    const va = computeRoute(answers({ isVeteran: true }));
    expect(va.indexOf("householdFamilySize")).toBe(va.indexOf("propertyState") + 1);
    expect(va.indexOf("homeSquareFootage")).toBe(va.indexOf("householdFamilySize") + 1);

    const conventional = computeRoute(answers({ isVeteran: false }));
    expect(conventional).not.toContain("householdFamilySize");
    expect(conventional).not.toContain("homeSquareFootage");
  });
});

describe("computeFlags", () => {
  it("flags VA zero-down for veteran purchases only", () => {
    expect(computeFlags(answers({ isVeteran: true, loanPurpose: "purchase" })).vaZeroDown).toBe(true);
    expect(computeFlags(answers({ isVeteran: true, loanPurpose: "refinance" })).vaZeroDown).toBe(false);
    expect(computeFlags(answers({ isVeteran: false })).vaZeroDown).toBe(false);
  });

  it("suppresses PMI guidance on the VA path", () => {
    const va = computeFlags(answers({ isVeteran: true, purchasePrice: "500,000", downPayment: "0" }));
    expect(va.pmiLikely).toBe(false);
    const conventional = computeFlags(answers({ purchasePrice: "500,000", downPayment: "50,000" }));
    expect(conventional.pmiLikely).toBe(true);
  });
});

describe("stepGate — validation gates", () => {
  it("blocks a $0 down payment on the conventional path", () => {
    const gate = stepGate("downPayment", answers({ purchasePrice: "500,000", downPayment: "0" }), NO_CONSENT);
    expect(gate.ok).toBe(false);
    expect(gate.errors[0]).toMatch(/VA/i);
  });

  it("allows a $0 down payment for VA-eligible veterans", () => {
    const gate = stepGate(
      "downPayment",
      answers({ isVeteran: true, loanPurpose: "purchase", purchasePrice: "500,000", downPayment: "0" }),
      NO_CONSENT,
    );
    expect(gate.ok).toBe(true);
  });

  it("blocks a down payment above the purchase price", () => {
    const gate = stepGate("downPayment", answers({ purchasePrice: "300,000", downPayment: "400,000" }), NO_CONSENT);
    expect(gate.ok).toBe(false);
  });

  it("requires self-employed borrowers to detail their income", () => {
    const gate = stepGate(
      "incomeSources",
      answers({ employmentType: "self_employed", hasAdditionalIncome: false, incomeSources: [] }),
      NO_CONSENT,
    );
    expect(gate.ok).toBe(false);
    expect(gate.errors[0]).toMatch(/self-employment/i);
  });

  it("requires rental sources to have complete property details", () => {
    const gate = stepGate(
      "incomeSources",
      answers({
        hasAdditionalIncome: true,
        incomeSources: [
          { type: "rental", annualAmount: "", rentalProperties: [{ address: "", monthlyRentalIncome: "", monthlyDebtPayment: "" }] },
        ],
      }),
      NO_CONSENT,
    );
    expect(gate.ok).toBe(false);
  });

  it("blocks final submission without the FCRA soft-pull acknowledgement", () => {
    const gate = stepGate("final", completeAnswers(), NO_CONSENT);
    expect(gate.ok).toBe(false);
    expect(gate.errors[0]).toMatch(/soft credit/i);
  });

  it("passes final submission with consent and complete answers", () => {
    const gate = stepGate("final", completeAnswers(), CONSENT);
    expect(gate.ok).toBe(true);
  });

  it("requires the VA residual-income inputs for veterans at the final gate", () => {
    const missing = stepGate(
      "final",
      completeAnswers({ isVeteran: true, downPayment: "0" }),
      CONSENT,
    );
    expect(missing.ok).toBe(false);
    expect(missing.errors.join(" ")).toMatch(/household size/i);

    const complete = stepGate(
      "final",
      completeAnswers({
        isVeteran: true,
        downPayment: "0",
        householdFamilySize: "3",
        homeSquareFootage: "2000",
      }),
      CONSENT,
    );
    expect(complete.ok).toBe(true);
  });

  it("reports schema violations at the final gate", () => {
    const gate = stepGate("final", completeAnswers({ annualIncome: "" }), CONSENT);
    expect(gate.ok).toBe(false);
    expect(gate.errors.length).toBeGreaterThan(0);
  });
});

describe("funnelReducer — transitions", () => {
  function advance(state: FunnelState, a: PreApprovalFormData): FunnelState {
    return funnelReducer(state, { type: "NEXT", answers: a });
  }

  it("walks the base route forward and backward symmetrically", () => {
    const a = completeAnswers();
    let state = createFunnelState(a);
    state = advance(state, a); // intro -> loanPurpose
    state = advance(state, a); // loanPurpose -> propertyType
    expect(state.stepId).toBe("propertyType");
    state = funnelReducer(state, { type: "BACK" });
    expect(state.stepId).toBe("loanPurpose");
    expect(state.direction).toBe(-1);
  });

  it("skips the complex-income block when routing says it doesn't exist", () => {
    const a = completeAnswers({ hasAdditionalIncome: false });
    let state = createFunnelState(a);
    state = funnelReducer(state, { type: "GO_TO", stepId: "hasAdditionalIncome" });
    state = advance(state, a);
    expect(state.stepId).toBe("monthlyDebts");
  });

  it("enters the complex-income block when injected", () => {
    const a = completeAnswers({ hasAdditionalIncome: true });
    let state = createFunnelState(a);
    state = funnelReducer(state, { type: "GO_TO", stepId: "hasAdditionalIncome" });
    state = advance(state, a);
    expect(state.stepId).toBe("incomeSources");
  });

  it("records a blocked gate instead of advancing", () => {
    const a = completeAnswers({ downPayment: "0" }); // non-VA zero down
    let state = createFunnelState(a);
    state = funnelReducer(state, { type: "GO_TO", stepId: "downPayment" });
    state = advance(state, a);
    expect(state.stepId).toBe("downPayment");
    expect(state.blockedGate?.ok).toBe(false);
  });

  it("hydrates to a saved step with saved answers", () => {
    const a = completeAnswers({ hasAdditionalIncome: true });
    let state = createFunnelState();
    state = funnelReducer(state, { type: "HYDRATE", stepId: "incomeSources", answers: a });
    expect(state.stepId).toBe("incomeSources");
    expect(state.answers.hasAdditionalIncome).toBe(true);
  });

  it("recovers deterministically when the current step is routed away", () => {
    // User is on incomeSources, then answers change so it no longer exists.
    const withIncome = completeAnswers({ hasAdditionalIncome: true });
    let state = createFunnelState(withIncome);
    state = funnelReducer(state, { type: "GO_TO", stepId: "incomeSources" });
    const withoutIncome = completeAnswers({ hasAdditionalIncome: false, incomeSources: [] });
    state = funnelReducer(state, { type: "NEXT", answers: withoutIncome });
    // Falls back to the nearest surviving predecessor, then advances.
    expect(state.stepId).toBe("monthlyDebts");
  });
});

describe("resolveRouteIndex / routeProgress", () => {
  it("resolves a missing step to its nearest surviving predecessor", () => {
    const route = computeRoute(answers({ hasAdditionalIncome: false }));
    expect(resolveRouteIndex(route, "incomeSources")).toBe(route.indexOf("hasAdditionalIncome"));
  });

  it("reports progress within the active route", () => {
    const route = computeRoute(answers());
    const p = routeProgress(route, "final");
    expect(p.index).toBe(route.length - 1);
    expect(p.percent).toBe(100);
  });
});
