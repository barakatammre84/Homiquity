/**
 * AI Document Extraction Service
 * 
 * Uses Google Gemini to extract structured financial data from:
 * - Tax Returns (Form 1040, Schedule C)
 * - Pay Stubs (income verification)
 * - Bank Statements (asset verification)
 * - W-2 Forms (employment verification)
 */

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { ObjectStorageService, ObjectNotFoundError } from "./integrations/object_storage";
import { computeHash, encryptSensitiveData } from "./services/encryptionService";

// Model lineage, persisted with every extraction so a past result can be traced
// to the exact model + prompt that produced it. Bump EXTRACTION_PROMPT_VERSION
// whenever any extraction prompt text changes.
export const EXTRACTION_MODEL_ID = "gemini-2.0-flash";
export const EXTRACTION_PROMPT_VERSION = "2026-07-v1";

const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;
const objectStorageService = new ObjectStorageService();

interface ExtractionLineage {
  /** Model that produced this extraction (audit lineage). */
  modelId?: string;
  /** Prompt revision that produced this extraction (audit lineage). */
  promptVersion?: string;
  /** SHA-256 of the raw model response — ties stored fields to the exact output. */
  rawResponseHash?: string;
  /** The raw model response, AES-256-GCM encrypted (it can contain PII). */
  rawResponseEncrypted?: string;
  rawResponseIv?: string;
  rawResponseKeyId?: string;
}

export interface ExtractedTaxReturnData extends ExtractionLineage {
  documentYear: string;
  taxpayerName?: string;
  grossIncome?: number;
  adjustedGrossIncome?: number;
  taxableIncome?: number;
  filingStatus?: string;
  scheduleC?: {
    businessIncome?: number;
    businessExpenses?: number;
    netProfitLoss?: number;
  };
  scheduleD?: {
    capitalGains?: number;
  };
  confidence: "high" | "medium" | "low";
  extractedFields: string[];
  warnings?: string[];
}

export interface ExtractedPayStubData extends ExtractionLineage {
  employeeName?: string;
  employerName?: string;
  payPeriodStartDate?: string;
  payPeriodEndDate?: string;
  grossPay?: number;
  netPay?: number;
  ytdGross?: number;
  ytdNetPay?: number;
  ytdTaxes?: number;
  deductions?: {
    federal?: number;
    fica?: number;
    other?: number;
  };
  confidence: "high" | "medium" | "low";
  extractedFields: string[];
  warnings?: string[];
}

export interface ExtractedBankStatementData extends ExtractionLineage {
  accountType?: string;
  accountNumber?: string;
  statementPeriod?: { start?: string; end?: string };
  openingBalance?: number;
  closingBalance?: number;
  totalDeposits?: number;
  totalWithdrawals?: number;
  averageDailyBalance?: number;
  transactions?: Array<{
    date: string;
    description: string;
    amount: number;
    type: "deposit" | "withdrawal";
  }>;
  confidence: "high" | "medium" | "low";
  extractedFields: string[];
  warnings?: string[];
}

export interface ExtractedLeaseData extends ExtractionLineage {
  monthlyRent?: number;
  tenantName?: string;
  landlordName?: string;
  propertyAddress?: string;
  leaseStartDate?: string;
  leaseEndDate?: string;
  securityDeposit?: number;
  confidence: "high" | "medium" | "low";
  extractedFields: string[];
  warnings?: string[];
}

export type ExtractedDocumentData = 
  | ExtractedTaxReturnData 
  | ExtractedPayStubData 
  | ExtractedBankStatementData
  | ExtractedLeaseData;

// Accepts an in-memory Buffer (transient uploads that never persist, e.g. the
// public lease extractor), a normalized /objects/ path (object storage — the
// presigned-upload flow), or a legacy filesystem path.
async function fileToBase64(source: string | Buffer): Promise<string> {
  if (Buffer.isBuffer(source)) {
    return source.toString("base64");
  }
  if (source.startsWith("/objects/")) {
    const objectFile = await objectStorageService.getObjectEntityFile(source);
    const chunks: Buffer[] = [];
    const stream = objectFile.createReadStream();
    return new Promise((resolve, reject) => {
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("base64")));
      stream.on("error", reject);
    });
  }
  const fileBuffer = fs.readFileSync(source);
  return fileBuffer.toString("base64");
}

function getMimeType(source: string | Buffer, storedMimeType?: string): string {
  if (storedMimeType) return storedMimeType;
  if (Buffer.isBuffer(source)) return "application/octet-stream";
  const ext = path.extname(source).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

// ---------------------------------------------------------------------------
// Model-output validation.
//
// Gemini's JSON is untrusted input: it can be malformed, out of range, or
// steered by adversarial text embedded in an uploaded document (prompt
// injection). Nothing the model returns is trusted until it passes these
// schemas: numeric fields are clamped to sane document ranges (out-of-range
// values are DROPPED, not trusted), bank account numbers are reduced to their
// last 4 digits, cross-field consistency failures cap the model's self-reported
// confidence, and a structurally invalid payload degrades to a low-confidence
// empty extraction instead of flowing downstream.
// ---------------------------------------------------------------------------

const MAX_MONEY = 100_000_000;

function coerceMoney(v: unknown): unknown {
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return v ?? undefined;
}

// Invalid values yield `undefined` (field dropped) rather than failing the record.
const money = z.preprocess(coerceMoney, z.number().finite().min(0).max(MAX_MONEY)).optional().catch(undefined);
const signedMoney = z.preprocess(coerceMoney, z.number().finite().min(-MAX_MONEY).max(MAX_MONEY)).optional().catch(undefined);
const shortText = z.string().trim().min(1).max(200).optional().catch(undefined);
const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined);
const confidenceLevel = z.enum(["high", "medium", "low"]).catch("low");
const extractedFieldsList = z.array(z.string().max(100)).max(50).catch([]);
const warningsList = z.array(z.string().max(500)).max(20).optional().catch(undefined);

const taxReturnSchema = z.object({
  documentYear: z.string().trim().regex(/^\d{4}$/).optional().catch(undefined),
  taxpayerName: shortText,
  grossIncome: money,
  adjustedGrossIncome: money,
  taxableIncome: money,
  filingStatus: shortText,
  scheduleC: z.object({
    businessIncome: money,
    businessExpenses: money,
    netProfitLoss: signedMoney,
  }).optional().catch(undefined),
  scheduleD: z.object({
    capitalGains: signedMoney,
  }).optional().catch(undefined),
  confidence: confidenceLevel,
  extractedFields: extractedFieldsList,
  warnings: warningsList,
});

const payStubSchema = z.object({
  employeeName: shortText,
  employerName: shortText,
  payPeriodStartDate: isoDate,
  payPeriodEndDate: isoDate,
  grossPay: money,
  netPay: money,
  ytdGross: money,
  ytdNetPay: money,
  ytdTaxes: money,
  deductions: z.object({
    federal: money,
    fica: money,
    other: money,
  }).optional().catch(undefined),
  confidence: confidenceLevel,
  extractedFields: extractedFieldsList,
  warnings: warningsList,
});

const bankStatementSchema = z.object({
  accountType: shortText,
  // PII minimization: whatever the model returns, only the last 4 digits are kept.
  accountNumber: z.string().trim().max(50)
    .transform((s) => s.replace(/\D/g, "").slice(-4) || undefined)
    .optional().catch(undefined),
  statementPeriod: z.object({ start: isoDate, end: isoDate }).optional().catch(undefined),
  openingBalance: signedMoney,
  closingBalance: signedMoney,
  totalDeposits: money,
  totalWithdrawals: money,
  averageDailyBalance: signedMoney,
  transactions: z.array(z.object({
    date: z.string().trim().max(20).catch(""),
    description: z.string().trim().max(200).catch(""),
    amount: z.preprocess(coerceMoney, z.number().finite().min(-MAX_MONEY).max(MAX_MONEY)).catch(0),
    type: z.enum(["deposit", "withdrawal"]).catch("deposit"),
  })).max(20).optional().catch(undefined),
  confidence: confidenceLevel,
  extractedFields: extractedFieldsList,
  warnings: warningsList,
});

const leaseSchema = z.object({
  monthlyRent: money,
  tenantName: shortText,
  landlordName: shortText,
  propertyAddress: z.string().trim().min(1).max(300).optional().catch(undefined),
  leaseStartDate: isoDate,
  leaseEndDate: isoDate,
  securityDeposit: money,
  confidence: confidenceLevel,
  extractedFields: extractedFieldsList,
  warnings: warningsList,
});

/**
 * Parse + schema-validate a raw model response. Returns null when the payload
 * is structurally unusable (no JSON object / not an object) — field-level
 * problems are absorbed by the per-field `.catch()` fallbacks above.
 */
function validateExtraction<S extends z.ZodTypeAny>(
  schema: S,
  rawText: string,
  docLabel: string,
): z.infer<S> | null {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    console.error(`${docLabel} extraction failed schema validation:`, result.error.issues.slice(0, 3));
    return null;
  }
  return result.data;
}

type ConfidenceLevel = "high" | "medium" | "low";
const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = { low: 0, medium: 1, high: 2 };

/** Cap the model's self-reported confidence when our own checks contradict it. */
function capConfidence(
  data: { confidence: ConfidenceLevel; warnings?: string[] },
  cap: ConfidenceLevel,
  reason: string,
): void {
  data.warnings = [...(data.warnings ?? []), reason];
  if (CONFIDENCE_RANK[data.confidence] > CONFIDENCE_RANK[cap]) {
    data.confidence = cap;
  }
}

function checkTaxReturnConsistency(data: ExtractedTaxReturnData): void {
  if (data.taxableIncome !== undefined && data.grossIncome !== undefined && data.taxableIncome > data.grossIncome) {
    capConfidence(data, "medium", "Consistency check: taxable income exceeds gross income");
  }
  if (data.adjustedGrossIncome !== undefined && data.grossIncome !== undefined && data.adjustedGrossIncome > data.grossIncome) {
    capConfidence(data, "medium", "Consistency check: AGI exceeds gross income");
  }
}

function checkPayStubConsistency(data: ExtractedPayStubData): void {
  if (data.netPay !== undefined && data.grossPay !== undefined && data.netPay > data.grossPay) {
    capConfidence(data, "medium", "Consistency check: net pay exceeds gross pay");
  }
  if (data.ytdNetPay !== undefined && data.ytdGross !== undefined && data.ytdNetPay > data.ytdGross) {
    capConfidence(data, "medium", "Consistency check: YTD net exceeds YTD gross");
  }
  if (data.grossPay !== undefined && data.ytdGross !== undefined && data.grossPay > data.ytdGross) {
    capConfidence(data, "medium", "Consistency check: period gross exceeds YTD gross");
  }
}

function checkBankStatementConsistency(data: ExtractedBankStatementData): void {
  if (
    data.openingBalance !== undefined &&
    data.closingBalance !== undefined &&
    data.totalDeposits !== undefined &&
    data.totalWithdrawals !== undefined
  ) {
    const expectedClosing = data.openingBalance + data.totalDeposits - data.totalWithdrawals;
    // Tolerance for fee/interest lines not captured in the two aggregates.
    if (Math.abs(expectedClosing - data.closingBalance) > Math.max(100, Math.abs(data.closingBalance) * 0.05)) {
      capConfidence(data, "medium", "Consistency check: balances do not reconcile (opening + deposits - withdrawals != closing)");
    }
  }
}

function checkLeaseConsistency(data: ExtractedLeaseData): void {
  if (data.monthlyRent !== undefined && (data.monthlyRent < 100 || data.monthlyRent > 50_000)) {
    capConfidence(data, "medium", "Consistency check: monthly rent outside plausible range");
  }
  if (data.securityDeposit !== undefined && data.monthlyRent !== undefined && data.securityDeposit > 12 * data.monthlyRent) {
    capConfidence(data, "medium", "Consistency check: security deposit exceeds 12x monthly rent");
  }
}

const LINEAGE = { modelId: EXTRACTION_MODEL_ID, promptVersion: EXTRACTION_PROMPT_VERSION } as const;
const VALIDATION_FAILED_WARNING =
  "Model output failed schema validation - values discarded, manual review required";

/**
 * Lineage for a successful extraction: model/prompt ids plus a hash of the raw
 * model response and the raw response itself, encrypted (it can carry PII).
 * Lets an auditor later confirm the stored fields came from that exact output.
 */
function rawLineage(rawText: string): ExtractionLineage {
  const enc = encryptSensitiveData(rawText);
  return {
    ...LINEAGE,
    rawResponseHash: computeHash(rawText),
    rawResponseEncrypted: enc.encryptedContent,
    rawResponseIv: enc.iv,
    rawResponseKeyId: enc.keyId,
  };
}

/**
 * Extract tax return data using Gemini vision
 */
export async function extractTaxReturnData(
  filePath: string,
  documentYear?: string
): Promise<ExtractedTaxReturnData> {
  if (!genAI) {
    return {
      documentYear: documentYear || new Date().getFullYear().toString(),
      confidence: "low",
      extractedFields: [],
      warnings: ["Gemini API not configured - returning empty extraction"],
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
  "confidence": "high or medium or low",
  "extractedFields": ["list of successfully extracted field names"],
  "warnings": ["list of any concerns or unclear values"]
}

Only include fields that are clearly visible. Return null for any unclear values.
If Schedule C or D are not present, omit those sections.`;

    const response = await genAI.models.generateContent({
      model: EXTRACTION_MODEL_ID,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
    });

    const text = response.text || "";
    const validated = validateExtraction(taxReturnSchema, text, "Tax return");

    if (validated) {
      const extracted: ExtractedTaxReturnData = {
        ...validated,
        documentYear: validated.documentYear || documentYear || new Date().getFullYear().toString(),
        ...rawLineage(text),
      };
      checkTaxReturnConsistency(extracted);
      return extracted;
    }

    return {
      documentYear: documentYear || new Date().getFullYear().toString(),
      confidence: "low",
      extractedFields: [],
      warnings: [VALIDATION_FAILED_WARNING],
      ...LINEAGE,
    };
  } catch (error) {
    console.error("Tax return extraction error:", error);
  }

  return {
    documentYear: documentYear || new Date().getFullYear().toString(),
    confidence: "low",
    extractedFields: [],
    warnings: ["Failed to extract data from tax return"],
    ...LINEAGE,
  };
}

/**
 * Extract pay stub data using Gemini vision
 */
export async function extractPayStubData(filePath: string): Promise<ExtractedPayStubData> {
  if (!genAI) {
    return {
      confidence: "low",
      extractedFields: [],
      warnings: ["Gemini API not configured"],
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

    const response = await genAI.models.generateContent({
      model: EXTRACTION_MODEL_ID,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
    });

    const text = response.text || "";
    const validated = validateExtraction(payStubSchema, text, "Pay stub");

    if (validated) {
      const extracted: ExtractedPayStubData = { ...validated, ...rawLineage(text) };
      checkPayStubConsistency(extracted);
      return extracted;
    }

    return {
      confidence: "low",
      extractedFields: [],
      warnings: [VALIDATION_FAILED_WARNING],
      ...LINEAGE,
    };
  } catch (error) {
    console.error("Pay stub extraction error:", error);
  }

  return {
    confidence: "low",
    extractedFields: [],
    warnings: ["Failed to extract data from pay stub"],
    ...LINEAGE,
  };
}

/**
 * Extract bank statement data using Gemini vision
 */
export async function extractBankStatementData(filePath: string): Promise<ExtractedBankStatementData> {
  if (!genAI) {
    return {
      confidence: "low",
      extractedFields: [],
      warnings: ["Gemini API not configured"],
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

    const response = await genAI.models.generateContent({
      model: EXTRACTION_MODEL_ID,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
    });

    const text = response.text || "";
    const validated = validateExtraction(bankStatementSchema, text, "Bank statement");

    if (validated) {
      const extracted: ExtractedBankStatementData = { ...validated, ...rawLineage(text) };
      checkBankStatementConsistency(extracted);
      return extracted;
    }

    return {
      confidence: "low",
      extractedFields: [],
      warnings: [VALIDATION_FAILED_WARNING],
      ...LINEAGE,
    };
  } catch (error) {
    console.error("Bank statement extraction error:", error);
  }

  return {
    confidence: "low",
    extractedFields: [],
    warnings: ["Failed to extract data from bank statement"],
    ...LINEAGE,
  };
}

/**
 * Extract lease agreement data using Gemini vision.
 * Used by the public Rent-to-Own Readiness calculator to auto-fill monthly rent.
 * Degrades gracefully (low confidence) when Gemini is unavailable or parsing fails.
 */
export async function extractLeaseData(
  source: string | Buffer,
  storedMimeType?: string
): Promise<ExtractedLeaseData> {
  if (!genAI) {
    return {
      confidence: "low",
      extractedFields: [],
      warnings: ["Gemini API not configured"],
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

    const response = await genAI.models.generateContent({
      model: EXTRACTION_MODEL_ID,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
    });

    const text = response.text || "";
    const validated = validateExtraction(leaseSchema, text, "Lease");

    if (validated) {
      const extracted: ExtractedLeaseData = { ...validated, ...rawLineage(text) };
      checkLeaseConsistency(extracted);
      return extracted;
    }

    return {
      confidence: "low",
      extractedFields: [],
      warnings: [VALIDATION_FAILED_WARNING],
      ...LINEAGE,
    };
  } catch (error) {
    console.error("Lease extraction error:", error);
  }

  return {
    confidence: "low",
    extractedFields: [],
    warnings: ["Failed to extract data from lease agreement"],
    ...LINEAGE,
  };
}
