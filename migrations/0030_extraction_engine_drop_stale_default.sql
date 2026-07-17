-- 0030: drop the stale 'gemini' default from document_confidence_scores.extraction_engine.
-- Document extraction moved from Gemini to Anthropic Claude in #146 — there are no Gemini
-- calls left on main and @google/generative-ai is gone from the deps — so this column
-- (unchanged since 0000_baseline) still defaulted to an engine that no longer exists.
--
-- DROP rather than re-point to 'claude': the sole insert path — recordExtractionConfidence()
-- in server/services/documentConfidence.ts — always sets the value explicitly, so the DB
-- default is never read. It is a second, invisible fallback duplicating that function's
-- `options.extractionEngine || "claude"`, and re-pointing it would only re-arm the same
-- landmine for the next engine migration. With no default, a future writer that omits the
-- field records NULL ("engine unrecorded") instead of a false stamp — a gap is honest,
-- a wrong value falsifies the AI provenance trail this column exists to keep.
--
-- Additive/backward-compatible + idempotent (CLAUDE.md §"Schema changes are migration-gated"):
-- DROP DEFAULT rewrites no rows, so historical rows keep their legitimate 'gemini'
-- provenance; the deployed app (which always sets the column) tolerates the new DB and
-- vice-versa; and a re-run is a no-op.
ALTER TABLE "document_confidence_scores"
	ALTER COLUMN "extraction_engine" DROP DEFAULT;
