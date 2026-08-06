import { describe, expect, it } from "vitest";
import {
  generateAdverseActionNotice,
  resolveRepresentativeScoreSource,
  resolveFurnishingBureaus,
  resolveDenialFcraPosture,
  computeFcraCompliant,
  BUREAU_CONTACT_INFO,
} from "../server/services/creditService";
import type { CreditPull } from "../shared/schema";
import { COMPANY_IDENTITY, companyAddressLines } from "../shared/companyIdentity";

/**
 * Adverse-action notice content (ECOA/Reg B §1002.9, FCRA §615(a)).
 *
 * Two regimes:
 *  - The ECOA block (anti-discrimination notice + creditor identity +
 *    administering agency) is UNCONDITIONAL — required on any adverse action
 *    on a credit application.
 *  - The FCRA §615(a) consumer-report content (basis statement, CRA contact,
 *    score disclosure, report rights) applies ONLY when the action was actually
 *    based on a consumer report. Asserting it otherwise is a misstatement.
 *
 * WF5-F2 additions: the §615(a) basis is resolved from the application's
 * latest completed credit pull (resolveDenialFcraPosture), score-source
 * attribution is deterministic (resolveRepresentativeScoreSource), the CRA
 * rights block names EVERY furnishing bureau, and fcraCompliant is COMPUTED
 * (computeFcraCompliant) — never stamped.
 */

const bureau = {
  name: "Experian",
  address: "P.O. Box 4500, Allen, TX 75013",
  phone: "1-888-397-3742",
  website: "www.experian.com",
};

describe("Adverse-action notice — ECOA is unconditional", () => {
  for (const basedOnConsumerReport of [true, false]) {
    it(`includes the ECOA block when basedOnConsumerReport=${basedOnConsumerReport}`, () => {
      const notice = generateAdverseActionNotice({
        actionType: "denial",
        primaryReason: "Debt-to-income ratio exceeds maximum threshold",
        basedOnConsumerReport,
        bureau: basedOnConsumerReport ? bureau : null,
      });
      expect(notice).toContain("EQUAL CREDIT OPPORTUNITY ACT");
      expect(notice).toContain("prohibits creditors from discriminating");
      expect(notice).toContain("CREDITOR:");
    });
  }

  // §1002.9(b)(1) requires the creditor's NAME AND ADDRESS. The notice carried
  // the name, NMLS id, email and phone but no address until the founder
  // supplied one (2026-08-06) — counsel flagged it as resolve-before-un-gating.
  // Pinned in BOTH report-basis postures because the ECOA block is
  // unconditional; the FCRA block is not a substitute for it.
  for (const basedOnConsumerReport of [true, false]) {
    it(`carries the creditor's mailing address (§1002.9(b)(1)) when basedOnConsumerReport=${basedOnConsumerReport}`, () => {
      const notice = generateAdverseActionNotice({
        actionType: "denial",
        primaryReason: "Debt-to-income ratio exceeds maximum threshold",
        basedOnConsumerReport,
        bureau: basedOnConsumerReport ? bureau : null,
      });
      const addr = COMPANY_IDENTITY.mailingAddress;
      expect(notice).toContain(addr.street);
      expect(notice).toContain(`${addr.city}, ${addr.state} ${addr.postalCode}`);
      // And it must sit inside the CREDITOR block, not merely somewhere in the
      // document — an address under the CRA heading would identify the wrong party.
      const creditorBlock = notice.slice(notice.indexOf("CREDITOR:"));
      expect(creditorBlock).toContain(addr.street);
    });
  }

  it("publishes the same address the Disclosures page shows", () => {
    // One source, so the public disclosure and the legal notice cannot drift.
    expect(companyAddressLines("\n")).toContain(COMPANY_IDENTITY.mailingAddress.street);
    expect(companyAddressLines(", ")).toBe(
      `${COMPANY_IDENTITY.mailingAddress.street}, ${COMPANY_IDENTITY.mailingAddress.city}, ` +
        `${COMPANY_IDENTITY.mailingAddress.state} ${COMPANY_IDENTITY.mailingAddress.postalCode}`,
    );
  });
});

describe("Adverse-action notice — FCRA content is gated on report use", () => {
  it("a self-reported denial does NOT claim a consumer report was used", () => {
    const notice = generateAdverseActionNotice({
      actionType: "denial",
      primaryReason: "Insufficient funds for down payment and/or closing costs",
      basedOnConsumerReport: false,
      creditScoreUsed: 640, // present, but must be ignored when no report was used
      bureau: null,
    });
    expect(notice).not.toContain("consumer reporting agency");
    expect(notice).not.toContain("FAIR CREDIT REPORTING ACT");
    expect(notice).not.toContain("CREDIT SCORE INFORMATION");
    // Closing cites ECOA only.
    expect(notice).toContain("required by the Equal Credit Opportunity Act.");
    expect(notice).not.toContain("Fair Credit Reporting Act.");
  });

  it("a report-based denial includes the full FCRA §615(a) content", () => {
    const notice = generateAdverseActionNotice({
      actionType: "denial",
      primaryReason: "Derogatory items on credit report",
      basedOnConsumerReport: true,
      creditScoreUsed: 610,
      bureau,
      bureauReasonCodes: ["022"],
    });
    expect(notice).toContain("information obtained from a consumer reporting agency");
    expect(notice).toContain("FAIR CREDIT REPORTING ACT");
    expect(notice).toContain("CREDIT SCORE INFORMATION");
    expect(notice).toContain("Your credit score: 610");
    expect(notice).toContain("Experian");
    // Closing cites both statutes.
    expect(notice).toContain("Equal Credit Opportunity Act and the Fair Credit Reporting Act");
  });

  it("discloses the score date when provided (§1681g(f)(1)(D))", () => {
    const scoreDate = new Date("2026-08-01T19:15:00Z");
    const notice = generateAdverseActionNotice({
      actionType: "denial",
      primaryReason: "Debt-to-income ratio exceeds maximum threshold",
      basedOnConsumerReport: true,
      creditScoreUsed: 634,
      creditScoreDate: scoreDate,
      bureau,
    });
    expect(notice).toContain(`Date of score: ${scoreDate.toLocaleDateString()}`);
  });

  it("never fabricates score key factors — denial reasons are NOT §1681g(f)(1)(C) key factors", () => {
    // The pre-fix template said "Key factors that adversely affected your
    // credit score are listed above", pointing at DENIAL REASONS. Until the
    // live vendor (F3) supplies the model's actual key factors, the notice
    // must stay silent rather than mislabel — pin the removal.
    const notice = generateAdverseActionNotice({
      actionType: "denial",
      primaryReason: "Debt-to-income ratio exceeds maximum threshold",
      basedOnConsumerReport: true,
      creditScoreUsed: 634,
      bureau,
    });
    expect(notice).not.toContain("Key factors that adversely affected your credit score");
  });

  it("renders the CRA contact block for EVERY furnishing bureau on a tri-merge (§1681m(a)(3))", () => {
    const notice = generateAdverseActionNotice({
      actionType: "denial",
      primaryReason: "Debt-to-income ratio exceeds maximum threshold",
      basedOnConsumerReport: true,
      creditScoreUsed: 634,
      bureau: BUREAU_CONTACT_INFO.equifax,
      furnishingBureaus: [
        BUREAU_CONTACT_INFO.experian,
        BUREAU_CONTACT_INFO.equifax,
        BUREAU_CONTACT_INFO.transunion,
      ],
    });
    expect(notice).toContain("CONSUMER REPORTING AGENCIES:");
    for (const b of Object.values(BUREAU_CONTACT_INFO)) {
      expect(notice).toContain(b.name);
      expect(notice).toContain(b.address);
      expect(notice).toContain(b.phone);
    }
    // Rights block survives pluralization.
    expect(notice).toContain("free copy of your credit report");
    expect(notice).toContain("did not make the decision");
    expect(notice).toContain("right to dispute the accuracy or completeness");
    expect(notice).toContain("within 60 days");
  });

  it("keeps the singular CRA heading for a single-bureau report", () => {
    const notice = generateAdverseActionNotice({
      actionType: "denial",
      primaryReason: "Derogatory items on credit report",
      basedOnConsumerReport: true,
      creditScoreUsed: 610,
      bureau,
    });
    expect(notice).toContain("CONSUMER REPORTING AGENCY:");
    expect(notice).not.toContain("CONSUMER REPORTING AGENCIES:");
  });
});

// ---------------------------------------------------------------------------
// WF5-F2: deterministic score-source attribution and the denial FCRA posture.
// ---------------------------------------------------------------------------

/** Minimal completed-pull row; override what the case needs. */
const pull = (overrides: Partial<CreditPull> = {}): CreditPull =>
  ({
    id: "pull-1",
    applicationId: "app-1",
    status: "completed",
    isSimulated: false,
    bureaus: ["experian", "equifax", "transunion"],
    experianScore: 650,
    equifaxScore: 634,
    transunionScore: 620,
    representativeScore: 634,
    completedAt: new Date("2026-08-01T19:15:00Z"),
    ...overrides,
  }) as CreditPull;

describe("resolveRepresentativeScoreSource — deterministic attribution", () => {
  it("attributes the representative (middle) score to the bureau that produced it", () => {
    expect(resolveRepresentativeScoreSource(pull())).toBe("equifax");
  });

  it("breaks ties in fixed bureau order (experian → equifax → transunion)", () => {
    expect(
      resolveRepresentativeScoreSource(
        pull({ experianScore: 640, equifaxScore: 640, transunionScore: 640, representativeScore: 640 }),
      ),
    ).toBe("experian");
    expect(
      resolveRepresentativeScoreSource(
        pull({ experianScore: 700, equifaxScore: 640, transunionScore: 640, representativeScore: 640 }),
      ),
    ).toBe("equifax");
  });

  it("returns null when no bureau score matches — attribution must not be guessed", () => {
    expect(
      resolveRepresentativeScoreSource(
        pull({ experianScore: 700, equifaxScore: 690, transunionScore: 680, representativeScore: 634 }),
      ),
    ).toBeNull();
    expect(resolveRepresentativeScoreSource(pull({ representativeScore: null }))).toBeNull();
  });
});

describe("resolveFurnishingBureaus", () => {
  it("returns every listed bureau in fixed order, dropping unknown strings", () => {
    expect(resolveFurnishingBureaus(pull({ bureaus: ["transunion", "experian", "not-a-bureau"] }))).toEqual([
      "experian",
      "transunion",
    ]);
  });

  it("is empty when the pull lists no bureaus", () => {
    expect(resolveFurnishingBureaus(pull({ bureaus: null }))).toEqual([]);
  });
});

describe("resolveDenialFcraPosture — the chokepoint's three branches", () => {
  it("no completed pull → no consumer-report duty (ECOA-only notice)", () => {
    expect(resolveDenialFcraPosture(null)).toEqual({ kind: "no_consumer_report" });
  });

  it("simulated pull → REFUSES, and the copy names no bureau", () => {
    const posture = resolveDenialFcraPosture(pull({ isSimulated: true }));
    expect(posture.kind).toBe("refuse");
    if (posture.kind !== "refuse") throw new Error("unreachable");
    expect(posture.reason).toBe("simulated_pull");
    expect(posture.error).toMatch(/simulated/i);
    expect(posture.error).toMatch(/615\(a\)/);
    // §1681m(a)(3)(A): the CRA "that furnished the report" — none did. Naming
    // one would be fabricated attribution.
    expect(posture.error).not.toMatch(/experian|equifax|transunion/i);
  });

  it("real pull → threads pull id, representative score, source, date, and all furnishing bureaus", () => {
    const posture = resolveDenialFcraPosture(pull());
    expect(posture).toEqual({
      kind: "consumer_report",
      creditPullId: "pull-1",
      creditScoreUsed: 634,
      creditScoreSource: "equifax",
      creditScoreDate: new Date("2026-08-01T19:15:00Z"),
      furnishingBureaus: ["experian", "equifax", "transunion"],
    });
  });

  it("real pull with an unattributable representative score → refuses rather than guessing a bureau", () => {
    const posture = resolveDenialFcraPosture(
      pull({ experianScore: 700, equifaxScore: 690, transunionScore: 680, representativeScore: 634 }),
    );
    expect(posture.kind).toBe("refuse");
    if (posture.kind !== "refuse") throw new Error("unreachable");
    expect(posture.reason).toBe("unattributable_score");
  });

  it("real pull naming no furnishing bureau → refuses (no CRA to identify under §615(a)(3))", () => {
    const posture = resolveDenialFcraPosture(pull({ bureaus: [] }));
    expect(posture.kind).toBe("refuse");
  });

  it("real scoreless (thin-file) pull with bureaus → still consumer_report, with no score threaded", () => {
    const posture = resolveDenialFcraPosture(
      pull({ experianScore: null, equifaxScore: null, transunionScore: null, representativeScore: null }),
    );
    expect(posture).toMatchObject({ kind: "consumer_report", creditScoreUsed: null, creditScoreSource: null });
  });
});

// ---------------------------------------------------------------------------
// WF5-F2: fcraCompliant is computed, never stamped.
// ---------------------------------------------------------------------------

describe("computeFcraCompliant", () => {
  const fullSet = {
    basedOnConsumerReport: true,
    fromRealPull: true,
    creditScoreUsed: 634,
    scoreDateDisclosed: true,
    scoreRangeDisclosed: true,
    keyFactorsDisclosed: true,
    providerEntityDisclosed: true,
    allFurnishingCrasIdentified: true,
  };

  it("a non-report-based notice is compliant (no §615(a) duty attaches; ECOA is unconditional)", () => {
    expect(
      computeFcraCompliant({ ...fullSet, basedOnConsumerReport: false, fromRealPull: false }),
    ).toBe(true);
  });

  it("a report-based notice with the full applicable set from a real pull is compliant", () => {
    expect(computeFcraCompliant(fullSet)).toBe(true);
  });

  it("is NEVER compliant when the basis pull is not verified real — simulated data cannot self-certify", () => {
    expect(computeFcraCompliant({ ...fullSet, fromRealPull: false })).toBe(false);
  });

  it("a scored notice missing any §1681g(f)(1) score conjunct is not compliant", () => {
    expect(computeFcraCompliant({ ...fullSet, keyFactorsDisclosed: false })).toBe(false);
    expect(computeFcraCompliant({ ...fullSet, providerEntityDisclosed: false })).toBe(false);
    expect(computeFcraCompliant({ ...fullSet, scoreRangeDisclosed: false })).toBe(false);
    expect(computeFcraCompliant({ ...fullSet, scoreDateDisclosed: false })).toBe(false);
  });

  it("score conjuncts are vacuous when no score was used (§1681m(a)(2) attaches only to a score used)", () => {
    expect(
      computeFcraCompliant({
        ...fullSet,
        creditScoreUsed: null,
        scoreDateDisclosed: false,
        scoreRangeDisclosed: false,
        keyFactorsDisclosed: false,
        providerEntityDisclosed: false,
      }),
    ).toBe(true);
  });

  it("a report-based notice that fails to identify every furnishing CRA is not compliant", () => {
    expect(computeFcraCompliant({ ...fullSet, allFurnishingCrasIdentified: false })).toBe(false);
  });
});
