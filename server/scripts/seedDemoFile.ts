/**
 * Demo/beta seed: build ONE fully-complete borrower file so the founder can
 * walk a wholesale lender from readiness → MISMO package → lender submission
 * live, without hand-entering a full URLA. The file seeds everything except
 * the AUS run — the submission gate requires a recorded DU/LPA run, so the
 * walkthrough includes one "Run DU / LPA" click in the readiness dialog
 * (the seeded profile simulates to approve_eligible).
 *
 * Self-contained: creates a demo borrower + application, assigns the dev test
 * loan officer (test-lo), then populates every URLA section, the loan-level
 * fields, the demographics/HMDA record, and the anti-steering + e-disclosure
 * consents — everything the broker submission-readiness gate checks. Idempotent
 * enough for repeated runs (creates a fresh application each time).
 *
 * Run against the shared dev DB (never in prod):
 *   ./node_modules/.bin/tsx server/scripts/seedDemoFile.ts
 *
 * Prints the new applicationId and the readiness verdict.
 */
import { storage } from "../storage";
import { finalizeIntake } from "../services/loanAnalysis";
import { evaluateBrokerSubmissionReadiness } from "../services/brokerSubmissionReadiness";

const LO_ID = process.env.SEED_LO_ID || "test-lo"; // dev test-login upserts this id for lo@test.com

async function main() {
  // 1) Demo borrower.
  const borrower = await storage.upsertUser({
    id: "demo-borrower-1",
    email: "demo.borrower@homiquity.test",
    firstName: "Jordan",
    lastName: "Rivera",
    profileImageUrl: null,
    role: "aspiring_owner",
  });

  // 2) Application with loan-level fields already set.
  const app = await storage.createLoanApplication({
    userId: borrower.id,
    status: "submitted",
    annualIncome: "132000",
    monthlyDebts: "650",
    creditScore: 744,
    employmentType: "employed",
    employmentYears: 6,
    propertyType: "single_family",
    purchasePrice: "465000",
    downPayment: "93000",
    loanPurpose: "purchase",
    isVeteran: false,
    isFirstTimeBuyer: true,
    propertyState: "TX",
    propertyAddress: "1420 Maple Grove Lane",
    propertyCity: "Austin",
    propertyZip: "78745",
    propertyValue: "465000",
    preferredLoanType: "conventional",
    amortizationType: "fixed",
  } as any);
  const applicationId = app.id;
  console.log(`created application ${applicationId} for ${borrower.firstName} ${borrower.lastName}`);

  // 3) Put it on the loan officer's desk (grants access + queue via the A2 chokepoint).
  await storage.assignLoanOfficer(applicationId, LO_ID, LO_ID);

  // 4) URLA — personal info (section 1a).
  await storage.upsertUrlaPersonalInfo({
    applicationId,
    borrowerSequenceNumber: 1,
    isPrimaryBorrower: true,
    firstName: "Jordan",
    lastName: "Rivera",
    ssn: "123456789",
    dateOfBirth: "1986-04-12",
    citizenship: "us_citizen",
    maritalStatus: "unmarried",
    email: "demo.borrower@homiquity.test",
    cellPhone: "512-555-0142",
    currentStreet: "77 Birchwood Terrace",
    currentCity: "Austin",
    currentState: "TX",
    currentZip: "78704",
    currentHousingType: "rent",
  } as any);

  // 5) Employment (section 1b / 4).
  await storage.createEmploymentHistory({
    applicationId,
    borrowerSequenceNumber: 1,
    employmentType: "current",
    employerName: "Lone Star Analytics LLC",
    positionTitle: "Senior Data Engineer",
    startDate: "2019-03-01",
    baseIncome: "11000",
    monthlyIncomeOrLoss: "11000",
  } as any);

  // 6) Assets (section 2).
  await storage.createUrlaAsset({
    applicationId,
    borrowerSequenceNumber: 1,
    accountType: "checking",
    financialInstitution: "Frost Bank",
    cashOrMarketValue: "58000",
  } as any);

  // 7) Subject property (section 4).
  await storage.upsertUrlaPropertyInfo({
    applicationId,
    propertyStreet: "1420 Maple Grove Lane",
    propertyCity: "Austin",
    propertyState: "TX",
    propertyZip: "78745",
    occupancyType: "primary_residence",
    propertyValue: "465000",
  } as any);

  // 8) Declarations (section 5).
  await storage.upsertBorrowerDeclarations({
    applicationId,
    borrowerSequenceNumber: 1,
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
  } as any);

  // 9) HMDA demographics (refusal recorded — lawful).
  await storage.upsertHmdaDemographics({
    applicationId,
    borrowerId: borrower.id,
    borrowerSequenceNumber: 1,
    ethnicityNotProvided: true,
    raceNotProvided: true,
    sexNotProvided: true,
    collectionMethod: "loan_officer",
  } as any);

  // 10) Consents: anti-steering (Reg Z §1026.36(e)(3)) + e-disclosure (ESIGN).
  for (const consentType of ["anti_steering", "e_disclosure"]) {
    await storage.createBorrowerConsent({
      userId: borrower.id,
      applicationId,
      consentType,
      consentGiven: true,
      consentMethod: "click",
      templateVersion: "1.0",
    } as any);
  }

  // 11) Run the deterministic intake decision so the file looks processed, then
  //     clear the document conditions it raises (the LO has collected them).
  try {
    await finalizeIntake(applicationId);
  } catch (e) {
    console.warn("finalizeIntake (non-fatal):", (e as Error).message);
  }
  const conditions = await storage.getLoanConditionsByApplication(applicationId);
  let cleared = 0;
  for (const c of conditions) {
    if (c.status === "outstanding") {
      await storage.updateLoanCondition(c.id, { status: "cleared" } as any);
      cleared++;
    }
  }
  console.log(`cleared ${cleared} outstanding condition(s)`);

  // 12) Readiness verdict.
  const readiness = await evaluateBrokerSubmissionReadiness(applicationId);
  console.log(`\nreadyToSubmitToLender = ${readiness.readyToSubmitToLender}`);
  for (const s of readiness.stages) {
    console.log(`  [${s.status}] ${s.label}`);
    for (const b of s.blockers) console.log(`      BLOCKER: ${b}`);
  }
  if (!readiness.readyToSubmitToLender) {
    console.log(
      `\nNote: stage 2 needs a recorded AUS run — open the submission dialog in the LO Command Center and click "Run DU / LPA" to clear it.`,
    );
  }
  console.log(`\nDEMO_APP_ID=${applicationId}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
