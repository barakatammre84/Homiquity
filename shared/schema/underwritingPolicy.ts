// Policy-as-data: profiles, thresholds, approval workflow, lender overlays.
// Split from the old shared/schema/underwriting.ts — ./underwriting re-exports all of it.
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  decimal,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const policyProfiles = pgTable("policy_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Policy identification
  profileId: varchar("profile_id", { length: 100 }).notNull(), // e.g., "FNMA_CONV_2026_Q1"
  authority: varchar("authority", { length: 50 }).notNull(), // FANNIE, FREDDIE, FHA, VA, LENDER, BROKER
  productType: varchar("product_type", { length: 50 }).notNull(), // CONVENTIONAL, FHA, VA, HELOC
  
  // Version control (CRITICAL for legal compliance)
  version: varchar("version", { length: 20 }).notNull(), // semver: 1.0.0
  effectiveDate: date("effective_date").notNull(),
  expirationDate: date("expiration_date"), // null = still active
  
  // Status workflow: DRAFT → PENDING_APPROVAL → APPROVED → ACTIVE → RETIRED
  status: varchar("status", { length: 30 }).notNull().default("DRAFT"),
  
  // Description and source
  description: text("description"),
  bulletinReference: varchar("bulletin_reference", { length: 200 }), // e.g., "SEL-2026-01"
  sourceUrl: varchar("source_url", { length: 500 }),
  
  // Parent profile (for cloning/versioning)
  parentProfileId: varchar("parent_profile_id"),
  
  // Audit trail
  createdBy: varchar("created_by"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  activatedBy: varchar("activated_by"),
  activatedAt: timestamp("activated_at"),
  retiredBy: varchar("retired_by"),
  retiredAt: timestamp("retired_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_policy_profiles_authority").on(table.authority),
  index("idx_policy_profiles_product").on(table.productType),
  index("idx_policy_profiles_status").on(table.status),
  index("idx_policy_profiles_effective").on(table.effectiveDate),
]);

export const insertPolicyProfileSchema = createInsertSchema(policyProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// 2. POLICY THRESHOLDS - Structured threshold values (NOT free-text logic)
// Each threshold is a controlled field with bounds, not a formula
export const policyThresholds = pgTable("policy_thresholds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Parent policy
  policyProfileId: varchar("policy_profile_id").references(() => policyProfiles.id).notNull(),
  
  // Threshold identification
  category: varchar("category", { length: 50 }).notNull(), // INCOME, CREDIT, ASSETS, DTI, LTV, etc.
  thresholdKey: varchar("threshold_key", { length: 100 }).notNull(), // e.g., "min_credit_score", "max_dti_front"
  
  // Threshold values (controlled, not formulas)
  valueNumeric: decimal("value_numeric", { precision: 15, scale: 4 }),
  valuePercent: decimal("value_percent", { precision: 6, scale: 4 }), // 0.45 = 45%
  valueBool: boolean("value_bool"),
  valueEnum: varchar("value_enum", { length: 100 }), // For predefined options
  
  // Bounds (ops cannot exceed these)
  minBound: decimal("min_bound", { precision: 15, scale: 4 }),
  maxBound: decimal("max_bound", { precision: 15, scale: 4 }),
  
  // Materiality flags (what action when threshold is breached)
  materialityAction: varchar("materiality_action", { length: 50 }).default("REVIEW"), // NONE, REVIEW, MATERIAL, INVALIDATE
  
  // Description for ops
  displayName: varchar("display_name", { length: 200 }),
  description: text("description"),
  guidelineReference: varchar("guideline_reference", { length: 200 }),
  
  // Ordering for UI
  displayOrder: integer("display_order").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_policy_thresholds_profile").on(table.policyProfileId),
  index("idx_policy_thresholds_category").on(table.category),
  index("idx_policy_thresholds_key").on(table.thresholdKey),
]);

export const insertPolicyThresholdSchema = createInsertSchema(policyThresholds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// 3. POLICY APPROVAL WORKFLOW - Audit trail for policy changes
// Every policy change must go through approval workflow
export const policyApprovalWorkflow = pgTable("policy_approval_workflow", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Policy being approved
  policyProfileId: varchar("policy_profile_id").references(() => policyProfiles.id).notNull(),
  
  // Workflow step
  fromStatus: varchar("from_status", { length: 30 }).notNull(),
  toStatus: varchar("to_status", { length: 30 }).notNull(),
  
  // Action details
  action: varchar("action", { length: 50 }).notNull(), // SUBMIT, APPROVE, REJECT, ACTIVATE, RETIRE
  actionBy: varchar("action_by").notNull(),
  actionAt: timestamp("action_at").defaultNow(),
  
  // Justification (required for approval)
  justification: text("justification"),
  bulletinReference: varchar("bulletin_reference", { length: 200 }),
  
  // Rejection reason (if rejected)
  rejectionReason: text("rejection_reason"),
  
  // Impact assessment (auto-generated)
  impactedApplicationsCount: integer("impacted_applications_count"),
  impactAssessment: jsonb("impact_assessment").$type<{
    affectedCategories: string[];
    thresholdChanges: { key: string; oldValue: number; newValue: number }[];
    estimatedImpact: string;
  }>(),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_policy_approval_profile").on(table.policyProfileId),
  index("idx_policy_approval_action").on(table.action),
  index("idx_policy_approval_by").on(table.actionBy),
  index("idx_policy_approval_at").on(table.actionAt),
]);

export const insertPolicyApprovalWorkflowSchema = createInsertSchema(policyApprovalWorkflow).omit({
  id: true,
  createdAt: true,
});

// 4. POLICY LENDER OVERLAYS - Lender-specific threshold adjustments
// Lenders can have stricter (never looser) thresholds than GSE baseline
export const policyLenderOverlays = pgTable("policy_lender_overlays", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Base policy being overlayed
  basePolicyProfileId: varchar("base_policy_profile_id").references(() => policyProfiles.id).notNull(),
  
  // Lender identification
  lenderId: varchar("lender_id", { length: 100 }).notNull(),
  lenderName: varchar("lender_name", { length: 255 }).notNull(),
  
  // Overlay version control
  version: varchar("version", { length: 20 }).notNull(),
  effectiveDate: date("effective_date").notNull(),
  expirationDate: date("expiration_date"),
  
  // Status
  status: varchar("status", { length: 30 }).notNull().default("DRAFT"),
  
  // Overlay thresholds (must be stricter than base)
  overlayThresholds: jsonb("overlay_thresholds").$type<{
    [key: string]: {
      baseValue: number;
      overlayValue: number;
      direction: "STRICTER" | "SAME"; // Never "LOOSER"
      reason?: string;
    };
  }>(),
  
  // Additional lender requirements
  additionalRequirements: jsonb("additional_requirements").$type<{
    requirement: string;
    category: string;
    description: string;
  }[]>(),
  
  // Audit trail
  createdBy: varchar("created_by"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_policy_lender_overlays_base").on(table.basePolicyProfileId),
  index("idx_policy_lender_overlays_lender").on(table.lenderId),
  index("idx_policy_lender_overlays_status").on(table.status),
  index("idx_policy_lender_overlays_effective").on(table.effectiveDate),
]);

export const insertPolicyLenderOverlaySchema = createInsertSchema(policyLenderOverlays).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports for Policy Profile Service
export type InsertPolicyProfile = z.infer<typeof insertPolicyProfileSchema>;
export type PolicyProfile = typeof policyProfiles.$inferSelect;
export type InsertPolicyThreshold = z.infer<typeof insertPolicyThresholdSchema>;
export type PolicyThreshold = typeof policyThresholds.$inferSelect;
export type InsertPolicyApprovalWorkflow = z.infer<typeof insertPolicyApprovalWorkflowSchema>;
export type PolicyApprovalWorkflow = typeof policyApprovalWorkflow.$inferSelect;
export type InsertPolicyLenderOverlay = z.infer<typeof insertPolicyLenderOverlaySchema>;
export type PolicyLenderOverlay = typeof policyLenderOverlays.$inferSelect;
