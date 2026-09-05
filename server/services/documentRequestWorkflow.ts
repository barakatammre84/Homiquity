import type { InsertDocument, TeamMessage } from "@shared/schema";
import { documentTypesMatch } from "@shared/documentTypes";

export type DocumentRequestPayload = {
  documentType?: string;
  status?: string;
  documentId?: string;
  rejectionReason?: string;
  respondedAt?: string;
  reviewedAt?: string;
};

export class DocumentRequestWorkflowError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/** Open means the borrower or team can still act on this request. */
export function isOpenDocumentRequest(message: TeamMessage): boolean {
  if (message.messageType !== "document_request") return false;
  const data = message.documentRequestData as DocumentRequestPayload | null;
  return !!data?.documentType && data.status !== "approved";
}

export function findOpenDocumentRequest(
  messages: TeamMessage[],
  input: { applicationId: string; recipientId: string; documentType: string },
): TeamMessage | undefined {
  return messages.find((message) => {
    if (
      !isOpenDocumentRequest(message) ||
      message.applicationId !== input.applicationId ||
      message.recipientId !== input.recipientId
    ) {
      return false;
    }
    const data = message.documentRequestData as DocumentRequestPayload;
    return documentTypesMatch(data.documentType!, input.documentType);
  });
}

/**
 * Validate the borrower response before any document row is written. This is
 * deliberately pure so the access/type/lineage rules can be pinned without a
 * database fixture; the caller holds the request row lock while applying it.
 */
export function validateRequestedDocumentResponse(input: {
  message: TeamMessage;
  actorId: string;
  document: InsertDocument;
  replacesDocumentId?: string;
}): DocumentRequestPayload {
  const { message } = input;
  if (message.messageType !== "document_request") {
    throw new DocumentRequestWorkflowError("Document request not found", 404);
  }
  if (
    message.recipientId !== input.actorId ||
    message.applicationId !== input.document.applicationId ||
    input.document.userId !== input.actorId
  ) {
    throw new DocumentRequestWorkflowError("Document request not found", 404);
  }
  const requestData = message.documentRequestData as DocumentRequestPayload | null;
  if (!requestData?.documentType) {
    throw new DocumentRequestWorkflowError("Document request is incomplete", 409);
  }
  const currentStatus = requestData.status ?? "pending";
  if (currentStatus !== "pending" && currentStatus !== "rejected") {
    throw new DocumentRequestWorkflowError(
      `This document request is already ${currentStatus}. Refresh the conversation.`,
      409,
    );
  }
  if (!documentTypesMatch(requestData.documentType, input.document.documentType ?? "other")) {
    throw new DocumentRequestWorkflowError(
      "Choose the document type requested by your loan team",
    );
  }
  if (requestData.documentId && input.replacesDocumentId !== requestData.documentId) {
    throw new DocumentRequestWorkflowError(
      "This correction must replace the document your loan team returned.",
      409,
    );
  }
  return requestData;
}
