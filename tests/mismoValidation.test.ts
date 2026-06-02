import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Fixture-backed storage mock.
//
// validateMISMOCompleteness pulls all of its inputs from the `storage`
// singleton, which transitively imports `server/db.ts` and requires a live
// DATABASE_URL connection. Mocking the storage module entirely keeps these
// tests hermetic (no DB) and lets each test feed deterministic fixtures.
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => ({
  fixtures: {
    application: null as any,
    urla: null as any,
    conditions: [] as any[],
    documents: [] as any[],
    profile: null as any,
  },
}));

vi.mock("../server/storage", () => ({
  storage: {
    getLoanApplication: async () => h.fixtures.application,
    getCompleteUrlaData: async () => h.fixtures.urla,
    getLoanConditionsByApplication: async () => h.fixtures.conditions,
    getDocumentsByApplication: async () => h.fixtures.documents,
    getBorrowerProfileByUserId: async () => h.fixtures.profile,
  },
}));

import { validateMISMOCompleteness } from "../server/services/mismoValidation";

// ---------------------------------------------------------------------------
// Fixture factories — each call returns a fresh, fully-complete object so
// tests can mutate freely without cross-contamination.
// ---------------------------------------------------------------------------
function baseApplication(overrides: Record<string, any> = {}) {
  return {
    id: "app-1",
    userId: "user-1",
    status: "submitted",
    creditScore: 720,
    purchasePrice: "500000",
    downPayment: "100000",
    loanPurpose: "purchase",
    preferredLoanType: "conventional",
    amortizationType: "fixed",
    propertyType: "single_family",
    propertyAddress: "123 Main St",
    propertyCity: "Austin",
    propertyState: "TX",
    propertyZip: "78701",
    ltvRatio: "80",
    dtiRatio: "36",
    // ARM fields (only relevant when amortizationType === "adjustable")
    armIndexType: null,
    armMargin: null,
    armInitialRate: null,
    armInitialCap: null,
    armPeriodicCap: null,
    armLifetimeCap: null,
    armAdjustmentFrequencyMonths: null,
    // ATR/QM
    totalPointsAndFees: "10000",
    // HMDA LAR
    hmdaActionTaken: "1", // 1 = loan originated/approved
    hmdaDenialReasons: [],
    // TRID dates
    closingDate: null,
    leIssuedDate: null,
    cdIssuedDate: null,
    createdAt: new Date("2026-01-05T00:00:00Z"),
    ...overrides,
  };
}

function completePersonalInfo(overrides: Record<string, any> = {}) {
  return {
    firstName: "Jane",
    lastName: "Borrower",
    ssn: "123-45-6789",
    dateOfBirth: "1985-04-12",
    citizenship: "us_citizen",
    maritalStatus: "married",
    email: "jane@example.com",
    cellPhone: "555-0100",
    currentStreet: "123 Main St",
    currentCity: "Austin",
    currentState: "TX",
    currentZip: "78701",
    currentHousingType: "rent",
    ...overrides,
  };
}

function baseUrla(overrides: Record<string, any> = {}) {
  return {
    personalInfo: completePersonalInfo(),
    employmentHistory: [
      {
        employmentType: "current",
        employerName: "Acme Corp",
        positionTitle: "Engineer",
        startDate: "2018-01-01", // > 2 years => no prior employer required
        monthlyIncomeOrLoss: "8000",
        employerPhone: "555-0199",
        employerStreet: "1 Industry Way",
        isSelfEmployed: false,
        borrowerSequenceNumber: 1,
      },
    ],
    otherIncomeSources: [
      { incomeSource: "bonus", monthlyAmount: "500", borrowerSequenceNumber: 1 },
    ],
    assets: [
      {
        accountType: "checking",
        financialInstitution: "Big Bank",
        cashOrMarketValue: "50000",
        borrowerSequenceNumber: 1,
      },
    ],
    liabilities: [
      {
        liabilityType: "credit_card",
        creditorName: "Card Co",
        monthlyPayment: "150",
        unpaidBalance: "2000",
        borrowerSequenceNumber: 1,
      },
    ],
    propertyInfo: {
      propertyStreet: "123 Main St",
      propertyCity: "Austin",
      propertyState: "TX",
      propertyZip: "78701",
      occupancyType: "primary",
      numberOfUnits: 1,
    },
    declarations: {
      willOccupyAsPrimaryResidence: true,
      hasOwnershipInterestInPast3Years: false,
      isBorrowingForDownPayment: false,
      hasOutstandingJudgments: false,
      isDelinquentOnFederalDebt: false,
      isPartyToLawsuit: false,
      hasConveyedTitleInLieuOfForeclosure: false,
      hasBeenForeclosed: false,
      hasDeclaredBankruptcy: false,
      isUSCitizen: true,
    },
    realEstateOwned: [],
    hmdaDemographics: [
      {
        borrowerId: "user-1",
        ethnicityNotProvided: true,
        raceNotProvided: true,
        sexNotProvided: true,
        collectionMethod: "visual",
      },
    ],
    ...overrides,
  };
}

function setFixtures(opts: {
  application?: Record<string, any>;
  urla?: Record<string, any>;
  conditions?: any[];
  documents?: any[];
  profile?: any;
} = {}) {
  h.fixtures.application = baseApplication(opts.application ?? {});
  h.fixtures.urla = opts.urla === undefined ? baseUrla() : opts.urla;
  h.fixtures.conditions = opts.conditions ?? [];
  h.fixtures.documents = opts.documents ?? [];
  h.fixtures.profile = opts.profile ?? null;
}

function sectionByNumber(result: any, number: string) {
  return result.sections.find((s: any) => s.sectionNumber === number);
}

beforeEach(() => {
  h.fixtures.application = null;
  h.fixtures.urla = null;
  h.fixtures.conditions = [];
  h.fixtures.documents = [];
  h.fixtures.profile = null;
});

// ---------------------------------------------------------------------------
describe("complete application baseline", () => {
  it("passes gating, has no critical errors, and is QM", async () => {
    setFixtures();
    const result = await validateMISMOCompleteness("app-1");

    expect(result.gseGatingFailed).toBe(false);
    expect(result.criticalErrors).toEqual([]);
    expect(result.qmStatus).toBe("QM");
    expect(result.pointsAndFeesCompliant).toBe(true);
    expect(result.armValidation.applicable).toBe(false);
    expect(result.overallScore).toBeGreaterThanOrEqual(80);
  });
});

// ---------------------------------------------------------------------------
describe("scoreSection weighting", () => {
  it("scores 0 when every required field in a section is missing", async () => {
    // Empty personal info => all of section 1a's required fields are missing.
    setFixtures({ urla: baseUrla({ personalInfo: undefined }) });
    const result = await validateMISMOCompleteness("app-1");

    const personal = sectionByNumber(result, "1a");
    expect(personal.completeness).toBe(0);
    expect(personal.completedFields).toBe(0);
    expect(personal.missingFields.length).toBe(personal.requiredFields);
  });

  it("scores 80 when all required present but optional missing (0.8 weight)", async () => {
    // Personal info has 2 optional fields (email, cell phone). Filling all
    // required but neither optional => 0.8 required weight only => 80.
    setFixtures({
      urla: baseUrla({
        personalInfo: completePersonalInfo({ email: null, cellPhone: null }),
      }),
    });
    const result = await validateMISMOCompleteness("app-1");

    const personal = sectionByNumber(result, "1a");
    expect(personal.completeness).toBe(80);
    expect(personal.missingFields).toEqual([]); // optional fields aren't "missing"
    expect(personal.warnings.length).toBe(2);
  });

  it("scores 100 when all required and optional fields are present", async () => {
    setFixtures();
    const result = await validateMISMOCompleteness("app-1");
    const personal = sectionByNumber(result, "1a");
    expect(personal.completeness).toBe(100);
  });
});

// ---------------------------------------------------------------------------
describe("GSE gating (hard-fail on sections 1a, 4, 5)", () => {
  it("does not fail gating when 1a, 4, and 5 are complete", async () => {
    setFixtures();
    const result = await validateMISMOCompleteness("app-1");
    expect(result.gseGatingFailed).toBe(false);
  });

  it("hard-fails when section 1a (personal info) has a missing required field", async () => {
    setFixtures({
      urla: baseUrla({ personalInfo: completePersonalInfo({ ssn: null }) }),
    });
    const result = await validateMISMOCompleteness("app-1");
    expect(result.gseGatingFailed).toBe(true);
    expect(result.gseReady).toBe(false);
    expect(sectionByNumber(result, "1a").gating).toBe(true);
  });

  it("hard-fails when section 4 (loan details) has a missing required field", async () => {
    setFixtures({ application: { purchasePrice: null } });
    const result = await validateMISMOCompleteness("app-1");
    expect(result.gseGatingFailed).toBe(true);
    expect(sectionByNumber(result, "4").gating).toBe(true);
  });

  it("hard-fails when section 5 (declarations) has a missing required field", async () => {
    setFixtures({
      urla: baseUrla({
        declarations: {
          willOccupyAsPrimaryResidence: true,
          hasOwnershipInterestInPast3Years: false,
          isBorrowingForDownPayment: false,
          hasOutstandingJudgments: false,
          isDelinquentOnFederalDebt: false,
          isPartyToLawsuit: false,
          hasConveyedTitleInLieuOfForeclosure: false,
          hasBeenForeclosed: false,
          hasDeclaredBankruptcy: false,
          isUSCitizen: null, // missing required declaration
        },
      }),
    });
    const result = await validateMISMOCompleteness("app-1");
    expect(result.gseGatingFailed).toBe(true);
    expect(sectionByNumber(result, "5").gating).toBe(true);
  });

  it("does not hard-fail for a missing field in a non-gating section", async () => {
    // Section 3 (property) is not in the gating set.
    setFixtures({
      application: {
        propertyType: null,
        propertyAddress: null,
        propertyCity: null,
        propertyState: null,
        propertyZip: null,
      },
      urla: baseUrla({ propertyInfo: undefined }),
    });
    const result = await validateMISMOCompleteness("app-1");
    expect(sectionByNumber(result, "3").missingFields.length).toBeGreaterThan(0);
    expect(result.gseGatingFailed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("TRID business-day math (weekends + federal holidays)", () => {
  it("LE due date skips a weekend and Presidents Day", async () => {
    // Presidents Day 2026 = Mon Feb 16. Application created Thu Feb 12.
    // +1 Fri 13 (1), Sat 14/Sun 15 skip, Mon 16 holiday skip,
    // Tue 17 (2), Wed 18 (3) => LE due Wed Feb 18, 2026.
    setFixtures({ application: { createdAt: new Date("2026-02-12T00:00:00Z") } });
    const result = await validateMISMOCompleteness("app-1");

    expect(result.tridStatus.leDueDate).not.toBeNull();
    expect(result.tridStatus.leDueDate!.toISOString().slice(0, 10)).toBe(
      "2026-02-18"
    );
  });

  it("CD due date counts back over a weekend and Juneteenth", async () => {
    // Juneteenth 2026 = Fri Jun 19. Closing Wed Jun 24, CD due 3 business
    // days prior: Tue 23 (1), Mon 22 (2), Sun 21/Sat 20 skip,
    // Fri 19 holiday skip, Thu 18 (3) => CD due Thu Jun 18, 2026.
    setFixtures({ application: { closingDate: "2026-06-24" } });
    const result = await validateMISMOCompleteness("app-1");

    expect(result.tridStatus.cdDueDate).not.toBeNull();
    expect(result.tridStatus.cdDueDate!.toISOString().slice(0, 10)).toBe(
      "2026-06-18"
    );
  });

  it("LE due date over a plain mid-week window skips only the weekend", async () => {
    // Created Mon Mar 2, 2026 (no holidays that week): +1 Tue (1),
    // Wed (2), Thu (3) => LE due Thu Mar 5, 2026.
    setFixtures({ application: { createdAt: new Date("2026-03-02T00:00:00Z") } });
    const result = await validateMISMOCompleteness("app-1");
    expect(result.tridStatus.leDueDate!.toISOString().slice(0, 10)).toBe(
      "2026-03-05"
    );
  });

  it("leaves CD due date null when no closing date is set", async () => {
    setFixtures();
    const result = await validateMISMOCompleteness("app-1");
    expect(result.tridStatus.cdDueDate).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("ATR/QM points-and-fees 3% cap", () => {
  // loanAmount = 500000 - 100000 = 400000; 3% cap = 12000.
  it("is QM exactly at the 3% cap (boundary inclusive)", async () => {
    setFixtures({ application: { totalPointsAndFees: "12000" } });
    const result = await validateMISMOCompleteness("app-1");
    expect(result.qmStatus).toBe("QM");
    expect(result.pointsAndFeesCompliant).toBe(true);
  });

  it("is Non-QM just over the 3% cap", async () => {
    setFixtures({ application: { totalPointsAndFees: "12000.01" } });
    const result = await validateMISMOCompleteness("app-1");
    expect(result.qmStatus).toBe("Non-QM");
    expect(result.pointsAndFeesCompliant).toBe(false);
    expect(result.gseReady).toBe(false);
  });

  it("is Unknown when points-and-fees is not provided", async () => {
    setFixtures({ application: { totalPointsAndFees: null } });
    const result = await validateMISMOCompleteness("app-1");
    expect(result.qmStatus).toBe("Unknown");
    expect(result.pointsAndFeesCompliant).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("ARM required-field validation", () => {
  const ARM_FIELDS = {
    armIndexType: "SOFR",
    armMargin: "2.75",
    armInitialRate: "5.5",
    armInitialCap: "2",
    armPeriodicCap: "1",
    armLifetimeCap: "5",
    armAdjustmentFrequencyMonths: 12,
  };

  it("is not applicable for fixed-rate loans", async () => {
    setFixtures({ application: { amortizationType: "fixed" } });
    const result = await validateMISMOCompleteness("app-1");
    expect(result.armValidation.applicable).toBe(false);
    expect(result.armValidation.valid).toBe(true);
    expect(result.armValidation.issues).toEqual([]);
  });

  it("flags every missing ARM field on an adjustable-rate loan", async () => {
    setFixtures({ application: { amortizationType: "adjustable" } });
    const result = await validateMISMOCompleteness("app-1");
    expect(result.armValidation.applicable).toBe(true);
    expect(result.armValidation.valid).toBe(false);
    expect(result.armValidation.issues.length).toBe(7);
  });

  it("is valid when all ARM fields are provided", async () => {
    setFixtures({
      application: { amortizationType: "adjustable", ...ARM_FIELDS },
    });
    const result = await validateMISMOCompleteness("app-1");
    expect(result.armValidation.applicable).toBe(true);
    expect(result.armValidation.valid).toBe(true);
    expect(result.armValidation.issues).toEqual([]);
  });

  it("flags only the single missing ARM field", async () => {
    const partial = { ...ARM_FIELDS, armMargin: null };
    setFixtures({
      application: { amortizationType: "adjustable", ...partial },
    });
    const result = await validateMISMOCompleteness("app-1");
    expect(result.armValidation.valid).toBe(false);
    expect(result.armValidation.issues.length).toBe(1);
    expect(result.armValidation.issues[0]).toMatch(/margin/i);
  });
});

// ---------------------------------------------------------------------------
describe("HMDA LAR denial-reason rules", () => {
  it("requires action-taken to be provided", async () => {
    setFixtures({ application: { hmdaActionTaken: null } });
    const result = await validateMISMOCompleteness("app-1");
    expect(result.hmdaLar.actionTakenProvided).toBe(false);
    expect(result.hmdaLar.issues.join(" ")).toMatch(/action-taken/i);
  });

  it("does not require denial reasons when the loan is approved", async () => {
    setFixtures({ application: { hmdaActionTaken: "1", hmdaDenialReasons: [] } });
    const result = await validateMISMOCompleteness("app-1");
    expect(result.hmdaLar.denialReasonsValid).toBe(true);
  });

  it("is invalid when denied with fewer than 2 denial reasons", async () => {
    setFixtures({
      application: { hmdaActionTaken: "3", hmdaDenialReasons: ["dti"] },
    });
    const result = await validateMISMOCompleteness("app-1");
    expect(result.hmdaLar.denialReasonsValid).toBe(false);
    expect(result.hmdaLar.issues.join(" ")).toMatch(/2 denial reasons/i);
  });

  it("is valid when denied with at least 2 denial reasons", async () => {
    setFixtures({
      application: {
        hmdaActionTaken: "3",
        hmdaDenialReasons: ["dti", "credit_history"],
      },
    });
    const result = await validateMISMOCompleteness("app-1");
    expect(result.hmdaLar.denialReasonsValid).toBe(true);
  });

  it("detects denial via the textual action-taken value", async () => {
    setFixtures({
      application: {
        hmdaActionTaken: "Application Denied",
        hmdaDenialReasons: ["dti"],
      },
    });
    const result = await validateMISMOCompleteness("app-1");
    expect(result.hmdaLar.denialReasonsValid).toBe(false);
  });
});
