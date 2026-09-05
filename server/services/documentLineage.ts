import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  applicationProperties,
  auditLogs,
  borrowerBusinessEntities,
  borrowerProfiles,
  dealTeamMembers,
  documentLineage,
  documents,
  loanApplications,
  users,
  type Document,
  type DocumentLineage,
  type InsertDocument,
} from "@shared/schema";
import { canReviewDocuments } from "@shared/documentStatus";
import { isAdmin, isInternalStaffRole } from "@shared/roles";
import type { DocumentSubjectOption, DocumentSubjectType, UpdateDocumentLineage } from "@shared/documentLineage";

export type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DocumentLineageActor = { id: string; role: string };

export class DocumentLineageError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function userLabel(row: { firstName: string | null; lastName: string | null; email: string | null }) {
  return [row.firstName, row.lastName].filter(Boolean).join(" ") || row.email || "Borrower";
}

async function applicationAndBorrowerIds(transaction: DatabaseTransaction, applicationId: string) {
  const [application] = await transaction.select().from(loanApplications)
    .where(eq(loanApplications.id, applicationId)).limit(1);
  if (!application) throw new DocumentLineageError("Application not found", 404);
  const [profile] = await transaction.select({ coBorrowerUserId: borrowerProfiles.coBorrowerUserId })
    .from(borrowerProfiles).where(eq(borrowerProfiles.userId, application.userId)).limit(1);
  return {
    application,
    borrowerIds: [application.userId, profile?.coBorrowerUserId].filter((id): id is string => Boolean(id)),
  };
}

export async function assertDocumentLineageAccess(
  transaction: DatabaseTransaction,
  applicationId: string,
  actor: DocumentLineageActor,
) {
  if (!isInternalStaffRole(actor.role)) throw new DocumentLineageError("Staff access required", 403);
  const context = await applicationAndBorrowerIds(transaction, applicationId);
  if (!isAdmin(actor)) {
    const [membership] = await transaction.select({ id: dealTeamMembers.id }).from(dealTeamMembers).where(and(
      eq(dealTeamMembers.applicationId, applicationId),
      eq(dealTeamMembers.userId, actor.id),
      eq(dealTeamMembers.isActive, true),
    )).limit(1);
    if (!membership) throw new DocumentLineageError("Application not found", 404);
  }
  return context;
}

async function validateSubject(
  transaction: DatabaseTransaction,
  applicationId: string,
  subjectType: DocumentSubjectType,
  subjectId: string,
) {
  const { borrowerIds } = await applicationAndBorrowerIds(transaction, applicationId);
  if (subjectType === "application") {
    if (subjectId !== applicationId) throw new DocumentLineageError("Choose this loan file as the evidence subject");
    return;
  }
  if (subjectType === "borrower") {
    if (!borrowerIds.includes(subjectId)) throw new DocumentLineageError("Choose a borrower on this application");
    return;
  }
  if (subjectType === "business") {
    const [business] = await transaction.select({ id: borrowerBusinessEntities.id }).from(borrowerBusinessEntities).where(and(
      eq(borrowerBusinessEntities.id, subjectId), eq(borrowerBusinessEntities.applicationId, applicationId),
    )).limit(1);
    if (!business) throw new DocumentLineageError("Choose a business on this application");
    return;
  }
  const [property] = await transaction.select({ id: applicationProperties.id }).from(applicationProperties).where(and(
    eq(applicationProperties.id, subjectId), eq(applicationProperties.applicationId, applicationId),
  )).limit(1);
  if (!property) throw new DocumentLineageError("Choose a property on this application");
}

function defaultSubject(applicationId: string, borrowerIds: string[], uploaderId: string) {
  return borrowerIds.includes(uploaderId)
    ? { subjectType: "borrower" as const, subjectId: uploaderId }
    : { subjectType: "application" as const, subjectId: applicationId };
}

async function ensureLegacyLineage(
  transaction: DatabaseTransaction,
  applicationId: string,
  document: Document,
  borrowerIds: string[],
): Promise<DocumentLineage> {
  const [existing] = await transaction.select().from(documentLineage)
    .where(eq(documentLineage.documentId, document.id)).limit(1);
  if (existing) return existing;
  const subject = defaultSubject(applicationId, borrowerIds, document.userId);
  const [created] = await transaction.insert(documentLineage).values({
    applicationId,
    documentId: document.id,
    lineageId: document.id,
    versionNumber: 1,
    contentSha256: null,
    ...subject,
    recordedByUserId: document.userId,
  }).returning();
  return created;
}

export async function registerDocumentVersion(input: {
  actor: DocumentLineageActor;
  document: InsertDocument;
  contentSha256: string | null;
  replacesDocumentId?: string;
}) {
  return db.transaction(async transaction => {
    const applicationId = input.document.applicationId ?? null;
    if (!applicationId) {
      const [document] = await transaction.insert(documents).values(input.document).returning();
      return { document, lineage: null };
    }
    const { borrowerIds } = await applicationAndBorrowerIds(transaction, applicationId);
    let prior: Document | undefined;
    let priorLineage: DocumentLineage | undefined;
    if (input.replacesDocumentId) {
      [prior] = await transaction.select().from(documents).where(and(
        eq(documents.id, input.replacesDocumentId), eq(documents.applicationId, applicationId),
      )).for("update").limit(1);
      if (!prior) throw new DocumentLineageError("The document to replace is not on this loan file", 404);
      // External partner roles can contribute documents to an assigned file,
      // but only internal staff may supersede evidence another user supplied.
      if (!isInternalStaffRole(input.actor.role) && prior.userId !== input.actor.id) {
        throw new DocumentLineageError("The document to replace is not available", 404);
      }
      if (prior.documentType !== input.document.documentType) {
        throw new DocumentLineageError("A replacement must use the same document type");
      }
      priorLineage = await ensureLegacyLineage(transaction, applicationId, prior, borrowerIds);
      const [latest] = await transaction.select({ documentId: documentLineage.documentId })
        .from(documentLineage)
        .where(and(eq(documentLineage.applicationId, applicationId), eq(documentLineage.lineageId, priorLineage.lineageId)))
        .orderBy(desc(documentLineage.versionNumber)).limit(1);
      if (latest?.documentId !== prior.id) {
        throw new DocumentLineageError("A newer replacement already exists. Refresh the document list.", 409);
      }
    }

    const [document] = await transaction.insert(documents).values(input.document).returning();
    const inherited = priorLineage
      ? {
          lineageId: priorLineage.lineageId,
          versionNumber: priorLineage.versionNumber + 1,
          replacesDocumentId: priorLineage.documentId,
          subjectType: priorLineage.subjectType,
          subjectId: priorLineage.subjectId,
          periodStart: priorLineage.periodStart,
          periodEnd: priorLineage.periodEnd,
          taxYear: priorLineage.taxYear,
        }
      : {
          lineageId: randomUUID(),
          versionNumber: 1,
          replacesDocumentId: null,
          ...defaultSubject(applicationId, borrowerIds, input.actor.id),
          periodStart: null,
          periodEnd: null,
          taxYear: null,
        };
    const [lineage] = await transaction.insert(documentLineage).values({
      applicationId,
      documentId: document.id,
      ...inherited,
      contentSha256: input.contentSha256,
      recordedByUserId: input.actor.id,
    }).returning();
    await transaction.insert(auditLogs).values({
      actorUserId: input.actor.id,
      action: input.replacesDocumentId ? "document.version_replaced" : "document.lineage_recorded",
      targetType: "document",
      targetId: document.id,
      metadata: {
        applicationId,
        lineageId: lineage.lineageId,
        versionNumber: lineage.versionNumber,
        replacesDocumentId: lineage.replacesDocumentId,
        subjectType: lineage.subjectType,
        subjectId: lineage.subjectId,
        contentFingerprintRecorded: Boolean(lineage.contentSha256),
      },
    });
    return { document, lineage };
  });
}

export async function updateDocumentLineage(
  applicationId: string,
  documentId: string,
  actor: DocumentLineageActor,
  input: UpdateDocumentLineage,
) {
  return db.transaction(async transaction => {
    const { borrowerIds } = await assertDocumentLineageAccess(transaction, applicationId, actor);
    if (!canReviewDocuments(actor.role)) throw new DocumentLineageError("Document reviewer access required", 403);
    const [document] = await transaction.select().from(documents).where(and(
      eq(documents.id, documentId), eq(documents.applicationId, applicationId),
    )).for("update").limit(1);
    if (!document) throw new DocumentLineageError("Document not found", 404);
    await validateSubject(transaction, applicationId, input.subjectType, input.subjectId);
    const current = await ensureLegacyLineage(transaction, applicationId, document, borrowerIds);
    const [latest] = await transaction.select({ documentId: documentLineage.documentId }).from(documentLineage)
      .where(and(eq(documentLineage.applicationId, applicationId), eq(documentLineage.lineageId, current.lineageId)))
      .orderBy(desc(documentLineage.versionNumber)).limit(1);
    if (latest?.documentId !== documentId) {
      throw new DocumentLineageError("This version has been replaced. Edit the current version instead.", 409);
    }
    const [updated] = await transaction.update(documentLineage).set({
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      periodStart: input.periodStart ?? null,
      periodEnd: input.periodEnd ?? null,
      taxYear: input.taxYear ?? null,
    }).where(eq(documentLineage.id, current.id)).returning();
    await transaction.insert(auditLogs).values({
      actorUserId: actor.id,
      action: "document.lineage_updated",
      targetType: "document",
      targetId: documentId,
      metadata: {
        applicationId,
        lineageId: updated.lineageId,
        versionNumber: updated.versionNumber,
        subjectType: updated.subjectType,
        subjectId: updated.subjectId,
        periodStart: updated.periodStart,
        periodEnd: updated.periodEnd,
        taxYear: updated.taxYear,
      },
    });
    return updated;
  });
}

export async function subjectOptions(
  transaction: DatabaseTransaction,
  applicationId: string,
): Promise<DocumentSubjectOption[]> {
  const { borrowerIds } = await applicationAndBorrowerIds(transaction, applicationId);
  const [borrowers, businesses, properties] = await Promise.all([
    borrowerIds.length ? transaction.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
      .from(users).where(inArray(users.id, borrowerIds)) : [],
    transaction.select({ id: borrowerBusinessEntities.id, name: borrowerBusinessEntities.name })
      .from(borrowerBusinessEntities).where(eq(borrowerBusinessEntities.applicationId, applicationId)),
    transaction.select({ id: applicationProperties.id, address: applicationProperties.address })
      .from(applicationProperties).where(eq(applicationProperties.applicationId, applicationId)),
  ]);
  return [
    { type: "application", id: applicationId, label: "Whole loan file" },
    ...borrowers.map(row => ({ type: "borrower" as const, id: row.id, label: userLabel(row) })),
    ...businesses.map(row => ({ type: "business" as const, id: row.id, label: row.name || "Unnamed business" })),
    ...properties.map(row => ({ type: "property" as const, id: row.id, label: row.address })),
  ];
}

export function currentDocumentVersions(
  documentRows: Document[],
  lineageRows: DocumentLineage[],
) {
  const byDocument = new Map(lineageRows.map(row => [row.documentId, row]));
  const histories = new Map<string, Array<{ document: Document; lineage: DocumentLineage | null }>>();
  for (const document of documentRows) {
    const lineage = byDocument.get(document.id) ?? null;
    const key = lineage?.lineageId ?? document.id;
    const history = histories.get(key) ?? [];
    history.push({ document, lineage });
    histories.set(key, history);
  }
  for (const history of histories.values()) history.sort((a, b) =>
    (a.lineage?.versionNumber ?? 1) - (b.lineage?.versionNumber ?? 1)
      || String(a.document.createdAt ?? "").localeCompare(String(b.document.createdAt ?? ""))
      || a.document.id.localeCompare(b.document.id),
  );
  return [...histories.entries()].map(([lineageId, history]) => ({
    lineageId,
    history,
    current: history[history.length - 1],
  }));
}
