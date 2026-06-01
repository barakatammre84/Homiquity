import { storage } from "../storage";
import type { 
  LoanApplication, 
  UrlaPersonalInfo, 
  EmploymentHistory, 
  UrlaAsset, 
  UrlaLiability,
  UrlaPropertyInfo,
  BorrowerDeclarations,
} from "@shared/schema";

export interface URLASectionScore {
  section: string;
  sectionNumber: string;
  completeness: number;
  requiredFields: number;
  completedFields: number;
  missingFields: string[];
  warnings: string[];
}

export interface MISMOValidationResult {
  applicationId: string;
  overallScore: number;
  gseReady: boolean;
  ulddCompliant: boolean;
  sections: URLASectionScore[];
  criticalErrors: string[];
  warnings: string[];
  missingDocuments: string[];
  tridStatus: {
    leRequired: boolean;
    leDueDate: Date | null;
    leIssued: boolean;
    cdRequired: boolean;
    cdDueDate: Date | null;
    cdIssued: boolean;
  };
}

function scoreSection(
  sectionName: string,
  sectionNumber: string,
  fields: { name: string; value: unknown; required: boolean }[]
): URLASectionScore {
  const requiredFields = fields.filter(f => f.required);
  const completedRequired = requiredFields.filter(f => 
    f.value !== null && f.value !== undefined && f.value !== ""
  );
  const missingFields = requiredFields
    .filter(f => f.value === null || f.value === undefined || f.value === "")
    .map(f => f.name);
  
  const optionalFields = fields.filter(f => !f.required);
  const completedOptional = optionalFields.filter(f => 
    f.value !== null && f.value !== undefined && f.value !== ""
  );
  
  const warnings = optionalFields
    .filter(f => f.value === null || f.value === undefined || f.value === "")
    .map(f => `${f.name} is recommended but not provided`);

  const requiredWeight = 0.8;
  const optionalWeight = 0.2;
  
  const requiredScore = requiredFields.length > 0 
    ? (completedRequired.length / requiredFields.length) * requiredWeight 
    : requiredWeight;
  const optionalScore = optionalFields.length > 0 
    ? (completedOptional.length / optionalFields.length) * optionalWeight 
    : optionalWeight;
  
  return {
    section: sectionName,
    sectionNumber,
    completeness: Math.round((requiredScore + optionalScore) * 100),
    requiredFields: requiredFields.length,
    completedFields: completedRequired.length,
    missingFields,
    warnings: warnings.slice(0, 3),
  };
}

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
  
  const fields = [
    { name: "Employer Name", value: currentEmployment?.employerName, required: true },
    { name: "Position/Title", value: currentEmployment?.positionTitle, required: true },
    { name: "Start Date", value: currentEmployment?.startDate, required: true },
    { name: "Monthly Income", value: currentEmployment?.monthlyIncomeOrLoss, required: true },
    { name: "Business Phone", value: currentEmployment?.employerPhone, required: false },
    { name: "Employer Address", value: currentEmployment?.employerStreet, required: false },
    { name: "Self Employed", value: currentEmployment?.isSelfEmployed !== undefined, required: false },
  ];
  
  return scoreSection("Employment & Income", "1b-1e", fields);
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
  const fields: { name: string; value: unknown; required: boolean }[] = [
    { name: "Liabilities Disclosed", value: "yes", required: true },
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

export async function validateMISMOCompleteness(applicationId: string): Promise<MISMOValidationResult> {
  const application = await storage.getLoanApplication(applicationId);
  if (!application) {
    throw new Error("Application not found");
  }

  const urlaData = await storage.getCompleteUrlaData(applicationId);
  const conditions = await storage.getLoanConditionsByApplication(applicationId);
  const documents = await storage.getDocumentsByApplication(applicationId);

  const personalInfoScore = scorePersonalInfo(urlaData.personalInfo);
  const employmentScore = scoreEmployment(urlaData.employmentHistory);
  const assetsScore = scoreAssets(urlaData.assets);
  const liabilitiesScore = scoreLiabilities(urlaData.liabilities);
  const propertyScore = scorePropertyInfo(application, urlaData.propertyInfo);
  const loanScore = scoreLoanInfo(application);
  const declarationsScore = scoreDeclarations(urlaData.declarations);

  const sections = [
    personalInfoScore,
    employmentScore,
    assetsScore,
    liabilitiesScore,
    propertyScore,
    loanScore,
    declarationsScore,
  ];

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

  const outstandingConditions = conditions.filter(c => c.status === "outstanding");
  const requiredDocTypes = outstandingConditions
    .flatMap(c => c.requiredDocumentTypes || [])
    .filter((v, i, a) => a.indexOf(v) === i);
  
  const uploadedDocTypes = documents.map(d => d.documentType);
  const missingDocuments = requiredDocTypes.filter(t => !uploadedDocTypes.includes(t));

  const createdAt = application.createdAt ? new Date(application.createdAt) : new Date();
  const threeDaysLater = new Date(createdAt);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);

  const gseReady = overallScore >= 90 && criticalErrors.length === 0 && missingDocuments.length === 0;
  const ulddCompliant = overallScore >= 80 && 
    personalInfoScore.completeness >= 90 && 
    loanScore.completeness >= 90;

  return {
    applicationId,
    overallScore,
    gseReady,
    ulddCompliant,
    sections,
    criticalErrors,
    warnings,
    missingDocuments,
    tridStatus: {
      leRequired: application.status !== "draft",
      leDueDate: threeDaysLater,
      leIssued: false,
      cdRequired: application.status === "clear_to_close",
      cdDueDate: null,
      cdIssued: false,
    },
  };
}

export async function getApplicationValidationSummary(applicationId: string) {
  const validation = await validateMISMOCompleteness(applicationId);
  
  return {
    applicationId,
    score: validation.overallScore,
    gseReady: validation.gseReady,
    ulddCompliant: validation.ulddCompliant,
    criticalCount: validation.criticalErrors.length,
    warningCount: validation.warnings.length,
    missingDocsCount: validation.missingDocuments.length,
    sections: validation.sections.map(s => ({
      name: s.section,
      number: s.sectionNumber,
      score: s.completeness,
      complete: s.completeness >= 90,
    })),
  };
}

export async function getBatchValidationStatus(applicationIds: string[]) {
  const results = await Promise.all(
    applicationIds.map(id => getApplicationValidationSummary(id).catch(() => null))
  );
  
  return results.filter(r => r !== null);
}
