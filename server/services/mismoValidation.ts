import { storage } from "../storage";
import type {
  LoanApplication,
  UrlaPersonalInfo,
  EmploymentHistory,
  UrlaAsset,
  UrlaLiability,
  UrlaPropertyInfo,
  BorrowerDeclarations,
  OtherIncomeSource,
  RealEstateOwned,
  HmdaDemographics,
  BorrowerProfile,
} from "@shared/schema";

export interface URLASectionScore {
  section: string;
  sectionNumber: string;
  completeness: number;
  requiredFields: number;
  completedFields: number;
  missingFields: string[];
  warnings: string[];
  /** True when this section is part of the GSE hard-gating set (1a, 4, 5). */
  gating?: boolean;
}

export interface CoApplicantScore {
  borrowerSequenceNumber: number;
  name: string | null;
  sections: URLASectionScore[];
}

export interface MISMOValidationResult {
  applicationId: string;
  overallScore: number;
  gseReady: boolean;
  /** True when a required field in a gating section (1a, 4, 5) is missing. */
  gseGatingFailed: boolean;
  ulddCompliant: boolean;
  sections: URLASectionScore[];
  coApplicants: CoApplicantScore[];
  coApplicantLimitation: string | null;
  criticalErrors: string[];
  warnings: string[];
  missingDocuments: string[];
  /** ATR/QM points-and-fees evaluation. */
  qmStatus: "QM" | "Non-QM" | "Unknown";
  pointsAndFeesCompliant: boolean;
  armValidation: {
    applicable: boolean;
    valid: boolean;
    issues: string[];
  };
  hmdaLar: {
    actionTakenProvided: boolean;
    denialReasonsValid: boolean;
    issues: string[];
  };
  tridStatus: {
    leRequired: boolean;
    leDueDate: Date | null;
    leIssued: boolean;
    cdRequired: boolean;
    cdDueDate: Date | null;
    cdIssued: boolean;
  };
}

const GATING_SECTIONS = ["1a", "4", "5"];

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

function scoreSection(
  sectionName: string,
  sectionNumber: string,
  fields: { name: string; value: unknown; required: boolean }[]
): URLASectionScore {
  const requiredFields = fields.filter(f => f.required);
  const completedRequired = requiredFields.filter(f => hasValue(f.value));
  const missingFields = requiredFields
    .filter(f => !hasValue(f.value))
    .map(f => f.name);

  const optionalFields = fields.filter(f => !f.required);
  const completedOptional = optionalFields.filter(f => hasValue(f.value));

  const warnings = optionalFields
    .filter(f => !hasValue(f.value))
    .map(f => `${f.name} is recommended but not provided`);

  const requiredWeight = 0.8;
  const optionalWeight = 0.2;

  // If a section has required fields but ALL are missing, it scores 0 — do not
  // award the optional weight for free. If a section has no required fields,
  // distribute the full weight across whatever fields exist.
  let completeness: number;
  if (requiredFields.length > 0) {
    const requiredScore = (completedRequired.length / requiredFields.length) * requiredWeight;
    // Only credit optional weight when there are optional fields present.
    const optionalScore = optionalFields.length > 0
      ? (completedOptional.length / optionalFields.length) * optionalWeight
      : 0;
    // When there are no optional fields, scale required up to fill 100%.
    const denominator = optionalFields.length > 0 ? requiredWeight + optionalWeight : requiredWeight;
    completeness = Math.round(((requiredScore + optionalScore) / denominator) * 100);
  } else if (optionalFields.length > 0) {
    completeness = Math.round((completedOptional.length / optionalFields.length) * 100);
  } else {
    completeness = 100;
  }

  return {
    section: sectionName,
    sectionNumber,
    completeness,
    requiredFields: requiredFields.length,
    completedFields: completedRequired.length,
    missingFields,
    warnings,
    gating: GATING_SECTIONS.includes(sectionNumber),
  };
}

// ---------------------------------------------------------------------------
// Date helpers — TRID business-day math (weekends + US federal holidays)
// ---------------------------------------------------------------------------

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  // month is 0-indexed, weekday 0=Sun..6=Sat, n is 1-based occurrence
  const first = new Date(Date.UTC(year, month, 1));
  const firstWeekday = first.getUTCDay();
  let day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
  return new Date(Date.UTC(year, month, day));
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = new Date(Date.UTC(year, month + 1, 0));
  const lastWeekday = last.getUTCDay();
  const day = last.getUTCDate() - ((lastWeekday - weekday + 7) % 7);
  return new Date(Date.UTC(year, month, day));
}

function observedHoliday(date: Date): Date {
  // Federal holidays falling on Sat are observed Fri; on Sun observed Mon.
  const day = date.getUTCDay();
  if (day === 6) return new Date(date.getTime() - 24 * 60 * 60 * 1000);
  if (day === 0) return new Date(date.getTime() + 24 * 60 * 60 * 1000);
  return date;
}

function usFederalHolidays(year: number): Set<string> {
  const holidays: Date[] = [
    new Date(Date.UTC(year, 0, 1)), // New Year's Day
    nthWeekdayOfMonth(year, 0, 1, 3), // MLK Day - 3rd Mon Jan
    nthWeekdayOfMonth(year, 1, 1, 3), // Presidents Day - 3rd Mon Feb
    lastWeekdayOfMonth(year, 4, 1), // Memorial Day - last Mon May
    new Date(Date.UTC(year, 5, 19)), // Juneteenth
    new Date(Date.UTC(year, 6, 4)), // Independence Day
    nthWeekdayOfMonth(year, 8, 1, 1), // Labor Day - 1st Mon Sep
    nthWeekdayOfMonth(year, 9, 1, 2), // Columbus Day - 2nd Mon Oct
    new Date(Date.UTC(year, 10, 11)), // Veterans Day
    nthWeekdayOfMonth(year, 10, 4, 4), // Thanksgiving - 4th Thu Nov
    new Date(Date.UTC(year, 11, 25)), // Christmas
  ];
  const set = new Set<string>();
  for (const h of holidays) {
    const obs = observedHoliday(h);
    set.add(obs.toISOString().split("T")[0]);
  }
  return set;
}

function isBusinessDay(date: Date, holidays: Set<string>): boolean {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  return !holidays.has(date.toISOString().split("T")[0]);
}

function holidaySetForRange(start: Date, end: Date): Set<string> {
  const years = new Set<number>();
  years.add(start.getUTCFullYear());
  years.add(end.getUTCFullYear());
  const set = new Set<string>();
  Array.from(years).forEach(y => {
    usFederalHolidays(y).forEach(h => set.add(h));
  });
  return set;
}

/** Returns the date `n` business days after `from` (excluding weekends + federal holidays). */
function addBusinessDays(from: Date, n: number): Date {
  const end = new Date(from.getTime() + Math.ceil(n / 5 + 2) * 7 * 24 * 60 * 60 * 1000);
  const holidays = holidaySetForRange(from, end);
  let count = 0;
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  while (count < n) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isBusinessDay(cursor, holidays)) count++;
  }
  return cursor;
}

/** Returns the date `n` business days before `from` (excluding weekends + federal holidays). */
function subtractBusinessDays(from: Date, n: number): Date {
  const start = new Date(from.getTime() - Math.ceil(n / 5 + 2) * 7 * 24 * 60 * 60 * 1000);
  const holidays = holidaySetForRange(start, from);
  let count = 0;
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  while (count < n) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (isBusinessDay(cursor, holidays)) count++;
  }
  return cursor;
}

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  return isNaN(d.getTime()) ? null : d;
}

function yearsSince(dateStr: string | null | undefined): number | null {
  const d = parseDate(dateStr);
  if (!d) return null;
  const now = new Date();
  return (now.getTime() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Section scorers
// ---------------------------------------------------------------------------

function scorePersonalInfo(personalInfo: UrlaPersonalInfo | null | undefined): URLASectionScore {
  const fields = [
    { name: "First Name", value: personalInfo?.firstName, required: true },
    { name: "Last Name", value: personalInfo?.lastName, required: true },
    { name: "SSN", value: personalInfo?.ssn, required: true },
    { name: "Date of Birth", value: personalInfo?.dateOfBirth, required: true },
    { name: "Citizenship Status", value: personalInfo?.citizenship, required: true },
    { name: "Marital Status", value: personalInfo?.maritalStatus, required: true },
    { name: "Email", value: personalInfo?.email, required: false },
    { name: "Cell Phone", value: personalInfo?.cellPhone, required: false },
    { name: "Current Street Address", value: personalInfo?.currentStreet, required: true },
    { name: "Current City", value: personalInfo?.currentCity, required: true },
    { name: "Current State", value: personalInfo?.currentState, required: true },
    { name: "Current Zip", value: personalInfo?.currentZip, required: true },
    { name: "Housing Status", value: personalInfo?.currentHousingType, required: true },
  ];

  return scoreSection("Personal Information", "1a", fields);
}

function scoreEmployment(employment: EmploymentHistory[]): URLASectionScore {
  const currentEmployment = employment.find(e => e.employmentType === "current");
  const priorEmployment = employment.find(e => e.employmentType === "previous" || e.employmentType === "prior");

  // If the borrower has under two years at the current job, prior employer
  // becomes required (Fannie/Freddie 2-year history rule).
  const yearsAtCurrent = yearsSince(currentEmployment?.startDate);
  const needsPriorEmployer = yearsAtCurrent !== null && yearsAtCurrent < 2;

  const fields = [
    { name: "Employer Name", value: currentEmployment?.employerName, required: true },
    { name: "Position/Title", value: currentEmployment?.positionTitle, required: true },
    { name: "Start Date", value: currentEmployment?.startDate, required: true },
    { name: "Monthly Income", value: currentEmployment?.monthlyIncomeOrLoss, required: true },
    { name: "Business Phone", value: currentEmployment?.employerPhone, required: false },
    { name: "Employer Address", value: currentEmployment?.employerStreet, required: false },
    { name: "Self Employed", value: currentEmployment?.isSelfEmployed !== undefined && currentEmployment?.isSelfEmployed !== null, required: false },
    { name: "Prior Employer Name (2-year history required)", value: priorEmployment?.employerName, required: needsPriorEmployer },
    { name: "Prior Employer Start Date", value: priorEmployment?.startDate, required: needsPriorEmployer },
    { name: "Prior Employer End Date", value: priorEmployment?.endDate, required: needsPriorEmployer },
  ];

  return scoreSection("Employment & Income", "1b-1e", fields);
}

function scoreOtherIncome(otherIncome: OtherIncomeSource[]): URLASectionScore {
  // Other income (1f) is optional in aggregate, but when a source is declared
  // its source and amount become required for that entry.
  const hasSources = otherIncome.length > 0;
  const fields: { name: string; value: unknown; required: boolean }[] = [
    { name: "Other income reviewed", value: "yes", required: true },
  ];

  if (hasSources) {
    otherIncome.forEach((src, i) => {
      fields.push(
        { name: `Income Source #${i + 1} Type`, value: src.incomeSource, required: true },
        { name: `Income Source #${i + 1} Monthly Amount`, value: src.monthlyAmount, required: true },
      );
    });
  } else {
    fields.push({ name: "Additional income sources (if any)", value: null, required: false });
  }

  return scoreSection("Other Income", "1f", fields);
}

function scoreAssets(assets: UrlaAsset[]): URLASectionScore {
  const hasAssets = assets.length > 0;
  const totalValue = assets.reduce((sum, a) => sum + Number(a.cashOrMarketValue || 0), 0);

  const fields: { name: string; value: unknown; required: boolean }[] = [
    { name: "At least one asset account", value: hasAssets ? "yes" : null, required: true },
    { name: "Total Assets > $0", value: totalValue > 0 ? "yes" : null, required: true },
  ];

  if (assets.length > 0) {
    const firstAsset = assets[0];
    fields.push(
      { name: "Account Type", value: firstAsset.accountType, required: true },
      { name: "Financial Institution", value: firstAsset.financialInstitution, required: true },
      { name: "Account Balance", value: firstAsset.cashOrMarketValue, required: true },
    );
  }

  return scoreSection("Assets & Accounts", "2a", fields);
}

function scoreLiabilities(liabilities: UrlaLiability[]): URLASectionScore {
  // "Liabilities disclosed" reflects actual stored data: a borrower with at
  // least one liability row has affirmatively disclosed. A borrower with none
  // is treated as "no liabilities reported" (still a valid disclosure state),
  // so the section is satisfied either way but real liability details, when
  // present, must be complete.
  const fields: { name: string; value: unknown; required: boolean }[] = [
    { name: "Liabilities Disclosed", value: liabilities.length > 0 ? "yes" : "none reported", required: true },
  ];

  if (liabilities.length > 0) {
    const firstLiability = liabilities[0];
    fields.push(
      { name: "Liability Type", value: firstLiability.liabilityType, required: true },
      { name: "Creditor Name", value: firstLiability.creditorName, required: false },
      { name: "Monthly Payment", value: firstLiability.monthlyPayment, required: true },
      { name: "Unpaid Balance", value: firstLiability.unpaidBalance, required: false },
    );
  }

  return scoreSection("Liabilities & Debts", "2b", fields);
}

function scoreRealEstateOwned(reo: RealEstateOwned[]): URLASectionScore {
  // Section 2c (REO) is only meaningful when the borrower actually owns
  // property. Disclosure is derived from the real real_estate_owned rows
  // rather than a hardcoded assumption.
  const hasReo = reo.length > 0;
  const fields: { name: string; value: unknown; required: boolean }[] = [
    { name: "Real estate ownership reviewed", value: "yes", required: true },
  ];

  if (hasReo) {
    reo.forEach((p, i) => {
      fields.push(
        { name: `REO #${i + 1} Address`, value: p.propertyAddress, required: true },
        { name: `REO #${i + 1} Market Value`, value: p.marketValue, required: true },
        { name: `REO #${i + 1} Mortgage Balance`, value: p.mortgageBalance, required: true },
        { name: `REO #${i + 1} Occupancy/Status`, value: p.status || p.occupancyType, required: true },
      );
    });
  } else {
    fields.push({ name: "Owned properties (if any)", value: null, required: false });
  }

  return scoreSection("Real Estate Owned", "2c", fields);
}

function scorePropertyInfo(
  application: LoanApplication,
  propertyInfo: UrlaPropertyInfo | null | undefined
): URLASectionScore {
  const fields = [
    { name: "Property Address", value: propertyInfo?.propertyStreet || application.propertyAddress, required: true },
    { name: "Property City", value: propertyInfo?.propertyCity || application.propertyCity, required: true },
    { name: "Property State", value: propertyInfo?.propertyState || application.propertyState, required: true },
    { name: "Property Zip", value: propertyInfo?.propertyZip || application.propertyZip, required: true },
    { name: "Property Type", value: application.propertyType, required: true },
    { name: "Occupancy Type", value: propertyInfo?.occupancyType, required: true },
    { name: "Number of Units", value: propertyInfo?.numberOfUnits, required: false },
  ];

  return scoreSection("Property Information", "3", fields);
}

function scoreLoanInfo(application: LoanApplication): URLASectionScore {
  const loanAmount = application.purchasePrice && application.downPayment
    ? Number(application.purchasePrice) - Number(application.downPayment)
    : null;

  const fields = [
    { name: "Loan Purpose", value: application.loanPurpose, required: true },
    { name: "Loan Type", value: application.preferredLoanType, required: true },
    { name: "Amortization Type", value: application.amortizationType, required: true },
    { name: "Purchase Price", value: application.purchasePrice, required: true },
    { name: "Down Payment", value: application.downPayment, required: true },
    { name: "Loan Amount", value: loanAmount, required: true },
    { name: "Credit Score", value: application.creditScore, required: true },
    { name: "LTV Ratio", value: application.ltvRatio, required: false },
    { name: "DTI Ratio", value: application.dtiRatio, required: false },
  ];

  return scoreSection("Loan Details", "4", fields);
}

function scoreDeclarations(declarations: BorrowerDeclarations | null | undefined): URLASectionScore {
  const fields = [
    { name: "Primary Residence Intent", value: declarations?.willOccupyAsPrimaryResidence, required: true },
    { name: "Ownership Interest in Property", value: declarations?.hasOwnershipInterestInPast3Years, required: true },
    { name: "Money Borrowed for Transaction", value: declarations?.isBorrowingForDownPayment, required: true },
    { name: "Outstanding Judgments", value: declarations?.hasOutstandingJudgments, required: true },
    { name: "Delinquent Federal Debt", value: declarations?.isDelinquentOnFederalDebt, required: true },
    { name: "Lawsuit Party", value: declarations?.isPartyToLawsuit, required: true },
    { name: "Conveyed Title", value: declarations?.hasConveyedTitleInLieuOfForeclosure, required: true },
    { name: "Pre-Foreclosure", value: declarations?.hasBeenForeclosed, required: true },
    { name: "Bankruptcy Declaration", value: declarations?.hasDeclaredBankruptcy, required: true },
    { name: "US Citizen Status", value: declarations?.isUSCitizen, required: true },
  ];

  return scoreSection("Borrower Declarations", "5", fields);
}

function scoreMilitary(
  application: LoanApplication,
  profile: BorrowerProfile | null | undefined
): URLASectionScore {
  // Section 6 (Military Service) is only required when the borrower is pursuing
  // a VA loan; otherwise the fields are optional disclosures.
  const isVa = (application.preferredLoanType || "").toLowerCase() === "va";
  const fields = [
    { name: "Military Service Status", value: profile?.militaryStatus, required: isVa },
    { name: "Service Branch", value: profile?.militaryBranch, required: isVa },
    { name: "Service Start Date", value: profile?.militaryServiceStart, required: false },
    { name: "VA Entitlement / Funding Fee Status", value: (profile?.vaEntitlementUsed !== undefined && profile?.vaEntitlementUsed !== null) || (profile?.vaFundingFeeExempt !== undefined && profile?.vaFundingFeeExempt !== null) ? "yes" : null, required: isVa },
  ];

  return scoreSection("Military Service", "6", fields);
}

function scoreDemographics(demographic: HmdaDemographics | null | undefined): URLASectionScore {
  // Section 7 (HMDA/Demographic Information). A borrower's recorded REFUSAL to
  // provide is itself compliant collection under Reg C, so "not provided"
  // flags satisfy the requirement.
  const ethnicityCollected =
    demographic?.ethnicityHispanicLatino !== null && demographic?.ethnicityHispanicLatino !== undefined
    || !!demographic?.ethnicityNotHispanicLatino
    || !!demographic?.ethnicityNotProvided;

  const raceCollected =
    !!demographic?.raceAmericanIndian || !!demographic?.raceAsian || !!demographic?.raceBlack
    || !!demographic?.raceNativeHawaiian || !!demographic?.raceWhite || !!demographic?.raceNotProvided;

  const sexCollected =
    demographic?.sexFemale !== null && demographic?.sexFemale !== undefined
    || demographic?.sexMale !== null && demographic?.sexMale !== undefined
    || !!demographic?.sexNotProvided;

  const fields = [
    { name: "Ethnicity collected (or refusal recorded)", value: ethnicityCollected ? "yes" : null, required: true },
    { name: "Race collected (or refusal recorded)", value: raceCollected ? "yes" : null, required: true },
    { name: "Sex collected (or refusal recorded)", value: sexCollected ? "yes" : null, required: true },
    { name: "Collection Method", value: demographic?.collectionMethod, required: true },
  ];

  return scoreSection("Demographic Information", "7", fields);
}

// ---------------------------------------------------------------------------
// Regulatory validation: ARM, ATR/QM, HMDA LAR
// ---------------------------------------------------------------------------

function validateArm(application: LoanApplication): MISMOValidationResult["armValidation"] {
  const isAdjustable = (application.amortizationType || "").toLowerCase() === "adjustable";
  if (!isAdjustable) {
    return { applicable: false, valid: true, issues: [] };
  }

  const issues: string[] = [];
  if (!hasValue(application.armIndexType)) issues.push("ARM index type is required for adjustable-rate loans");
  if (!hasValue(application.armMargin)) issues.push("ARM margin is required for adjustable-rate loans");
  if (!hasValue(application.armInitialRate)) issues.push("ARM initial rate is required for adjustable-rate loans");
  if (!hasValue(application.armInitialCap)) issues.push("ARM initial adjustment cap is required");
  if (!hasValue(application.armPeriodicCap)) issues.push("ARM periodic adjustment cap is required");
  if (!hasValue(application.armLifetimeCap)) issues.push("ARM lifetime cap is required");
  if (!hasValue(application.armAdjustmentFrequencyMonths)) issues.push("ARM adjustment frequency is required");

  return { applicable: true, valid: issues.length === 0, issues };
}

function evaluatePointsAndFees(application: LoanApplication): {
  qmStatus: "QM" | "Non-QM" | "Unknown";
  compliant: boolean;
  issue: string | null;
} {
  const loanAmount = application.purchasePrice && application.downPayment
    ? Number(application.purchasePrice) - Number(application.downPayment)
    : null;
  const pointsAndFees = hasValue(application.totalPointsAndFees) ? Number(application.totalPointsAndFees) : null;

  if (loanAmount === null || loanAmount <= 0 || pointsAndFees === null) {
    return { qmStatus: "Unknown", compliant: true, issue: null };
  }

  // ATR/QM general 3% cap for loans >= $100,000 (Reg Z 1026.43(e)(3)).
  const cap = loanAmount * 0.03;
  if (pointsAndFees > cap) {
    return {
      qmStatus: "Non-QM",
      compliant: false,
      issue: `Points and fees ($${pointsAndFees.toFixed(2)}) exceed the 3% QM cap ($${cap.toFixed(2)}) for the loan amount`,
    };
  }
  return { qmStatus: "QM", compliant: true, issue: null };
}

function validateHmdaLar(application: LoanApplication): MISMOValidationResult["hmdaLar"] {
  const issues: string[] = [];
  const actionTaken = application.hmdaActionTaken;
  const actionTakenProvided = hasValue(actionTaken);

  if (!actionTakenProvided) {
    issues.push("HMDA action-taken code is required for LAR reporting");
  }

  const isDenied = (actionTaken || "").toLowerCase().includes("deni")
    || actionTaken === "3";
  const denialReasons = application.hmdaDenialReasons || [];
  let denialReasonsValid = true;

  if (isDenied) {
    if (denialReasons.length < 2) {
      denialReasonsValid = false;
      issues.push("At least 2 denial reasons are required when the application is denied (HMDA LAR)");
    }
  }

  return {
    actionTakenProvided,
    denialReasonsValid,
    issues,
  };
}

// ---------------------------------------------------------------------------
// Main validator
// ---------------------------------------------------------------------------

export async function validateMISMOCompleteness(applicationId: string): Promise<MISMOValidationResult> {
  const application = await storage.getLoanApplication(applicationId);
  if (!application) {
    throw new Error("Application not found");
  }

  const urlaData = await storage.getCompleteUrlaData(applicationId);
  const conditions = await storage.getLoanConditionsByApplication(applicationId);
  const documents = await storage.getDocumentsByApplication(applicationId);
  const borrowerProfile = await storage.getBorrowerProfileByUserId(application.userId);

  const hmdaRows = urlaData.hmdaDemographics || [];
  const primaryHmda =
    hmdaRows.find(h => (h.borrowerSequenceNumber ?? 1) === 1)
    || hmdaRows.find(h => h.borrowerId === application.userId)
    || hmdaRows[0];

  const personalInfoScore = scorePersonalInfo(urlaData.personalInfo);
  const employmentScore = scoreEmployment(urlaData.employmentHistory.filter(e => (e.borrowerSequenceNumber ?? 1) === 1));
  const otherIncomeScore = scoreOtherIncome(urlaData.otherIncomeSources);
  const assetsScore = scoreAssets(urlaData.assets.filter(a => (a.borrowerSequenceNumber ?? 1) === 1));
  const liabilitiesScore = scoreLiabilities(urlaData.liabilities.filter(l => (l.borrowerSequenceNumber ?? 1) === 1));
  const reoScore = scoreRealEstateOwned(urlaData.realEstateOwned);
  const propertyScore = scorePropertyInfo(application, urlaData.propertyInfo);
  const loanScore = scoreLoanInfo(application);
  const declarationsScore = scoreDeclarations(urlaData.declarations);
  const militaryScore = scoreMilitary(application, borrowerProfile);
  const demographicsScore = scoreDemographics(primaryHmda);

  const sections = [
    personalInfoScore,
    employmentScore,
    otherIncomeScore,
    assetsScore,
    liabilitiesScore,
    reoScore,
    propertyScore,
    loanScore,
    declarationsScore,
    militaryScore,
    demographicsScore,
  ];

  // -------------------------------------------------------------------------
  // Co-applicant scoring (scored independently from the primary borrower).
  // -------------------------------------------------------------------------
  const coApplicants: CoApplicantScore[] = [];
  let coApplicantLimitation: string | null = null;

  const coEmploymentSeqs = new Set(
    urlaData.employmentHistory
      .map(e => e.borrowerSequenceNumber ?? 1)
      .filter(seq => seq > 1)
  );
  const coAssetSeqs = new Set(
    urlaData.assets.map(a => a.borrowerSequenceNumber ?? 1).filter(seq => seq > 1)
  );
  const coLiabilitySeqs = new Set(
    urlaData.liabilities.map(l => l.borrowerSequenceNumber ?? 1).filter(seq => seq > 1)
  );
  const coHmda = hmdaRows.filter(h => (h.borrowerSequenceNumber ?? 1) > 1);
  const coHmdaSeqs = new Set(coHmda.map(h => h.borrowerSequenceNumber ?? 1));
  const coPersonalInfoSeqs = new Set(
    (urlaData.allPersonalInfo || [])
      .map(p => p.borrowerSequenceNumber ?? 1)
      .filter(seq => seq > 1)
  );
  const coDeclarationSeqs = new Set(
    (urlaData.allDeclarations || [])
      .map(d => d.borrowerSequenceNumber ?? 1)
      .filter(seq => seq > 1)
  );

  const coSequences = new Set<number>([
    ...Array.from(coPersonalInfoSeqs),
    ...Array.from(coEmploymentSeqs),
    ...Array.from(coAssetSeqs),
    ...Array.from(coLiabilitySeqs),
    ...Array.from(coDeclarationSeqs),
    ...Array.from(coHmdaSeqs),
  ]);

  for (const seq of Array.from(coSequences).sort((a, b) => a - b)) {
    const coEmployment = urlaData.employmentHistory.filter(e => (e.borrowerSequenceNumber ?? 1) === seq);
    const coAssets = urlaData.assets.filter(a => (a.borrowerSequenceNumber ?? 1) === seq);
    const coLiabilities = urlaData.liabilities.filter(l => (l.borrowerSequenceNumber ?? 1) === seq);
    const coDemographic = coHmda.find(h => (h.borrowerSequenceNumber ?? 1) === seq);
    const coPersonal = (urlaData.allPersonalInfo || []).find(p => (p.borrowerSequenceNumber ?? 1) === seq);
    const coName = coPersonal
      ? [coPersonal.firstName, coPersonal.lastName].filter(Boolean).join(" ").trim() || null
      : null;

    coApplicants.push({
      borrowerSequenceNumber: seq,
      name: coName,
      sections: [
        scoreEmployment(coEmployment),
        scoreAssets(coAssets),
        scoreLiabilities(coLiabilities),
        scoreDemographics(coDemographic),
      ],
    });
  }

  // Surface a limitation note when the application indicates a co-borrower
  // exists but the data model holds no per-co-applicant URLA rows yet.
  const declaresCoBorrower =
    !!borrowerProfile?.hasCoBorrower
    || hasValue(urlaData.personalInfo?.coBorrowerNames)
    || (urlaData.personalInfo?.totalBorrowers ?? 1) > 1;
  if (declaresCoBorrower && coApplicants.length === 0) {
    coApplicantLimitation =
      "A co-borrower is indicated for this application, but no per-co-applicant URLA records are stored. Co-applicant personal info, employment, assets, liabilities, declarations, and demographics must be captured (borrowerSequenceNumber > 1) to be scored independently.";
  }

  const overallScore = Math.round(
    sections.reduce((sum, s) => sum + s.completeness, 0) / sections.length
  );

  const criticalErrors: string[] = [];
  const warnings: string[] = [];

  sections.forEach(section => {
    section.missingFields.forEach(field => {
      criticalErrors.push(`${section.section}: ${field} is required`);
    });
    section.warnings.forEach(warning => {
      warnings.push(`${section.section}: ${warning}`);
    });
  });

  coApplicants.forEach(co => {
    const coLabel = co.name
      ? `Co-applicant #${co.borrowerSequenceNumber} (${co.name})`
      : `Co-applicant #${co.borrowerSequenceNumber}`;
    co.sections.forEach(section => {
      section.missingFields.forEach(field => {
        criticalErrors.push(`${coLabel} ${section.section}: ${field} is required`);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Regulatory validation
  // -------------------------------------------------------------------------
  const armValidation = validateArm(application);
  armValidation.issues.forEach(i => criticalErrors.push(`ARM: ${i}`));

  const pointsAndFees = evaluatePointsAndFees(application);
  if (pointsAndFees.issue) {
    criticalErrors.push(`ATR/QM: ${pointsAndFees.issue}`);
  }

  const hmdaLar = validateHmdaLar(application);
  hmdaLar.issues.forEach(i => warnings.push(`HMDA LAR: ${i}`));

  // -------------------------------------------------------------------------
  // Documents
  // -------------------------------------------------------------------------
  const outstandingConditions = conditions.filter(c => c.status === "outstanding");
  const requiredDocTypes = outstandingConditions
    .flatMap(c => c.requiredDocumentTypes || [])
    .filter((v, i, a) => a.indexOf(v) === i);

  const uploadedDocTypes = documents.map(d => d.documentType);
  const missingDocuments = requiredDocTypes.filter(t => !uploadedDocTypes.includes(t));

  // -------------------------------------------------------------------------
  // TRID date math (business days, excluding weekends + federal holidays)
  // -------------------------------------------------------------------------
  const createdAt = parseDate(application.createdAt) || new Date();
  // LE must be delivered/placed in the mail no later than 3 business days
  // after application (Reg Z 1026.19(e)(1)(iii)).
  const leDueDate = addBusinessDays(createdAt, 3);

  const closingDate = parseDate(application.closingDate);
  // CD must be received by the borrower at least 3 business days before
  // consummation (Reg Z 1026.19(f)(1)(ii)).
  const cdDueDate = closingDate ? subtractBusinessDays(closingDate, 3) : null;

  const leIssued = hasValue(application.leIssuedDate);
  const cdIssued = hasValue(application.cdIssuedDate);

  // -------------------------------------------------------------------------
  // GSE / ULDD gating
  // -------------------------------------------------------------------------
  const gatingSections = sections.filter(s => s.gating);
  const gseGatingFailed = gatingSections.some(s => s.missingFields.length > 0);

  const gseReady =
    overallScore >= 90 &&
    !gseGatingFailed &&
    criticalErrors.length === 0 &&
    missingDocuments.length === 0 &&
    armValidation.valid &&
    pointsAndFees.compliant;

  const ulddCompliant =
    overallScore >= 80 &&
    !gseGatingFailed &&
    personalInfoScore.completeness >= 90 &&
    loanScore.completeness >= 90;

  return {
    applicationId,
    overallScore,
    gseReady,
    gseGatingFailed,
    ulddCompliant,
    sections,
    coApplicants,
    coApplicantLimitation,
    criticalErrors,
    warnings,
    missingDocuments,
    qmStatus: pointsAndFees.qmStatus,
    pointsAndFeesCompliant: pointsAndFees.compliant,
    armValidation,
    hmdaLar,
    tridStatus: {
      leRequired: application.status !== "draft",
      leDueDate,
      leIssued,
      cdRequired: application.status === "clear_to_close",
      cdDueDate,
      cdIssued,
    },
  };
}

export async function getApplicationValidationSummary(applicationId: string) {
  const validation = await validateMISMOCompleteness(applicationId);

  return {
    applicationId,
    score: validation.overallScore,
    gseReady: validation.gseReady,
    gseGatingFailed: validation.gseGatingFailed,
    ulddCompliant: validation.ulddCompliant,
    qmStatus: validation.qmStatus,
    criticalCount: validation.criticalErrors.length,
    warningCount: validation.warnings.length,
    missingDocsCount: validation.missingDocuments.length,
    coApplicantCount: validation.coApplicants.length,
    coApplicants: validation.coApplicants.map(co => ({
      borrowerSequenceNumber: co.borrowerSequenceNumber,
      name: co.name,
    })),
    sections: validation.sections.map(s => ({
      name: s.section,
      number: s.sectionNumber,
      score: s.completeness,
      complete: s.completeness >= 90,
      gating: !!s.gating,
    })),
  };
}

export async function getBatchValidationStatus(applicationIds: string[]) {
  const results = await Promise.all(
    applicationIds.map(id => getApplicationValidationSummary(id).catch(() => null))
  );

  return results.filter(r => r !== null);
}
