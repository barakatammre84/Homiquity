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
import * as fs from "fs";
import * as path from "path";
import { ObjectStorageService, ObjectNotFoundError } from "./replit_integrations/object_storage";

const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;
const objectStorageService = new ObjectStorageService();

export interface ExtractedTaxReturnData {
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

export interface ExtractedPayStubData {
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

export interface ExtractedBankStatementData {
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

export interface ExtractedLeaseData {
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

async function fileToBase64(filePath: string): Promise<string> {
  if (filePath.startsWith("/objects/")) {
    const objectFile = await objectStorageService.getObjectEntityFile(filePath);
    const chunks: Buffer[] = [];
    const stream = objectFile.createReadStream();
    return new Promise((resolve, reject) => {
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("base64")));
      stream.on("error", reject);
    });
  }
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString("base64");
}

function getMimeType(filePath: string, storedMimeType?: string): string {
  if (storedMimeType) return storedMimeType;
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
  };
  return mimeTypes[ext] || "application/octet-stream";
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
      model: "gemini-2.0-flash",
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
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const extracted = JSON.parse(jsonMatch[0]) as ExtractedTaxReturnData;
      extracted.documentYear = extracted.documentYear || documentYear || new Date().getFullYear().toString();
      return extracted;
    }
  } catch (error) {
    console.error("Tax return extraction error:", error);
  }

  return {
    documentYear: documentYear || new Date().getFullYear().toString(),
    confidence: "low",
    extractedFields: [],
    warnings: ["Failed to extract data from tax return"],
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
      model: "gemini-2.0-flash",
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
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ExtractedPayStubData;
    }
  } catch (error) {
    console.error("Pay stub extraction error:", error);
  }

  return {
    confidence: "low",
    extractedFields: [],
    warnings: ["Failed to extract data from pay stub"],
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
      model: "gemini-2.0-flash",
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
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ExtractedBankStatementData;
    }
  } catch (error) {
    console.error("Bank statement extraction error:", error);
  }

  return {
    confidence: "low",
    extractedFields: [],
    warnings: ["Failed to extract data from bank statement"],
  };
}

/**
 * Extract lease agreement data using Gemini vision.
 * Used by the public Rent-to-Own Readiness calculator to auto-fill monthly rent.
 * Degrades gracefully (low confidence) when Gemini is unavailable or parsing fails.
 */
export async function extractLeaseData(
  filePath: string,
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
    const base64 = await fileToBase64(filePath);
    const mimeType = getMimeType(filePath, storedMimeType);

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
      model: "gemini-2.0-flash",
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
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as ExtractedLeaseData;
      if (typeof parsed.monthlyRent === "string") {
        const numeric = Number(String(parsed.monthlyRent).replace(/[^0-9.]/g, ""));
        parsed.monthlyRent = Number.isFinite(numeric) ? numeric : undefined;
      }
      return parsed;
    }
  } catch (error) {
    console.error("Lease extraction error:", error);
  }

  return {
    confidence: "low",
    extractedFields: [],
    warnings: ["Failed to extract data from lease agreement"],
  };
}
