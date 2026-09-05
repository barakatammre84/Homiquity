import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { users } from "./core";
import { documents, loanApplications } from "./lending";
import type { DocumentSubjectType } from "../documentLineage";

// One row describes one immutable uploaded-file version. `documents` remains the
// authoritative upload record; this table adds the version chain, byte digest,
// evidence subject and covered period without creating a second document flow.
export const documentLineage = pgTable("document_lineage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => loanApplications.id),
  documentId: varchar("document_id").notNull().references(() => documents.id),
  lineageId: varchar("lineage_id").notNull(),
  versionNumber: integer("version_number").notNull(),
  replacesDocumentId: varchar("replaces_document_id").references(() => documents.id),
  contentSha256: varchar("content_sha256", { length: 64 }),
  subjectType: varchar("subject_type", { length: 30 }).$type<DocumentSubjectType>().notNull(),
  subjectId: varchar("subject_id").notNull(),
  periodStart: varchar("period_start", { length: 10 }),
  periodEnd: varchar("period_end", { length: 10 }),
  taxYear: integer("tax_year"),
  recordedByUserId: varchar("recorded_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, table => [
  unique("document_lineage_document_unique").on(table.documentId),
  unique("document_lineage_version_unique").on(table.applicationId, table.lineageId, table.versionNumber),
  index("idx_document_lineage_application").on(table.applicationId),
  index("idx_document_lineage_lineage").on(table.lineageId),
  index("idx_document_lineage_subject").on(table.applicationId, table.subjectType, table.subjectId),
  check("document_lineage_version_positive", sql`${table.versionNumber} > 0`),
  check("document_lineage_subject_type", sql`${table.subjectType} IN ('application','borrower','business','property')`),
  check("document_lineage_hash_shape", sql`${table.contentSha256} IS NULL OR ${table.contentSha256} ~ '^[a-f0-9]{64}$'`),
  check("document_lineage_period_order", sql`${table.periodStart} IS NULL OR ${table.periodEnd} IS NULL OR ${table.periodStart} <= ${table.periodEnd}`),
]);

export type DocumentLineage = typeof documentLineage.$inferSelect;
export type InsertDocumentLineage = typeof documentLineage.$inferInsert;
