import { describe, expect, it } from "vitest";
import { toMessageViewForApplicationAccess } from "../server/services/messageVisibility";

const request = {
  id: "request-1",
  senderId: "lo-1",
  recipientId: "borrower-1",
  applicationId: "app-1",
  message: "Document Request: Pay stub",
  messageType: "document_request",
  documentRequestData: {
    documentType: "pay_stub",
    documentName: "Pay stub",
    status: "rejected",
    documentId: "doc-1",
    rejectionReason: "Upload the full page, including the employer header.",
    requestedAt: "2026-09-01T12:00:00.000Z",
    respondedAt: "2026-09-02T12:00:00.000Z",
    reviewedAt: "2026-09-03T12:00:00.000Z",
  },
  isRead: false,
  readAt: null,
  createdAt: new Date(),
} as any;

describe("toMessageViewForApplicationAccess", () => {
  it("redacts every later lifecycle field without erasing historical request context", () => {
    const view = toMessageViewForApplicationAccess(request, new Set());
    expect(view.documentRequestData).toMatchObject({
      documentType: "pay_stub",
      documentName: "Pay stub",
      requestedAt: "2026-09-01T12:00:00.000Z",
    });
    for (const field of ["status", "documentId", "rejectionReason", "respondedAt", "reviewedAt"]) {
      expect(view.documentRequestData).not.toHaveProperty(field);
    }
    expect(request.documentRequestData).toHaveProperty("rejectionReason");
  });

  it("keeps the correction for an authorized application viewer", () => {
    expect(
      toMessageViewForApplicationAccess(request, new Set(["app-1"]))
        .documentRequestData,
    ).toHaveProperty("rejectionReason");
  });

  it("keeps legacy unstamped conversation history", () => {
    const legacy = { ...request, applicationId: null };
    expect(toMessageViewForApplicationAccess(legacy, new Set())).toBe(legacy);
  });
});
