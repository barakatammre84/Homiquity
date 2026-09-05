import { describe, expect, it } from "vitest";
import type { InsertDocument, TeamMessage } from "@shared/schema";
import {
  DocumentRequestWorkflowError,
  findOpenDocumentRequest,
  validateRequestedDocumentResponse,
} from "../server/services/documentRequestWorkflow";

function request(overrides: Partial<TeamMessage> = {}): TeamMessage {
  return {
    id: "request-1",
    senderId: "lo-1",
    recipientId: "borrower-1",
    applicationId: "app-1",
    message: "Document Request: Recent Pay Stubs",
    messageType: "document_request",
    documentRequestData: {
      documentType: "pay_stub",
      documentName: "Recent Pay Stubs",
      status: "pending",
    },
    isRead: false,
    readAt: null,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    ...overrides,
  };
}

function document(overrides: Partial<InsertDocument> = {}): InsertDocument {
  return {
    userId: "borrower-1",
    applicationId: "app-1",
    documentType: "paystub",
    fileName: "paystub.pdf",
    fileSize: 1024,
    mimeType: "application/pdf",
    storagePath: "/objects/paystub",
    status: "uploaded",
    ...overrides,
  };
}

describe("document request workflow", () => {
  it("accepts an alias-equivalent borrower response on the same application", () => {
    expect(
      validateRequestedDocumentResponse({
        message: request(),
        actorId: "borrower-1",
        document: document(),
      }).documentType,
    ).toBe("pay_stub");
  });

  it.each([
    ["another borrower", { actorId: "borrower-2" }],
    ["another application", { document: document({ applicationId: "app-2" }) }],
    ["another document type", { document: document({ documentType: "bank_statement" }) }],
  ])("rejects %s", (_label, overrides) => {
    expect(() =>
      validateRequestedDocumentResponse({
        message: request(),
        actorId: "borrower-1",
        document: document(),
        ...overrides,
      }),
    ).toThrow(DocumentRequestWorkflowError);
  });

  it("requires a correction to replace the exact document returned by staff", () => {
    const message = request({
      documentRequestData: {
        documentType: "pay_stub",
        documentName: "Recent Pay Stubs",
        status: "rejected",
        documentId: "doc-rejected",
        rejectionReason: "The pay period is cut off.",
      },
    });
    expect(() =>
      validateRequestedDocumentResponse({
        message,
        actorId: "borrower-1",
        document: document(),
      }),
    ).toThrow("must replace");
    expect(
      validateRequestedDocumentResponse({
        message,
        actorId: "borrower-1",
        document: document(),
        replacesDocumentId: "doc-rejected",
      }).status,
    ).toBe("rejected");
  });

  it("does not accept another response while staff review is pending", () => {
    expect(() =>
      validateRequestedDocumentResponse({
        message: request({
          documentRequestData: {
            documentType: "pay_stub",
            documentName: "Recent Pay Stubs",
            status: "submitted",
            documentId: "doc-1",
          },
        }),
        actorId: "borrower-1",
        document: document(),
      }),
    ).toThrow("already submitted");
  });

  it("finds one alias-equivalent open request and ignores a closed one", () => {
    const closed = request({
      id: "closed",
      documentRequestData: {
        documentType: "pay_stub",
        documentName: "Recent Pay Stubs",
        status: "approved",
      },
    });
    const open = request({
      id: "open",
      documentRequestData: {
        documentType: "paystub",
        documentName: "Recent Pay Stubs",
        status: "rejected",
      },
    });
    expect(
      findOpenDocumentRequest([closed, open], {
        applicationId: "app-1",
        recipientId: "borrower-1",
        documentType: "pay_stub",
      })?.id,
    ).toBe("open");
  });
});
