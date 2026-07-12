import { createHash } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  incomePathEvaluations,
  situationProfiles,
  type Document,
  type EmploymentHistory,
  type IncomePathEvaluation,
  type SituationProfileRow,
} from "@shared/schema";
import { getWholesaleLender } from "@shared/wholesaleLenders";
import type { IncomePathResult } from "@shared/incomePaths";
import type { SituationProfile } from "@shared/situationProfile";
import {
  INCOME_PACKAGE_VERSION,
  incomeAnalysisPackageSchema,
  type IncomeAnalysisPackage,
  type IncomePackageDocumentEntry,
} from "@shared/incomePackage";

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
  submittedBy: string;
  submittedAt: Date;
  simulated: boolean;
  evaluation: IncomePathEvaluation | null;
  situation: SituationProfileRow | null;
  confirmedWorksheets: EmploymentHistory[];
  documents: Document[];
}

/** Alternative (non-QM) paths ship only to non-QM lenders. */
const NON_QM_PATH_IDS = new Set(["dscr", "bank_statement"]);

function documentEntry(doc: Document): IncomePackageDocumentEntry {
  // Extraction lineage lives on the document's notes JSON (P2a persists
  // modelId/promptVersion/responseHash there) plus the dedicated hash column.
  let modelId: string | null = null;
  let promptVersion: string | null = null;
  let responseHash: string | null = doc.extractionResponseHash ?? null;
  if (doc.notes) {
    try {
      const n = JSON.parse(doc.notes) as { modelId?: string; promptVersion?: string; responseHash?: string };
      modelId = n.modelId ?? null;
      promptVersion = n.promptVersion ?? null;
      responseHash = responseHash ?? n.responseHash ?? null;
    } catch {
      // notes isn't always JSON — lineage stays null, never throws.
    }
  }
  const wasMachineRead = !!(modelId || promptVersion || responseHash);
  return {
    documentId: doc.id,
    fileName: doc.fileName,
    documentType: doc.documentType,
    contentHash: responseHash,
    extraction: wasMachineRead ? { modelId, promptVersion, responseHash } : null,
    label: "machine-read; human-confirmed",
  };
}

/** Pure: assemble the package object (no IO). */
export function assembleIncomePackage(inputs: IncomePackageInputs): IncomeAnalysisPackage {
  const lender = getWholesaleLender(inputs.lenderId);
  const lenderName = lender?.name ?? inputs.lenderId;
  const isNonQmLender = !!lender?.nonQm;

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
    documentManifest: inputs.documents.map(documentEntry),
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
  const [[evaluation], employment, documents, situationRow] = await Promise.all([
    db
      .select()
      .from(incomePathEvaluations)
      .where(eq(incomePathEvaluations.applicationId, applicationId))
      .orderBy(desc(incomePathEvaluations.createdAt))
      .limit(1),
    storage.getEmploymentHistory(applicationId),
    storage.getDocumentsByApplication(applicationId),
    app?.userId
      ? db
          .select()
          .from(situationProfiles)
          .where(eq(situationProfiles.userId, app.userId))
          .orderBy(desc(situationProfiles.generatedAt))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);

  const pkg = assembleIncomePackage({
    applicationId,
    lenderId,
    submittedBy,
    submittedAt,
    simulated,
    evaluation: evaluation ?? null,
    situation: situationRow,
    confirmedWorksheets: employment,
    documents,
  });

  const hash = createHash("sha256").update(JSON.stringify(pkg)).digest("hex");
  return { package: pkg, hash, generatedAt: submittedAt };
}
