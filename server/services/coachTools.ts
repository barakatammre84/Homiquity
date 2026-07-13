import type { Request } from "express";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  syncCoachIntakeToApplication,
  type AppliedField,
  type SkippedField,
} from "./coachProfileSync";

// ---------------------------------------------------------------------------
// AI Coach tool surface — Claude Sonnet 5 tool-use replaces the old
// <coach_data> text-block extraction. Structured capture now arrives as typed
// tool calls, validated server-side with the SAME Zod schemas the old parser
// used, so malformed data is returned to the model as an is_error tool_result
// (it self-corrects) instead of being silently dropped.
//
// This module owns:
//  - the coach data types + Zod schemas (moved here from coachingService so
//    the import graph stays acyclic; coachingService re-exports them),
//  - the Anthropic tool definitions (COACH_TOOLS — module-level const in a
//    FIXED order; tools render before system in the prompt-cache prefix, so
//    any reorder invalidates the cache),
//  - the executors, which apply side effects (profile writeback via
//    coachProfileSync) and stream `captured`/`panel` events mid-turn.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Data shapes (public API — re-exported by coachingService)
// ---------------------------------------------------------------------------

export interface CoachingProfile {
  readinessTier: "ready_now" | "almost_ready" | "building" | "exploring";
  completionPercentage: number;
  statusNote: string;
  completedInputs: string[];
  outstandingInputs: string[];
  estimatedTimeline: string;
}

export interface ActionPlanItem {
  id: string;
  phase: number;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  category: "credit" | "savings" | "income" | "debt" | "documents" | "education";
  completed: boolean;
}

export interface DocumentRequirement {
  docType: string;
  label: string;
  reason: string;
  priority: "required" | "recommended" | "optional";
  category: string;
}

export interface CoachIntakeData {
  annualIncome?: string;
  monthlyDebts?: string;
  creditScore?: string;
  employmentType?: string;
  employmentYears?: string;
  downPayment?: string;
  purchasePrice?: string;
  propertyType?: string;
  loanPurpose?: string;
  isVeteran?: boolean;
  isFirstTimeBuyer?: boolean;
}

export interface BorrowerPackage {
  generatedDate: string;
  borrowerOverview: {
    borrowerNames: string;
    householdComposition: string;
    primaryResidenceState: string;
    incomeProfileType: string;
  };
  householdOverview: {
    firstTimeBuyer: string;
    veteranStatus: string;
  };
  transactionIntent: {
    transactionType: string;
    propertyIntent: string;
    targetTimeframe: string;
  };
  incomeSources: Array<{
    source: string;
    type: string;
    frequency: string;
    documentationStatus: string;
  }>;
  assetSummary: Array<{
    assetType: string;
    accountCategory: string;
    ownershipType: string;
    documentationStatus: string;
    lastStatementDate: string;
    validationNotes: string;
    accessLink: string;
  }>;
  creditAndDebt: {
    creditScore: string;
    creditScoreVerification: string;
    monthlyDebts: string;
    monthlyDebtsVerification: string;
    dtiRatio: string;
    dtiNote: string;
  };
  propertyContext: {
    propertyAddress: string;
    estimatedValueOrPrice: string;
    occupancyIntent: string;
  };
  documentInventory: Array<{
    docType: string;
    label: string;
    status: string;
    flags: string[];
  }>;
  readinessStatus: {
    intakeStatus: string;
    documentStatus: string;
    packageStatus: string;
    pendingItems: string[];
  };
  auditTrail: {
    intakeStartDate: string;
    lastUpdateDate: string;
    events: Array<{
      date: string;
      activity: string;
    }>;
  };
  validationNotes: {
    recencyChecks: string[];
    completenessChecks: string[];
    consistencyObservations: string[];
  };
  complianceFooter: string;
}

// ---------------------------------------------------------------------------
// Zod schemas (unchanged rules — moved from coachingService)
// ---------------------------------------------------------------------------

export const coachProfileSchema = z.object({
  readinessTier: z.enum(["ready_now", "almost_ready", "building", "exploring"]).catch("exploring"),
  completionPercentage: z.number().min(0).max(100).catch(0),
  statusNote: z.string().catch(""),
  completedInputs: z.array(z.string()).catch([]),
  outstandingInputs: z.array(z.string()).catch([]),
  estimatedTimeline: z.string().catch(""),
}).passthrough();

export const coachIntakeSchema = z.object({
  annualIncome: z.string().optional(),
  monthlyDebts: z.string().optional(),
  creditScore: z.string().optional(),
  employmentType: z.string().optional(),
  employmentYears: z.string().optional(),
  downPayment: z.string().optional(),
  purchasePrice: z.string().optional(),
  propertyType: z.string().optional(),
  loanPurpose: z.string().optional(),
  isVeteran: z.boolean().optional(),
  isFirstTimeBuyer: z.boolean().optional(),
}).strict();

const actionPlanItemSchema = z.object({
  id: z.string().min(1),
  phase: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  category: z.enum(["credit", "savings", "income", "debt", "documents", "education"]),
  completed: z.boolean(),
});
export const coachActionPlanSchema = z.array(actionPlanItemSchema);

const documentRequirementSchema = z.object({
  docType: z.string().min(1),
  label: z.string().min(1),
  reason: z.string(),
  priority: z.enum(["required", "recommended", "optional"]),
  category: z.string().min(1),
});
export const coachDocumentChecklistSchema = z.array(documentRequirementSchema);

export const borrowerPackageSchema = z.object({
  generatedDate: z.string().min(1),
  borrowerOverview: z.object({
    borrowerNames: z.string().min(1),
    householdComposition: z.string().min(1),
    primaryResidenceState: z.string().min(1),
    incomeProfileType: z.string().min(1),
  }),
  householdOverview: z.object({
    firstTimeBuyer: z.string().min(1),
    veteranStatus: z.string().min(1),
  }),
  transactionIntent: z.object({
    transactionType: z.string().min(1),
    propertyIntent: z.string().min(1),
    targetTimeframe: z.string().min(1),
  }),
  incomeSources: z.array(z.object({
    source: z.string(),
    type: z.string(),
    frequency: z.string(),
    documentationStatus: z.string(),
  })),
  assetSummary: z.array(z.object({
    assetType: z.string(),
    accountCategory: z.string(),
    ownershipType: z.string(),
    documentationStatus: z.string(),
    lastStatementDate: z.string(),
    validationNotes: z.string(),
    accessLink: z.string(),
  })),
  creditAndDebt: z.object({
    creditScore: z.string(),
    creditScoreVerification: z.string(),
    monthlyDebts: z.string(),
    monthlyDebtsVerification: z.string(),
    dtiRatio: z.string(),
    dtiNote: z.string(),
  }),
  propertyContext: z.object({
    propertyAddress: z.string(),
    estimatedValueOrPrice: z.string(),
    occupancyIntent: z.string(),
  }),
  documentInventory: z.array(z.object({
    docType: z.string(),
    label: z.string(),
    status: z.string(),
    flags: z.array(z.string()),
  })),
  readinessStatus: z.object({
    intakeStatus: z.string(),
    documentStatus: z.string(),
    packageStatus: z.string(),
    pendingItems: z.array(z.string()),
  }),
  auditTrail: z.object({
    intakeStartDate: z.string(),
    lastUpdateDate: z.string(),
    events: z.array(z.object({
      date: z.string(),
      activity: z.string(),
    })),
  }),
  validationNotes: z.object({
    recencyChecks: z.array(z.string()),
    completenessChecks: z.array(z.string()),
    consistencyObservations: z.array(z.string()),
  }),
  complianceFooter: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Streamed turn events (transport-agnostic — the SSE route serializes them,
// the JSON route buffers them)
// ---------------------------------------------------------------------------

export type CoachStreamEvent =
  | { type: "text"; delta: string }
  | {
      type: "captured";
      applicationId: string | null;
      created: boolean;
      applied: AppliedField[];
      skipped: SkippedField[];
    }
  | {
      type: "panel";
      profile?: CoachingProfile;
      actionPlan?: ActionPlanItem[];
      documentChecklist?: DocumentRequirement[];
      borrowerPackage?: BorrowerPackage;
      suggestions?: string[];
    }
  | { type: "lint_replaced"; categories: string[]; citations: string[] };

export type CoachEmit = (event: CoachStreamEvent) => void;

/** Structured results a turn accumulates across tool calls. */
export interface CoachToolTurnState {
  intake?: CoachIntakeData;
  profile?: CoachingProfile;
  actionPlan?: ActionPlanItem[];
  documentChecklist?: DocumentRequirement[];
  borrowerPackage?: BorrowerPackage;
  suggestions?: string[];
  /** Writeback target resolved by record_intake (for ai_interactions linkage). */
  syncedApplicationId?: string | null;
}

export interface CoachToolContext {
  req: Request;
  userId: string;
  conversationId: string;
  emit: CoachEmit;
  state: CoachToolTurnState;
}

// ---------------------------------------------------------------------------
// Tool definitions — FIXED order (prompt-cache prefix). Descriptions are
// prescriptive about WHEN to call (measurably improves trigger rate).
// ---------------------------------------------------------------------------

const INTAKE_INPUT_SCHEMA = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    annualIncome: { type: "string", description: 'Annual gross income in dollars, digits only (e.g. "85000").' },
    monthlyDebts: { type: "string", description: 'Total monthly debt payments in dollars, digits only (e.g. "1200").' },
    creditScore: { type: "string", description: 'Approximate credit score, 300-850, digits only (e.g. "720"). If the user gives a range, send the midpoint.' },
    employmentType: { type: "string", enum: ["employed", "self_employed", "retired", "other"] },
    employmentYears: { type: "string", description: "Years at current job, digits only." },
    downPayment: { type: "string", description: "Down payment funds available, in dollars, digits only." },
    purchasePrice: { type: "string", description: "Target purchase price, in dollars, digits only." },
    propertyType: { type: "string", enum: ["single_family", "condo", "townhouse", "multi_family"] },
    loanPurpose: { type: "string", enum: ["purchase", "refinance", "cash_out"] },
    isVeteran: { type: "boolean" },
    isFirstTimeBuyer: { type: "boolean" },
  },
};

export const COACH_TOOLS: Anthropic.Tool[] = [
  {
    name: "record_intake",
    description:
      "Save financial details to the borrower's pre-application profile. Call this EVERY time the user supplies or corrects a financial detail — income, monthly debts, credit score, employment, down payment, target price, property type, loan purpose, veteran or first-time-buyer status. Send ONLY the fields learned or corrected in this turn, as plain numeric strings with no $ signs or commas. The result tells you exactly which fields were saved and which were skipped — narrate that honestly.",
    input_schema: INTAKE_INPUT_SCHEMA,
  },
  {
    name: "update_readiness",
    description:
      "Update the borrower's readiness assessment shown in their side panel. Call whenever the readiness picture changes: the tier moves, an input completes, or the outstanding list changes. statusNote must be factual and procedural — never qualitative words like strong, solid, excellent, or concerning, and never approval likelihood.",
    input_schema: {
      type: "object" as const,
      additionalProperties: false,
      properties: {
        readinessTier: { type: "string", enum: ["ready_now", "almost_ready", "building", "exploring"] },
        statusNote: { type: "string", description: 'Factual procedural status, e.g. "Core financial inputs collected. Document verification pending."' },
        completedInputs: { type: "array", items: { type: "string" }, description: "Specific inputs already collected." },
        outstandingInputs: { type: "array", items: { type: "string" }, description: "Specific inputs still required." },
        estimatedTimeline: { type: "string", description: 'e.g. "1-3 months"' },
      },
      required: ["readinessTier", "statusNote", "completedInputs", "outstandingInputs", "estimatedTimeline"],
    },
  },
  {
    name: "set_action_plan",
    description:
      "Replace the borrower's step-by-step action plan shown in their side panel. Call when the user asks for a plan, or when their situation changes materially. Always send the FULL plan (it replaces the previous one). Keep items concrete and procedural.",
    input_schema: {
      type: "object" as const,
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string", description: 'Stable id, e.g. "action-1".' },
              phase: { type: "integer", minimum: 1 },
              title: { type: "string" },
              description: { type: "string" },
              priority: { type: "string", enum: ["high", "medium", "low"] },
              category: { type: "string", enum: ["credit", "savings", "income", "debt", "documents", "education"] },
              completed: { type: "boolean" },
            },
            required: ["id", "phase", "title", "description", "priority", "category", "completed"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "set_document_checklist",
    description:
      "Replace the borrower's document checklist shown in their side panel. Call when the required document set first becomes determinable (e.g. once employment type is known) or when it changes. Always send the FULL checklist.",
    input_schema: {
      type: "object" as const,
      additionalProperties: false,
      properties: {
        documents: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              docType: { type: "string", description: 'Machine slug, e.g. "pay_stub", "w2", "tax_return", "bank_statement".' },
              label: { type: "string", description: 'Human label, e.g. "Recent Pay Stubs (Last 30 Days)".' },
              reason: { type: "string", description: "Why underwriting systems require it." },
              priority: { type: "string", enum: ["required", "recommended", "optional"] },
              category: { type: "string", description: 'Grouping, e.g. "Income", "Assets", "Identity".' },
            },
            required: ["docType", "label", "reason", "priority", "category"],
          },
        },
      },
      required: ["documents"],
    },
  },
  {
    name: "generate_borrower_package",
    description:
      "Generate the lender-ready borrower intake summary. Call ONLY when the borrower's readiness tier is ready_now, or when the user explicitly asks for their borrower summary/package. Every field with no data MUST be the string \"Not Provided\", \"Pending\", or \"Insufficient Data\" — never invent, infer, or estimate values. Never include approval odds, qualitative assessments, or product recommendations anywhere in it.",
    input_schema: {
      type: "object" as const,
      additionalProperties: false,
      properties: {
        generatedDate: { type: "string", description: "YYYY-MM-DD" },
        borrowerOverview: {
          type: "object",
          properties: {
            borrowerNames: { type: "string" },
            householdComposition: { type: "string", description: "Single Borrower | Co-Borrowers (Married) | Co-Borrowers (Non-Married) | Not Provided" },
            primaryResidenceState: { type: "string", description: "Two-letter state code or Not Provided" },
            incomeProfileType: { type: "string", description: "W-2 | Self-Employed | Mixed | Investor | Not Provided" },
          },
          required: ["borrowerNames", "householdComposition", "primaryResidenceState", "incomeProfileType"],
        },
        householdOverview: {
          type: "object",
          properties: {
            firstTimeBuyer: { type: "string", description: "Yes | No | Not Provided" },
            veteranStatus: { type: "string", description: "Yes | No | Not Provided" },
          },
          required: ["firstTimeBuyer", "veteranStatus"],
        },
        transactionIntent: {
          type: "object",
          properties: {
            transactionType: { type: "string", description: "Purchase | Refinance | Cash-Out Refinance | Not Provided" },
            propertyIntent: { type: "string", description: "Primary Residence | Second Home | Investment | Not Provided" },
            targetTimeframe: { type: "string", description: "Borrower-stated timeframe or Not Provided — never infer." },
          },
          required: ["transactionType", "propertyIntent", "targetTimeframe"],
        },
        incomeSources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              source: { type: "string" },
              type: { type: "string", description: "W-2 | Self-Employed | Rental | 1099 | Retirement | Other" },
              frequency: { type: "string", description: "Monthly | Bi-Weekly | Annual | Not Provided" },
              documentationStatus: { type: "string", description: "Uploaded | Pending | Not Provided" },
            },
            required: ["source", "type", "frequency", "documentationStatus"],
          },
        },
        assetSummary: {
          type: "array",
          items: {
            type: "object",
            properties: {
              assetType: { type: "string" },
              accountCategory: { type: "string", description: "Liquid | Non-Liquid | Retirement | Gift | Other" },
              ownershipType: { type: "string", description: "Individual | Joint | Trust | Custodial | Not Specified" },
              documentationStatus: { type: "string", description: "Uploaded | Pending | Not Provided" },
              lastStatementDate: { type: "string", description: "YYYY-MM-DD or Not Provided" },
              validationNotes: { type: "string", description: "Factual procedural note or empty string — never assess sufficiency." },
              accessLink: { type: "string", description: "Always send an empty string — links are generated server-side." },
            },
            required: ["assetType", "accountCategory", "ownershipType", "documentationStatus", "lastStatementDate", "validationNotes", "accessLink"],
          },
        },
        creditAndDebt: {
          type: "object",
          properties: {
            creditScore: { type: "string" },
            creditScoreVerification: { type: "string", description: "Tier 1 | Tier 2 | Tier 3 | Not Provided" },
            monthlyDebts: { type: "string" },
            monthlyDebtsVerification: { type: "string", description: "Tier 1 | Tier 2 | Tier 3 | Not Provided" },
            dtiRatio: { type: "string", description: 'e.g. "35%" or "Insufficient Data"' },
            dtiNote: { type: "string" },
          },
          required: ["creditScore", "creditScoreVerification", "monthlyDebts", "monthlyDebtsVerification", "dtiRatio", "dtiNote"],
        },
        propertyContext: {
          type: "object",
          properties: {
            propertyAddress: { type: "string", description: "Address if identified or Not Provided — never fabricate." },
            estimatedValueOrPrice: { type: "string" },
            occupancyIntent: { type: "string", description: "Primary Residence | Second Home | Investment | Not Provided" },
          },
          required: ["propertyAddress", "estimatedValueOrPrice", "occupancyIntent"],
        },
        documentInventory: {
          type: "array",
          items: {
            type: "object",
            properties: {
              docType: { type: "string" },
              label: { type: "string" },
              status: { type: "string", description: "Received — Verified | Received — Pending Review | Not Yet Received | Not Required" },
              flags: { type: "array", items: { type: "string", enum: ["recency", "legibility", "consistency", "completeness"] } },
            },
            required: ["docType", "label", "status", "flags"],
          },
        },
        readinessStatus: {
          type: "object",
          properties: {
            intakeStatus: { type: "string", description: "Started | Complete" },
            documentStatus: { type: "string", description: "Complete | Partial | Not Started" },
            packageStatus: { type: "string", description: "Ready for Underwriting Review | Pending Items" },
            pendingItems: { type: "array", items: { type: "string" } },
          },
          required: ["intakeStatus", "documentStatus", "packageStatus", "pendingItems"],
        },
        auditTrail: {
          type: "object",
          properties: {
            intakeStartDate: { type: "string" },
            lastUpdateDate: { type: "string" },
            events: {
              type: "array",
              items: {
                type: "object",
                properties: { date: { type: "string" }, activity: { type: "string" } },
                required: ["date", "activity"],
              },
            },
          },
          required: ["intakeStartDate", "lastUpdateDate", "events"],
        },
        validationNotes: {
          type: "object",
          properties: {
            recencyChecks: { type: "array", items: { type: "string" } },
            completenessChecks: { type: "array", items: { type: "string" } },
            consistencyObservations: { type: "array", items: { type: "string" } },
          },
          required: ["recencyChecks", "completenessChecks", "consistencyObservations"],
        },
        complianceFooter: { type: "string", description: "The standard informational-purposes compliance footer." },
      },
      required: [
        "generatedDate", "borrowerOverview", "householdOverview", "transactionIntent", "incomeSources",
        "assetSummary", "creditAndDebt", "propertyContext", "documentInventory", "readinessStatus",
        "auditTrail", "validationNotes", "complianceFooter",
      ],
    },
  },
  {
    name: "suggest_next_steps",
    description:
      "Provide tappable follow-up suggestions rendered as chips under the chat. Call at the END of every turn with 2-3 short messages the user might naturally send next, phrased in the USER's voice (e.g. \"What documents do I need?\"), each under 60 characters.",
    input_schema: {
      type: "object" as const,
      additionalProperties: false,
      properties: {
        suggestions: { type: "array", items: { type: "string", maxLength: 80 }, minItems: 1, maxItems: 3 },
      },
      required: ["suggestions"],
    },
  },
];

// ---------------------------------------------------------------------------
// Executors
// ---------------------------------------------------------------------------

export interface CoachToolResult {
  /** Text returned to the model as the tool_result content. */
  content: string;
  isError?: boolean;
}

function zodIssueSummary(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

const KNOWN_INTAKE_KEYS = new Set(Object.keys(INTAKE_INPUT_SCHEMA.properties));

export async function executeCoachTool(
  ctx: CoachToolContext,
  name: string,
  input: unknown,
): Promise<CoachToolResult> {
  switch (name) {
    case "record_intake": {
      // Strip unknown keys first (the schema is .strict()) so one hallucinated
      // key doesn't void the real fields; report what was ignored.
      const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
      const filtered: Record<string, unknown> = {};
      const ignored: string[] = [];
      for (const [k, v] of Object.entries(raw)) {
        if (KNOWN_INTAKE_KEYS.has(k)) filtered[k] = v;
        else ignored.push(k);
      }
      const parsed = coachIntakeSchema.safeParse(filtered);
      if (!parsed.success) {
        return { content: `Invalid intake fields — ${zodIssueSummary(parsed.error)}. Re-send with corrected values.`, isError: true };
      }
      if (Object.keys(parsed.data).length === 0) {
        return { content: "No recognized intake fields were provided.", isError: true };
      }

      // Always keep the conversation-level snapshot (borrowerGraph readiness,
      // /api/coach/intake/latest, and the Pre-Approval prefill read it) …
      ctx.state.intake = { ...ctx.state.intake, ...parsed.data };

      // … and write through to the borrower's real records.
      try {
        const sync = await syncCoachIntakeToApplication(ctx.req, ctx.userId, parsed.data, ctx.conversationId);
        ctx.state.syncedApplicationId = sync.applicationId;
        ctx.emit({
          type: "captured",
          applicationId: sync.applicationId,
          created: sync.created,
          applied: sync.applied,
          skipped: sync.skipped,
        });
        const appliedNote = sync.applied.length > 0
          ? `Saved to the borrower's draft pre-application: ${sync.applied.map((f) => f.field).join(", ")}.`
          : "Nothing new was saved to the pre-application.";
        const skippedNote = sync.skipped.length > 0
          ? ` Skipped: ${sync.skipped.map((f) => `${f.field} (${f.reason})`).join(", ")}.`
          : "";
        const ignoredNote = ignored.length > 0 ? ` Ignored unknown fields: ${ignored.join(", ")}.` : "";
        return { content: `${appliedNote}${skippedNote}${ignoredNote}` };
      } catch (err) {
        console.error("[Coach] Profile sync failed:", err);
        return {
          content:
            "The values were noted in this conversation, but saving to the pre-application profile failed temporarily. Do NOT tell the user their profile was updated.",
          isError: true,
        };
      }
    }

    case "update_readiness": {
      const base = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
      // completionPercentage is server-derived (deriveCompletionPercentage) —
      // the model does not control it; 0 is a placeholder overwritten by the
      // turn runner before persistence/emit.
      const parsed = coachProfileSchema.safeParse({ completionPercentage: 0, ...base });
      if (!parsed.success) {
        return { content: `Invalid readiness update — ${zodIssueSummary(parsed.error)}.`, isError: true };
      }
      ctx.state.profile = {
        readinessTier: parsed.data.readinessTier,
        completionPercentage: parsed.data.completionPercentage,
        statusNote: parsed.data.statusNote,
        completedInputs: parsed.data.completedInputs,
        outstandingInputs: parsed.data.outstandingInputs,
        estimatedTimeline: parsed.data.estimatedTimeline,
      };
      return { content: "Readiness panel updated." };
    }

    case "set_action_plan": {
      const items = (input as { items?: unknown })?.items;
      const parsed = coachActionPlanSchema.safeParse(items);
      if (!parsed.success) {
        return { content: `Invalid action plan — ${zodIssueSummary(parsed.error)}.`, isError: true };
      }
      ctx.state.actionPlan = parsed.data;
      ctx.emit({ type: "panel", actionPlan: parsed.data });
      return { content: `Action plan set (${parsed.data.length} items).` };
    }

    case "set_document_checklist": {
      const documents = (input as { documents?: unknown })?.documents;
      const parsed = coachDocumentChecklistSchema.safeParse(documents);
      if (!parsed.success) {
        return { content: `Invalid document checklist — ${zodIssueSummary(parsed.error)}.`, isError: true };
      }
      ctx.state.documentChecklist = parsed.data;
      ctx.emit({ type: "panel", documentChecklist: parsed.data });
      return { content: `Document checklist set (${parsed.data.length} documents).` };
    }

    case "generate_borrower_package": {
      const pkg = (input && typeof input === "object" ? { ...(input as Record<string, unknown>) } : {}) as Record<string, unknown>;
      if (Array.isArray(pkg.assetSummary)) {
        // Document access links are generated server-side; never trust
        // model-authored URLs (same rule as the old parser).
        pkg.assetSummary = pkg.assetSummary.map((a) =>
          a && typeof a === "object" ? { ...(a as Record<string, unknown>), accessLink: "" } : a,
        );
      }
      const parsed = borrowerPackageSchema.safeParse(pkg);
      if (!parsed.success) {
        return { content: `Invalid borrower package — ${zodIssueSummary(parsed.error)}.`, isError: true };
      }
      ctx.state.borrowerPackage = parsed.data;
      ctx.emit({ type: "panel", borrowerPackage: parsed.data });
      return { content: "Borrower package generated and shown to the user." };
    }

    case "suggest_next_steps": {
      const suggestions = (input as { suggestions?: unknown })?.suggestions;
      const parsed = z.array(z.string().min(1).max(80)).min(1).max(3).safeParse(suggestions);
      if (!parsed.success) {
        return { content: `Invalid suggestions — ${zodIssueSummary(parsed.error)}.`, isError: true };
      }
      ctx.state.suggestions = parsed.data;
      ctx.emit({ type: "panel", suggestions: parsed.data });
      return { content: "Suggestions shown." };
    }

    default:
      return { content: `Unknown tool: ${name}`, isError: true };
  }
}
