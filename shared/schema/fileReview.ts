import { sql } from "drizzle-orm";
import { pgTable, varchar, integer, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { users } from "./core";
import { loanApplications } from "./lending";
import type { FileReviewManifest } from "../fileReview";

// Append-only internal review checkpoints, not loan approvals or frozen lender packages.
// No borrower values or filenames are duplicated: retain counts and one-way digests only.
export const fileReviewCheckpoints = pgTable("file_review_checkpoints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => loanApplications.id),
  version: integer("version").notNull(),
  revision: varchar("revision", { length: 64 }).notNull(),
  manifest: jsonb("manifest").$type<FileReviewManifest>().notNull(),
  reviewedBy: varchar("reviewed_by").notNull().references(() => users.id),
  reviewedAt: timestamp("reviewed_at").defaultNow().notNull(),
}, table => [unique("file_review_application_version").on(table.applicationId, table.version)]);
