import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Document } from "@shared/schema";
import { UploadedDocumentsTable } from "./UploadedDocumentsTable";

// Pins the vault migration onto DocumentList (DESIGN_SYSTEM.md §13 + the vault rules, teardown §6.5): titles
// come from the catalog's data-layer name map (never a view-side slug
// prettifier), off-catalog types land in "Other documents" via the same map's
// own fallback, dates read as plain English, a rejection's reason rides the
// row, and the download affordance keeps its testid.

const doc = (overrides: Partial<Document>): Document =>
  ({
    id: "d-1",
    documentType: "w2",
    fileName: "w2-2025.pdf",
    status: "verified",
    rejectionReason: null,
    createdAt: new Date("2026-08-12T12:00:00Z"),
    ...overrides,
  }) as unknown as Document;

describe("UploadedDocumentsTable", () => {
  it("resolves catalog titles at the data layer and never renders raw slugs", () => {
    render(
      <UploadedDocumentsTable
        documents={[
          doc({ id: "d-1", documentType: "tax_return_1040" }),
          doc({ id: "d-2", documentType: "letter_of_explanation" }),
        ]}
      />,
    );

    // Catalog name for a known type; the catalog's own snake_case fallback
    // (docTypeName) for an off-catalog type — both data-layer, not the view.
    expect(screen.getByText("Tax Returns (1040)")).toBeTruthy();
    expect(screen.getByText("Letter Of Explanation")).toBeTruthy();
    expect(screen.queryByText("tax_return_1040")).toBeNull();
    expect(screen.queryByText("letter_of_explanation")).toBeNull();

    // Off-catalog types group under "Other documents".
    expect(screen.getByText("Other documents")).toBeTruthy();
  });

  it("speaks plain dates, keeps the filename as metadata, and carries rejection reasons", () => {
    render(
      <UploadedDocumentsTable
        documents={[
          doc({
            id: "d-3",
            documentType: "paystub",
            fileName: "july-paystub.pdf",
            status: "rejected",
            rejectionReason: "The pay period is cut off — please upload all pages.",
          }),
        ]}
      />,
    );

    expect(
      screen.getByText(/july-paystub\.pdf · You uploaded on Aug 12, 2026/),
    ).toBeTruthy();
    expect(
      screen.getByTestId("uploaded-documents-d-3-note").textContent,
    ).toContain("please upload all pages");
    expect(screen.getByTestId("button-download-doc-d-3")).toBeTruthy();
    expect(screen.getByTestId("uploaded-documents-d-3-status").textContent).toBe(
      "Action Needed",
    );
  });
});
