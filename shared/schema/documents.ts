import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  decimal,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./core";
import { loanApplications, documents } from "./lending";

// ============================================================================
// DOCUMENT PACKAGES (Lender-Ready Document Organization)
// ============================================================================

// Document Package Types
export const DOCUMENT_PACKAGE_TYPES = [
  "initial_submission",    // Initial lender submission
  "condition_response",    // Response to underwriting conditions
  "final_package",         // Final closing package
  "title_package",         // Title company package
  "custom",                // Custom package
] as const;

export type DocumentPackageType = typeof DOCUMENT_PACKAGE_TYPES[number];

// Document Package - organizes documents for lender delivery
export const documentPackages = pgTable("document_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id).notNull(),
  
  // Package Details
  name: varchar("name", { length: 255 }).notNull(),
  packageType: varchar("package_type", { length: 50 }).notNull(), // initial_submission, condition_response, final_package, title_package, custom
  description: text("description"),
  
  // Organization
  sections: jsonb("sections"), // Array of section names for organizing documents
  
  // Status
  status: varchar("status", { length: 50 }).default("draft").notNull(), // draft, ready, sent, acknowledged
  
  // Delivery
  recipientType: varchar("recipient_type", { length: 50 }), // lender, title, underwriter, investor
  recipientName: varchar("recipient_name", { length: 255 }),
  sentAt: timestamp("sent_at"),
  acknowledgedAt: timestamp("acknowledged_at"),
  
  // Notes
  internalNotes: text("internal_notes"),
  deliveryNotes: text("delivery_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Document Package Items - links documents to packages with organization
export const documentPackageItems = pgTable("document_package_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packageId: varchar("package_id").references(() => documentPackages.id).notNull(),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  
  // Organization within package
  sectionName: varchar("section_name", { length: 100 }), // e.g., "Income Documents", "Asset Documents"
  displayOrder: integer("display_order").default(0),
  customLabel: varchar("custom_label", { length: 255 }), // Override default document name
  
  // Notes
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDocumentPackageSchema = createInsertSchema(documentPackages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentPackageItemSchema = createInsertSchema(documentPackageItems).omit({
  id: true,
  createdAt: true,
});

export type InsertDocumentPackage = z.infer<typeof insertDocumentPackageSchema>;
export type DocumentPackage = typeof documentPackages.$inferSelect;
export type InsertDocumentPackageItem = z.infer<typeof insertDocumentPackageItemSchema>;
export type DocumentPackageItem = typeof documentPackageItems.$inferSelect;

// ============================================================================
// DOCUMENT INTELLIGENCE ENGINE (Underwriting-Aware OCR + Classification)
// ============================================================================
// This is the backbone of automated document processing. 
// Rule #1: Build ENGINES, not features.
// Everything operates at PAGE level, not file level.

// A. Document Taxonomy - All mortgage document types the classifier recognizes
export const DOCUMENT_TYPE_TAXONOMY = [
  // Identity / Compliance
  "drivers_license",
  "passport",
  "green_card",
  "ssn_card",
  "itin_letter",
  // Income - W2/Employment
  "paystub",
  "w2",
  "1099_misc",
  "1099_nec",
  // Income - Tax Returns
  "tax_return_1040",
  "schedule_c",
  "schedule_e",
  "schedule_k1",
  "business_tax_return_1120",
  "business_tax_return_1120s",
  "business_tax_return_1065",
  // Income - Self-Employed
  "profit_loss_statement",
  "social_security_award_letter",
  // Assets
  "bank_statement_checking",
  "bank_statement_savings",
  "business_bank_statement",
  "retirement_statement_401k",
  "retirement_statement_ira",
  "brokerage_statement",
  "gift_letter",
  // Liabilities
  "mortgage_statement",
  "heloc_statement",
  "auto_loan_statement",
  "student_loan_statement",
  "credit_card_statement",
  // Property / Transaction
  "purchase_contract",
  "lease_agreement",
  "hoa_statement",
  "homeowners_insurance_binder",
  "earnest_money_receipt",
  "appraisal_report",
  "title_commitment",
  // Other
  "letter_of_explanation",
  "divorce_decree",
  "bankruptcy_discharge",
  "unknown",
] as const;

export type DocumentTypeTaxonomy = typeof DOCUMENT_TYPE_TAXONOMY[number];

// B. Raw Document Upload (Immutable - Never mutate for audit + fraud)
export const documentUploads = pgTable("document_uploads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loanApplications.id),
  borrowerId: varchar("borrower_id").references(() => users.id).notNull(),
  
  // Original file metadata
  originalFileName: varchar("original_file_name", { length: 500 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  
  // Upload source tracking
  uploadSource: varchar("upload_source", { length: 50 }).notNull(), // web, mobile, api, email
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  
  // Storage references (never modify after creation)
  rawFileUri: text("raw_file_uri").notNull(),  // Original file in object storage
  checksum: varchar("checksum", { length: 128 }).notNull(), // SHA-256 for integrity
  
  // Processing status
  processingStatus: varchar("processing_status", { length: 50 }).default("pending").notNull(), // pending, processing, completed, failed
  processingStartedAt: timestamp("processing_started_at"),
  processingCompletedAt: timestamp("processing_completed_at"),
  processingError: text("processing_error"),
  
  // Metadata
  pageCount: integer("page_count"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_doc_uploads_loan").on(table.loanId),
  index("idx_doc_uploads_borrower").on(table.borrowerId),
  index("idx_doc_uploads_status").on(table.processingStatus),
]);

// C. Document Page Entity (CRITICAL - All intelligence happens at page level)
export const documentPages = pgTable("document_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  uploadId: varchar("upload_id").references(() => documentUploads.id).notNull(),
  
  // Page identification
  pageNumber: integer("page_number").notNull(), // 1-indexed
  
  // Processed image storage
  imageUri: text("image_uri").notNull(), // Cleaned/normalized page image
  thumbnailUri: text("thumbnail_uri"), // Smaller preview
  
  // Image dimensions (for layout analysis)
  width: integer("width"),
  height: integer("height"),
  
  // Raw OCR text (before field extraction)
  rawOcrText: text("raw_ocr_text"),
  ocrConfidence: decimal("ocr_confidence", { precision: 5, scale: 4 }), // 0.0-1.0
  ocrEngine: varchar("ocr_engine", { length: 50 }), // gemini, tesseract, etc.
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_doc_pages_upload").on(table.uploadId),
]);

// D. Page Classification Output (Never trust file names - classify each page)
export const pageClassifications = pgTable("page_classifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pageId: varchar("page_id").references(() => documentPages.id).notNull(),
  
  // Classification result
  documentType: varchar("document_type", { length: 100 }).notNull(), // From DOCUMENT_TYPE_TAXONOMY
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull(), // 0.0-1.0
  
  // Alternative classifications (top 3)
  alternativeTypes: jsonb("alternative_types"), // [{type, confidence}, ...]
  
  // Classification method tracking
  modelVersion: varchar("model_version", { length: 100 }).notNull(),
  classificationMethod: varchar("classification_method", { length: 50 }).notNull(), // rule_based, ml_classifier, hybrid
  
  // Human review status
  humanReviewed: boolean("human_reviewed").default(false),
  humanCorrectedType: varchar("human_corrected_type", { length: 100 }),
  reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  
  classifiedAt: timestamp("classified_at").defaultNow().notNull(),
}, (table) => [
  index("idx_page_class_page").on(table.pageId),
  index("idx_page_class_type").on(table.documentType),
  index("idx_page_class_confidence").on(table.confidence),
]);

// E. Logical Document (Reassembled from classified pages)
export const logicalDocuments = pgTable("logical_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loanApplications.id),
  borrowerId: varchar("borrower_id").references(() => users.id).notNull(),
  
  // Document identification
  documentType: varchar("document_type", { length: 100 }).notNull(), // From DOCUMENT_TYPE_TAXONOMY
  
  // Aggregated confidence (average of page confidences)
  aggregatedConfidence: decimal("aggregated_confidence", { precision: 5, scale: 4 }).notNull(),
  
  // Status workflow
  status: varchar("status", { length: 50 }).default("needs_review").notNull(), // accepted, needs_review, rejected
  
  // Document period (for statements/returns)
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  taxYear: integer("tax_year"),
  
  // Institution/employer info (extracted)
  institutionName: varchar("institution_name", { length: 255 }),
  accountNumberMasked: varchar("account_number_masked", { length: 50 }),
  
  // Completeness
  expectedPageCount: integer("expected_page_count"),
  actualPageCount: integer("actual_page_count"),
  isComplete: boolean("is_complete").default(false),
  
  // Human review
  verifiedByUserId: varchar("verified_by_user_id").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  verificationNotes: text("verification_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_logical_docs_loan").on(table.loanId),
  index("idx_logical_docs_borrower").on(table.borrowerId),
  index("idx_logical_docs_type").on(table.documentType),
  index("idx_logical_docs_status").on(table.status),
]);

// Link table: Logical Document to Pages
export const logicalDocumentPages = pgTable("logical_document_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  logicalDocumentId: varchar("logical_document_id").references(() => logicalDocuments.id).notNull(),
  pageId: varchar("page_id").references(() => documentPages.id).notNull(),
  pageOrder: integer("page_order").notNull(), // Order within the logical document
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_logical_doc_pages_doc").on(table.logicalDocumentId),
  index("idx_logical_doc_pages_page").on(table.pageId),
]);

// ============================================================================
// OCR & FIELD EXTRACTION SCHEMAS
// ============================================================================

// F. Extracted Field (NON-NEGOTIABLE STRUCTURE)
// Rule: If a value has no confidence or no source page → it does not exist
export const extractedFields = pgTable("extracted_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  logicalDocumentId: varchar("logical_document_id").references(() => logicalDocuments.id),
  pageId: varchar("page_id").references(() => documentPages.id).notNull(),
  
  // Field identification
  fieldName: varchar("field_name", { length: 255 }).notNull(), // e.g., "grossMonthlyIncome", "employerName"
  fieldCategory: varchar("field_category", { length: 100 }), // income, asset, liability, identity, property
  
  // Extracted value (polymorphic - store as string, parse based on type)
  valueString: text("value_string"),
  valueNumeric: decimal("value_numeric", { precision: 18, scale: 4 }),
  valueDate: timestamp("value_date"),
  valueBoolean: boolean("value_boolean"),
  valueType: varchar("value_type", { length: 50 }).notNull(), // string, number, date, boolean, currency
  
  // Confidence & source (REQUIRED - no field exists without these)
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull(), // 0.0-1.0
  boundingBox: jsonb("bounding_box"), // {x, y, width, height} on source page
  
  // MISMO Mapping (Everything maps to MISMO or fails)
  mismoPath: varchar("mismo_path", { length: 500 }), // e.g., "MISMO.Income.EmploymentIncome.GrossMonthlyIncome"
  
  // Extraction metadata
  extractionMethod: varchar("extraction_method", { length: 50 }).notNull(), // regex, ml_extraction, template_match, gemini
  modelVersion: varchar("model_version", { length: 100 }),
  
  // Human verification
  humanVerified: boolean("human_verified").default(false),
  humanCorrectedValue: text("human_corrected_value"),
  verifiedByUserId: varchar("verified_by_user_id").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  
  extractedAt: timestamp("extracted_at").defaultNow().notNull(),
}, (table) => [
  index("idx_extracted_fields_doc").on(table.logicalDocumentId),
  index("idx_extracted_fields_page").on(table.pageId),
  index("idx_extracted_fields_name").on(table.fieldName),
  index("idx_extracted_fields_mismo").on(table.mismoPath),
  index("idx_extracted_fields_confidence").on(table.confidence),
]);

// G. Completeness Check (Eliminate huge processor time)
export const completenessChecks = pgTable("completeness_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  logicalDocumentId: varchar("logical_document_id").references(() => logicalDocuments.id).notNull(),
  
  // Check result
  documentType: varchar("document_type", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(), // complete, incomplete, unable_to_determine
  
  // Missing items (what's wrong)
  missingItems: jsonb("missing_items").notNull(), // [{item: "page 2 of 3", severity: "high"}, ...]
  
  // Expected vs actual
  expectedPages: integer("expected_pages"),
  foundPages: integer("found_pages"),
  
  // Required fields check
  requiredFieldsFound: jsonb("required_fields_found"), // [{field, found: boolean}, ...]
  requiredFieldsMissing: text("required_fields_missing").array(),
  
  // Continuity checks (for statements)
  balanceContinuityValid: boolean("balance_continuity_valid"),
  dateRangeContinuous: boolean("date_range_continuous"),
  
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
}, (table) => [
  index("idx_completeness_doc").on(table.logicalDocumentId),
  index("idx_completeness_status").on(table.status),
]);

// Insert schemas
export const insertDocumentUploadSchema = createInsertSchema(documentUploads).omit({
  id: true,
  createdAt: true,
});
export const insertDocumentPageSchema = createInsertSchema(documentPages).omit({
  id: true,
  createdAt: true,
});
export const insertPageClassificationSchema = createInsertSchema(pageClassifications).omit({
  id: true,
});
export const insertLogicalDocumentSchema = createInsertSchema(logicalDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertLogicalDocumentPageSchema = createInsertSchema(logicalDocumentPages).omit({
  id: true,
  createdAt: true,
});
export const insertExtractedFieldSchema = createInsertSchema(extractedFields).omit({
  id: true,
});
export const insertCompletenessCheckSchema = createInsertSchema(completenessChecks).omit({
  id: true,
});

// Type exports
export type InsertDocumentUpload = z.infer<typeof insertDocumentUploadSchema>;
export type DocumentUpload = typeof documentUploads.$inferSelect;
export type InsertDocumentPage = z.infer<typeof insertDocumentPageSchema>;
export type DocumentPage = typeof documentPages.$inferSelect;
export type InsertPageClassification = z.infer<typeof insertPageClassificationSchema>;
export type PageClassification = typeof pageClassifications.$inferSelect;
export type InsertLogicalDocument = z.infer<typeof insertLogicalDocumentSchema>;
export type LogicalDocument = typeof logicalDocuments.$inferSelect;
export type InsertLogicalDocumentPage = z.infer<typeof insertLogicalDocumentPageSchema>;
export type LogicalDocumentPage = typeof logicalDocumentPages.$inferSelect;
export type InsertExtractedField = z.infer<typeof insertExtractedFieldSchema>;
export type ExtractedField = typeof extractedFields.$inferSelect;
export type InsertCompletenessCheck = z.infer<typeof insertCompletenessCheckSchema>;
export type CompletenessCheck = typeof completenessChecks.$inferSelect;
