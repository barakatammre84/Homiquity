import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "../db";
import { loanApplications, dealTeamMembers, documents, documentLineage, logicalDocuments, extractedFields, fileReviewCheckpoints, auditLogs } from "@shared/schema";
import { isAdmin, isInternalStaffRole } from "@shared/roles";
import { isTerminalLoanAppStatus } from "@shared/loanApplicationStatus";
import { canReviewDocuments } from "@shared/documentStatus";
import { assessFileReview, type FileReviewWorkspace } from "@shared/fileReview";
import { fingerprintFileReview } from "./fileReviewFingerprint";
import { currentDocumentVersions, subjectOptions } from "./documentLineage";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type FileReviewActor = { id: string; role: string };
export class FileReviewError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
async function loadSources(tx: Transaction, applicationId: string, actor: FileReviewActor, lock = false) {
  if (!isInternalStaffRole(actor.role)) throw new FileReviewError("Staff access required", 403);
  const query = tx.select().from(loanApplications).where(eq(loanApplications.id, applicationId));
  const [application] = await (lock ? query.for("update") : query);
  if (!application) throw new FileReviewError("Application not found", 404);
  if (!isAdmin(actor)) {
    const membershipQuery = tx.select({ id: dealTeamMembers.id }).from(dealTeamMembers).where(and(
      eq(dealTeamMembers.applicationId, applicationId), eq(dealTeamMembers.userId, actor.id), eq(dealTeamMembers.isActive, true),
    ));
    const membership = await (lock ? membershipQuery.for("share") : membershipQuery);
    if (!membership.length) throw new FileReviewError("Application not found", 404);
  }
  const allDocs = await tx.select().from(documents).where(eq(documents.applicationId, applicationId));
  const lineageRows = await tx.select().from(documentLineage).where(eq(documentLineage.applicationId, applicationId));
  const versionGroups = currentDocumentVersions(allDocs, lineageRows);
  const docs = versionGroups.map(group => group.current.document);
  const lineageByDocument = new Map(lineageRows.map(row => [row.documentId, row]));
  const docIds = docs.map(doc => doc.id);
  // Include both extraction paths, only where the form belongs to this application
  // or is linked to one of its documents. Never pull another loan by borrower id.
  const sourceDocumentScope = docIds.length ? inArray(logicalDocuments.sourceDocumentId, docIds) : undefined;
  const forms = await tx.select().from(logicalDocuments).where(and(
    or(eq(logicalDocuments.loanId, applicationId), docIds.length ? and(isNull(logicalDocuments.loanId), sourceDocumentScope) : undefined),
    or(isNull(logicalDocuments.sourceDocumentId), sourceDocumentScope),
  ));
  const formIds = forms.map(form => form.id);
  const documentScope = docIds.length ? inArray(extractedFields.documentId, docIds) : undefined;
  const formScope = formIds.length ? inArray(extractedFields.logicalDocumentId, formIds) : undefined;
  const facts = docIds.length || formIds.length ? await tx.select().from(extractedFields).where(and(
    or(documentScope, formScope),
    or(isNull(extractedFields.documentId), documentScope),
    or(isNull(extractedFields.logicalDocumentId), formScope),
  )) : [];
  return {
    sources: {
      application: [application],
      documents: versionGroups.map(group => {
        const document = group.current.document;
        const lineage = lineageByDocument.get(document.id);
        return {
          ...document,
          ...(lineage ? { lineage } : {}),
          fingerprintKey: group.lineageId,
        };
      }),
      forms,
      facts,
    },
    docs,
    facts,
    application,
    lineageByDocument,
    versionGroups,
    subjectOptions: await subjectOptions(tx, applicationId),
  };
}
async function workspace(tx: Transaction, applicationId: string, actor: FileReviewActor, loaded?: Awaited<ReturnType<typeof loadSources>>): Promise<FileReviewWorkspace> {
  const { sources, docs, facts, application, lineageByDocument, versionGroups, subjectOptions: options } = loaded ?? await loadSources(tx, applicationId, actor);
  const { manifest, revision } = fingerprintFileReview(sources);
  const checkpoints = await tx.select().from(fileReviewCheckpoints).where(eq(fileReviewCheckpoints.applicationId, applicationId)).orderBy(desc(fileReviewCheckpoints.version)).limit(20);
  const assessed = checkpoints.map(row => ({ row, assessment: assessFileReview(row.manifest, manifest) }));
  const latestChangedLineages = new Set(assessed[0]?.assessment.changedItems.documents ?? []);
  const subjectLabelByKey = new Map(options.map(option => [`${option.type}:${option.id}`, option.label]));
  const sameRevision = checkpoints[0]?.revision === revision;
  const saveBlockedReason = !canReviewDocuments(actor.role) ? "Your role can view this review, but cannot record a checkpoint."
    : !docs.length ? "Add the supporting documents before recording a review."
    : isTerminalLoanAppStatus(application.status) ? "This application is closed. Review history remains available."
    : sameRevision ? "The current file already has a review checkpoint." : null;
  return {
    applicationId, revision, manifest,
    documents: versionGroups.map(group => {
      const doc = group.current.document;
      const lineage = lineageByDocument.get(doc.id);
      return {
        id: doc.id,
        name: doc.fileName,
        documentType: doc.documentType,
        status: doc.status ?? "uploaded",
        reviewedAt: doc.reviewedAt?.toISOString() ?? null,
        lineage: {
          lineageId: group.lineageId,
          versionNumber: lineage?.versionNumber ?? 1,
          replacesDocumentId: lineage?.replacesDocumentId ?? null,
          contentFingerprintRecorded: Boolean(lineage?.contentSha256),
          subjectType: lineage?.subjectType ?? null,
          subjectId: lineage?.subjectId ?? null,
          subjectLabel: lineage ? subjectLabelByKey.get(`${lineage.subjectType}:${lineage.subjectId}`) ?? null : null,
          periodStart: lineage?.periodStart ?? null,
          periodEnd: lineage?.periodEnd ?? null,
          taxYear: lineage?.taxYear ?? null,
          needsAssignment: !lineage,
          changedSinceLatestReview: latestChangedLineages.has(group.lineageId),
          history: group.history.map(entry => ({
            documentId: entry.document.id,
            versionNumber: entry.lineage?.versionNumber ?? 1,
            fileName: entry.document.fileName,
            uploadedAt: entry.document.createdAt?.toISOString() ?? null,
            isCurrent: entry.document.id === doc.id,
          })),
        },
      };
    }),
    subjectOptions: options,
    unreviewedDocumentCount: docs.filter(doc => doc.status !== "verified").length,
    unreviewedFactCount: facts.filter(fact => !fact.humanVerified).length,
    checkpoints: assessed.map(({ row, assessment }) => ({
      id: row.id,
      version: row.version,
      reviewedAt: row.reviewedAt.toISOString(),
      reviewedBy: row.reviewedBy,
      isStale: assessment.isStale,
      staleReasons: assessment.staleReasons,
      changedDocumentLineageIds: assessment.changedItems.documents,
    })),
    canSave: !saveBlockedReason, saveBlockedReason,
  };
}
export async function getFileReview(applicationId: string, actor: FileReviewActor) {
  return db.transaction(tx => workspace(tx, applicationId, actor), { isolationLevel: "repeatable read" });
}
export async function saveFileReview(applicationId: string, actor: FileReviewActor, expectedRevision: string) {
  return db.transaction(async tx => {
    const loaded = await loadSources(tx, applicationId, actor, true);
    if (!canReviewDocuments(actor.role)) throw new FileReviewError("Document reviewer access required", 403);
    const current = await workspace(tx, applicationId, actor, loaded);
    if (current.revision !== expectedRevision) throw new FileReviewError("The file changed while you were reviewing it. Refresh and review the changes before saving.", 409);
    // A retry never creates a second checkpoint.
    if (current.checkpoints[0] && !current.checkpoints[0].isStale) return { replayed: true };
    if (!current.canSave) throw new FileReviewError(current.saveBlockedReason!, 409);
    const [saved] = await tx.insert(fileReviewCheckpoints).values({ applicationId, version: (current.checkpoints[0]?.version ?? 0) + 1, revision: current.revision, manifest: current.manifest, reviewedBy: actor.id }).returning({ id: fileReviewCheckpoints.id });
    // Same transaction: a checkpoint cannot survive a failed audit write.
    await tx.insert(auditLogs).values({ actorUserId: actor.id, action: "file_review.checkpoint_recorded", targetType: "loan_application", targetId: applicationId, metadata: { checkpointId: saved.id, revision: current.revision } });
    return { replayed: false };
  }, { isolationLevel: "repeatable read" });
}
