import { describe, expect, it } from "vitest";
import {
  classifyAusConditions,
  planAusFollowUp,
} from "../server/services/autopilot/ausFollowUps";
import type { DuFindings, LpaFindings } from "../server/services/ausSubmission";

function du(partial: Partial<DuFindings> = {}): DuFindings {
  return {
    simulated: true,
    casefileId: "sim-du-abc",
    duVersion: "12.1",
    recommendation: "approve_eligible",
    riskAssessment: { dti: 0.3, ltv: 0.8, creditScore: 720 },
    day1Certainty: {
      assets: { relief: true, reportId: "voa-1", reason: "Assets validated" },
      income: { relief: true, reportId: "voie-1", reason: "Income validated" },
      employment: { relief: true, reportId: "voie-1", reason: "Employment validated" },
    },
    messages: [{ code: "DU-0001", severity: "info", text: "No adverse findings." }],
    ...partial,
  };
}

describe("classifyAusConditions", () => {
  it("returns nothing when D1C is fully validated and there are no condition messages", () => {
    expect(classifyAusConditions(du())).toEqual([]);
  });

  it("surfaces each unvalidated D1C layer plus condition-severity messages", () => {
    const conds = classifyAusConditions(
      du({
        day1Certainty: {
          assets: { relief: false, reportId: null, reason: "No validated assets report" },
          income: { relief: false, reportId: null, reason: "No validated income report" },
          employment: { relief: false, reportId: null, reason: "No validated employment report" },
        },
        messages: [
          { code: "DU-2105", severity: "condition", text: "LTV 98% exceeds 97% conforming maximum." },
          { code: "DU-3202", severity: "risk", text: "DTI too high." }, // risk, not condition → ignored
        ],
      }),
    );
    // 3 D1C + 1 condition message (the risk message is excluded)
    expect(conds.map((c) => c.kind)).toEqual([
      "d1c_assets",
      "d1c_income",
      "d1c_employment",
      "message",
    ]);
  });

  it("includes LPA condition messages when the second leg is provided", () => {
    const lpa: LpaFindings = {
      simulated: true,
      assessmentId: "sim-lpa-abc",
      riskClass: "accept",
      purchaseEligibility: "ineligible",
      riskAssessment: { dti: 0.3, ltv: 0.98, creditScore: 720 },
      messages: [{ code: "LPA-SIM-301", severity: "condition", text: "LTV exceeds max." }],
    };
    const conds = classifyAusConditions(du(), lpa);
    expect(conds).toHaveLength(1);
    expect(conds[0]).toMatchObject({ origin: "lpa", kind: "message", code: "LPA-SIM-301" });
  });
});

describe("planAusFollowUp — the borrower-actionable vs lender-internal split", () => {
  it("makes D1C assets + income borrower-actionable, cited to Day 1 Certainty", () => {
    const assets = planAusFollowUp({ origin: "du", kind: "d1c_assets", code: "D1C-ASSETS", text: "x" });
    expect(assets.borrowerActionable).toBe(true);
    expect(assets.category).toBe("assets");
    expect(assets.requiredDocumentTypes).toEqual(["bank_statement"]);
    expect(assets.sourceRule).toBe("AUTOPILOT_AUS_D1C_ASSETS");
    expect(assets.description).toContain("Fannie Mae Day 1 Certainty");

    const income = planAusFollowUp({ origin: "du", kind: "d1c_income", code: "D1C-INCOME", text: "x" });
    expect(income.borrowerActionable).toBe(true);
    expect(income.requiredDocumentTypes).toEqual(["pay_stub", "w2"]);
  });

  it("keeps employment (VOE) lender-internal", () => {
    const emp = planAusFollowUp({ origin: "du", kind: "d1c_employment", code: "D1C-EMPLOYMENT", text: "x" });
    expect(emp.borrowerActionable).toBe(false);
  });

  it("keeps structural / eligibility messages (LTV) lender-internal, cited to the AUS code", () => {
    const ltv = planAusFollowUp({ origin: "du", kind: "message", code: "DU-2105", text: "LTV 98% exceeds max." });
    expect(ltv.borrowerActionable).toBe(false);
    expect(ltv.sourceRule).toBe("AUTOPILOT_AUS_DU-2105");
    expect(ltv.description).toContain("DU DU-2105");
  });

  it("reproduces the 3-conditions-2-actionable behavior end to end", () => {
    const conds = classifyAusConditions(
      du({
        day1Certainty: {
          assets: { relief: false, reportId: null, reason: "r" },
          income: { relief: false, reportId: null, reason: "r" },
          employment: { relief: false, reportId: null, reason: "r" },
        },
      }),
    );
    const actionable = conds.map(planAusFollowUp).filter((p) => p.borrowerActionable);
    expect(conds).toHaveLength(3); // assets, income, employment
    expect(actionable).toHaveLength(2); // only assets + income
  });
});
