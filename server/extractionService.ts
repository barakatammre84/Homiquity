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

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { ObjectStorageService, ObjectNotFoundError } from "./integrations/object_storage";
import { computeHash, encryptSensitiveData } from "./services/encryptionService";
import {
  TAX_FORM_FIELD_CATALOG,
  taxDocumentClassificationSchema,
  buildFormExtractionResponseSchema,
  type ClassifiedFormInstance,
  type TaxDocumentClassification,
  type ExtractedFieldValue,
  type TaxFormType,
} from "@shared/taxFormExtraction";

// Model lineage, persisted with every extraction so a past result can be traced
// to the exact model + prompt that produced it. Bump EXTRACTION_PROMPT_VERSION
// whenever any extraction prompt text changes.
export const EXTRACTION_MODEL_ID = "claude-opus-4-8";
export const EXTRACTION_PROMPT_VERSION = "2026-07-v3";
/** Lineage marker for deterministic simulated extractions (I10: unmistakable). */
export const SIMULATED_MODEL_ID = "simulated";

// Captured at import time (tests rely on this): construct the client only when
// a key exists — the Anthropic SDK throws at construction with no API key.
const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;
const objectStorageService = new ObjectStorageService();

export interface ExtractionLineage {
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
  /** Form 1040 line 1a — total W-2 wages. */
  w2Wages?: number;
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
  scheduleE?: {
    /** Schedule E Part I line 26 — total rental real estate income or (loss). */
    netRentalIncomeLoss?: number;
    /** Sum of line 3 (rents received) across property columns. */
    grossRents?: number;
    /** Line 18 total depreciation expense. */
    totalDepreciation?: number;
    /** Line 12 total mortgage interest paid to banks. */
    mortgageInterest?: number;
    /** Number of property columns with data (Part I). */
    propertyCount?: number;
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

/**
 * Wrap an uploaded file as the correct Anthropic content block: images go in
 * an image block, everything else (uploads are constrained to pdf/jpg/png) is
 * treated as a PDF document block.
 */
function mediaBlock(mimeType: string, base64: string): Anthropic.ContentBlockParam {
  if (mimeType.startsWith("image/")) {
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: base64,
      },
    };
  }
  return {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: base64 },
  };
}

/**
 * One vision/document call: file + prompt in, raw model text out. A safety
 * refusal (stop_reason "refusal") returns "" so the caller's low-confidence
 * fallback handles it like any other unusable response.
 */
async function generateExtractionText(
  client: Anthropic,
  mimeType: string,
  base64: string,
  prompt: string,
): Promise<string> {
  const response = await client.messages.create({
    model: EXTRACTION_MODEL_ID,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: [mediaBlock(mimeType, base64), { type: "text", text: prompt }],
      },
    ],
  });
  if (response.stop_reason === "refusal") return "";
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

// ---------------------------------------------------------------------------
// Model-output validation.
//
// The model's JSON is untrusted input: it can be malformed, out of range, or
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
  w2Wages: money,
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
  scheduleE: z.object({
    netRentalIncomeLoss: signedMoney,
    grossRents: money,
    totalDepreciation: money,
    mortgageInterest: money,
    propertyCount: z.preprocess(coerceMoney, z.number().int().min(0).max(50)).optional().catch(undefined),
  }).optional().catch(undefined),
  confidence: confidenceLevel,
  extractedFields: extractedFieldsList,
  warnings: warningsList,
});

/**
 * Test seam: parse + schema-validate a raw tax-return model response.
 * Exercises the same untrusted-input path extractTaxReturnData uses.
 */
export function validateTaxReturnResponse(rawText: string) {
  return validateExtraction(taxReturnSchema, rawText, "Tax return");
}

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

// Exported as a test seam: this cross-field hardening runs only in the real
// model path (after schema validation), so the unit tests exercise it directly.
export function checkTaxReturnConsistency(data: ExtractedTaxReturnData): void {
  if (data.taxableIncome !== undefined && data.grossIncome !== undefined && data.taxableIncome > data.grossIncome) {
    capConfidence(data, "medium", "Consistency check: taxable income exceeds gross income");
  }
  if (data.adjustedGrossIncome !== undefined && data.grossIncome !== undefined && data.adjustedGrossIncome > data.grossIncome) {
    capConfidence(data, "medium", "Consistency check: AGI exceeds gross income");
  }
  if (data.w2Wages !== undefined && data.grossIncome !== undefined && data.w2Wages > data.grossIncome) {
    capConfidence(data, "medium", "Consistency check: W-2 wages exceed gross income");
  }
  if (
    data.scheduleE?.netRentalIncomeLoss !== undefined &&
    data.scheduleE.grossRents !== undefined &&
    data.scheduleE.netRentalIncomeLoss > data.scheduleE.grossRents
  ) {
    capConfidence(data, "medium", "Consistency check: Schedule E net rental income exceeds gross rents");
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

    const text = await generateExtractionText(anthropic, mimeType, base64, prompt);
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
 * Extract pay stub data using Claude vision
 */
export async function extractPayStubData(filePath: string): Promise<ExtractedPayStubData> {
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

    const text = await generateExtractionText(anthropic, mimeType, base64, prompt);
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
 * Extract bank statement data using Claude vision
 */
export async function extractBankStatementData(filePath: string): Promise<ExtractedBankStatementData> {
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

    const text = await generateExtractionText(anthropic, mimeType, base64, prompt);
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
 * Extract lease agreement data using Claude vision.
 * Used by the public Rent-to-Own Readiness calculator to auto-fill monthly rent.
 * Degrades gracefully (low confidence) when Claude is unavailable or parsing fails.
 */
export async function extractLeaseData(
  source: string | Buffer,
  storedMimeType?: string
): Promise<ExtractedLeaseData> {
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

    const text = await generateExtractionText(anthropic, mimeType, base64, prompt);
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
const TAX_INTEL_CALL_TIMEOUT_MS = 90_000;

async function withCallTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${TAX_INTEL_CALL_TIMEOUT_MS}ms`)),
          TAX_INTEL_CALL_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface TaxFormClassificationResult {
  classification: TaxDocumentClassification | null;
  lineage: ExtractionLineage;
  simulated: boolean;
  /** Set when classification is null — why the pass produced nothing. */
  failureReason?: string;
}

export interface TaxFormInstanceExtraction {
  taxYear: number | null;
  entityName: string | null;
  /** Validated fields; a field absent here was not readable — never assume 0. */
  fields: Record<string, ExtractedFieldValue>;
  warnings: string[];
  lineage: ExtractionLineage;
  simulated: boolean;
}

const FORM_TYPE_PROMPT_LABELS: Record<TaxFormType, string> = {
  tax_return_1040: "Form 1040 — U.S. Individual Income Tax Return (the two main pages)",
  schedule_1: "Schedule 1 (Form 1040) — Additional Income and Adjustments to Income",
  schedule_b: "Schedule B (Form 1040) — Interest and Ordinary Dividends",
  schedule_c: "Schedule C (Form 1040) — Profit or Loss From Business (one instance PER business)",
  schedule_d: "Schedule D (Form 1040) — Capital Gains and Losses",
  schedule_e: "Schedule E (Form 1040) — Supplemental Income and Loss",
  schedule_k1: "Schedule K-1 — partner's or shareholder's share of income (one instance PER K-1)",
  business_tax_return_1065: "Form 1065 — U.S. Return of Partnership Income",
  business_tax_return_1120s: "Form 1120-S — U.S. Income Tax Return for an S Corporation",
  business_tax_return_1120: "Form 1120 — U.S. Corporation Income Tax Return",
  form_8825: "Form 8825 — Rental Real Estate Income and Expenses of a Partnership or an S Corporation",
  form_4562: "Form 4562 — Depreciation and Amortization (one instance per business or activity)",
  w2: "Form W-2 — Wage and Tax Statement (one instance per employer per year)",
  "1099_nec": "Form 1099-NEC — Nonemployee Compensation (one instance per payer per year)",
  "1099_misc": "Form 1099-MISC — Miscellaneous Information (one instance per payer per year)",
};

const FIELD_KIND_PROMPT_HINTS: Record<string, string> = {
  currency: "dollar amount, 0 or greater, plain number without $ or commas",
  signedCurrency:
    "dollar amount as a plain number; amounts shown in parentheses on the form are NEGATIVE",
  integer: "whole-number count",
  percent: "percentage between 0 and 100",
  text: "short text exactly as printed",
  naics: "the 6-digit code exactly as printed",
  einLast4: "the LAST 4 DIGITS ONLY — never return a full EIN",
  boolean: "true or false",
};

function buildClassificationPrompt(): string {
  const formList = (Object.entries(FORM_TYPE_PROMPT_LABELS) as [TaxFormType, string][])
    .map(([type, label]) => `- "${type}": ${label}`)
    .join("\n");
  return `You are a mortgage document-intelligence specialist. The attached upload is a tax package that may contain MULTIPLE IRS forms, MULTIPLE tax years, and MULTIPLE business entities. Identify every distinct form instance.

Recognized form types (use these exact identifiers, nothing else):
${formList}

Rules:
- Emit ONE entry per (form type, tax year, entity). Three Schedule Cs for three businesses are three entries; the same business across two years is two entries.
- "entityName": the business or issuing-entity name as printed on that form (null for personal forms like the 1040).
- "k1Variant": for schedule_k1 only — "1065" for a partnership K-1, "1120s" for an S-corporation K-1; null otherwise.
- "pageStart"/"pageEnd": 1-indexed inclusive page range where the instance appears in THIS file.
- "confidence": 0.0-1.0 — your confidence that the instance exists as identified.
- Do NOT guess. If pages are unreadable or ambiguous, lower the confidence and add a note to "warnings".

Return ONLY valid JSON:
{"pageCount": <total pages>, "forms": [{"formType": "...", "taxYear": 2025, "entityName": "... or null", "k1Variant": "1065 or 1120s or null", "pageStart": 1, "pageEnd": 2, "confidence": 0.95}], "warnings": []}`;
}

function buildFormExtractionPrompt(instance: ClassifiedFormInstance): string {
  const catalog = TAX_FORM_FIELD_CATALOG[instance.formType];
  const fieldLines = Object.entries(catalog)
    .map(([name, spec]) => `- "${name}" (${FIELD_KIND_PROMPT_HINTS[spec.kind]}): ${spec.description}`)
    .join("\n");
  const where = [
    instance.taxYear ? `tax year ${instance.taxYear}` : null,
    instance.entityName ? `entity "${instance.entityName}"` : null,
    instance.pageStart
      ? `located approximately at pages ${instance.pageStart}-${instance.pageEnd ?? instance.pageStart}`
      : null,
  ]
    .filter(Boolean)
    .join(", ");
  return `You are a tax document analysis specialist. The attached file is a complete tax package. Extract fields from EXACTLY ONE form instance in it:

Target: ${FORM_TYPE_PROMPT_LABELS[instance.formType]}${where ? ` — ${where}` : ""}.

Read ONLY that instance. If the same form appears for another year or another entity, ignore those.

Fields to extract:
${fieldLines}

Rules:
- Every field you return must be {"value": <value>, "confidence": <0.0-1.0>}.
- If a field is not present on the form or is unreadable, OMIT it or return {"value": null, "confidence": <low>}. NEVER estimate, compute, or carry a value from a different form or year.
- Numbers must be plain (no currency symbols, no thousands separators). Parentheses on the form mean a negative number.

Return ONLY valid JSON:
{"taxYear": ${instance.taxYear ?? "<year or null>"}, "entityName": ${instance.entityName ? `"${instance.entityName}"` : "<name or null>"}, "fields": {"<fieldName>": {"value": 12345, "confidence": 0.97}}, "warnings": []}`;
}

// ---------------------------------------------------------------------------
// Deterministic simulation (EXTRACTION_SIMULATE=true, no Anthropic key). One
// coherent multi-entity, multi-year self-employed scenario, seeded by file
// path: two Schedule C businesses (one profitable, one loss), a rental on
// Schedule E, a 50% partnership K-1 tied to its Form 1065 (with Schedule L
// liquidity components), plus the prior-year 1040/Schedule C for trend math.
// Internally consistent so the P2b tie-out engine passes on it; a couple of
// fields are deliberately omitted or low-confidence so review tiers and
// missing-value honesty are exercisable in dev and tests.
// ---------------------------------------------------------------------------

function seededFrac(seedText: string): number {
  return parseInt(computeHash(seedText).slice(0, 8), 16) / 0xffffffff;
}

interface SimulatedTaxInstance {
  meta: NonNullable<TaxDocumentClassification["forms"][number]>;
  extraction: Pick<TaxFormInstanceExtraction, "taxYear" | "entityName" | "fields" | "warnings">;
}

export function buildSimulatedTaxScenario(filePath: string): {
  classification: TaxDocumentClassification;
  instances: SimulatedTaxInstance[];
} {
  const frac = seededFrac(`tax-intel-sim:${filePath}`);
  const conf = (tag: string, lo = 0.78, hi = 0.99) =>
    Math.round((lo + seededFrac(`tax-intel-conf:${filePath}:${tag}`) * (hi - lo)) * 100) / 100;
  const f = (value: number | string, tag: string): ExtractedFieldValue => ({
    value,
    confidence: conf(tag),
  });
  const r = Math.round;
  const year = new Date().getFullYear() - 1;
  const priorYear = year - 1;
  const einLast4 = String(1000 + Math.floor(seededFrac(`tax-intel-ein:${filePath}`) * 9000));

  // Businesses
  const consultingNet = r(42_000 + frac * 30_000);
  const consultingReceipts = r(consultingNet * 1.9);
  const consultingExpenses = consultingReceipts - consultingNet;
  const consultingDepreciation = r(4_000 + frac * 3_000);
  const consultingHomeOffice = r(2_400 + frac * 1_200);
  const consultingMeals = r(900 + frac * 600);
  const consultingOtherExpenses = r(1_500 + frac * 1_000);

  const ecomNet = -r(3_000 + frac * 5_000);
  const ecomReceipts = r(18_000 + frac * 6_000);
  const ecomExpenses = ecomReceipts - ecomNet;

  // Partnership + 50% K-1
  const partnershipOrdinary = r(80_000 + frac * 40_000);
  const k1Ordinary = r(partnershipOrdinary / 2);
  const k1Guaranteed = r(12_000 + frac * 6_000);
  const partnershipDistributions = r(30_000 + frac * 10_000);
  const k1Distributions = r(partnershipDistributions / 2);
  const partnershipTotalIncome = r(partnershipOrdinary * 2);
  const partnershipTotalDeductions = partnershipTotalIncome - partnershipOrdinary;

  // Rental (Schedule E Part I)
  const rents = r(30_000 + frac * 20_000);
  const rentalDepreciation = r(rents * 0.25);
  const rentalMortgageInterest = r(rents * 0.3);
  const rentalExpensesTotal = r(rents * 0.62);
  const rentalNet = rents - rentalExpensesTotal;

  // Roll-ups (kept internally consistent for the tie-out engine)
  const schedCTotal = consultingNet + ecomNet;
  const schedEPartII = k1Ordinary + k1Guaranteed;
  const schedETotal = rentalNet + schedEPartII;
  const wages = r(18_000 + frac * 10_000);
  const interest = r(300 + frac * 400);
  const dividends = r(900 + frac * 800);
  const additionalIncome = schedCTotal + schedETotal;
  const totalIncome = wages + interest + dividends + additionalIncome;
  const adjustments = r(6_000 + frac * 2_000);
  const agi = totalIncome - adjustments;
  const taxable = Math.max(0, agi - 21_900);

  // Prior year (primary business trending up into the current year)
  const priorConsultingNet = r(consultingNet * 0.85);
  const priorConsultingReceipts = r(priorConsultingNet * 1.9);
  const priorWages = r(wages * 0.95);
  const priorTotalIncome = priorWages + priorConsultingNet;
  const priorAgi = priorTotalIncome - r(adjustments * 0.9);

  // Schedule L (healthy liquidity: quick ratio well above 1)
  const lCash = r(45_000 + frac * 20_000);
  const lReceivables = r(22_000 + frac * 8_000);
  const lAp = r(9_000 + frac * 3_000);
  const lShortDebt = r(6_000 + frac * 2_000);
  const lOtherCurrent = r(4_000 + frac * 1_500);

  const person = "Alex Simworth";
  const simWarning = "Simulated extraction - no Anthropic credentials (EXTRACTION_SIMULATE)";

  const instances: SimulatedTaxInstance[] = [
    {
      meta: { formType: "tax_return_1040", taxYear: year, entityName: null, k1Variant: null, pageStart: 1, pageEnd: 2, confidence: conf("cls-1040") },
      extraction: {
        taxYear: year,
        entityName: null,
        fields: {
          taxpayerName: f(person, "1040-name"),
          filingStatus: f("married_filing_jointly", "1040-status"),
          wagesSalariesTips: f(wages, "1040-wages"),
          taxableInterest: f(interest, "1040-interest"),
          ordinaryDividends: f(dividends, "1040-dividends"),
          additionalIncomeFromSchedule1: f(additionalIncome, "1040-addl"),
          totalIncome: f(totalIncome, "1040-total"),
          adjustedGrossIncome: f(agi, "1040-agi"),
          taxableIncome: f(taxable, "1040-taxable"),
        },
        warnings: [simWarning],
      },
    },
    {
      meta: { formType: "schedule_1", taxYear: year, entityName: null, k1Variant: null, pageStart: 3, pageEnd: 4, confidence: conf("cls-sch1") },
      extraction: {
        taxYear: year,
        entityName: null,
        fields: {
          businessIncomeOrLoss: f(schedCTotal, "sch1-biz"),
          rentalRealEstatePartnershipsSCorpsIncomeOrLoss: f(schedETotal, "sch1-rental"),
          additionalIncomeTotal: f(additionalIncome, "sch1-total"),
          adjustmentsToIncomeTotal: f(adjustments, "sch1-adj"),
        },
        warnings: [simWarning],
      },
    },
    {
      meta: { formType: "schedule_c", taxYear: year, entityName: "Simworth Consulting", k1Variant: null, pageStart: 5, pageEnd: 7, confidence: conf("cls-schc1") },
      extraction: {
        taxYear: year,
        entityName: "Simworth Consulting",
        fields: {
          businessName: f("Simworth Consulting", "schc1-name"),
          principalBusinessOrProfession: f("Management consulting", "schc1-activity"),
          businessCodeNaics: f("541611", "schc1-naics"),
          grossReceipts: f(consultingReceipts, "schc1-receipts"),
          grossIncome: f(consultingReceipts, "schc1-gross"),
          totalExpenses: f(consultingExpenses, "schc1-expenses"),
          netProfitOrLoss: f(consultingNet, "schc1-net"),
          depreciationAndSection179: f(consultingDepreciation, "schc1-depr"),
          deductibleMeals: f(consultingMeals, "schc1-meals"),
          // Deliberately LOW confidence — exercises the flagged review tier.
          businessUseOfHomeExpenses: { value: consultingHomeOffice, confidence: 0.55 },
          otherExpensesTotal: f(consultingOtherExpenses, "schc1-other"),
          // depletion + amortizationInOtherExpenses deliberately ABSENT —
          // exercises missing-value honesty (absent ≠ 0).
        },
        warnings: [simWarning, "Business use of home figure partially obscured (simulated)"],
      },
    },
    {
      meta: { formType: "schedule_c", taxYear: year, entityName: "Simworth Trading Co", k1Variant: null, pageStart: 8, pageEnd: 10, confidence: conf("cls-schc2") },
      extraction: {
        taxYear: year,
        entityName: "Simworth Trading Co",
        fields: {
          businessName: f("Simworth Trading Co", "schc2-name"),
          principalBusinessOrProfession: f("Online retail", "schc2-activity"),
          businessCodeNaics: f("455110", "schc2-naics"),
          grossReceipts: f(ecomReceipts, "schc2-receipts"),
          totalExpenses: f(ecomExpenses, "schc2-expenses"),
          netProfitOrLoss: f(ecomNet, "schc2-net"),
        },
        warnings: [simWarning],
      },
    },
    {
      meta: { formType: "schedule_e", taxYear: year, entityName: null, k1Variant: null, pageStart: 11, pageEnd: 12, confidence: conf("cls-sche") },
      extraction: {
        taxYear: year,
        entityName: null,
        fields: {
          propertyCount: f(1, "sche-count"),
          rentsReceivedTotal: f(rents, "sche-rents"),
          totalExpensesTotal: f(rentalExpensesTotal, "sche-expenses"),
          depreciationTotal: f(rentalDepreciation, "sche-depr"),
          mortgageInterestTotal: f(rentalMortgageInterest, "sche-interest"),
          netRentalRealEstateIncomeOrLoss: f(rentalNet, "sche-net"),
          partnershipSCorpIncomeOrLossTotal: f(schedEPartII, "sche-partii"),
        },
        warnings: [simWarning],
      },
    },
    {
      meta: { formType: "schedule_k1", taxYear: year, entityName: "Simworth Ventures LP", k1Variant: "1065", pageStart: 13, pageEnd: 14, confidence: conf("cls-k1") },
      extraction: {
        taxYear: year,
        entityName: "Simworth Ventures LP",
        fields: {
          entityName: f("Simworth Ventures LP", "k1-entity"),
          entityEinLast4: f(einLast4, "k1-ein"),
          partnerOrShareholderName: f(person, "k1-partner"),
          ordinaryBusinessIncomeOrLoss: f(k1Ordinary, "k1-ordinary"),
          guaranteedPayments: f(k1Guaranteed, "k1-guaranteed"),
          distributionsTotal: f(k1Distributions, "k1-distributions"),
          ownershipPercentEndOfYear: f(50, "k1-pct"),
        },
        warnings: [simWarning],
      },
    },
    {
      meta: { formType: "business_tax_return_1065", taxYear: year, entityName: "Simworth Ventures LP", k1Variant: null, pageStart: 15, pageEnd: 20, confidence: conf("cls-1065") },
      extraction: {
        taxYear: year,
        entityName: "Simworth Ventures LP",
        fields: {
          entityName: f("Simworth Ventures LP", "1065-entity"),
          entityEinLast4: f(einLast4, "1065-ein"),
          businessCodeNaics: f("541611", "1065-naics"),
          grossReceipts: f(r(partnershipOrdinary * 2.2), "1065-receipts"),
          totalIncome: f(partnershipTotalIncome, "1065-income"),
          totalDeductions: f(partnershipTotalDeductions, "1065-deductions"),
          ordinaryBusinessIncomeOrLoss: f(partnershipOrdinary, "1065-ordinary"),
          guaranteedPaymentsToPartners: f(k1Guaranteed * 2, "1065-guaranteed"),
          depreciationDeduction: f(r(6_000 + frac * 4_000), "1065-depr"),
          numberOfSchedulesK1Attached: f(2, "1065-k1count"),
          distributionsTotal: f(partnershipDistributions, "1065-distributions"),
          scheduleLCashEndOfYear: f(lCash, "1065-lcash"),
          scheduleLReceivablesEndOfYear: f(lReceivables, "1065-lrecv"),
          scheduleLInventoriesEndOfYear: f(0, "1065-linv"),
          scheduleLTotalAssetsEndOfYear: f(lCash + lReceivables + 65_000, "1065-lassets"),
          scheduleLAccountsPayableEndOfYear: f(lAp, "1065-lap"),
          scheduleLShortTermDebtEndOfYear: f(lShortDebt, "1065-lstd"),
          scheduleLOtherCurrentLiabilitiesEndOfYear: f(lOtherCurrent, "1065-locl"),
          scheduleLTotalLiabilitiesEndOfYear: f(r(60_000 + frac * 10_000), "1065-lliab"),
        },
        warnings: [simWarning],
      },
    },
    {
      meta: { formType: "tax_return_1040", taxYear: priorYear, entityName: null, k1Variant: null, pageStart: 21, pageEnd: 22, confidence: conf("cls-1040p") },
      extraction: {
        taxYear: priorYear,
        entityName: null,
        fields: {
          taxpayerName: f(person, "1040p-name"),
          filingStatus: f("married_filing_jointly", "1040p-status"),
          wagesSalariesTips: f(priorWages, "1040p-wages"),
          additionalIncomeFromSchedule1: f(priorConsultingNet, "1040p-addl"),
          totalIncome: f(priorTotalIncome, "1040p-total"),
          adjustedGrossIncome: f(priorAgi, "1040p-agi"),
        },
        warnings: [simWarning],
      },
    },
    {
      meta: { formType: "schedule_c", taxYear: priorYear, entityName: "Simworth Consulting", k1Variant: null, pageStart: 23, pageEnd: 25, confidence: conf("cls-schc1p") },
      extraction: {
        taxYear: priorYear,
        entityName: "Simworth Consulting",
        fields: {
          businessName: f("Simworth Consulting", "schc1p-name"),
          businessCodeNaics: f("541611", "schc1p-naics"),
          grossReceipts: f(priorConsultingReceipts, "schc1p-receipts"),
          totalExpenses: f(priorConsultingReceipts - priorConsultingNet, "schc1p-expenses"),
          netProfitOrLoss: f(priorConsultingNet, "schc1p-net"),
          depreciationAndSection179: f(r(consultingDepreciation * 0.9), "schc1p-depr"),
        },
        warnings: [simWarning],
      },
    },
  ];

  return {
    classification: {
      pageCount: 25,
      forms: instances.map((i) => i.meta),
      warnings: [simWarning],
    },
    instances,
  };
}

function simulatedLineage(): ExtractionLineage {
  return { modelId: SIMULATED_MODEL_ID, promptVersion: EXTRACTION_PROMPT_VERSION };
}

/** Pass 1: find every IRS form instance in the uploaded tax package. */
export async function classifyTaxDocument(
  filePath: string,
  storedMimeType?: string,
): Promise<TaxFormClassificationResult> {
  if (!anthropic) {
    if (process.env.EXTRACTION_SIMULATE === "true") {
      const sim = buildSimulatedTaxScenario(filePath);
      return { classification: sim.classification, lineage: simulatedLineage(), simulated: true };
    }
    return {
      classification: null,
      lineage: LINEAGE,
      simulated: false,
      failureReason: "Anthropic API not configured - tax document classification unavailable",
    };
  }

  try {
    const base64 = await fileToBase64(filePath);
    const mimeType = getMimeType(filePath, storedMimeType);
    const text = await withCallTimeout(
      generateExtractionText(anthropic, mimeType, base64, buildClassificationPrompt()),
      "Tax document classification",
    );
    const validated = validateExtraction(taxDocumentClassificationSchema, text, "Tax document classification");
    if (validated) {
      return { classification: validated, lineage: rawLineage(text), simulated: false };
    }
    return {
      classification: null,
      lineage: rawLineage(text),
      simulated: false,
      failureReason: VALIDATION_FAILED_WARNING,
    };
  } catch (error) {
    console.error("Tax document classification error:", error);
    return {
      classification: null,
      lineage: LINEAGE,
      simulated: false,
      failureReason: "Tax document classification call failed",
    };
  }
}

/** Instances match on (formType, taxYear, entityName) — the classifier's identity triple. */
function matchesSimInstance(
  sim: SimulatedTaxInstance,
  instance: ClassifiedFormInstance,
): boolean {
  return (
    sim.meta.formType === instance.formType &&
    (sim.meta.taxYear ?? null) === (instance.taxYear ?? null) &&
    (sim.meta.entityName ?? null) === (instance.entityName ?? null)
  );
}

/** Pass 2: extract one classified form instance's fields as {value, confidence}. */
export async function extractTaxFormInstanceFields(
  filePath: string,
  instance: ClassifiedFormInstance,
  storedMimeType?: string,
): Promise<TaxFormInstanceExtraction> {
  if (!anthropic) {
    if (process.env.EXTRACTION_SIMULATE === "true") {
      const sim = buildSimulatedTaxScenario(filePath);
      const match = sim.instances.find((i) => matchesSimInstance(i, instance));
      if (match) {
        return { ...match.extraction, lineage: simulatedLineage(), simulated: true };
      }
      return {
        taxYear: instance.taxYear ?? null,
        entityName: instance.entityName ?? null,
        fields: {},
        warnings: ["Simulated extraction: no simulated data for this form instance"],
        lineage: simulatedLineage(),
        simulated: true,
      };
    }
    return {
      taxYear: instance.taxYear ?? null,
      entityName: instance.entityName ?? null,
      fields: {},
      warnings: ["Anthropic API not configured - form extraction unavailable"],
      lineage: LINEAGE,
      simulated: false,
    };
  }

  try {
    const base64 = await fileToBase64(filePath);
    const mimeType = getMimeType(filePath, storedMimeType);
    const text = await withCallTimeout(
      generateExtractionText(anthropic, mimeType, base64, buildFormExtractionPrompt(instance)),
      `Form extraction (${instance.formType})`,
    );
    const schema = buildFormExtractionResponseSchema(instance.formType);
    const validated = validateExtraction(schema, text, `Form extraction (${instance.formType})`);
    if (!validated) {
      return {
        taxYear: instance.taxYear ?? null,
        entityName: instance.entityName ?? null,
        fields: {},
        warnings: [VALIDATION_FAILED_WARNING],
        lineage: rawLineage(text),
        simulated: false,
      };
    }

    // Keep only readable values: a {value: null} entry means "label seen,
    // value unreadable" — that surfaces as a count, never as a number.
    const fields: Record<string, ExtractedFieldValue> = {};
    let unreadable = 0;
    for (const [name, fv] of Object.entries(validated.fields as Record<string, ExtractedFieldValue | undefined>)) {
      if (!fv) continue;
      if (fv.value === null) {
        unreadable += 1;
        continue;
      }
      fields[name] = fv;
    }
    const warnings = [...(validated.warnings ?? [])];
    if (unreadable > 0) {
      warnings.push(`${unreadable} field(s) visible but unreadable - omitted, manual review may be needed`);
    }

    return {
      taxYear: validated.taxYear ?? instance.taxYear ?? null,
      entityName: validated.entityName ?? instance.entityName ?? null,
      fields,
      warnings,
      lineage: rawLineage(text),
      simulated: false,
    };
  } catch (error) {
    console.error(`Form extraction error (${instance.formType}):`, error);
    return {
      taxYear: instance.taxYear ?? null,
      entityName: instance.entityName ?? null,
      fields: {},
      warnings: [`Failed to extract ${instance.formType} fields`],
      lineage: LINEAGE,
      simulated: false,
    };
  }
}
