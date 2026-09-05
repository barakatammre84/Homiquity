import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./core";
import { loanApplications } from "./lending";
import type {
  CreditMemoReference,
  CreditMemoSection,
  FinancialSourceReference,
  FinancialWorkpaperInput,
  FinancialWorkpaperKind,
  FinancialWorkpaperOutput,
} from "../financialReview";

// Immutable versions of the calculations an officer reviewed. Existing URLA,
// income-path and document tables remain authoritative; these rows freeze the
// exact safe input/output projection and evidence references used at signoff.
export const financialWorkpaperVersions = pgTable("financial_workpaper_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => loanApplications.id),
  workpaperKey: varchar("workpaper_key", { length: 220 }).notNull(),
  kind: varchar("kind", { length: 40 }).$type<FinancialWorkpaperKind>().notNull(),
  subjectId: varchar("subject_id").notNull(),
  subjectLabel: varchar("subject_label", { length: 255 }).notNull(),
  versionNumber: integer("version_number").notNull(),
  inputFingerprint: varchar("input_fingerprint", { length: 64 }).notNull(),
  inputSnapshot: jsonb("input_snapshot").$type<FinancialWorkpaperInput>().notNull(),
  outputSnapshot: jsonb("output_snapshot").$type<FinancialWorkpaperOutput>().notNull(),
  sourceReferences: jsonb("source_references").$type<FinancialSourceReference[]>().notNull(),
  dependencyVersionIds: varchar("dependency_version_ids").array().$type<string[]>().notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, table => [
  unique("financial_workpaper_application_key_version").on(
    table.applicationId,
    table.workpaperKey,
    table.versionNumber,
  ),
  index("idx_financial_workpaper_application").on(table.applicationId),
  index("idx_financial_workpaper_key").on(table.applicationId, table.workpaperKey),
  check("financial_workpaper_version_positive", sql`${table.versionNumber} > 0`),
  check("financial_workpaper_fingerprint_shape", sql`${table.inputFingerprint} ~ '^[a-f0-9]{64}$'`),
]);

export const financialWorkpaperReviews = pgTable("financial_workpaper_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workpaperVersionId: varchar("workpaper_version_id").notNull().references(() => financialWorkpaperVersions.id),
  action: varchar("action", { length: 10 }).$type<"approve" | "reject">().notNull(),
  reason: text("reason").notNull(),
  reviewedBy: varchar("reviewed_by").notNull().references(() => users.id),
  reviewedAt: timestamp("reviewed_at").defaultNow().notNull(),
}, table => [
  unique("financial_workpaper_review_version_unique").on(table.workpaperVersionId),
  check("financial_workpaper_review_action", sql`${table.action} IN ('approve','reject')`),
]);

export const creditMemoVersions = pgTable("credit_memo_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => loanApplications.id),
  versionNumber: integer("version_number").notNull(),
  inputFingerprint: varchar("input_fingerprint", { length: 64 }).notNull(),
  workpaperVersionIds: varchar("workpaper_version_ids").array().$type<string[]>().notNull(),
  sections: jsonb("sections").$type<CreditMemoSection[]>().notNull(),
  referenceIndex: jsonb("reference_index").$type<CreditMemoReference[]>().notNull(),
  packageHash: varchar("package_hash", { length: 64 }).notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, table => [
  unique("credit_memo_application_version").on(table.applicationId, table.versionNumber),
  index("idx_credit_memo_application").on(table.applicationId),
  check("credit_memo_version_positive", sql`${table.versionNumber} > 0`),
  check("credit_memo_input_fingerprint_shape", sql`${table.inputFingerprint} ~ '^[a-f0-9]{64}$'`),
  check("credit_memo_package_hash_shape", sql`${table.packageHash} ~ '^[a-f0-9]{64}$'`),
]);

export const creditMemoReviews = pgTable("credit_memo_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memoVersionId: varchar("memo_version_id").notNull().references(() => creditMemoVersions.id),
  action: varchar("action", { length: 10 }).$type<"approve" | "reject">().notNull(),
  reason: text("reason").notNull(),
  reviewedBy: varchar("reviewed_by").notNull().references(() => users.id),
  reviewedAt: timestamp("reviewed_at").defaultNow().notNull(),
}, table => [
  unique("credit_memo_review_version_unique").on(table.memoVersionId),
  check("credit_memo_review_action", sql`${table.action} IN ('approve','reject')`),
]);

export type FinancialWorkpaperVersion = typeof financialWorkpaperVersions.$inferSelect;
export type FinancialWorkpaperReview = typeof financialWorkpaperReviews.$inferSelect;
export type CreditMemoVersion = typeof creditMemoVersions.$inferSelect;
export type CreditMemoReview = typeof creditMemoReviews.$inferSelect;
