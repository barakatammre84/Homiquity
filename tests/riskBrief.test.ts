import { afterEach, describe, expect, it } from "vitest";
import {
  buildAllowedNumberSet,
  buildDeterministicBrief,
  findUnsourcedNumbers,
  isRiskBriefDisabled,
  validateRiskBriefResponse,
} from "../server/services/riskBrief";
import { riskBriefNarrativeSchema, type RiskBriefFacts } from "@shared/riskBrief";

/**
 * Risk brief (roadmap A4) — pure-logic tests. No DB, no HTTP, no API key:
 * everything exercised here is the deterministic side of the feature (the
 * template fallback, the echo-only number guard, and the model-output
 * validation seam), which is also exactly what runs when ANTHROPIC_API_KEY is
 * absent in CI.
 */

function cleanFacts(overrides: Partial<RiskBriefFacts> = {}): RiskBriefFacts {
  return {
    applicationId: "app-test-1",
    provenanceQualifier: "PRELIMINARY",
    decision: {
      status: "DECISION_READY",
      decision: "REJECTED",
      reasons: [
        "DTI of 47.2% exceeds the conventional cap of 45%",
        "Verified liquid assets of $12,500 fall below required reserves",
      ],
      missingItems: ["Property state"],
      metrics: {
        ltv: 85.5,
        dti: 47.2,
        monthlyPiti: 2412.55,
        loanAmount: 412250,
        monthlyIncome: 8200,
        monthlyDebts: 1460,
        monthsOfReserves: 1.4,
        incomeBasis: "urla_line_items",
      },
      policy: { loanType: "CONVENTIONAL", dtiCapPct: 45, ltvCapPct: 97, fingerprint: "abc123" },
    },
    preUwFlags: {
      evaluatedAt: "2026-07-17T00:00:00.000Z",
      flags: [
        {
          code: "LARGE_DEPOSIT_SOURCING",
          severity: "warning",
          reason: "A deposit of $9,000 exceeds 50% of monthly income (B3-4.2-02)",
          requiredDocs: ["Letter of explanation with the deposit source"],
        },
      ],
    },
    readiness: {
      readyToSubmitToLender: false,
      currentStage: "aus",
      blockers: ["No AUS run on file"],
      warnings: [],
      nextActions: ["Run DU before packaging the file"],
    },
    prediction: {
      riskFactors: ["Below-average credit score"],
      positiveFactors: ["Documents verified promptly"],
    },
    situation: null,
    ...overrides,
  };
}

describe("buildDeterministicBrief (template fallback)", () => {
  it("carries every engine rejection reason, pre-UW flag, and blocker into keyRisks", () => {
    const facts = cleanFacts();
    const brief = buildDeterministicBrief(facts);
    const whys = brief.keyRisks.map((r) => r.why).join(" | ");
    for (const reason of facts.decision.reasons) {
      expect(whys).toContain(reason);
    }
    expect(whys).toContain(facts.preUwFlags.flags[0].reason);
    expect(whys).toContain("No AUS run on file");
    expect(brief.summary).toContain("REJECTED");
    expect(brief.summary).toContain("PRELIMINARY");
  });

  it("maps flag requiredDocs into remediation and readiness nextActions into borrower questions", () => {
    const brief = buildDeterministicBrief(cleanFacts());
    const remediations = brief.keyRisks.map((r) => r.remediation).join(" | ");
    expect(remediations).toContain("Letter of explanation with the deposit source");
    expect(brief.suggestedBorrowerQuestions.join(" | ")).toContain("Run DU before packaging the file");
    expect(brief.suggestedBorrowerQuestions.join(" | ")).toContain("property state");
  });

  it("always satisfies the shared schema, even with oversized inputs and many findings", () => {
    const longReason = "x".repeat(2000);
    const facts = cleanFacts({
      decision: {
        ...cleanFacts().decision,
        reasons: Array.from({ length: 12 }, (_, i) => `${longReason} ${i}`),
      },
    });
    const brief = buildDeterministicBrief(facts);
    expect(() => riskBriefNarrativeSchema.parse(brief)).not.toThrow();
    expect(brief.keyRisks.length).toBeLessThanOrEqual(8);
  });

  it("describes the NEEDS_MORE_INFO state without inventing a decision", () => {
    const facts = cleanFacts({
      decision: { ...cleanFacts().decision, status: "NEEDS_MORE_INFO", decision: null },
    });
    const brief = buildDeterministicBrief(facts);
    expect(brief.summary).toContain("needs more information");
    expect(brief.summary).not.toContain("REJECTED");
  });
});

describe("echo-only number validation", () => {
  const facts = cleanFacts();
  const allowed = buildAllowedNumberSet(facts);

  const narrativeWith = (summary: string) =>
    riskBriefNarrativeSchema.parse({
      summary,
      keyRisks: [],
      strengths: [],
      suggestedBorrowerQuestions: [],
    });

  it("accepts figures echoed from facts in common formats", () => {
    const narrative = narrativeWith(
      "DTI stands at 47.2% against a 45% cap; the loan amount is $412,250 and LTV is 85.5%.",
    );
    expect(findUnsourcedNumbers(narrative, allowed)).toEqual([]);
  });

  it("accepts numbers that appear only inside fact strings (engine reasons)", () => {
    const narrative = narrativeWith("A deposit of $9,000 requires sourcing per B3-4.2-02.");
    expect(findUnsourcedNumbers(narrative, allowed)).toEqual([]);
  });

  it("rejects a figure the model invented", () => {
    const narrative = narrativeWith("The borrower's credit score of 700 is below the tier cutoff.");
    expect(findUnsourcedNumbers(narrative, allowed)).toContain("700");
  });

  it("rejects a derived figure even when its inputs are on file", () => {
    // monthlyIncome 8200 and monthlyDebts 1460 are in facts; their sum is not.
    const narrative = narrativeWith("Total monthly obligations reach $9,660.");
    expect(findUnsourcedNumbers(narrative, allowed)).toContain("$9,660");
  });
});

describe("validateRiskBriefResponse (model-output seam)", () => {
  const valid = {
    summary: "Engine reads the file as REJECTED.",
    keyRisks: [{ factor: "DTI", why: "Above cap", remediation: "Reduce debts" }],
    strengths: ["Prompt document uploads"],
    suggestedBorrowerQuestions: ["Can you provide the property state?"],
  };

  it("parses a clean JSON object", () => {
    expect(validateRiskBriefResponse(JSON.stringify(valid))).not.toBeNull();
  });

  it("parses JSON wrapped in a markdown fence and surrounding prose", () => {
    const wrapped = "Here you go:\n```json\n" + JSON.stringify(valid) + "\n```\nDone.";
    expect(validateRiskBriefResponse(wrapped)?.summary).toBe(valid.summary);
  });

  it("returns null for non-JSON, wrong shapes, and over-limit arrays", () => {
    expect(validateRiskBriefResponse("")).toBeNull();
    expect(validateRiskBriefResponse("I cannot help with that.")).toBeNull();
    expect(validateRiskBriefResponse(JSON.stringify({ summary: "x" }))).toBeNull();
    expect(
      validateRiskBriefResponse(
        JSON.stringify({ ...valid, keyRisks: Array(9).fill(valid.keyRisks[0]) }),
      ),
    ).toBeNull();
  });
});

describe("isRiskBriefDisabled kill switch", () => {
  const original = process.env.RISK_BRIEF_DISABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.RISK_BRIEF_DISABLED;
    else process.env.RISK_BRIEF_DISABLED = original;
  });

  it("treats the usual truthy strings as disabled and everything else as enabled", () => {
    for (const v of ["1", "true", "TRUE", " yes ", "on"]) {
      process.env.RISK_BRIEF_DISABLED = v;
      expect(isRiskBriefDisabled()).toBe(true);
    }
    for (const v of ["", "0", "false", "off"]) {
      process.env.RISK_BRIEF_DISABLED = v;
      expect(isRiskBriefDisabled()).toBe(false);
    }
    delete process.env.RISK_BRIEF_DISABLED;
    expect(isRiskBriefDisabled()).toBe(false);
  });
});
