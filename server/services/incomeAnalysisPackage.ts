import { createHash } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  incomePathEvaluations,
  documentLineage,
  situationProfiles,
  type Document,
  type DocumentLineage,
  type EmploymentHistory,
  type IncomePathEvaluation,
  type SituationProfileRow,
} from "@shared/schema";
import type { IncomePathResult } from "@shared/incomePaths";
import type { SituationProfile } from "@shared/situationProfile";
import {
  INCOME_PACKAGE_VERSION,
  incomeAnalysisPackageSchema,
  type IncomeAnalysisPackage,
  type IncomePackageDocumentEntry,
} from "@shared/incomePackage";
import { currentDocumentVersions } from "./documentLineage";
import { getCurrentApprovedCreditMemo } from "./financialReview";

/**
 * Income analysis package builder (UAL P6) — the broker's cited income
 * narrative sent to a wholesale lender alongside the MISMO package.
 *
 * Pure core `assembleIncomePackage` (unit-tested directly) + IO wrapper
 * `buildIncomeAnalysisPackage` (loads the evaluation, situation, confirmed
 * worksheets, and documents). Mirrors buildLenderPackage's pure/IO split and
 * its immutable-snapshot + SHA-256 discipline. The lender never sees raw model
 * output — only per-path cited math, human-confirmed worksheet figures, and a
 * hash-only document manifest.
 */

export interface IncomePackageInputs {
  applicationId: string;
  lenderId: string;
  /**
   * The lender's display name and non-QM capability, read from the
   * `wholesale_lenders` row by the caller.
   *
   * Passed in rather than looked up so this function stays PURE — the lender
   * catalog is a database table now, and a lookup here would make package
   * assembly async and untestable without a DB. Omit when the row could not be
   * resolved; the package then falls back to the raw lenderId and to
   * agency-only sections, which is the conservative default (a non-QM section
   * sent to a lender that cannot underwrite it is worse than an omission, and
   * the omission is recorded).
   */
  lender?: { lenderName: string; nonQm?: boolean | null } | null;
  submittedBy: string;
  submittedAt: Date;
  simulated: boolean;
  evaluation: IncomePathEvaluation | null;
  situation: SituationProfileRow | null;
  confirmedWorksheets: EmploymentHistory[];
  documents: Document[];
  documentLineage: DocumentLineage[];
  creditMemo: Awaited<ReturnType<typeof getCurrentApprovedCreditMemo>>;
}

/** Alternative (non-QM) paths ship only to non-QM lenders. */
const NON_QM_PATH_IDS = new Set(["dscr", "bank_statement"]);

export class IncomeAnalysisPackageBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IncomeAnalysisPackageBlockedError";
  }
}

function documentEntry(doc: Document, lineage: DocumentLineage | undefined): IncomePackageDocumentEntry {
  // Extraction lineage lives on the document's notes JSON (P2a persists
  // modelId/promptVersion/responseHash there) plus the dedicated hash column.
  //
  // `extractionResponseHash` is a real column only the server writes, so it is
  // the trust anchor: lineage is read out of `notes` ONLY when that column is
  // populated, which proves an extractor actually ran on this document. Before
  // F-027 closed the write side, a borrower could put arbitrary JSON in `notes`
  // (it was the same column their upload description landed in), and this
  // function would promote it into `wasMachineRead: true` plus a `contentHash`
  // on an entry hard-labelled "machine-read; human-confirmed" — inside a
  // manifest sent to a wholesale lender. Pre-0046 rows can still carry such a
  // blob, so anchoring on the column keeps a forged one out of a third-party
  // package rather than relying on the write-side fix alone.
  let modelId: string | null = null;
  let promptVersion: string | null = null;
  const responseHash: string | null = doc.extractionResponseHash ?? null;
  if (doc.notes && responseHash) {
    try {
      const n = JSON.parse(doc.notes) as { modelId?: string; promptVersion?: string };
      modelId = n.modelId ?? null;
      promptVersion = n.promptVersion ?? null;
    } catch {
      // notes isn't always JSON — lineage stays null, never throws.
    }
  }
  const wasMachineRead = !!responseHash;
  const humanConfirmed = doc.status === "verified";
  return {
    documentId: doc.id,
    fileName: doc.fileName,
    documentType: doc.documentType,
    contentHash: lineage?.contentSha256 ?? null,
    extraction: wasMachineRead ? { modelId, promptVersion, responseHash } : null,
    label: wasMachineRead
      ? humanConfirmed ? "machine-read; human-confirmed" : "machine-read; confirmation pending"
      : humanConfirmed ? "source-file; human-confirmed" : "source-file; confirmation pending",
  };
}

/** Pure: assemble the package object (no IO). */
export function assembleIncomePackage(inputs: IncomePackageInputs): IncomeAnalysisPackage {
  const lenderName = inputs.lender?.lenderName ?? inputs.lenderId;
  const isNonQmLender = !!inputs.lender?.nonQm;

  const allPaths = (inputs.evaluation?.paths as IncomePathResult[] | undefined) ?? [];
  // Agency-only lenders get the agency/full-doc sections; non-QM path sections
  // are omitted (the lender can't underwrite them). Record the omission.
  const paths = isNonQmLender ? allPaths : allPaths.filter((p) => !NON_QM_PATH_IDS.has(p.pathId));
  const omittedSections: string[] = [];
  if (!isNonQmLender) {
    const dropped = allPaths.filter((p) => NON_QM_PATH_IDS.has(p.pathId)).map((p) => p.pathId);
    if (dropped.length > 0) {
      omittedSections.push(
        `Non-QM path sections (${dropped.join(", ")}) omitted — ${lenderName} does not run non-QM programs.`,
      );
    }
  }

  const confirmedWorksheets = inputs.confirmedWorksheets
    .filter((e) => e.isSelfEmployed && e.selfEmploymentIncome)
    .map((e) => {
      const wk = e.selfEmploymentIncome as Record<string, unknown>;
      return {
        employmentId: e.id,
        entityName: e.employerName ?? null,
        businessStructure: String(wk.businessStructure ?? "unknown"),
        confirmedByBorrowerAt: (wk.confirmedByBorrowerAt as string | undefined) ?? null,
        sourceTaxInsightId: (wk.sourceTaxInsightId as string | undefined) ?? null,
        worksheet: wk,
      };
    });

  let situation: IncomeAnalysisPackage["situation"] = null;
  if (inputs.situation) {
    const p = inputs.situation.profile as SituationProfile;
    situation = {
      summary: p.summary,
      taxYears: p.taxYears,
      entityCount: p.entityCount,
      flags: p.flags.map((f) => f.label),
    };
  }

  const pkg: IncomeAnalysisPackage = {
    version: INCOME_PACKAGE_VERSION,
    applicationId: inputs.applicationId,
    lenderId: inputs.lenderId,
    lenderName,
    generatedAt: inputs.submittedAt.toISOString(),
    simulated: inputs.simulated,

    incomePathEvaluationId: inputs.evaluation?.id ?? null,
    primaryMonthlyQualifyingIncome: inputs.evaluation
      ? Number(inputs.evaluation.primaryMonthlyQualifyingIncome)
      : null,
    recommendedPathId: inputs.evaluation?.recommendedPathId ?? null,
    incomeBasis: inputs.evaluation?.incomeBasis ?? null,
    inputsFingerprint: inputs.evaluation?.inputsFingerprint ?? null,
    evaluationFingerprint: inputs.evaluation?.evaluationFingerprint ?? null,

    paths,
    selection: {
      // The recommended path is what the LO relied on; explicit selection is a
      // later enhancement (income_path_evaluations.selectedPathId is not set
      // until the LO picks a non-recommended alternative).
      selectedPathId: inputs.evaluation?.recommendedPathId ?? null,
      submittedBy: inputs.submittedBy,
      submittedAt: inputs.submittedAt.toISOString(),
    },
    confirmedWorksheets,
    situation,
    documentManifest: inputs.documents.map(document =>
      documentEntry(document, inputs.documentLineage.find(lineage => lineage.documentId === document.id)),
    ),
    creditMemo: inputs.creditMemo ? {
      id: inputs.creditMemo.id,
      versionNumber: inputs.creditMemo.versionNumber,
      packageHash: inputs.creditMemo.packageHash,
      sections: inputs.creditMemo.sections,
      references: inputs.creditMemo.references,
      approvedAt: inputs.creditMemo.review!.reviewedAt,
    } : null,
    omittedSections,
  };

  // The package must be exactly what the schema accepts (also catches an
  // accidental widening of an identifier).
  return incomeAnalysisPackageSchema.parse(pkg);
}

export interface IncomePackageResult {
  package: IncomeAnalysisPackage;
  hash: string;
  generatedAt: Date;
}

/** IO: load everything and assemble + hash the package for a submission. */
export async function buildIncomeAnalysisPackage(
  applicationId: string,
  lenderId: string,
  submittedBy: string,
  simulated: boolean,
  submittedAt: Date = new Date(),
): Promise<IncomePackageResult> {
  // situation_profiles is keyed by userId, so the application resolves the owner.
  const app = await storage.getLoanApplication(applicationId);
  // The lender row drives the display name and whether non-QM sections ship.
  // Read here (IO) and handed to the pure assembler, which stays synchronous.
  const lenderRow = await storage.getWholesaleLenderByLenderId(lenderId);
  const [[evaluation], employment, allDocuments, lineageRows, situationRow, creditMemo] = await Promise.all([
    db
      .select()
      .from(incomePathEvaluations)
      .where(eq(incomePathEvaluations.applicationId, applicationId))
      .orderBy(desc(incomePathEvaluations.createdAt))
      .limit(1),
    storage.getEmploymentHistory(applicationId),
    storage.getDocumentsByApplication(applicationId),
    db.select().from(documentLineage).where(eq(documentLineage.applicationId, applicationId)),
    app?.userId
      ? db
          .select()
          .from(situationProfiles)
          .where(eq(situationProfiles.userId, app.userId))
          .orderBy(desc(situationProfiles.generatedAt))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    getCurrentApprovedCreditMemo(applicationId),
  ]);
  const documents = currentDocumentVersions(allDocuments, lineageRows).map(group => group.current.document);
  const requiresApprovedMemo = employment.some(row => row.isSelfEmployed)
    || !!(evaluation?.recommendedPathId && ["dscr", "bank_statement", "rental"].includes(evaluation.recommendedPathId));
  if (requiresApprovedMemo && !creditMemo) {
    throw new IncomeAnalysisPackageBlockedError(
      "Financial review changed before package assembly — refresh, approve the current workpapers and memo, then submit again.",
    );
  }

  const pkg = assembleIncomePackage({
    applicationId,
    lenderId,
    lender: lenderRow
      ? { lenderName: lenderRow.lenderName, nonQm: lenderRow.nonQm }
      : null,
    submittedBy,
    submittedAt,
    simulated,
    evaluation: evaluation ?? null,
    situation: situationRow,
    confirmedWorksheets: employment,
    documents,
    documentLineage: lineageRows,
    creditMemo,
  });

  const hash = createHash("sha256").update(JSON.stringify(pkg)).digest("hex");
  return { package: pkg, hash, generatedAt: submittedAt };
}
