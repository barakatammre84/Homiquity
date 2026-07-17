// Per-document extractors (tax return, pay stub, bank statement, lease) + their deterministic simulations.
// Split from the old server/extractionService.ts — which re-exports it.
/**
 * AI Document Extraction Service — the Anthropic (Claude) vendor adapter.
 * Every document-extraction model call in the codebase lives here
 * (vendor-adapter rule); orchestration/persistence live in the services that
 * consume it.
 *
 * Extracts structured financial data from:
 * - Tax Returns — single-pass summary (legacy) AND multi-form classification +
 *   per-form extraction (UAL P2a Situation Identification Engine)
 * - Pay Stubs (income verification)
 * - Bank Statements (asset verification)
 * - Lease agreements (rent auto-fill)
 */

import * as fs from "fs";
import * as path from "path";
import { computeHash } from "./services/encryptionService";
import {
  anthropic,
  generateExtractionText,
  fileToBase64,
  getMimeType,
  EXTRACTION_MODEL_SINGLE_DOC,
  type ExtractedTaxReturnData,
  type ExtractedPayStubData,
  type ExtractedBankStatementData,
  type ExtractedLeaseData,
} from "./extractionCore";
import {
  validateExtraction,
  checkPayStubConsistency,
  checkBankStatementConsistency,
  checkLeaseConsistency,
  lineageFor,
  rawLineage,
  VALIDATION_FAILED_WARNING,
  checkTaxReturnConsistency,
  taxReturnSchema,
  payStubSchema,
  bankStatementSchema,
  leaseSchema,
} from "./extractionValidation";

// Model lineage, persisted with every extraction so a past result can be traced
// to the exact model + prompt that produced it. Bump EXTRACTION_PROMPT_VERSION
// whenever any extraction prompt text changes.
//
// Extraction is tiered by task. Single-document reads (pay stub, bank statement,
// lease, single-pass tax return) are bounded, high-volume, and vision-bound but
// not reasoning-heavy — Sonnet 5 has the same high-res vision as Opus at lower
// cost, and everything downstream is Zod-validated + confidence-capped. The
// multi-form tax-package pass (UAL P2a: classify every form, then tie the forms
// out across entities and years) is the one genuinely hard reasoning task and it
// feeds the income engine — it stays on Opus. Lineage records the actual model.

/**
 * Deterministic simulated extraction (EXTRACTION_SIMULATE=true, no Anthropic key):
 * same file path → same figures, internally consistent so the confidence caps
 * don't fire. Always includes a Schedule E block so downstream DSCR flagging
 * is exercisable in tests and local dev. Clearly flagged via warnings.
 */
function simulatedTaxReturnExtraction(
  filePath: string,
  documentYear?: string,
): ExtractedTaxReturnData {
  const frac = parseInt(computeHash(`tax-sim:${filePath}`).slice(0, 8), 16) / 0xffffffff;
  const w2Wages = Math.round(60_000 + frac * 60_000);
  const grossRents = Math.round(24_000 + frac * 24_000);
  const netRental = Math.round(grossRents * 0.35);
  const scheduleCNet = Math.round(10_000 + frac * 20_000);
  const grossIncome = w2Wages + netRental + scheduleCNet;
  return {
    documentYear: documentYear || (new Date().getFullYear() - 1).toString(),
    w2Wages,
    grossIncome,
    adjustedGrossIncome: grossIncome - Math.round(frac * 5_000),
    taxableIncome: grossIncome - Math.round(15_000 + frac * 10_000),
    filingStatus: frac < 0.5 ? "single" : "married",
    scheduleC: {
      businessIncome: scheduleCNet + 15_000,
      businessExpenses: 15_000,
      netProfitLoss: scheduleCNet,
    },
    scheduleE: {
      netRentalIncomeLoss: netRental,
      grossRents,
      totalDepreciation: Math.round(grossRents * 0.25),
      mortgageInterest: Math.round(grossRents * 0.3),
      propertyCount: frac < 0.5 ? 1 : 2,
    },
    confidence: "medium",
    extractedFields: [
      "w2Wages",
      "grossIncome",
      "adjustedGrossIncome",
      "taxableIncome",
      "filingStatus",
      "scheduleC",
      "scheduleE",
    ],
    warnings: ["Simulated extraction - no Anthropic credentials (EXTRACTION_SIMULATE)"],
  };
}

/**
 * Extract tax return data using Claude vision
 */
export async function extractTaxReturnData(
  filePath: string,
  documentYear?: string
): Promise<ExtractedTaxReturnData> {
  const model = EXTRACTION_MODEL_SINGLE_DOC;
  if (!anthropic) {
    if (process.env.EXTRACTION_SIMULATE === "true") {
      return simulatedTaxReturnExtraction(filePath, documentYear);
    }
    return {
      documentYear: documentYear || new Date().getFullYear().toString(),
      confidence: "low",
      extractedFields: [],
      warnings: ["Anthropic API not configured - returning empty extraction"],
    };
  }

  try {
    const base64 = await fileToBase64(filePath);
    const mimeType = getMimeType(filePath);

    const prompt = `You are a tax document analysis specialist. Extract financial data from this tax return image.

Return ONLY valid JSON with this structure:
{
  "documentYear": "2024",
  "taxpayerName": "extracted name or null",
  "w2Wages": 68000,
  "grossIncome": 75000,
  "adjustedGrossIncome": 72000,
  "taxableIncome": 65000,
  "filingStatus": "single or married or head_of_household",
  "scheduleC": {
    "businessIncome": 50000,
    "businessExpenses": 15000,
    "netProfitLoss": 35000
  },
  "scheduleD": {
    "capitalGains": 5000
  },
  "scheduleE": {
    "netRentalIncomeLoss": 12000,
    "grossRents": 36000,
    "totalDepreciation": 8000,
    "mortgageInterest": 9000,
    "propertyCount": 2
  },
  "confidence": "high or medium or low",
  "extractedFields": ["list of successfully extracted field names"],
  "warnings": ["list of any concerns or unclear values"]
}

"w2Wages" is Form 1040 line 1a (total W-2 wages). For "scheduleE", use Part I:
netRentalIncomeLoss from line 26, grossRents as the sum of line 3 across property
columns, totalDepreciation from line 18, mortgageInterest from line 12, and
propertyCount as the number of property columns with data.
Only include fields that are clearly visible. Return null for any unclear values.
If Schedule C, D, or E are not present, omit those sections.`;

    const text = await generateExtractionText(anthropic, mimeType, base64, prompt, model);
    const validated = validateExtraction(taxReturnSchema, text, "Tax return");

    if (validated) {
      const extracted: ExtractedTaxReturnData = {
        ...validated,
        documentYear: validated.documentYear || documentYear || new Date().getFullYear().toString(),
        ...rawLineage(text, model),
      };
      checkTaxReturnConsistency(extracted);
      return extracted;
    }

    return {
      documentYear: documentYear || new Date().getFullYear().toString(),
      confidence: "low",
      extractedFields: [],
      warnings: [VALIDATION_FAILED_WARNING],
      ...lineageFor(model),
    };
  } catch (error) {
    console.error("Tax return extraction error:", error);
  }

  return {
    documentYear: documentYear || new Date().getFullYear().toString(),
    confidence: "low",
    extractedFields: [],
    warnings: ["Failed to extract data from tax return"],
    ...lineageFor(model),
  };
}

/**
 * Extract pay stub data using Claude vision
 */
export async function extractPayStubData(filePath: string): Promise<ExtractedPayStubData> {
  const model = EXTRACTION_MODEL_SINGLE_DOC;
  if (!anthropic) {
    return {
      confidence: "low",
      extractedFields: [],
      warnings: ["Anthropic API not configured"],
    };
  }

  try {
    const base64 = await fileToBase64(filePath);
    const mimeType = getMimeType(filePath);

    const prompt = `You are a payroll document analysis specialist. Extract financial data from this pay stub.

Return ONLY valid JSON with this structure:
{
  "employeeName": "extracted name or null",
  "employerName": "extracted name or null",
  "payPeriodStartDate": "2024-01-01 or null",
  "payPeriodEndDate": "2024-01-15 or null",
  "grossPay": 3000,
  "netPay": 2100,
  "ytdGross": 15000,
  "ytdNetPay": 10500,
  "ytdTaxes": 4500,
  "deductions": {
    "federal": 300,
    "fica": 230,
    "other": 100
  },
  "confidence": "high or medium or low",
  "extractedFields": ["list of successfully extracted field names"],
  "warnings": ["any concerns or unclear values"]
}

Only include fields that are clearly visible. Return null for any unclear values.`;

    const text = await generateExtractionText(anthropic, mimeType, base64, prompt, model);
    const validated = validateExtraction(payStubSchema, text, "Pay stub");

    if (validated) {
      const extracted: ExtractedPayStubData = { ...validated, ...rawLineage(text, model) };
      checkPayStubConsistency(extracted);
      return extracted;
    }

    return {
      confidence: "low",
      extractedFields: [],
      warnings: [VALIDATION_FAILED_WARNING],
      ...lineageFor(model),
    };
  } catch (error) {
    console.error("Pay stub extraction error:", error);
  }

  return {
    confidence: "low",
    extractedFields: [],
    warnings: ["Failed to extract data from pay stub"],
    ...lineageFor(model),
  };
}

/**
 * Extract bank statement data using Claude vision
 */
export async function extractBankStatementData(filePath: string): Promise<ExtractedBankStatementData> {
  const model = EXTRACTION_MODEL_SINGLE_DOC;
  if (!anthropic) {
    return {
      confidence: "low",
      extractedFields: [],
      warnings: ["Anthropic API not configured"],
    };
  }

  try {
    const base64 = await fileToBase64(filePath);
    const mimeType = getMimeType(filePath);

    const prompt = `You are a banking document analysis specialist. Extract financial data from this bank statement.

Return ONLY valid JSON with this structure:
{
  "accountType": "checking or savings or money_market",
  "accountNumber": "last 4 digits or null",
  "statementPeriod": {
    "start": "2024-01-01 or null",
    "end": "2024-01-31 or null"
  },
  "openingBalance": 5000,
  "closingBalance": 6500,
  "totalDeposits": 3000,
  "totalWithdrawals": 1500,
  "averageDailyBalance": 5750,
  "transactions": [
    {"date": "2024-01-05", "description": "ACH Deposit", "amount": 1500, "type": "deposit"},
    {"date": "2024-01-10", "description": "Withdrawal", "amount": 500, "type": "withdrawal"}
  ],
  "confidence": "high or medium or low",
  "extractedFields": ["list of successfully extracted field names"],
  "warnings": ["any concerns or unclear values"]
}

Only include fields that are clearly visible. Return null for any unclear values.
Limit transactions array to first 10 most significant transactions.`;

    const text = await generateExtractionText(anthropic, mimeType, base64, prompt, model);
    const validated = validateExtraction(bankStatementSchema, text, "Bank statement");

    if (validated) {
      const extracted: ExtractedBankStatementData = { ...validated, ...rawLineage(text, model) };
      checkBankStatementConsistency(extracted);
      return extracted;
    }

    return {
      confidence: "low",
      extractedFields: [],
      warnings: [VALIDATION_FAILED_WARNING],
      ...lineageFor(model),
    };
  } catch (error) {
    console.error("Bank statement extraction error:", error);
  }

  return {
    confidence: "low",
    extractedFields: [],
    warnings: ["Failed to extract data from bank statement"],
    ...lineageFor(model),
  };
}

/**
 * Extract lease agreement data using Claude vision.
 * Used by the public Rent-to-Own Readiness calculator to auto-fill monthly rent.
 * Degrades gracefully (low confidence) when Claude is unavailable or parsing fails.
 */
export async function extractLeaseData(
  source: string | Buffer,
  storedMimeType?: string
): Promise<ExtractedLeaseData> {
  const model = EXTRACTION_MODEL_SINGLE_DOC;
  if (!anthropic) {
    return {
      confidence: "low",
      extractedFields: [],
      warnings: ["Anthropic API not configured"],
    };
  }

  try {
    const base64 = await fileToBase64(source);
    const mimeType = getMimeType(source, storedMimeType);

    const prompt = `You are a residential lease analysis specialist. Extract key terms from this lease agreement.

Return ONLY valid JSON with this structure:
{
  "monthlyRent": 1850,
  "tenantName": "full name or null",
  "landlordName": "name or null",
  "propertyAddress": "full address or null",
  "leaseStartDate": "2024-01-01 or null",
  "leaseEndDate": "2024-12-31 or null",
  "securityDeposit": 1850,
  "confidence": "high or medium or low",
  "extractedFields": ["list of successfully extracted field names"],
  "warnings": ["any concerns or unclear values"]
}

Important:
- "monthlyRent" must be the recurring MONTHLY rent amount as a plain number (no currency symbols or commas).
- If only an annual or weekly amount is shown, convert it to a monthly figure and add a warning.
- Only include fields that are clearly visible. Return null for any unclear values.`;

    const text = await generateExtractionText(anthropic, mimeType, base64, prompt, model);
    const validated = validateExtraction(leaseSchema, text, "Lease");

    if (validated) {
      const extracted: ExtractedLeaseData = { ...validated, ...rawLineage(text, model) };
      checkLeaseConsistency(extracted);
      return extracted;
    }

    return {
      confidence: "low",
      extractedFields: [],
      warnings: [VALIDATION_FAILED_WARNING],
      ...lineageFor(model),
    };
  } catch (error) {
    console.error("Lease extraction error:", error);
  }

  return {
    confidence: "low",
    extractedFields: [],
    warnings: ["Failed to extract data from lease agreement"],
    ...lineageFor(model),
  };
}

// ===========================================================================
// Multi-form tax-document intelligence (UAL P2a — Situation Identification
// Engine). Two passes over the SAME uploaded file:
//   1. classifyTaxDocument      — find every IRS form instance (type, year,
//                                 entity, page range) in the upload;
//   2. extractTaxFormInstanceFields — read one classified instance's fields,
//                                 each as {value, confidence}.
// Orchestration + persistence live in services/taxDocumentIntelligence.ts.
// Both passes obey the untrusted-output discipline above: everything the
// model returns goes through Zod with per-field drops; a missing value stays
// missing (never defaulted); EIN digits are reduced to last-4 in the shared
// schema itself.
// ===========================================================================

/** Model calls can hang on large PDFs; bound them so a run can always finish. */
