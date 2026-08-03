import { z } from "zod";
import { incomePathResultSchema } from "./incomePaths";

/**
 * Income analysis package (UAL program P6) — the broker's cited income
 * narrative that ships alongside the MISMO package to a wholesale lender. The
 * broker equivalent of a "normalized asset tape": one canonical, sourced
 * account of how qualifying income was derived, that a lender's underwriter
 * can consume without re-deriving it.
 *
 * Discipline:
 *  - Every path carries its math trace + citation (the same cited calculators
 *    P3/P4 use). No figure without a source (L2 I2).
 *  - The document manifest is hashes + lineage, NEVER content or ciphertext,
 *    and every extracted value is labeled "machine-read, human-confirmed" —
 *    the lender sees provenance, not raw model output.
 *  - Honest `simulated` labeling: submissions to a not-yet-contracted lender
 *    are marked, per the vendor-adapter rule (L2 I10).
 *  - No full SSN or EIN: identifiers are last-4 only (they arrive that way
 *    from the vault / extraction schemas; the package never widens them).
 */

export const INCOME_PACKAGE_VERSION = 1 as const;

const documentManifestEntrySchema = z.object({
  documentId: z.string(),
  fileName: z.string(),
  documentType: z.string(),
  /** SHA-256 of the stored file / extraction response, for tamper-evident audit. */
  contentHash: z.string().nullable(),
  /** Extraction lineage (model + prompt), when the doc was machine-read. */
  extraction: z
    .object({
      modelId: z.string().nullable(),
      promptVersion: z.string().nullable(),
      responseHash: z.string().nullable(),
    })
    .nullable(),
  /** Always true for machine-read docs in this package: values were human-confirmed downstream. */
  label: z.literal("machine-read; human-confirmed"),
});

const confirmedWorksheetSchema = z.object({
  employmentId: z.string(),
  entityName: z.string().nullable(),
  businessStructure: z.string(),
  confirmedByBorrowerAt: z.string().nullable(),
  /** Provenance link back to the source tax insight/extraction, when smart-filled. */
  sourceTaxInsightId: z.string().nullable(),
  /** The confirmed worksheet figures (already PII-safe: no SSN/full EIN). */
  worksheet: z.record(z.string(), z.unknown()),
});

const situationSummarySchema = z.object({
  summary: z.string(),
  taxYears: z.array(z.number()),
  entityCount: z.number(),
  flags: z.array(z.string()),
});

export const incomeAnalysisPackageSchema = z.object({
  version: z.literal(INCOME_PACKAGE_VERSION),
  applicationId: z.string(),
  lenderId: z.string(),
  lenderName: z.string(),
  generatedAt: z.string(),
  /** True when any leg is a deterministic simulation (no live broker agreement). */
  simulated: z.boolean(),

  // The income evaluation this package reports.
  incomePathEvaluationId: z.string().nullable(),
  primaryMonthlyQualifyingIncome: z.number().nullable(),
  recommendedPathId: z.string().nullable(),
  incomeBasis: z.string().nullable(),
  /** Reproducibility fingerprints from the evaluation (P3). */
  inputsFingerprint: z.string().nullable(),
  evaluationFingerprint: z.string().nullable(),

  /** Per-path result + math trace + citations. Non-QM sections included only for non-QM lenders. */
  paths: z.array(incomePathResultSchema),

  /** LO/staff selection audit: who submitted, when, which path was relied on. */
  selection: z.object({
    selectedPathId: z.string().nullable(),
    submittedBy: z.string(),
    submittedAt: z.string(),
  }),

  confirmedWorksheets: z.array(confirmedWorksheetSchema),
  situation: situationSummarySchema.nullable(),
  documentManifest: z.array(documentManifestEntrySchema),

  /** Sections omitted for this lender (e.g. non-QM paths for an agency-only lender). */
  omittedSections: z.array(z.string()),
});

export type IncomeAnalysisPackage = z.infer<typeof incomeAnalysisPackageSchema>;
export type IncomePackageDocumentEntry = z.infer<typeof documentManifestEntrySchema>;
