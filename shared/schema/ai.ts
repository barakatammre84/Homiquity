import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { users } from "./core";
import { loanApplications } from "./lending";

// =============================================================================
// AI GOVERNANCE — every model call routes through the AI gateway and is logged
// here for traceability (CFPB/state exam support: "what guidance did the system
// give this borrower on that date?"). One row per model invocation.
// =============================================================================

// Output classification — drives whether an artifact may be shown to a borrower.
//   internal_only                    → checklists, summaries, staff guidance
//   borrower_facing_review_required  → must be approved by a licensed LO/compliance before sending
//   borrower_facing_approved_template → template where the model only swapped variables
//   borrower_facing_guardrailed      → real-time borrower chat where pre-send human review is
//                                      impossible; shown only after passing the deterministic
//                                      compliance rails (loCommsLint hard-block post-filter +
//                                      prompt-level prohibitions). Added for the AI Coach
//                                      (MODEL_RISK_GOVERNANCE.md M-5).
export const AI_OUTPUT_CLASSIFICATIONS = [
  "internal_only",
  "borrower_facing_review_required",
  "borrower_facing_approved_template",
  "borrower_facing_guardrailed",
] as const;

export const aiInteractions = pgTable(
  "ai_interactions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

    // Linkage — application is optional (some calls are not loan-scoped)
    applicationId: varchar("application_id").references(() => loanApplications.id),
    userId: varchar("user_id").references(() => users.id),

    // Who/what invoked the model
    workflow: varchar("workflow", { length: 100 }).notNull(), // e.g. "loan_estimate_explanation", "document_extraction"
    userRole: varchar("user_role", { length: 50 }), // role of the requesting user, if any

    // Provider + model actually used (provider-agnostic gateway)
    provider: varchar("provider", { length: 30 }).notNull(), // "claude" (current) | "gemini" (legacy rows)
    model: varchar("model", { length: 100 }).notNull(),

    // The exchange (store enough to reconstruct for an exam; redact PII upstream)
    systemPrompt: text("system_prompt"),
    prompt: text("prompt").notNull(),
    response: text("response"),

    // Governance
    classification: varchar("classification", { length: 50 }).notNull(),
    reviewStatus: varchar("review_status", { length: 30 }).notNull().default("not_required"), // not_required | pending_review | approved | rejected
    reviewedBy: varchar("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),

    // Observability
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    isError: varchar("is_error", { length: 5 }).default("false"),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at").notNull().default(sql`now()`),
  },
  (table) => ({
    applicationIdx: index("ai_interactions_application_idx").on(table.applicationId),
    workflowIdx: index("ai_interactions_workflow_idx").on(table.workflow),
    reviewStatusIdx: index("ai_interactions_review_status_idx").on(table.reviewStatus),
    createdAtIdx: index("ai_interactions_created_at_idx").on(table.createdAt),
  }),
);

export const insertAiInteractionSchema = createInsertSchema(aiInteractions).omit({
  id: true,
  createdAt: true,
});

export type AiInteraction = typeof aiInteractions.$inferSelect;
export type InsertAiInteraction = typeof aiInteractions.$inferInsert;
