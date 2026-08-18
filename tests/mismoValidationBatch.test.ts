import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// CTO_ROADMAP §3.2 — "the last N+1 loop".
//
// The compliance dashboard called validateMISMOCompleteness once per active
// application, and that validator makes 15 storage reads internally (11 URLA
// tables + application + conditions + documents + borrower profile). A staff
// dashboard with 100 in-flight files therefore fired ~1,500 queries in one
// burst. It is now a fixed number of batched (`inArray`) reads.
//
// The property that matters is NOT the speed — it is that the verdicts are
// unchanged. These files decide GSE delivery readiness, so a batched loader
// that drops a bucket would report a complete borrower file as incomplete (or
// worse, an incomplete one as ready). Three layers are pinned below:
//
//   1. the grouping helpers (dense keys, order, first-wins),
//   2. the pure per-application split of a batched read,
//   3. the validator itself — batch output vs the single-application path,
//      over the SAME fixtures, asserted equal field for field.
//
// Not covered here: the SQL in getCompleteUrlaDataBatch. These tests are
// hermetic (no database), so the queries themselves are pinned by source
// guards in nPlusOneBatching.test.ts instead.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  rows: {
    applications: [] as any[],
    personal: [] as any[],
    employment: [] as any[],
    income: [] as any[],
    assets: [] as any[],
    liabilities: [] as any[],
    property: [] as any[],
    declarations: [] as any[],
    realEstateOwned: [] as any[],
    hmda: [] as any[],
    conditions: [] as any[],
    documents: [] as any[],
    profiles: [] as any[],
  },
  calls: {} as Record<string, number>,
}));

function count(method: string) {
  h.calls[method] = (h.calls[method] ?? 0) + 1;
}

const forApp = (list: any[], applicationId: string) =>
  list.filter((r) => r.applicationId === applicationId);

vi.mock("../server/storage", async () => {
  // The batched mocks delegate to the REAL assembler, so a bug in the
  // per-application split shows up as a verdict difference below rather than
  // being papered over by a hand-written test double.
  const { assembleCompleteUrlaDataBatch } = await import("../server/storage/urlaBatch");
  const { groupRowsByKeyDense, indexRowsByKey } = await import("../server/storage/batchGroup");

  return {
    storage: {
      // --- single-application path (the shape that produced the N+1) ---------
      getLoanApplication: async (id: string) => {
        count("getLoanApplication");
        return h.rows.applications.find((a) => a.id === id);
      },
      getCompleteUrlaData: async (applicationId: string) => {
        count("getCompleteUrlaData");
        const allPersonalInfo = forApp(h.rows.personal, applicationId);
        const allDeclarations = forApp(h.rows.declarations, applicationId);
        return {
          // Deliberately spelled the way the single loader queries it — a
          // separate `where seq = 1 limit 1` read — not the way the batch
          // assembler derives it.
          personalInfo: allPersonalInfo.find((p) => (p.borrowerSequenceNumber ?? 1) === 1),
          allPersonalInfo,
          employmentHistory: forApp(h.rows.employment, applicationId),
          otherIncomeSources: forApp(h.rows.income, applicationId),
          assets: forApp(h.rows.assets, applicationId),
          liabilities: forApp(h.rows.liabilities, applicationId),
          propertyInfo: forApp(h.rows.property, applicationId)[0],
          declarations: allDeclarations.find((d) => (d.borrowerSequenceNumber ?? 1) === 1),
          allDeclarations,
          realEstateOwned: forApp(h.rows.realEstateOwned, applicationId),
          hmdaDemographics: forApp(h.rows.hmda, applicationId),
        };
      },
      getLoanConditionsByApplication: async (applicationId: string) => {
        count("getLoanConditionsByApplication");
        return forApp(h.rows.conditions, applicationId);
      },
      getDocumentsByApplication: async (applicationId: string) => {
        count("getDocumentsByApplication");
        return forApp(h.rows.documents, applicationId);
      },
      getBorrowerProfileByUserId: async (userId: string) => {
        count("getBorrowerProfileByUserId");
        return h.rows.profiles.find((p) => p.userId === userId);
      },

      // --- batched path -----------------------------------------------------
      getCompleteUrlaDataBatch: async (ids: string[]) => {
        count("getCompleteUrlaDataBatch");
        return assembleCompleteUrlaDataBatch(ids, {
          personal: h.rows.personal.filter((r) => ids.includes(r.applicationId)),
          employment: h.rows.employment.filter((r) => ids.includes(r.applicationId)),
          income: h.rows.income.filter((r) => ids.includes(r.applicationId)),
          assets: h.rows.assets.filter((r) => ids.includes(r.applicationId)),
          liabilities: h.rows.liabilities.filter((r) => ids.includes(r.applicationId)),
          property: h.rows.property.filter((r) => ids.includes(r.applicationId)),
          declarations: h.rows.declarations.filter((r) => ids.includes(r.applicationId)),
          realEstateOwned: h.rows.realEstateOwned.filter((r) => ids.includes(r.applicationId)),
          hmda: h.rows.hmda.filter((r) => ids.includes(r.applicationId)),
        });
      },
      getLoanConditionsByApplications: async (ids: string[]) => {
        count("getLoanConditionsByApplications");
        return groupRowsByKeyDense(
          ids,
          h.rows.conditions.filter((r) => ids.includes(r.applicationId)),
          (r: any) => r.applicationId,
        );
      },
      getDocumentsByApplications: async (ids: string[]) => {
        count("getDocumentsByApplications");
        return groupRowsByKeyDense(
          ids,
          h.rows.documents.filter((r) => ids.includes(r.applicationId)),
          (r: any) => r.applicationId,
        );
      },
      getBorrowerProfilesByUserIds: async (userIds: string[]) => {
        count("getBorrowerProfilesByUserIds");
        return indexRowsByKey(
          h.rows.profiles.filter((p) => userIds.includes(p.userId)),
          (p: any) => p.userId,
        );
      },
    },
  };
});

import {
  validateMISMOCompleteness,
  validateMISMOCompletenessBatch,
  getBatchValidationStatus,
} from "../server/services/mismoValidation";
import {
  groupRowsByKey,
  groupRowsByKeyDense,
  indexRowsByKey,
} from "../server/storage/batchGroup";
import { assembleCompleteUrlaDataBatch } from "../server/storage/urlaBatch";

// ---------------------------------------------------------------------------
// Fixtures — three applications that score differently, so an equivalence test
// that accidentally compares two empty files cannot pass by coincidence.
// ---------------------------------------------------------------------------

function application(id: string, userId: string, overrides: Record<string, any> = {}) {
  return {
    id,
    userId,
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
    armIndexType: null,
    armMargin: null,
    armInitialRate: null,
    armInitialCap: null,
    armPeriodicCap: null,
    armLifetimeCap: null,
    armAdjustmentFrequencyMonths: null,
    totalPointsAndFees: "10000",
    hmdaActionTaken: "1",
    hmdaDenialReasons: [],
    closingDate: null,
    leIssuedDate: null,
    cdIssuedDate: null,
    tridTriggeredAt: null,
    createdAt: new Date("2026-01-05T00:00:00Z"),
    ...overrides,
  };
}

function personalRow(applicationId: string, seq: number, overrides: Record<string, any> = {}) {
  return {
    applicationId,
    borrowerSequenceNumber: seq,
    firstName: seq === 1 ? "Jane" : "John",
    lastName: "Borrower",
    ssnLast4: "6789",
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

function employmentRow(applicationId: string, seq: number, overrides: Record<string, any> = {}) {
  return {
    applicationId,
    borrowerSequenceNumber: seq,
    employmentType: "current",
    employerName: "Acme Corp",
    positionTitle: "Engineer",
    startDate: "2018-01-01",
    monthlyIncomeOrLoss: "8000",
    employerPhone: "555-0199",
    employerStreet: "1 Industry Way",
    isSelfEmployed: false,
    ...overrides,
  };
}

function declarationsRow(applicationId: string, seq: number) {
  return {
    applicationId,
    borrowerSequenceNumber: seq,
    willOccupyAsPrimaryResidence: true,
    hasOwnershipInterestInPast3Years: false,
    isBorrowingForDownPayment: false,
    hasOutstandingJudgments: false,
    isDelinquentOnFederalDebt: false,
    isPartyToLawsuit: false,
    hasConveyedTitleInLieuOfForeclosure: false,
    hasBeenForeclosed: false,
    hasDeclaredBankruptcy: false,
  };
}

/**
 * app-complete : fully populated, single borrower
 * app-co       : populated plus a borrowerSequenceNumber-2 co-applicant
 * app-empty    : an application row and nothing else (a real early-stage file)
 */
function seedThreeApplications() {
  h.rows.applications = [
    application("app-complete", "user-1"),
    application("app-co", "user-2"),
    application("app-empty", "user-3", { propertyAddress: null, propertyZip: null }),
  ];
  h.rows.personal = [
    personalRow("app-complete", 1),
    personalRow("app-co", 1),
    personalRow("app-co", 2),
  ];
  h.rows.employment = [
    employmentRow("app-complete", 1),
    employmentRow("app-co", 1),
    employmentRow("app-co", 2),
  ];
  h.rows.income = [
    { applicationId: "app-complete", incomeSource: "bonus", monthlyAmount: "500", borrowerSequenceNumber: 1 },
  ];
  h.rows.assets = [
    { applicationId: "app-complete", accountType: "checking", financialInstitution: "Big Bank", cashOrMarketValue: "50000", borrowerSequenceNumber: 1 },
    { applicationId: "app-co", accountType: "checking", financialInstitution: "Big Bank", cashOrMarketValue: "50000", borrowerSequenceNumber: 1 },
    { applicationId: "app-co", accountType: "savings", financialInstitution: "Big Bank", cashOrMarketValue: "25000", borrowerSequenceNumber: 2 },
  ];
  h.rows.liabilities = [
    { applicationId: "app-complete", liabilityType: "credit_card", creditorName: "Card Co", monthlyPayment: "150", unpaidBalance: "2000", borrowerSequenceNumber: 1 },
    { applicationId: "app-co", liabilityType: "credit_card", creditorName: "Card Co", monthlyPayment: "150", unpaidBalance: "2000", borrowerSequenceNumber: 1 },
  ];
  h.rows.property = [
    { applicationId: "app-complete", propertyStreet: "123 Main St", propertyCity: "Austin", propertyState: "TX", propertyZip: "78701", occupancyType: "primary", numberOfUnits: 1 },
    { applicationId: "app-co", propertyStreet: "9 Oak Ave", propertyCity: "Austin", propertyState: "TX", propertyZip: "78702", occupancyType: "primary", numberOfUnits: 1 },
  ];
  h.rows.declarations = [
    declarationsRow("app-complete", 1),
    declarationsRow("app-co", 1),
    declarationsRow("app-co", 2),
  ];
  h.rows.realEstateOwned = [];
  h.rows.hmda = [
    { applicationId: "app-complete", borrowerId: "user-1", borrowerSequenceNumber: 1, ethnicityNotProvided: true, raceNotProvided: true, sexNotProvided: true, collectionMethod: "visual" },
    { applicationId: "app-co", borrowerId: "user-2", borrowerSequenceNumber: 1, ethnicityNotProvided: true, raceNotProvided: true, sexNotProvided: true, collectionMethod: "visual" },
    { applicationId: "app-co", borrowerId: "user-2", borrowerSequenceNumber: 2, ethnicityNotProvided: true, raceNotProvided: true, sexNotProvided: true, collectionMethod: "visual" },
  ];
  h.rows.conditions = [
    { applicationId: "app-complete", status: "outstanding", priority: 1, requiredDocumentTypes: ["pay_stub"] },
    { applicationId: "app-co", status: "cleared", priority: 1, requiredDocumentTypes: ["tax_return"] },
  ];
  h.rows.documents = [
    { applicationId: "app-complete", documentType: "pay_stub" },
  ];
  h.rows.profiles = [
    { userId: "user-2", hasCoBorrower: true },
  ];
}

beforeEach(() => {
  for (const key of Object.keys(h.rows)) (h.rows as any)[key] = [];
  h.calls = {};
});

// ---------------------------------------------------------------------------
describe("grouping helpers", () => {
  const rows = [
    { app: "a", n: 1 },
    { app: "b", n: 2 },
    { app: "a", n: 3 },
  ];

  it("preserves arrival order within each bucket", () => {
    const grouped = groupRowsByKey(rows, (r) => r.app);
    expect(grouped.get("a")?.map((r) => r.n)).toEqual([1, 3]);
    expect(grouped.get("b")?.map((r) => r.n)).toEqual([2]);
  });

  it("gives a requested key with no rows an EMPTY bucket, not a missing one", () => {
    // The storage boundary's contract: you get a bucket for every id you asked
    // for. (The validator additionally falls back with `?? []`, so this is
    // belt-and-braces there — it matters for any caller that reads the map
    // directly.)
    const grouped = groupRowsByKeyDense(["a", "b", "c"], rows, (r) => r.app);
    expect(grouped.has("c")).toBe(true);
    expect(grouped.get("c")).toEqual([]);
  });

  it("does not invent buckets for keys that were never requested", () => {
    const grouped = groupRowsByKeyDense(["a"], rows, (r) => r.app);
    // "b" still appears because it has rows — the dense pass only ADDS empties.
    expect(grouped.get("a")?.length).toBe(2);
    expect(grouped.has("c")).toBe(false);
  });

  it("keeps the FIRST row per key, matching a single-row limit(1) read", () => {
    const indexed = indexRowsByKey(rows, (r) => r.app);
    expect(indexed.get("a")?.n).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe("assembleCompleteUrlaDataBatch", () => {
  const emptyRows = {
    personal: [], employment: [], income: [], assets: [], liabilities: [],
    property: [], declarations: [], realEstateOwned: [], hmda: [],
  };

  it("takes the borrowerSequenceNumber-1 row as personalInfo / declarations", () => {
    const assembled = assembleCompleteUrlaDataBatch(["app-1"], {
      ...emptyRows,
      personal: [personalRow("app-1", 2), personalRow("app-1", 1)] as any,
      declarations: [declarationsRow("app-1", 2), declarationsRow("app-1", 1)] as any,
    });
    expect(assembled.get("app-1")?.personalInfo?.borrowerSequenceNumber).toBe(1);
    expect(assembled.get("app-1")?.declarations?.borrowerSequenceNumber).toBe(1);
    expect(assembled.get("app-1")?.allPersonalInfo).toHaveLength(2);
  });

  it("treats a null borrowerSequenceNumber as the primary borrower", () => {
    const assembled = assembleCompleteUrlaDataBatch(["app-1"], {
      ...emptyRows,
      personal: [personalRow("app-1", null as any)] as any,
    });
    expect(assembled.get("app-1")?.personalInfo?.firstName).toBe("John");
  });

  it("never bleeds one application's rows into another", () => {
    const assembled = assembleCompleteUrlaDataBatch(["app-1", "app-2"], {
      ...emptyRows,
      assets: [
        { applicationId: "app-1", accountType: "checking" },
        { applicationId: "app-2", accountType: "savings" },
      ] as any,
    });
    expect(assembled.get("app-1")?.assets.map((a: any) => a.accountType)).toEqual(["checking"]);
    expect(assembled.get("app-2")?.assets.map((a: any) => a.accountType)).toEqual(["savings"]);
  });

  it("returns a fully-shaped, empty record for an application with no URLA rows", () => {
    const assembled = assembleCompleteUrlaDataBatch(["app-1"], emptyRows);
    const record = assembled.get("app-1");
    expect(record).toBeDefined();
    expect(record?.personalInfo).toBeUndefined();
    expect(record?.propertyInfo).toBeUndefined();
    expect(record?.assets).toEqual([]);
    expect(record?.hmdaDemographics).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("validateMISMOCompletenessBatch matches the single-application path", () => {
  beforeEach(seedThreeApplications);

  it("produces an identical verdict for every application", async () => {
    const applications = h.rows.applications;
    const batch = await validateMISMOCompletenessBatch(applications as any);

    for (const app of applications) {
      const single = await validateMISMOCompleteness(app.id);
      expect(batch.get(app.id)).toEqual(single);
    }
  });

  it("distinguishes the three files, so the equality above is not vacuous", async () => {
    const batch = await validateMISMOCompletenessBatch(h.rows.applications as any);

    const complete = batch.get("app-complete")!;
    const co = batch.get("app-co")!;
    const empty = batch.get("app-empty")!;

    expect(complete.overallScore).toBeGreaterThan(empty.overallScore);
    expect(complete.coApplicants).toHaveLength(0);
    expect(co.coApplicants).toHaveLength(1);
    expect(co.coApplicants[0].borrowerSequenceNumber).toBe(2);
    expect(empty.criticalErrors.length).toBeGreaterThan(0);
  });

  it("scores a file whose only data is the application row, rather than skipping it", async () => {
    // An early-stage file must still appear on the dashboard with its gaps
    // listed — dropping it would read as "nothing to fix here".
    const batch = await validateMISMOCompletenessBatch(h.rows.applications as any);
    expect(batch.has("app-empty")).toBe(true);
    expect(batch.get("app-empty")!.gseReady).toBe(false);
  });

  it("issues a fixed number of storage reads regardless of file count", async () => {
    await validateMISMOCompletenessBatch(h.rows.applications as any);
    const forThree = { ...h.calls };

    // Twelve applications, same fixtures repeated — nothing about the read
    // count may depend on how many files are in flight.
    h.calls = {};
    const many = Array.from({ length: 12 }, (_, i) => application(`bulk-${i}`, `bulk-user-${i}`));
    h.rows.applications = many;
    await validateMISMOCompletenessBatch(many as any);

    expect(h.calls).toEqual(forThree);
    expect(h.calls).toEqual({
      getCompleteUrlaDataBatch: 1,
      getLoanConditionsByApplications: 1,
      getDocumentsByApplications: 1,
      getBorrowerProfilesByUserIds: 1,
    });
    // And specifically: not one single-application read anywhere.
    expect(h.calls.getLoanApplication).toBeUndefined();
    expect(h.calls.getCompleteUrlaData).toBeUndefined();
  });

  it("is the shape the old loop was NOT: 15 reads per application", async () => {
    // Pins the thing being fixed. The single-application path is still correct
    // and still used by the four per-file callers; it is only the LOOP that was
    // the defect.
    await validateMISMOCompleteness("app-complete");
    expect(h.calls).toEqual({
      getLoanApplication: 1,
      getCompleteUrlaData: 1,
      getLoanConditionsByApplication: 1,
      getDocumentsByApplication: 1,
      getBorrowerProfileByUserId: 1,
    });
  });

  it("looks the borrower profile up by userId, not applicationId", async () => {
    // app-co's profile carries hasCoBorrower — mis-keying the profile map would
    // silently drop the co-borrower limitation notice on every file.
    const batch = await validateMISMOCompletenessBatch(h.rows.applications as any);
    expect(batch.get("app-co")!.coApplicantLimitation).toBeNull();

    // Remove the co-applicant rows but keep the profile: the notice must fire.
    h.rows.personal = h.rows.personal.filter((p) => p.borrowerSequenceNumber === 1);
    h.rows.employment = h.rows.employment.filter((e) => e.borrowerSequenceNumber === 1);
    h.rows.assets = h.rows.assets.filter((a) => a.borrowerSequenceNumber === 1);
    h.rows.declarations = h.rows.declarations.filter((d) => d.borrowerSequenceNumber === 1);
    h.rows.hmda = h.rows.hmda.filter((d) => d.borrowerSequenceNumber === 1);

    const rescored = await validateMISMOCompletenessBatch(h.rows.applications as any);
    expect(rescored.get("app-co")!.coApplicantLimitation).toContain("co-borrower");
    // The other files must be unaffected — profiles are per-user, not shared.
    expect(rescored.get("app-complete")!.coApplicantLimitation).toBeNull();
  });

  it("returns an empty map for no applications without touching storage", async () => {
    const batch = await validateMISMOCompletenessBatch([]);
    expect(batch.size).toBe(0);
    expect(h.calls).toEqual({});
  });
});

// ---------------------------------------------------------------------------
describe("getBatchValidationStatus", () => {
  beforeEach(seedThreeApplications);

  it("summarises every application, in the order given", async () => {
    const summaries = await getBatchValidationStatus(h.rows.applications as any);
    expect(summaries.map((s) => s.applicationId)).toEqual([
      "app-complete",
      "app-co",
      "app-empty",
    ]);
  });

  it("carries the co-applicant roster into the summary", async () => {
    const summaries = await getBatchValidationStatus(h.rows.applications as any);
    const co = summaries.find((s) => s.applicationId === "app-co")!;
    expect(co.coApplicantCount).toBe(1);
    expect(co.coApplicants).toEqual([{ borrowerSequenceNumber: 2, name: "John Borrower" }]);
  });

  it("uses the batched loader, not one read per application", async () => {
    await getBatchValidationStatus(h.rows.applications as any);
    expect(h.calls.getCompleteUrlaDataBatch).toBe(1);
    expect(h.calls.getCompleteUrlaData).toBeUndefined();
  });
});
