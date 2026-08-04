/**
 * MISMO 3.4 XML Generation Service
 * 
 * Generates compliant MISMO 3.4 XML for loan delivery to GSEs (Fannie Mae, Freddie Mac)
 * Supports ULDD Phase 5 requirements effective July 28, 2025
 */

import type { 
  LoanApplication, 
  User, 
  UrlaPersonalInfo, 
  EmploymentHistory, 
  UrlaAsset, 
  UrlaLiability,
  UrlaPropertyInfo,
  LoanOption,
  Document,
  BorrowerDeclarations,
} from "@shared/schema";
import { isApprovedGradeLoanAppStatus } from "@shared/schema";
import { COMPANY_CONFIG } from "./config/company";
import { mersOrgIdApplicable } from "@shared/businessChannel";
import {
  MISMO_NAMESPACE,
  XLINK_NAMESPACE,
  XSI_NAMESPACE,
  type MortgageType,
  type LoanPurposeType,
  type PropertyUsageType,
  type AssetType,
  type LiabilityType,
} from "@shared/mismo";

export interface MISMOLoanDTO {
  application: LoanApplication;
  user: User | null;
  // `ssn` is a virtual field: SSNs are encrypted at rest, and
  // storage.getMISMOLoanData() decrypts the full value onto the record because
  // GSE loan delivery (TaxpayerIdentifierValue) requires it.
  personalInfo: (UrlaPersonalInfo & { ssn?: string | null }) | null;
  employment: EmploymentHistory[];
  // Asset/liability `accountNumber` is likewise a decrypted virtual field.
  assets: (UrlaAsset & { accountNumber?: string | null })[];
  liabilities: (UrlaLiability & { accountNumber?: string | null })[];
  propertyInfo: UrlaPropertyInfo | null;
  declarations: BorrowerDeclarations | null;
  loanOptions: LoanOption[];
  documents: Document[];
}

export function generateLuhnCheckDigit(digits: string): number {
  // The MERS MIN is an all-numeric identifier; any non-digit (e.g. hex from a
  // UUID-derived loan number, or a non-numeric org id) would map through
  // Number() to NaN and silently corrupt the check digit. Fail loudly instead.
  if (!/^\d+$/.test(digits)) {
    throw new Error(`generateLuhnCheckDigit requires a numeric string, received: "${digits}"`);
  }
  const digitsArray = digits.split("").map(Number);
  let checksum = 0;
  let isDouble = true;

  for (let i = digitsArray.length - 1; i >= 0; i--) {
    let digit = digitsArray[i];
    if (isDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    checksum += digit;
    isDouble = !isDouble;
  }

  return (10 - (checksum % 10)) % 10;
}

export function generateMERSMIN(orgId: string, loanNumber: string): string {
  const appId = "100";
  // Both segments must be numeric and fit their fixed width. Strip any
  // formatting, then validate — we would rather throw than emit a MIN whose
  // Luhn check digit is NaN (which a GSE/investor ingestion will reject).
  const numericOrgId = orgId.replace(/\D/g, "");
  const numericLoanNumber = loanNumber.replace(/\D/g, "");
  if (numericOrgId.length === 0 || numericOrgId.length > 7) {
    throw new Error(`MERS Org ID must be 1-7 digits, received: "${orgId}"`);
  }
  if (numericLoanNumber.length === 0 || numericLoanNumber.length > 7) {
    throw new Error(`MERS loan number must be 1-7 digits, received: "${loanNumber}"`);
  }
  const paddedOrgId = numericOrgId.padStart(7, "0");
  const paddedLoanNumber = numericLoanNumber.padStart(7, "0");

  const minPrefix = appId + paddedOrgId + paddedLoanNumber;
  const checkDigit = generateLuhnCheckDigit(minPrefix);

  return minPrefix + checkDigit.toString();
}

export function validateMERSMIN(min: string): boolean {
  if (min.length !== 18) return false;
  
  const prefix = min.substring(0, 17);
  const providedCheckDigit = parseInt(min.charAt(17), 10);
  const calculatedCheckDigit = generateLuhnCheckDigit(prefix);
  
  return providedCheckDigit === calculatedCheckDigit;
}

function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  // A malformed date string produces an Invalid Date whose toISOString() throws
  // a RangeError and would abort the entire export. Drop the value instead.
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

// DB decimal columns arrive as plain numeric strings, but hand-entered values
// can carry currency formatting ("$1,234.56"). parseFloat("$1,234") is NaN and
// parseFloat("1,234") is 1 — both silently corrupt the amount — so strip the
// formatting first and fall back to "0.00" rather than emitting a literal "NaN".
function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "0.00";
  const num = typeof amount === "string" ? parseFloat(amount.replace(/[$,\s]/g, "")) : amount;
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
}

function formatPercent(rate: number | string | null | undefined): string {
  if (rate === null || rate === undefined) return "0.000";
  const num = typeof rate === "string" ? parseFloat(rate.replace(/[%,\s]/g, "")) : rate;
  return Number.isFinite(num) ? num.toFixed(3) : "0.000";
}

function mapMortgageType(loanType: string | null | undefined): MortgageType {
  const mapping: Record<string, MortgageType> = {
    conventional: "Conventional",
    fha: "FHA",
    va: "VA",
    usda: "USDA",
  };
  return mapping[loanType?.toLowerCase() || ""] || "Conventional";
}

function mapLoanPurpose(purpose: string | null | undefined): LoanPurposeType {
  const p = purpose?.toLowerCase() || "";
  // ULDD LoanPurposeTypeEnumerated = {MortgageModification, Other, Purchase, Refinance}
  // (verified vs docs/fannie-mae/schemas MISMO_3_0.xsd + golden UCD samples; ledger
  // uldd-loanpurposetype-enum). Cash-out is NOT a LoanPurposeType value — a cash-out or
  // rate/term refi is LoanPurposeType=Refinance, with the cash-out fact carried separately
  // by REFINANCE/RefinanceCashOutDeterminationType (follow-up, tracked with the F-018 restructure).
  if (p === "purchase") return "Purchase";
  if (p === "refinance" || p === "cash_out_refinance" || p === "cash_out" || p === "no_cash_out_refinance") {
    return "Refinance";
  }
  if (p === "construction") {
    // U-7: the base ULDD XSD has no Construction LoanPurposeType value. Fail loud rather than
    // emit an out-of-enum value that fails GSE ingestion (pending ULDD data-dictionary confirmation).
    throw new Error(
      "MISMO LoanPurposeType: construction loan purpose is unmapped — no valid ULDD enum value (escalation U-7, pending source confirmation)",
    );
  }
  return "Purchase";
}

function mapPropertyUsage(usage: string | null | undefined): PropertyUsageType {
  const mapping: Record<string, PropertyUsageType> = {
    primary_residence: "PrimaryResidence",
    primary: "PrimaryResidence",
    second_home: "SecondHome",
    secondary: "SecondHome",
    investment: "Investment",
    investment_property: "Investment",
  };
  return mapping[usage?.toLowerCase() || ""] || "PrimaryResidence";
}

function mapAssetType(type: string | null | undefined): AssetType {
  const mapping: Record<string, AssetType> = {
    checking: "CheckingAccount",
    checking_account: "CheckingAccount",
    savings: "SavingsAccount",
    savings_account: "SavingsAccount",
    money_market: "MoneyMarketFund",
    money_market_account: "MoneyMarketFund",
    cd: "CertificateOfDepositTimeDeposit",
    certificate_of_deposit: "CertificateOfDepositTimeDeposit",
    stocks: "Stock",
    stock: "Stock",
    bonds: "Bond",
    bond: "Bond",
    retirement: "RetirementFund",
    retirement_account: "RetirementFund",
    mutual_fund: "MutualFund",
    ira: "RetirementFund",
    "401k": "RetirementFund",
    other: "Other",
  };
  return mapping[type?.toLowerCase() || ""] || "Other";
}

function mapLiabilityType(type: string | null | undefined): LiabilityType {
  const mapping: Record<string, LiabilityType> = {
    credit_card: "Revolving",
    revolving: "Revolving",
    auto_loan: "Installment",
    car_loan: "Installment",
    student_loan: "Installment",
    mortgage: "Mortgage",
    home_equity: "Mortgage",
    personal_loan: "Installment",
    installment: "Installment",
    child_support: "ChildSupport",
    alimony: "Alimony",
    other: "Other",
  };
  return mapping[type?.toLowerCase() || ""] || "Other";
}

interface XMLNode {
  tag: string;
  attributes?: Record<string, string>;
  children?: (XMLNode | string)[];
  text?: string;
}

function buildXmlNode(node: XMLNode, indent: number = 0): string {
  const spaces = "  ".repeat(indent);
  const attrs = node.attributes
    ? " " + Object.entries(node.attributes)
        .map(([k, v]) => `${k}="${escapeXml(v)}"`)
        .join(" ")
    : "";

  if (node.text !== undefined && node.text !== null && node.text !== "") {
    return `${spaces}<${node.tag}${attrs}>${escapeXml(String(node.text))}</${node.tag}>`;
  }

  if (!node.children || node.children.length === 0) {
    return `${spaces}<${node.tag}${attrs}/>`;
  }

  const childContent = node.children
    .filter(child => child !== null && child !== undefined)
    .map(child => {
      if (typeof child === "string") {
        return escapeXml(child);
      }
      return buildXmlNode(child, indent + 1);
    })
    .filter(content => content.trim() !== "")
    .join("\n");

  if (childContent.trim() === "") {
    return "";
  }

  return `${spaces}<${node.tag}${attrs}>\n${childContent}\n${spaces}</${node.tag}>`;
}

function buildAddressNode(
  street: string | null | undefined,
  unit: string | null | undefined,
  city: string | null | undefined,
  state: string | null | undefined,
  zip: string | null | undefined,
  county?: string | null | undefined,
  tagName: string = "ADDRESS"
): XMLNode | null {
  const children: XMLNode[] = [];

  if (street) {
    children.push({ tag: "AddressLineText", text: street });
  }
  if (unit) {
    children.push({ tag: "AddressUnitIdentifier", text: unit });
  }
  if (city) {
    children.push({ tag: "CityName", text: city });
  }
  if (state) {
    children.push({ tag: "StateCode", text: state });
  }
  if (zip) {
    children.push({ tag: "PostalCode", text: zip });
  }
  if (county) {
    children.push({ tag: "CountyName", text: county });
  }
  children.push({ tag: "CountryCode", text: "US" });

  if (children.length === 1) return null;

  return { tag: tagName, children };
}

function buildBorrowerNode(dto: MISMOLoanDTO): XMLNode {
  const { personalInfo, employment, declarations } = dto;
  const borrowerChildren: XMLNode[] = [];

  const borrowerDetail: XMLNode[] = [];
  if (personalInfo?.dateOfBirth) {
    borrowerDetail.push({ tag: "BorrowerBirthDate", text: personalInfo.dateOfBirth });
  }
  if (personalInfo?.ssn) {
    borrowerDetail.push({ tag: "BorrowerSSNIdentifier", text: personalInfo.ssn.replace(/-/g, "") });
  }
  borrowerDetail.push({ tag: "BorrowerClassificationType", text: "Primary" });
  if (personalInfo?.maritalStatus) {
    const maritalMap: Record<string, string> = {
      married: "Married",
      unmarried: "Unmarried",
      separated: "Separated",
    };
    borrowerDetail.push({ 
      tag: "MaritalStatusType", 
      text: maritalMap[personalInfo.maritalStatus?.toLowerCase()] || "Unmarried" 
    });
  }

  if (borrowerDetail.length > 0) {
    borrowerChildren.push({ tag: "BORROWER_DETAIL", children: borrowerDetail });
  }

  if (declarations) {
    const declarationNode: XMLNode[] = [];
    
    // Helper to add boolean indicator if value is set
    const addBooleanIndicator = (tag: string, value: boolean | null | undefined) => {
      if (value !== null && value !== undefined) {
        declarationNode.push({ tag, text: value ? "true" : "false" });
      }
    };
    
    // Section 5a - Property and Money for Loan
    addBooleanIndicator("IntentToOccupyIndicator", declarations.willOccupyAsPrimaryResidence);
    addBooleanIndicator("HomeownerPastThreeYearsIndicator", declarations.hasOwnershipInterestInPast3Years);
    addBooleanIndicator("PropertySellerRelationshipIndicator", declarations.hasRelationshipWithSeller);
    addBooleanIndicator("BorrowedDownPaymentIndicator", declarations.isBorrowingForDownPayment);
    
    // URLA 5a-E: "Have you or will you be applying for a mortgage loan on another property?"
    // MortgageOnOtherPropertyIndicator covers both applied for AND credit extended on other properties
    addBooleanIndicator("MortgageOnOtherPropertyIndicator", declarations.hasAppliedForMortgageOnOtherProperty);
    // Note: hasCreditForMortgageOnOtherProperty is included as part of MortgageOnOtherPropertyIndicator per MISMO 3.4
    // NewMortgageOnOtherPropertyIndicator is for mortgages on the SUBJECT property, not other properties
    
    // Priority lien indicators - MISMO requires separate flags for presence vs payoff
    addBooleanIndicator("PriorityLienIndicator", declarations.hasPriorityLienOnSubjectProperty);
    
    // Section 5b - Finances
    addBooleanIndicator("CoMakerEndorserOfNoteIndicator", declarations.hasCoMakerEndorser);
    addBooleanIndicator("OutstandingJudgmentsIndicator", declarations.hasOutstandingJudgments);
    addBooleanIndicator("DelinquentPastDueIndicator", declarations.isDelinquentOnFederalDebt);
    addBooleanIndicator("PartyToLawsuitIndicator", declarations.isPartyToLawsuit);
    addBooleanIndicator("DeedInLieuIndicator", declarations.hasConveyedTitleInLieuOfForeclosure);
    addBooleanIndicator("ShortSaleIndicator", declarations.hasCompletedShortSale);
    addBooleanIndicator("LoanForeclosureIndicator", declarations.hasBeenForeclosed);
    addBooleanIndicator("BankruptcyIndicator", declarations.hasDeclaredBankruptcy);
    
    // Section 5c - Transaction
    addBooleanIndicator("UndisclosedBorrowedFundsIndicator", declarations.hasUndisclosedDebt);
    addBooleanIndicator("NewCreditIndicator", declarations.hasAppliedForNewCredit);
    addBooleanIndicator("PriorityLienPayoffIndicator", declarations.hasPriorityLienToBePaidOff);
    
    // Citizenship
    addBooleanIndicator("USCitizenIndicator", declarations.isUSCitizen);
    addBooleanIndicator("PermanentResidentAlienIndicator", declarations.isPermanentResidentAlien);
    
    if (declarationNode.length > 0) {
      borrowerChildren.push({ tag: "DECLARATION", children: declarationNode });
    }
  }

  if (employment.length > 0) {
    const employersNode: XMLNode[] = [];
    for (const emp of employment) {
      const employerChildren: XMLNode[] = [];
      if (emp.employerName) {
        employerChildren.push({ tag: "EmployerName", text: emp.employerName });
      }
      if (emp.employerPhone) {
        employerChildren.push({ tag: "EmployerTelephoneNumber", text: emp.employerPhone });
      }

      const empAddress = buildAddressNode(
        emp.employerStreet,
        emp.employerUnit,
        emp.employerCity,
        emp.employerState,
        emp.employerZip
      );
      if (empAddress) {
        employerChildren.push(empAddress);
      }

      const employmentDetail: XMLNode[] = [];
      if (emp.isSelfEmployed !== undefined) {
        employmentDetail.push({ 
          tag: "EmploymentBorrowerSelfEmployedIndicator", 
          text: emp.isSelfEmployed ? "true" : "false" 
        });
      }
      if (emp.totalMonthlyIncome) {
        employmentDetail.push({ 
          tag: "EmploymentMonthlyIncomeAmount", 
          text: formatCurrency(emp.totalMonthlyIncome) 
        });
      }
      if (emp.positionTitle) {
        employmentDetail.push({ 
          tag: "EmploymentPositionDescription", 
          text: emp.positionTitle 
        });
      }
      if (emp.startDate) {
        employmentDetail.push({ tag: "EmploymentStartDate", text: emp.startDate });
      }
      if (emp.endDate) {
        employmentDetail.push({ tag: "EmploymentEndDate", text: emp.endDate });
      }
      // MISMO EmploymentStatusType is Current | Previous. The employmentType
      // column holds free-text categories ("employed"/"self_employed"/…), never
      // this distinction, so the old `=== "current"` check tagged nearly every
      // active job "Previous". Key off the end date instead: an open-ended job
      // (no end date) is the borrower's current employment.
      employmentDetail.push({
        tag: "EmploymentStatusType",
        text: emp.endDate ? "Previous" : "Current",
      });

      if (employmentDetail.length > 0) {
        employerChildren.push({ tag: "EMPLOYMENT", children: employmentDetail });
      }

      if (employerChildren.length > 0) {
        employersNode.push({ tag: "EMPLOYER", children: employerChildren });
      }
    }
    if (employersNode.length > 0) {
      borrowerChildren.push({ tag: "EMPLOYERS", children: employersNode });
    }
  }

  if (personalInfo?.numberOfDependents) {
    borrowerChildren.push({
      tag: "DEPENDENTS",
      children: [
        { tag: "DependentCount", text: String(personalInfo.numberOfDependents) },
      ],
    });
  }

  return { tag: "BORROWER", children: borrowerChildren };
}

function buildPartyNode(dto: MISMOLoanDTO): XMLNode {
  const { personalInfo, user } = dto;

  const nameChildren: XMLNode[] = [];
  if (personalInfo?.firstName) {
    nameChildren.push({ tag: "FirstNameText", text: personalInfo.firstName });
  }
  if (personalInfo?.middleName) {
    nameChildren.push({ tag: "MiddleNameText", text: personalInfo.middleName });
  }
  if (personalInfo?.lastName) {
    nameChildren.push({ tag: "LastNameText", text: personalInfo.lastName });
  }
  if (personalInfo?.suffix) {
    nameChildren.push({ tag: "SuffixText", text: personalInfo.suffix });
  }

  const individualChildren: XMLNode[] = [];
  if (nameChildren.length > 0) {
    individualChildren.push({ tag: "NAME", children: nameChildren });
  }

  const contactPoints: XMLNode[] = [];
  if (personalInfo?.email || user?.email) {
    contactPoints.push({
      tag: "CONTACT_POINT",
      children: [
        { tag: "ContactPointEmailValue", text: personalInfo?.email || user?.email || "" },
        { tag: "ContactPointRoleType", text: "Home" },
      ],
    });
  }
  if (personalInfo?.cellPhone) {
    contactPoints.push({
      tag: "CONTACT_POINT",
      children: [
        { tag: "ContactPointTelephoneValue", text: personalInfo.cellPhone },
        { tag: "ContactPointRoleType", text: "Mobile" },
      ],
    });
  }
  if (personalInfo?.homePhone) {
    contactPoints.push({
      tag: "CONTACT_POINT",
      children: [
        { tag: "ContactPointTelephoneValue", text: personalInfo.homePhone },
        { tag: "ContactPointRoleType", text: "Home" },
      ],
    });
  }
  if (contactPoints.length > 0) {
    individualChildren.push({ tag: "CONTACT_POINTS", children: contactPoints });
  }

  const partyChildren: XMLNode[] = [];
  if (individualChildren.length > 0) {
    partyChildren.push({ tag: "INDIVIDUAL", children: individualChildren });
  }

  const addressNode = buildAddressNode(
    personalInfo?.currentStreet,
    personalInfo?.currentUnit,
    personalInfo?.currentCity,
    personalInfo?.currentState,
    personalInfo?.currentZip
  );
  if (addressNode) {
    partyChildren.push({ tag: "ADDRESSES", children: [addressNode] });
  }

  const borrowerNode = buildBorrowerNode(dto);
  partyChildren.push({
    tag: "ROLES",
    children: [
      {
        tag: "ROLE",
        children: [
          borrowerNode,
          {
            tag: "ROLE_DETAIL",
            children: [
              { tag: "PartyRoleType", text: "Borrower" },
            ],
          },
        ],
      },
    ],
  });

  if (personalInfo?.ssn) {
    partyChildren.push({
      tag: "TAXPAYER_IDENTIFIERS",
      children: [
        {
          tag: "TAXPAYER_IDENTIFIER",
          children: [
            { tag: "TaxpayerIdentifierType", text: "SocialSecurityNumber" },
            { tag: "TaxpayerIdentifierValue", text: personalInfo.ssn.replace(/-/g, "") },
          ],
        },
      ],
    });
  }

  return { tag: "PARTY", children: partyChildren };
}

/**
 * Loan-state stamp for a LOAN container. Per the ULDD Implementation Guide
 * (Table 5, Subject Loan State), a loan delivery file carries the subject
 * loan as multiple LOAN containers: AtClosing (LoanStateDate = note date)
 * and Current (LoanStateDate = extraction date) — plus AtModification for
 * modified loans, which we do not originate.
 */
export interface LoanStateStamp {
  loanStateType: "AtClosing" | "Current" | "AtModification";
  /** YYYY-MM-DD; omitted when the date is not yet known. */
  loanStateDate?: string;
}

function buildLoanNode(dto: MISMOLoanDTO, mersMin?: string, loanState?: LoanStateStamp): XMLNode {
  const { application, loanOptions } = dto;
  const loanChildren: XMLNode[] = [];

  if (loanState) {
    const stateChildren: XMLNode[] = [];
    if (loanState.loanStateDate) {
      stateChildren.push({ tag: "LoanStateDate", text: loanState.loanStateDate });
    }
    stateChildren.push({ tag: "LoanStateType", text: loanState.loanStateType });
    loanChildren.push({ tag: "LOAN_STATE", children: stateChildren });
  }

  const loanIdentifiers: XMLNode[] = [
    {
      tag: "LOAN_IDENTIFIER",
      children: [
        { tag: "LoanIdentifier", text: application.id },
        { tag: "LoanIdentifierType", text: "LenderLoan" },
      ],
    },
  ];

  if (mersMin) {
    loanIdentifiers.push({
      tag: "LOAN_IDENTIFIER",
      children: [
        { tag: "LoanIdentifier", text: mersMin },
        { tag: "LoanIdentifierType", text: "MERS_MIN" },
      ],
    });
  }

  loanChildren.push({ tag: "LOAN_IDENTIFIERS", children: loanIdentifiers });

  // Loan amount + selected option (used by TERMS_OF_MORTGAGE below). Prefer an explicit loan-option
  // amount; otherwise derive from price minus down payment. Use != null (not truthiness) so a real
  // $0 down payment yields loan = price, while a MISSING down payment leaves the amount unknown
  // rather than overstating the loan.
  const optionAmount = loanOptions[0]?.loanAmount != null
    ? parseFloat(String(loanOptions[0].loanAmount))
    : NaN;
  const price = application.purchasePrice != null ? parseFloat(String(application.purchasePrice)) : NaN;
  const down = application.downPayment != null ? parseFloat(String(application.downPayment)) : NaN;
  let loanAmount: number | null = null;
  if (Number.isFinite(optionAmount)) {
    loanAmount = optionAmount;
  } else if (Number.isFinite(price) && Number.isFinite(down)) {
    loanAmount = price - down;
  }
  const selectedOption = loanOptions.find(o => o.isLocked) || loanOptions[0];

  // F-018 (verified vs docs/fannie-mae/schemas MISMO_3_0.xsd + golden UCD samples):
  //   LOAN_DETAIL      = loan-characteristic detail (ApplicationReceivedDate here);
  //   AMORTIZATION_RULE = amortization type/term;
  //   TERMS_OF_MORTGAGE    = LienPriorityType, LoanPurposeType, MortgageType, NoteAmount, NoteRatePercent.
  // Previously all five plus amortization were mis-nested in LOAN_DETAIL/TERMS_OF_MORTGAGE, and the
  // LOAN children were emitted out of XSD sequence — both fixed here (see the ordered push below).
  const loanDetail: XMLNode[] = [];
  if (application.createdAt) {
    loanDetail.push({ tag: "ApplicationReceivedDate", text: formatDate(application.createdAt) });
  }
  loanChildren.push({ tag: "LOAN_DETAIL", children: loanDetail });

  loanChildren.push({
    tag: "AMORTIZATION",
    children: [
      {
        tag: "AMORTIZATION_RULE",
        // XSD AMORTIZATION_RULE sequence: PeriodCount, PeriodType, LoanAmortizationType.
        children: [
          { tag: "LoanAmortizationPeriodCount", text: String(selectedOption?.loanTerm || 30) },
          { tag: "LoanAmortizationPeriodType", text: "Year" },
          { tag: "LoanAmortizationType", text: "Fixed" },
        ],
      },
    ],
  });

  const termsOfLoan: XMLNode[] = [];
  termsOfLoan.push({ tag: "LienPriorityType", text: "FirstLien" });
  termsOfLoan.push({ tag: "LoanPurposeType", text: mapLoanPurpose(application.loanPurpose) });
  termsOfLoan.push({ tag: "MortgageType", text: mapMortgageType(application.preferredLoanType) });
  if (loanAmount != null && loanAmount > 0) {
    termsOfLoan.push({ tag: "NoteAmount", text: formatCurrency(loanAmount) });
  }
  if (selectedOption?.interestRate) {
    termsOfLoan.push({ tag: "NoteRatePercent", text: formatPercent(selectedOption.interestRate) });
  }
  loanChildren.push({ tag: "TERMS_OF_MORTGAGE", children: termsOfLoan });

  if (mersMin) {
    loanChildren.push({
      tag: "MERS_REGISTRATION",
      children: [
        { tag: "MERSMINIdentifier", text: mersMin },
        { tag: "MERSOrganizationIdentifier", text: mersMin.substring(3, 10) },
        { tag: "MERSRegistrationStatusType", text: "Registered" },
      ],
    });
  }

  if (isApprovedGradeLoanAppStatus(application.status)) {
    loanChildren.push({
      tag: "UNDERWRITING",
      children: [
        {
          tag: "UNDERWRITING_DETAIL",
          children: [
            {
              tag: "UnderwritingDecisionType",
              text: "Approve"
            },
            { tag: "UnderwritingMethodType", text: "AutomatedUnderwriting" },
          ],
        },
        {
          tag: "AUTOMATED_UNDERWRITINGS",
          children: [
            {
              tag: "AUTOMATED_UNDERWRITING",
              children: [
                { tag: "AutomatedUnderwritingSystemType", text: "Other" },
                { tag: "AutomatedUnderwritingResultType", text: "Approve" },
              ],
            },
          ],
        },
      ],
    });
  }

  if (application.dtiRatio || application.ltvRatio) {
    const qualificationChildren: XMLNode[] = [];
    if (application.dtiRatio) {
      qualificationChildren.push({ 
        tag: "DebtIncomeRatioPercent", 
        text: formatPercent(application.dtiRatio) 
      });
    }
    if (application.ltvRatio) {
      qualificationChildren.push({ 
        tag: "LoanToValueRatioPercent", 
        text: formatPercent(application.ltvRatio) 
      });
    }
    loanChildren.push({
      tag: "QUALIFICATION",
      children: [{ tag: "QUALIFICATION_DETAIL", children: qualificationChildren }],
    });
  }

  // F-018: emit LOAN children in the MISMO LOAN sequence order (the XSD is a <sequence>),
  // regardless of the order they were built above. Verified against MISMO_3_0.xsd LOAN complexType.
  const LOAN_CHILD_ORDER = [
    "AMORTIZATION",
    "LOAN_DETAIL",
    "LOAN_IDENTIFIERS",
    "LOAN_STATE",
    "MERS_REGISTRATION",
    "QUALIFICATION",
    "REFINANCE",
    "TERMS_OF_MORTGAGE",
    "UNDERWRITING",
  ];
  loanChildren.sort(
    (a, b) => LOAN_CHILD_ORDER.indexOf(a.tag) - LOAN_CHILD_ORDER.indexOf(b.tag),
  );

  return { tag: "LOAN", children: loanChildren };
}

function buildCollateralNode(dto: MISMOLoanDTO): XMLNode | null {
  const { application, propertyInfo } = dto;
  
  const street = propertyInfo?.propertyStreet || application.propertyAddress;
  const city = propertyInfo?.propertyCity || application.propertyCity;
  const state = propertyInfo?.propertyState || application.propertyState;
  const zip = propertyInfo?.propertyZip || application.propertyZip;
  
  if (!street && !city) return null;

  const propertyChildren: XMLNode[] = [];

  const addressNode = buildAddressNode(
    street, 
    propertyInfo?.propertyUnit, 
    city, 
    state, 
    zip,
    undefined
  );
  if (addressNode) {
    propertyChildren.push(addressNode);
  }

  const propertyDetail: XMLNode[] = [];
  if (application.propertyValue) {
    propertyDetail.push({ 
      tag: "PropertyEstimatedValueAmount", 
      text: formatCurrency(application.propertyValue) 
    });
  }
  // ConstructionMethodType is a MISMO-enumerated construction method
  // (SiteBuilt | Manufactured | Modular | …), NOT the app's propertyType
  // (single_family/condo/townhouse/multi_family — those are attachment/project
  // concepts and belong in AttachmentType/ProjectType). Emitting the raw
  // propertyType here produced schema-invalid values like
  // <ConstructionMethodType>single_family</...>. Every current propertyType is
  // site-built unless the URLA flags it a manufactured home.
  propertyDetail.push({
    tag: "ConstructionMethodType",
    text: propertyInfo?.isManufacturedHome ? "Manufactured" : "SiteBuilt",
  });
  propertyDetail.push({ 
    tag: "PropertyUsageType", 
    text: mapPropertyUsage(propertyInfo?.occupancyType) 
  });
  if (propertyInfo?.numberOfUnits) {
    propertyDetail.push({ 
      tag: "PropertyUnitCount", 
      text: String(propertyInfo.numberOfUnits) 
    });
  }

  if (propertyDetail.length > 0) {
    propertyChildren.push({ tag: "PROPERTY_DETAIL", children: propertyDetail });
  }

  if (application.purchasePrice) {
    propertyChildren.push({
      tag: "SALES_CONTRACT_DETAIL",
      children: [
        { tag: "SalesContractAmount", text: formatCurrency(application.purchasePrice) },
      ],
    });
  }

  if (propertyChildren.length === 0) return null;

  return {
    tag: "COLLATERALS",
    children: [
      {
        tag: "COLLATERAL",
        children: [
          { tag: "SUBJECT_PROPERTY", children: propertyChildren },
        ],
      },
    ],
  };
}

function buildAssetsNode(dto: MISMOLoanDTO): XMLNode | null {
  const { assets } = dto;
  if (assets.length === 0) return null;

  const assetNodes: XMLNode[] = [];
  for (const asset of assets) {
    const assetDetail: XMLNode[] = [];
    if (asset.accountNumber) {
      assetDetail.push({ tag: "AssetAccountIdentifier", text: asset.accountNumber });
    }
    if (asset.cashOrMarketValue) {
      assetDetail.push({ 
        tag: "AssetCashOrMarketValueAmount", 
        text: formatCurrency(asset.cashOrMarketValue) 
      });
    }
    assetDetail.push({ tag: "AssetType", text: mapAssetType(asset.accountType) });

    const assetChildren: XMLNode[] = [{ tag: "ASSET_DETAIL", children: assetDetail }];

    if (asset.financialInstitution) {
      assetChildren.push({
        tag: "ASSET_HOLDER",
        children: [
          {
            tag: "NAME",
            children: [{ tag: "FullName", text: asset.financialInstitution }],
          },
        ],
      });
    }

    assetNodes.push({ tag: "ASSET", children: assetChildren });
  }

  return { tag: "ASSETS", children: assetNodes };
}

function buildLiabilitiesNode(dto: MISMOLoanDTO): XMLNode | null {
  const { liabilities } = dto;
  if (liabilities.length === 0) return null;

  const liabilityNodes: XMLNode[] = [];
  for (const liability of liabilities) {
    const liabilityDetail: XMLNode[] = [];
    if (liability.accountNumber) {
      liabilityDetail.push({ tag: "LiabilityAccountIdentifier", text: liability.accountNumber });
    }
    if (liability.monthlyPayment) {
      liabilityDetail.push({ 
        tag: "LiabilityMonthlyPaymentAmount", 
        text: formatCurrency(liability.monthlyPayment) 
      });
    }
    if (liability.toBePaidOff !== undefined) {
      liabilityDetail.push({ 
        tag: "LiabilityPayoffStatusIndicator", 
        text: liability.toBePaidOff ? "true" : "false" 
      });
    }
    liabilityDetail.push({ tag: "LiabilityType", text: mapLiabilityType(liability.liabilityType) });
    if (liability.unpaidBalance) {
      liabilityDetail.push({ 
        tag: "LiabilityUnpaidBalanceAmount", 
        text: formatCurrency(liability.unpaidBalance) 
      });
    }

    const liabilityChildren: XMLNode[] = [{ tag: "LIABILITY_DETAIL", children: liabilityDetail }];

    if (liability.creditorName) {
      liabilityChildren.push({
        tag: "LIABILITY_HOLDER",
        children: [
          {
            tag: "NAME",
            children: [{ tag: "FullName", text: liability.creditorName }],
          },
        ],
      });
    }

    liabilityNodes.push({ tag: "LIABILITY", children: liabilityChildren });
  }

  return { tag: "LIABILITIES", children: liabilityNodes };
}

// ============================================================================
// XLINK RELATIONSHIP GENERATION (Graph-based data model)
//
// DEFERRED — intentionally emits nothing. A MISMO 3.4 relationship graph
// associates objects via xlink arcs: each ASSET/LIABILITY/EMPLOYMENT/PARTY
// carries an xlink:label, and each RELATIONSHIP references them with
// xlink:from / xlink:to under a GSE-accepted arcrole URI. The previous
// implementation emitted xlink:href pointers to labels that were never defined
// (dangling references) alongside non-standard RelationshipType/RelatedParty
// children — an invalid graph that fails GSE ingestion. Until the container
// nodes carry matching labels and the exact arcrole URIs are wired in, we omit
// the block rather than deliver a broken graph. The objects themselves are
// still emitted inline under DEAL; single-borrower associations are implicit.
// ============================================================================

function buildRelationshipsNode(_dto: MISMOLoanDTO): XMLNode | null {
  return null;
}

export interface MISMOGenerationOptions {
  includeAboutVersions?: boolean;
  mersOrgId?: string;
  generateMersMin?: boolean;
  /**
   * "loanDelivery" produces the ULDD delivery shape per the ULDD
   * Implementation Guide: the subject loan is emitted as AtClosing + Current
   * LOAN containers (Table 5), and the ASSET container is omitted because
   * Fannie Mae does not support it in delivery files (Table 4). The default
   * ("underwriting") keeps the single-LOAN shape with assets for AUS-style
   * consumers.
   */
  purpose?: "underwriting" | "loanDelivery";
  /** Note date (YYYY-MM-DD) for the AtClosing loan state, when known. */
  noteDate?: string;
  /**
   * Generation clock for ABOUT_VERSION CreatedDatetime and the Current
   * loan-state date. Same inputs + same clock ⇒ byte-identical XML.
   */
  generatedAt?: Date;
}

export function generateMISMO34XML(
  dto: MISMOLoanDTO,
  options: MISMOGenerationOptions = {}
): string {
  const {
    includeAboutVersions = true,
    mersOrgId = COMPANY_CONFIG.mersOrgId,
    generateMersMin = true,
    purpose = "underwriting",
    noteDate,
    generatedAt = new Date(),
  } = options;

  let mersMin: string | undefined;
  // Only mint a MIN when the org id is a real numeric MERS identifier. While it
  // is unset ("PENDING") we deliberately omit MERS_REGISTRATION rather than emit
  // a placeholder MIN that would fail Luhn validation downstream. The loan
  // number is derived from the application id's digits (a UUID is hex, so we
  // strip the letters) padded to the 7-digit MIN loan-number width.
  const orgIdIsNumeric = /^\d{1,7}$/.test(mersOrgId);
  if (generateMersMin && orgIdIsNumeric) {
    const loanNumber = dto.application.id.replace(/\D/g, "").slice(0, 7).padStart(7, "0");
    mersMin = generateMERSMIN(mersOrgId, loanNumber);
  }

  const dealChildren: XMLNode[] = [];

  const collateralNode = buildCollateralNode(dto);
  if (collateralNode) {
    dealChildren.push(collateralNode);
  }

  if (purpose === "loanDelivery") {
    // ULDD Implementation Guide Table 5: every subject loan is delivered
    // with an AtClosing LOAN container (LoanStateDate = note date) and a
    // Current LOAN container (LoanStateDate = data-extraction date).
    dealChildren.push({
      tag: "LOANS",
      children: [
        buildLoanNode(dto, mersMin, { loanStateType: "AtClosing", loanStateDate: noteDate }),
        buildLoanNode(dto, mersMin, {
          loanStateType: "Current",
          loanStateDate: generatedAt.toISOString().slice(0, 10),
        }),
      ],
    });
  } else {
    dealChildren.push({
      tag: "LOANS",
      children: [buildLoanNode(dto, mersMin)],
    });
  }

  dealChildren.push({
    tag: "PARTIES",
    children: [buildPartyNode(dto)],
  });

  // The ULDD Implementation Guide (Table 4) states Fannie Mae does not
  // support the ASSET container in delivery files — it is emitted only for
  // underwriting-style consumers.
  if (purpose !== "loanDelivery") {
    const assetsNode = buildAssetsNode(dto);
    if (assetsNode) {
      dealChildren.push(assetsNode);
    }
  }

  const liabilitiesNode = buildLiabilitiesNode(dto);
  if (liabilitiesNode) {
    dealChildren.push(liabilitiesNode);
  }

  const relationshipsNode = buildRelationshipsNode(dto);
  if (relationshipsNode) {
    dealChildren.push(relationshipsNode);
  }

  const messageChildren: XMLNode[] = [];

  if (includeAboutVersions) {
    messageChildren.push({
      tag: "ABOUT_VERSIONS",
      children: [
        {
          tag: "ABOUT_VERSION",
          children: [
            { tag: "CreatedDatetime", text: generatedAt.toISOString() },
            { tag: "DataVersionIdentifier", text: "3.4.0" },
            { tag: "DataVersionName", text: "MISMO" },
          ],
        },
      ],
    });
  }

  messageChildren.push({
    tag: "DEAL_SETS",
    children: [
      {
        tag: "DEAL_SET",
        children: [
          {
            tag: "DEALS",
            children: [{ tag: "DEAL", children: dealChildren }],
          },
        ],
      },
    ],
  });

  const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>';
  const messageNode: XMLNode = {
    tag: "MESSAGE",
    attributes: {
      xmlns: MISMO_NAMESPACE,
      "xmlns:xlink": XLINK_NAMESPACE,
      "xmlns:xsi": XSI_NAMESPACE,
    },
    children: messageChildren,
  };

  const xmlBody = buildXmlNode(messageNode);
  return `${xmlDeclaration}\n${xmlBody}`;
}

export function validateMISMOXML(xml: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!xml.includes('<?xml version="1.0"')) {
    errors.push("Missing XML declaration");
  }

  if (!xml.includes("MESSAGE")) {
    errors.push("Missing MESSAGE root element");
  }

  if (!xml.includes("DEAL_SETS")) {
    errors.push("Missing DEAL_SETS container");
  }

  if (!xml.includes("DEAL")) {
    errors.push("Missing DEAL element");
  }

  if (!xml.includes("LOAN")) {
    errors.push("Missing LOAN element");
  }

  if (!xml.includes("PARTY")) {
    errors.push("Missing PARTY element");
  }

  const requiredDataPoints = [
    "NoteAmount",
    "LoanPurposeType",
    "MortgageType",
    // BaseLoanAmount was dropped in the F-018 restructure (redundant with NoteAmount and
    // out-of-schema in TERMS_OF_MORTGAGE); NoteAmount is the canonical loan amount.
    "LoanAmortizationType",
  ];

  for (const dataPoint of requiredDataPoints) {
    if (!xml.includes(dataPoint)) {
      errors.push(`Missing required ULDD data point: ${dataPoint}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export interface ULDDValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  phase5Ready: boolean;
}

export function validateULDDCompliance(dto: MISMOLoanDTO): ULDDValidationResult {
  const { application, personalInfo, propertyInfo, employment } = dto;
  const errors: string[] = [];
  const warnings: string[] = [];

  // != null (not truthiness) so a valid $0-down loan (e.g. VA 100% financing)
  // computes loanAmount = price and passes, instead of being wrongly reported as
  // a missing NoteAmount.
  const price = application.purchasePrice != null ? parseFloat(String(application.purchasePrice)) : NaN;
  const down = application.downPayment != null ? parseFloat(String(application.downPayment)) : NaN;
  const loanAmount = Number.isFinite(price) && Number.isFinite(down) ? price - down : null;
  if (loanAmount == null || loanAmount <= 0) {
    errors.push("NoteAmount is required and must be greater than 0");
  }

  if (!application.loanPurpose) {
    errors.push("LoanPurposeType is required");
  }

  if (!application.preferredLoanType) {
    errors.push("MortgageType is required");
  }

  if (!personalInfo?.firstName || !personalInfo?.lastName) {
    errors.push("Borrower name is required");
  }

  if (!personalInfo?.ssn) {
    errors.push("Borrower SSN is required");
  }

  const street = propertyInfo?.propertyStreet || application.propertyAddress;
  const city = propertyInfo?.propertyCity || application.propertyCity;
  if (!street && !city) {
    errors.push("Subject property address is required");
  }

  if (!application.creditScore && application.status !== "draft") {
    warnings.push("Credit score should be provided for loan delivery");
  }

  if (!application.propertyValue) {
    warnings.push("Property valuation amount should be provided");
  }

  if (!employment || employment.length === 0) {
    warnings.push("Employment information should be provided");
  }

  // A broker registers no notes in MERS, so a missing org id is expected, not
  // a gap to warn about (F-14). Warn only where it would actually be needed.
  if (mersOrgIdApplicable() && !/^\d{1,7}$/.test(COMPANY_CONFIG.mersOrgId)) {
    warnings.push("MERS Org ID is not configured; a MERS MIN cannot be generated for loan delivery");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    phase5Ready: errors.length === 0 && warnings.length === 0,
  };
}
