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
import { COMPANY_CONFIG } from "./config/company";
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
  personalInfo: UrlaPersonalInfo | null;
  employment: EmploymentHistory[];
  assets: UrlaAsset[];
  liabilities: UrlaLiability[];
  propertyInfo: UrlaPropertyInfo | null;
  declarations: BorrowerDeclarations | null;
  loanOptions: LoanOption[];
  documents: Document[];
}

export function generateLuhnCheckDigit(digits: string): number {
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
  const paddedOrgId = orgId.padStart(7, "0");
  const paddedLoanNumber = loanNumber.padStart(7, "0");
  
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
  return d.toISOString().split("T")[0];
}

function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "0.00";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return num.toFixed(2);
}

function formatPercent(rate: number | string | null | undefined): string {
  if (rate === null || rate === undefined) return "0.000";
  const num = typeof rate === "string" ? parseFloat(rate) : rate;
  return num.toFixed(3);
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
  const mapping: Record<string, LoanPurposeType> = {
    purchase: "Purchase",
    refinance: "Refinance",
    cash_out_refinance: "CashOutRefinance",
    cash_out: "CashOutRefinance",
    no_cash_out_refinance: "NoCashOutRefinance",
    construction: "ConstructionToPermanent",
  };
  return mapping[purpose?.toLowerCase() || ""] || "Purchase";
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
      employmentDetail.push({ 
        tag: "EmploymentStatusType", 
        text: emp.employmentType === "current" ? "Current" : "Previous" 
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

function buildLoanNode(dto: MISMOLoanDTO, mersMin?: string): XMLNode {
  const { application, loanOptions } = dto;
  const loanChildren: XMLNode[] = [];

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

  const loanDetail: XMLNode[] = [];
  if (application.createdAt) {
    loanDetail.push({ 
      tag: "ApplicationReceivedDate", 
      text: formatDate(application.createdAt) 
    });
  }
  loanDetail.push({ tag: "LienPriorityType", text: "FirstLien" });
  loanDetail.push({ 
    tag: "LoanPurposeType", 
    text: mapLoanPurpose(application.loanPurpose) 
  });
  loanDetail.push({ 
    tag: "MortgageType", 
    text: mapMortgageType(application.preferredLoanType) 
  });
  
  const loanAmount = loanOptions[0]?.loanAmount || 
    (application.purchasePrice && application.downPayment 
      ? parseFloat(String(application.purchasePrice)) - parseFloat(String(application.downPayment))
      : application.purchasePrice);
  if (loanAmount) {
    loanDetail.push({ 
      tag: "NoteAmount", 
      text: formatCurrency(loanAmount) 
    });
  }

  const selectedOption = loanOptions.find(o => o.isLocked) || loanOptions[0];
  if (selectedOption?.interestRate) {
    loanDetail.push({ 
      tag: "NoteRatePercent", 
      text: formatPercent(selectedOption.interestRate) 
    });
  }

  loanChildren.push({ tag: "LOAN_DETAIL", children: loanDetail });

  const termsOfLoan: XMLNode[] = [];
  if (loanAmount) {
    termsOfLoan.push({ 
      tag: "BaseLoanAmount", 
      text: formatCurrency(loanAmount) 
    });
  }
  termsOfLoan.push({ tag: "LoanAmortizationType", text: "Fixed" });
  termsOfLoan.push({ tag: "LoanAmortizationPeriodCount", text: String(selectedOption?.loanTerm || 30) });
  termsOfLoan.push({ tag: "LoanAmortizationPeriodType", text: "Year" });

  if (selectedOption?.interestRate) {
    termsOfLoan.push({ 
      tag: "InterestRatePercent", 
      text: formatPercent(selectedOption.interestRate) 
    });
  }

  loanChildren.push({ tag: "TERMS_OF_LOAN", children: termsOfLoan });

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

  if (application.status === "approved" || application.status === "pre_approved") {
    loanChildren.push({
      tag: "UNDERWRITING",
      children: [
        {
          tag: "UNDERWRITING_DETAIL",
          children: [
            { 
              tag: "UnderwritingDecisionType", 
              text: application.status === "approved" ? "Approve" : "Approve"
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
  if (application.propertyType) {
    propertyDetail.push({ 
      tag: "ConstructionMethodType", 
      text: application.propertyType || "SiteBuilt" 
    });
  }
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
// ============================================================================

function buildRelationshipsNode(dto: MISMOLoanDTO): XMLNode | null {
  const { user, employment, assets, liabilities } = dto;
  if (!user) return null;

  const relationshipNodes: XMLNode[] = [];
  const borrowerId = `Party_${user.id.substring(0, 8)}`;

  // Asset-to-Borrower relationships
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    relationshipNodes.push({
      tag: "RELATIONSHIP",
      attributes: {
        "xlink:arcrole": "urn:mismo.org:3.4:Asset_Associated_With_Party",
        "xlink:href": `#Asset_${i}`,
        "xlink:title": "Asset Associated With Party",
      },
      children: [
        { tag: "RelationshipType", text: "Asset_Associated_With_Party" },
        { tag: "RelatedParty", text: borrowerId },
      ],
    });
  }

  // Liability-to-Borrower relationships
  for (let i = 0; i < liabilities.length; i++) {
    const liability = liabilities[i];
    relationshipNodes.push({
      tag: "RELATIONSHIP",
      attributes: {
        "xlink:arcrole": "urn:mismo.org:3.4:Liability_Associated_With_Party",
        "xlink:href": `#Liability_${i}`,
        "xlink:title": "Liability Associated With Party",
      },
      children: [
        { tag: "RelationshipType", text: "Liability_Associated_With_Party" },
        { tag: "RelatedParty", text: borrowerId },
      ],
    });
  }

  // Employment/Income-to-Borrower relationships
  for (let i = 0; i < employment.length; i++) {
    const emp = employment[i];
    relationshipNodes.push({
      tag: "RELATIONSHIP",
      attributes: {
        "xlink:arcrole": "urn:mismo.org:3.4:Income_Associated_With_Party",
        "xlink:href": `#Employment_${i}`,
        "xlink:title": "Income Associated With Party",
      },
      children: [
        { tag: "RelationshipType", text: "Income_Associated_With_Party" },
        { tag: "IncomeSource", text: emp.employmentType || "salaried" },
        { tag: "RelatedParty", text: borrowerId },
      ],
    });
  }

  if (relationshipNodes.length === 0) return null;

  return { tag: "RELATIONSHIPS", children: relationshipNodes };
}

export interface MISMOGenerationOptions {
  includeAboutVersions?: boolean;
  mersOrgId?: string;
  generateMersMin?: boolean;
}

export function generateMISMO34XML(
  dto: MISMOLoanDTO,
  options: MISMOGenerationOptions = {}
): string {
  const {
    includeAboutVersions = true,
    mersOrgId = COMPANY_CONFIG.mersOrgId,
    generateMersMin = true,
  } = options;

  let mersMin: string | undefined;
  if (generateMersMin) {
    const loanNumber = dto.application.id.replace(/-/g, "").substring(0, 7);
    mersMin = generateMERSMIN(mersOrgId, loanNumber);
  }

  const dealChildren: XMLNode[] = [];

  const collateralNode = buildCollateralNode(dto);
  if (collateralNode) {
    dealChildren.push(collateralNode);
  }

  dealChildren.push({
    tag: "LOANS",
    children: [buildLoanNode(dto, mersMin)],
  });

  dealChildren.push({
    tag: "PARTIES",
    children: [buildPartyNode(dto)],
  });

  const assetsNode = buildAssetsNode(dto);
  if (assetsNode) {
    dealChildren.push(assetsNode);
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
            { tag: "CreatedDatetime", text: new Date().toISOString() },
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
    "BaseLoanAmount",
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

  const loanAmount = application.purchasePrice && application.downPayment 
    ? parseFloat(String(application.purchasePrice)) - parseFloat(String(application.downPayment))
    : null;
  if (!loanAmount || loanAmount <= 0) {
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

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    phase5Ready: errors.length === 0 && warnings.length === 0,
  };
}
