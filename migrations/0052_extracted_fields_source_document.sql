-- 0052: attribute extracted field VALUES to a simple-upload document (F-028).
--
-- Two document pipelines exist in this codebase. The UAL tax pipeline builds
-- document_uploads -> document_pages -> logical_documents and attributes
-- extracted_fields rows by logical_document_id. The borrower upload flow writes
-- plain `documents` rows and extracts straight off them (POST
-- /api/documents/:id/extract) — and had nowhere to persist the VALUES it read.
--
-- So a borrower uploaded a pay stub or bank statement, a model read it, and the
-- numbers were discarded: only lineage (field NAMES, confidence, model id) was
-- kept on documents.notes. Tax returns escaped this only because tax_insights
-- exists for them specifically. The borrower graph therefore had no tier-1
-- income path from pay stubs and no tier-1 asset path at all, so the platform
-- kept asking for figures it had already been shown.
--
-- Expand-only and idempotent:
--   * ADD COLUMN, nullable, no DEFAULT / NOT NULL / CHECK — catalog-only, no
--     table rewrite and no existing row can violate it.
--   * logical_document_id and page_id are already nullable, so a row attributed
--     to one pipeline and not the other is the established shape, not a new one.
--   * CREATE INDEX IF NOT EXISTS is a no-op on re-run.
-- Nothing is backfilled: existing rows belong to the UAL pipeline and their
-- document_id is genuinely unknown, not merely missing.

ALTER TABLE "extracted_fields" ADD COLUMN IF NOT EXISTS "document_id" varchar;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "extracted_fields"
    ADD CONSTRAINT "extracted_fields_document_id_documents_id_fk"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_extracted_fields_source_doc" ON "extracted_fields" ("document_id");
