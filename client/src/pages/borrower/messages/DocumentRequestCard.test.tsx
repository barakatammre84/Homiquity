import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentRequestCard } from "./DocumentRequestCard";

vi.mock("@/components/UploadDocumentDialog", () => ({
  toUploadableDocumentType: (type: string) => type,
  UploadDocumentDialog: ({ replacesDocumentId }: { replacesDocumentId?: string }) => (
    <button data-testid="mock-upload" data-replaces={replacesDocumentId}>
      Upload correction
    </button>
  ),
}));

describe("DocumentRequestCard", () => {
  it("shows the exact correction and replaces the rejected document", () => {
    render(
      <DocumentRequestCard
        data={{
          documentType: "pay_stub",
          documentName: "Recent Pay Stubs",
          status: "rejected",
          documentId: "doc-rejected",
          rejectionReason: "The pay period is cut off. Upload the full page.",
        }}
        isFromCurrentUser={false}
        messageId="request-1"
        applicationId="app-1"
        partnerId="lo-1"
      />,
    );
    expect(screen.getByTestId("document-request-correction").textContent).toContain(
      "The pay period is cut off. Upload the full page.",
    );
    expect(screen.getByTestId("mock-upload").getAttribute("data-replaces")).toBe(
      "doc-rejected",
    );
  });
});
