import { storage } from "../storage";
import type { LoanApplication, InsertLoanCondition } from "@shared/schema";

interface DocumentRequirement {
  documentName: string;
  documentType: string;
  category: string;
  priority: "prior_to_approval" | "prior_to_docs" | "prior_to_funding";
  description: string;
  sourceRule: string;
}

export async function generateDocumentRequirements(loanApplication: LoanApplication): Promise<void> {
  const requirements: DocumentRequirement[] = [];
  
  const employmentType = loanApplication.employmentType?.toLowerCase();
  const loanPurpose = loanApplication.loanPurpose?.toLowerCase();
  const loanType = loanApplication.preferredLoanType?.toLowerCase();
  const isVeteran = loanApplication.isVeteran;

  if (employmentType === "w2" || employmentType === "employed") {
    requirements.push({
      documentName: "Paystubs (30 Days)",
      documentType: "pay_stub",
      category: "income",
      priority: "prior_to_approval",
      description: "Most recent 30 days of pay stubs showing year-to-date earnings",
      sourceRule: "W2_EMPLOYMENT",
    });
    
    requirements.push({
      documentName: "W2s (2 Years)",
      documentType: "w2",
      category: "income",
      priority: "prior_to_approval",
      description: "W-2 wage statements for the past 2 tax years",
      sourceRule: "W2_EMPLOYMENT",
    });
  }

  if (employmentType === "selfemployed" || employmentType === "self_employed" || employmentType === "self-employed") {
    requirements.push({
      documentName: "1040 Tax Returns (2 Years)",
      documentType: "tax_return",
      category: "income",
      priority: "prior_to_approval",
      description: "Complete federal 1040 tax returns with all schedules for the past 2 years",
      sourceRule: "SELF_EMPLOYED",
    });
    
    requirements.push({
      documentName: "P&L Statement",
      documentType: "profit_loss",
      category: "income",
      priority: "prior_to_approval",
      description: "Year-to-date profit and loss statement for your business",
      sourceRule: "SELF_EMPLOYED",
    });
  }

  if (loanPurpose === "purchase") {
    requirements.push({
      documentName: "Purchase Contract",
      documentType: "purchase_contract",
      category: "property",
      priority: "prior_to_approval",
      description: "Fully executed purchase agreement/contract for the property",
      sourceRule: "PURCHASE_TRANSACTION",
    });
    
    requirements.push({
      documentName: "Earnest Money Check",
      documentType: "earnest_money",
      category: "assets",
      priority: "prior_to_approval",
      description: "Copy of earnest money deposit check (front and back) or wire confirmation",
      sourceRule: "PURCHASE_TRANSACTION",
    });
  }

  if (loanType === "va" || isVeteran) {
    requirements.push({
      documentName: "DD-214",
      documentType: "dd214",
      category: "compliance",
      priority: "prior_to_approval",
      description: "Certificate of Release or Discharge from Active Duty (DD-214)",
      sourceRule: "VA_LOAN",
    });
  }

  const incomeSources = (loanApplication.incomeSources as Array<{ type: string }>) || [];
  for (const source of incomeSources) {
    const t = source.type?.toLowerCase();
    if ((t === "w2") && employmentType !== "employed" && employmentType !== "w2") {
      requirements.push({
        documentName: "Additional W-2 Employment - Paystubs (30 Days)",
        documentType: "pay_stub",
        category: "income",
        priority: "prior_to_approval",
        description: "Most recent 30 days of pay stubs for additional W-2 employment",
        sourceRule: "ADDITIONAL_W2",
      });
      requirements.push({
        documentName: "Additional W-2 Employment - W2s (2 Years)",
        documentType: "w2",
        category: "income",
        priority: "prior_to_approval",
        description: "W-2 wage statements for additional employment for the past 2 tax years",
        sourceRule: "ADDITIONAL_W2",
      });
    }
    if (t === "self_employed" && employmentType !== "self_employed" && employmentType !== "selfemployed") {
      requirements.push({
        documentName: "Additional Self-Employment - 1040 Tax Returns (2 Years)",
        documentType: "tax_return",
        category: "income",
        priority: "prior_to_approval",
        description: "Complete federal 1040 tax returns with all schedules for additional self-employment income",
        sourceRule: "ADDITIONAL_SELF_EMPLOYED",
      });
    }
    if (t === "rental") {
      requirements.push({
        documentName: "Rental Income - Lease Agreements",
        documentType: "lease_agreement",
        category: "income",
        priority: "prior_to_approval",
        description: "Current signed lease agreements for rental properties",
        sourceRule: "RENTAL_INCOME",
      });
      requirements.push({
        documentName: "Rental Income - Schedule E (2 Years)",
        documentType: "tax_return",
        category: "income",
        priority: "prior_to_approval",
        description: "IRS Schedule E from tax returns showing rental income for the past 2 years",
        sourceRule: "RENTAL_INCOME",
      });
    }
    if (t === "social_security") {
      requirements.push({
        documentName: "Social Security Award Letter",
        documentType: "award_letter",
        category: "income",
        priority: "prior_to_approval",
        description: "SSA benefit verification letter or award letter showing monthly benefit amount",
        sourceRule: "SOCIAL_SECURITY_INCOME",
      });
    }
    if (t === "pension") {
      requirements.push({
        documentName: "Pension/Retirement Distribution Statement",
        documentType: "pension_statement",
        category: "income",
        priority: "prior_to_approval",
        description: "Most recent pension or retirement distribution statement showing periodic payment amount",
        sourceRule: "PENSION_INCOME",
      });
    }
    if (t === "investment") {
      requirements.push({
        documentName: "Investment Account Statements (2 Months)",
        documentType: "investment_statement",
        category: "income",
        priority: "prior_to_approval",
        description: "Most recent 2 months of investment/brokerage account statements showing dividend/interest income",
        sourceRule: "INVESTMENT_INCOME",
      });
    }
  }

  for (const req of requirements) {
    const existingConditions = await storage.getLoanConditionsByApplication(loanApplication.id);
    const alreadyExists = existingConditions.some(
      (c) => c.sourceRule === req.sourceRule && c.title === req.documentName
    );
    
    if (!alreadyExists) {
      const condition: InsertLoanCondition = {
        applicationId: loanApplication.id,
        category: req.category,
        title: req.documentName,
        description: req.description,
        priority: req.priority,
        status: "outstanding",
        requiredDocumentTypes: [req.documentType],
        isAutoGenerated: true,
        sourceRule: req.sourceRule,
      };
      
      await storage.createLoanCondition(condition);
    }
  }
}

export function getDocumentRulesForProfile(loanApplication: LoanApplication): string[] {
  const rules: string[] = [];
  
  const employmentType = loanApplication.employmentType?.toLowerCase();
  const loanPurpose = loanApplication.loanPurpose?.toLowerCase();
  const loanType = loanApplication.preferredLoanType?.toLowerCase();
  const isVeteran = loanApplication.isVeteran;

  if (employmentType === "w2" || employmentType === "employed") {
    rules.push("W2_EMPLOYMENT: Paystubs (30 Days), W2s (2 Years)");
  }

  if (employmentType === "selfemployed" || employmentType === "self_employed" || employmentType === "self-employed") {
    rules.push("SELF_EMPLOYED: 1040 Tax Returns (2 Years), P&L Statement");
  }

  if (loanPurpose === "purchase") {
    rules.push("PURCHASE_TRANSACTION: Purchase Contract, Earnest Money Check");
  }

  if (loanType === "va" || isVeteran) {
    rules.push("VA_LOAN: DD-214");
  }

  const incomeSources = (loanApplication.incomeSources as Array<{ type: string }>) || [];
  for (const source of incomeSources) {
    const t = source.type?.toLowerCase();
    if (t === "w2" && employmentType !== "employed" && employmentType !== "w2") {
      rules.push("ADDITIONAL_W2: Paystubs (30 Days), W2s (2 Years)");
    }
    if (t === "self_employed" && employmentType !== "self_employed" && employmentType !== "selfemployed") {
      rules.push("ADDITIONAL_SELF_EMPLOYED: 1040 Tax Returns (2 Years)");
    }
    if (t === "rental") {
      rules.push("RENTAL_INCOME: Lease Agreements, Schedule E (2 Years)");
    }
    if (t === "social_security") {
      rules.push("SOCIAL_SECURITY_INCOME: SSA Award Letter");
    }
    if (t === "pension") {
      rules.push("PENSION_INCOME: Distribution Statement");
    }
    if (t === "investment") {
      rules.push("INVESTMENT_INCOME: Account Statements (2 Months)");
    }
  }

  return rules;
}
