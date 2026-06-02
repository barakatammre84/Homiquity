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

// ---------------------------------------------------------------------------
// Additional section-scorer fixtures (employment, military, demographics,
// and the conditional asset/liability/REO detail rules).
// ---------------------------------------------------------------------------
function currentJob(startDate: string, overrides: Record<string, any> = {}) {
  return {
    employmentType: "current",
    employerName: "Acme Corp",
    positionTitle: "Engineer",
    startDate,
    monthlyIncomeOrLoss: "8000",
    employerPhone: "555-0199",
    employerStreet: "1 Industry Way",
    isSelfEmployed: false,
    borrowerSequenceNumber: 1,
    ...overrides,
  };
}

function priorJob(overrides: Record<string, any> = {}) {
  return {
    employmentType: "previous",
    employerName: "Old Co",
    positionTitle: "Analyst",
    startDate: "2015-01-01",
    endDate: "2017-12-31",
    monthlyIncomeOrLoss: "6000",
    borrowerSequenceNumber: 1,
    ...overrides,
  };
}

function militaryProfile(overrides: Record<string, any> = {}) {
  return {
    militaryStatus: "veteran",
    militaryBranch: "army",
    militaryServiceStart: "2005-01-01",
    vaEntitlementUsed: false,
    vaFundingFeeExempt: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
describe("employment 2-year-history rule (section 1b-1e)", () => {
  it("does not require a prior employer when the current job exceeds 2 years", async () => {
    setFixtures({ urla: baseUrla({ employmentHistory: [currentJob("2020-01-01")] }) });
    const result = await validateMISMOCompleteness("app-1");
    const emp = sectionByNumber(result, "1b-1e");
    expect(emp.missingFields).toEqual([]);
  });

  it("requires prior-employer fields when the current job is under 2 years old", async () => {
    setFixtures({ urla: baseUrla({ employmentHistory: [currentJob("2025-06-01")] }) });
    const result = await validateMISMOCompleteness("app-1");
    const emp = sectionByNumber(result, "1b-1e");
    expect(emp.missingFields).toEqual(
      expect.arrayContaining([
        "Prior Employer Name (2-year history required)",
        "Prior Employer Start Date",
        "Prior Employer End Date",
      ])
    );
  });

  it("is satisfied when a short current job is paired with a complete prior employer", async () => {
    setFixtures({
      urla: baseUrla({ employmentHistory: [currentJob("2025-06-01"), priorJob()] }),
    });
    const result = await validateMISMOCompleteness("app-1");
    const emp = sectionByNumber(result, "1b-1e");
    expect(emp.missingFields).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("VA-loan military-service requirement (section 6)", () => {
  it("does not require military fields for a non-VA loan", async () => {
    // conventional loan + no profile => section 6 fields are optional.
    setFixtures();
    const result = await validateMISMOCompleteness("app-1");
    const military = sectionByNumber(result, "6");
    expect(military.missingFields).toEqual([]);
  });

  it("requires military fields when the loan type is VA but no profile exists", async () => {
    setFixtures({ application: { preferredLoanType: "va" }, profile: null });
    const result = await validateMISMOCompleteness("app-1");
    const military = sectionByNumber(result, "6");
    expect(military.missingFields).toEqual(
      expect.arrayContaining([
        "Military Service Status",
        "Service Branch",
        "VA Entitlement / Funding Fee Status",
      ])
    );
  });

  it("is satisfied for a VA loan once the military profile is complete", async () => {
    setFixtures({ application: { preferredLoanType: "va" }, profile: militaryProfile() });
    const result = await validateMISMOCompleteness("app-1");
    const military = sectionByNumber(result, "6");
    expect(military.missingFields).toEqual([]);
  });

  it("treats VA detection as case-insensitive", async () => {
    setFixtures({ application: { preferredLoanType: "VA" }, profile: null });
    const result = await validateMISMOCompleteness("app-1");
    const military = sectionByNumber(result, "6");
    expect(military.missingFields.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
describe("demographics refusal-recorded logic (section 7 / Reg C)", () => {
  it("counts recorded refusals (not-provided flags) as collected", async () => {
    // baseline uses ethnicity/race/sex not-provided flags.
    setFixtures();
    const result = await validateMISMOCompleteness("app-1");
    const demo = sectionByNumber(result, "7");
    expect(demo.missingFields).toEqual([]);
  });

  it("counts affirmatively selected values as collected", async () => {
    setFixtures({
      urla: baseUrla({
        hmdaDemographics: [
          {
            borrowerId: "user-1",
            ethnicityHispanicLatino: true,
            raceWhite: true,
            sexFemale: true,
            collectionMethod: "visual",
          },
        ],
      }),
    });
    const result = await validateMISMOCompleteness("app-1");
    const demo = sectionByNumber(result, "7");
    expect(demo.missingFields).toEqual([]);
  });

  it("flags ethnicity/race/sex as missing when nothing is recorded", async () => {
    setFixtures({
      urla: baseUrla({
        hmdaDemographics: [{ borrowerId: "user-1", collectionMethod: "visual" }],
      }),
    });
    const result = await validateMISMOCompleteness("app-1");
    const demo = sectionByNumber(result, "7");
    expect(demo.missingFields).toEqual(
      expect.arrayContaining([
        "Ethnicity collected (or refusal recorded)",
        "Race collected (or refusal recorded)",
        "Sex collected (or refusal recorded)",
      ])
    );
  });

  it("flags collection method as missing when no demographic row exists", async () => {
    setFixtures({ urla: baseUrla({ hmdaDemographics: [] }) });
    const result = await validateMISMOCompleteness("app-1");
    const demo = sectionByNumber(result, "7");
    expect(demo.missingFields).toContain("Collection Method");
  });
});

// ---------------------------------------------------------------------------
describe("conditional asset detail requirements (section 2a)", () => {
  it("flags the no-asset state when no asset rows are present", async () => {
    setFixtures({ urla: baseUrla({ assets: [] }) });
    const result = await validateMISMOCompleteness("app-1");
    const assets = sectionByNumber(result, "2a");
    expect(assets.missingFields).toEqual(
      expect.arrayContaining(["At least one asset account", "Total Assets > $0"])
    );
  });

  it("requires detail fields once an asset row is present", async () => {
    setFixtures({
      urla: baseUrla({
        assets: [
          {
            accountType: null,
            financialInstitution: "Big Bank",
            cashOrMarketValue: "50000",
            borrowerSequenceNumber: 1,
          },
        ],
      }),
    });
    const result = await validateMISMOCompleteness("app-1");
    const assets = sectionByNumber(result, "2a");
    expect(assets.missingFields).toContain("Account Type");
  });
});

// ---------------------------------------------------------------------------
describe("conditional liability detail requirements (section 2b)", () => {
  it("is satisfied with no liabilities reported", async () => {
    setFixtures({ urla: baseUrla({ liabilities: [] }) });
    const result = await validateMISMOCompleteness("app-1");
    const liabilities = sectionByNumber(result, "2b");
    expect(liabilities.missingFields).toEqual([]);
  });

  it("requires type and monthly payment once a liability row is present", async () => {
    setFixtures({
      urla: baseUrla({
        liabilities: [
          {
            liabilityType: null,
            creditorName: "Card Co",
            monthlyPayment: null,
            unpaidBalance: "2000",
            borrowerSequenceNumber: 1,
          },
        ],
      }),
    });
    const result = await validateMISMOCompleteness("app-1");
    const liabilities = sectionByNumber(result, "2b");
    expect(liabilities.missingFields).toEqual(
      expect.arrayContaining(["Liability Type", "Monthly Payment"])
    );
  });

  it("does not require the optional creditor name / unpaid balance", async () => {
    setFixtures({
      urla: baseUrla({
        liabilities: [
          {
            liabilityType: "credit_card",
            creditorName: null,
            monthlyPayment: "150",
            unpaidBalance: null,
            borrowerSequenceNumber: 1,
          },
        ],
      }),
    });
    const result = await validateMISMOCompleteness("app-1");
    const liabilities = sectionByNumber(result, "2b");
    expect(liabilities.missingFields).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("conditional real-estate-owned detail requirements (section 2c)", () => {
  it("is satisfied when no property is owned", async () => {
    setFixtures({ urla: baseUrla({ realEstateOwned: [] }) });
    const result = await validateMISMOCompleteness("app-1");
    const reo = sectionByNumber(result, "2c");
    expect(reo.missingFields).toEqual([]);
  });

  it("requires every REO detail field once a property is listed", async () => {
    setFixtures({
      urla: baseUrla({
        realEstateOwned: [
          {
            propertyAddress: "456 Rental Rd",
            marketValue: null,
            mortgageBalance: null,
            status: null,
            occupancyType: null,
          },
        ],
      }),
    });
    const result = await validateMISMOCompleteness("app-1");
    const reo = sectionByNumber(result, "2c");
    expect(reo.missingFields).toEqual(
      expect.arrayContaining([
        "REO #1 Market Value",
        "REO #1 Mortgage Balance",
        "REO #1 Occupancy/Status",
      ])
    );
  });
});

// ---------------------------------------------------------------------------
// Co-applicant scoring (borrowerSequenceNumber > 1) and the
// coApplicantLimitation note.
// ---------------------------------------------------------------------------
function coEmployment(overrides: Record<string, any> = {}) {
  return {
    employmentType: "current",
    employerName: "Co Corp",
    positionTitle: "Manager",
    startDate: "2017-01-01", // > 2 years => no prior employer required
    monthlyIncomeOrLoss: "7000",
    employerPhone: "555-0200",
    employerStreet: "2 Commerce Blvd",
    isSelfEmployed: false,
    borrowerSequenceNumber: 2,
    ...overrides,
  };
}

function coAsset(overrides: Record<string, any> = {}) {
  return {
    accountType: "savings",
    financialInstitution: "Co Bank",
    cashOrMarketValue: "30000",
    borrowerSequenceNumber: 2,
    ...overrides,
  };
}

function coLiability(overrides: Record<string, any> = {}) {
  return {
    liabilityType: "auto_loan",
    creditorName: "Auto Co",
    monthlyPayment: "300",
    unpaidBalance: "10000",
    borrowerSequenceNumber: 2,
    ...overrides,
  };
}

function coDemographic(overrides: Record<string, any> = {}) {
  return {
    borrowerId: "co-user-2",
    ethnicityNotProvided: true,
    raceNotProvided: true,
    sexNotProvided: true,
    collectionMethod: "visual",
    ...overrides,
  };
}

// Builds a URLA fixture that includes a complete primary borrower plus an
// optional set of co-applicant (seq > 1) rows, layered onto the baseline.
function urlaWithCoApplicant(co: {
  employment?: any[];
  assets?: any[];
  liabilities?: any[];
  hmda?: any[];
  personalInfo?: Record<string, any>;
} = {}) {
  const base = baseUrla();
  return baseUrla({
    personalInfo: completePersonalInfo(co.personalInfo ?? {}),
    employmentHistory: [...base.employmentHistory, ...(co.employment ?? [coEmployment()])],
    assets: [...base.assets, ...(co.assets ?? [coAsset()])],
    liabilities: [...base.liabilities, ...(co.liabilities ?? [coLiability()])],
    hmdaDemographics: [...base.hmdaDemographics, ...(co.hmda ?? [coDemographic()])],
  });
}

describe("co-applicant scoring (borrowerSequenceNumber > 1)", () => {
  it("creates a coApplicants entry with its own section scores", async () => {
    setFixtures({ urla: urlaWithCoApplicant() });
    const result = await validateMISMOCompleteness("app-1");

    expect(result.coApplicants.length).toBe(1);
    const co = result.coApplicants[0];
    expect(co.borrowerSequenceNumber).toBe(2);
    // Independently scored sections: employment, assets, liabilities, demographics.
    expect(co.sections.map((s: any) => s.sectionNumber)).toEqual([
      "1b-1e",
      "2a",
      "2b",
      "7",
    ]);
    // No required fields are missing in any co-applicant section.
    co.sections.forEach((s: any) => {
      expect(s.missingFields).toEqual([]);
      expect(s.completeness).toBeGreaterThanOrEqual(90);
    });
    // Assets, liabilities, and demographics have no optional gaps => 100.
    expect(
      co.sections.find((s: any) => s.sectionNumber === "2a").completeness
    ).toBe(100);
  });

  it("scores the co-applicant's sections independently of the primary borrower", async () => {
    // Primary borrower stays complete; only the co-applicant employment is broken.
    setFixtures({
      urla: urlaWithCoApplicant({
        employment: [coEmployment({ employerName: null, positionTitle: null })],
      }),
    });
    const result = await validateMISMOCompleteness("app-1");

    // Primary employment is untouched and complete.
    const primaryEmp = sectionByNumber(result, "1b-1e");
    expect(primaryEmp.missingFields).toEqual([]);

    // The co-applicant's employment section reflects the missing fields.
    const coEmp = result.coApplicants[0].sections.find(
      (s: any) => s.sectionNumber === "1b-1e"
    );
    expect(coEmp.missingFields).toEqual(
      expect.arrayContaining(["Employer Name", "Position/Title"])
    );
    expect(coEmp.completeness).toBeLessThan(100);
  });

  it("detects a co-applicant from any single seq>1 row type (assets only)", async () => {
    const base = baseUrla();
    setFixtures({
      urla: baseUrla({
        assets: [...base.assets, coAsset()],
      }),
    });
    const result = await validateMISMOCompleteness("app-1");

    expect(result.coApplicants.length).toBe(1);
    expect(result.coApplicants[0].borrowerSequenceNumber).toBe(2);
  });

  it("scores multiple co-applicants, sorted by sequence number", async () => {
    const base = baseUrla();
    setFixtures({
      urla: baseUrla({
        employmentHistory: [
          ...base.employmentHistory,
          coEmployment({ borrowerSequenceNumber: 3 }),
          coEmployment({ borrowerSequenceNumber: 2 }),
        ],
      }),
    });
    const result = await validateMISMOCompleteness("app-1");

    expect(result.coApplicants.map((c: any) => c.borrowerSequenceNumber)).toEqual([
      2, 3,
    ]);
  });
});

describe("co-applicant missing fields surface into criticalErrors", () => {
  it("prefixes co-applicant errors with 'Co-applicant #N <section>'", async () => {
    setFixtures({
      urla: urlaWithCoApplicant({
        employment: [coEmployment({ employerName: null })],
      }),
    });
    const result = await validateMISMOCompleteness("app-1");

    expect(result.criticalErrors).toContain(
      "Co-applicant #2 Employment & Income: Employer Name is required"
    );
  });

  it("does not emit co-applicant errors when the co-applicant is complete", async () => {
    setFixtures({ urla: urlaWithCoApplicant() });
    const result = await validateMISMOCompleteness("app-1");

    expect(
      result.criticalErrors.filter((e: string) => e.startsWith("Co-applicant #"))
    ).toEqual([]);
  });

  it("uses the co-applicant's own sequence number in the prefix", async () => {
    const base = baseUrla();
    setFixtures({
      urla: baseUrla({
        assets: [
          ...base.assets,
          coAsset({ borrowerSequenceNumber: 3, accountType: null }),
        ],
      }),
    });
    const result = await validateMISMOCompleteness("app-1");

    expect(result.criticalErrors).toContain(
      "Co-applicant #3 Assets & Accounts: Account Type is required"
    );
  });
});

describe("coApplicantLimitation note", () => {
  it("is null when no co-borrower is declared and no co-applicant rows exist", async () => {
    setFixtures();
    const result = await validateMISMOCompleteness("app-1");
    expect(result.coApplicantLimitation).toBeNull();
  });

  it("is set when profile.hasCoBorrower is true but no co-applicant rows exist", async () => {
    setFixtures({ profile: { hasCoBorrower: true } });
    const result = await validateMISMOCompleteness("app-1");
    expect(result.coApplicantLimitation).not.toBeNull();
    expect(result.coApplicantLimitation).toMatch(/co-borrower is indicated/i);
  });

  it("is set when personalInfo.coBorrowerNames is present but no co-applicant rows exist", async () => {
    setFixtures({
      urla: baseUrla({
        personalInfo: completePersonalInfo({ coBorrowerNames: "John Co-Borrower" }),
      }),
    });
    const result = await validateMISMOCompleteness("app-1");
    expect(result.coApplicantLimitation).not.toBeNull();
  });

  it("is set when personalInfo.totalBorrowers > 1 but no co-applicant rows exist", async () => {
    setFixtures({
      urla: baseUrla({
        personalInfo: completePersonalInfo({ totalBorrowers: 2 }),
      }),
    });
    const result = await validateMISMOCompleteness("app-1");
    expect(result.coApplicantLimitation).not.toBeNull();
  });

  it("stays null when a co-borrower is declared AND co-applicant rows exist", async () => {
    setFixtures({
      profile: { hasCoBorrower: true },
      urla: urlaWithCoApplicant({
        personalInfo: { totalBorrowers: 2, coBorrowerNames: "John Co-Borrower" },
      }),
    });
    const result = await validateMISMOCompleteness("app-1");
    expect(result.coApplicants.length).toBe(1);
    expect(result.coApplicantLimitation).toBeNull();
  });
});
