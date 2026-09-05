import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FileReviewTab } from "./FileReviewTab";
import { loanApplicationKeys } from "@/lib/queryClient";
import type { FileReviewWorkspace } from "@shared/fileReview";

const fixture = (): FileReviewWorkspace => ({
  applicationId: "a", revision: "a".repeat(64),
  manifest: { application: { count: 1, digest: "a" }, documents: { count: 1, digest: "d" }, forms: { count: 0, digest: "f" }, facts: { count: 2, digest: "v" } },
  documents: [{
    id: "d", name: "Supporting statement.pdf", documentType: "bank_statement", status: "uploaded", reviewedAt: null,
    lineage: {
      lineageId: "lineage-d", versionNumber: 1, replacesDocumentId: null,
      contentFingerprintRecorded: true, subjectType: "borrower", subjectId: "borrower-a",
      subjectLabel: "Alex Borrower", periodStart: "2026-07-01", periodEnd: "2026-07-31", taxYear: null,
      needsAssignment: false, changedSinceLatestReview: false,
      history: [{ documentId: "d", versionNumber: 1, fileName: "Supporting statement.pdf", uploadedAt: "2026-08-01T00:00:00Z", isCurrent: true }],
    },
  }],
  subjectOptions: [
    { type: "application", id: "a", label: "Whole loan file" },
    { type: "borrower", id: "borrower-a", label: "Alex Borrower" },
  ],
  unreviewedDocumentCount: 1, unreviewedFactCount: 2, checkpoints: [], canSave: true, saveBlockedReason: null,
});
function setup(data: FileReviewWorkspace | null = fixture(), fail = false) {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, queryFn: async () => { if (fail) throw new Error("Offline"); return data; } }, mutations: { retry: false } } });
  if (data) cache.setQueryData(loanApplicationKeys.fileReview("a"), data);
  const navigate = vi.fn();
  render(<QueryClientProvider client={cache}><FileReviewTab applicationId="a" onNavigate={navigate} /></QueryClientProvider>);
  return { cache, navigate };
}
describe("File Review in the existing officer workspace", () => {
  it("uses existing documents and links to existing review tools", async () => {
    const { navigate } = setup();
    expect(screen.getByText("Supporting statement.pdf")).toBeTruthy();
    expect(screen.getByTestId("file-review-lineage-summary-d").textContent).toContain("Alex Borrower");
    expect(screen.getByText("Content fingerprint recorded")).toBeTruthy();
    expect(screen.getByTestId("file-review-status").textContent).toBe("No review recorded");
    await userEvent.click(screen.getByTestId("file-review-open-documents"));
    expect(navigate).toHaveBeenCalledWith("documents");
    await userEvent.click(screen.getByTestId("file-review-open-values"));
    expect(navigate).toHaveBeenCalledWith("tax-intel");
    expect(screen.getByTestId("file-review-save").hasAttribute("disabled")).toBe(true);
  });
  it("requires a new acknowledgment after background data changes", async () => {
    const { cache } = setup();
    await waitFor(() => expect(screen.getByTestId("file-review-ack").hasAttribute("disabled")).toBe(false));
    await userEvent.click(screen.getByTestId("file-review-ack"));
    expect(screen.getByTestId("file-review-save").hasAttribute("disabled")).toBe(false);
    cache.setQueryData(loanApplicationKeys.fileReview("a"), { ...fixture(), revision: "b".repeat(64) });
    await waitFor(() => expect(screen.getByTestId("file-review-save").hasAttribute("disabled")).toBe(true));
  });
  it("shows changes and preserves the previous review", () => {
    const data = fixture(); data.checkpoints = [{ id: "r", version: 1, reviewedAt: "2026-09-04T00:00:00Z", reviewedBy: "lo", isStale: true, staleReasons: ["Uploaded documents changed after this review."], changedDocumentLineageIds: ["lineage-d"] }];
    setup(data);
    expect(screen.getByTestId("file-review-status").textContent).toBe("Changed since review");
    expect(screen.getByTestId("file-review-changes").textContent).toContain("Uploaded documents changed");
    expect(screen.getByTestId("file-review-history").textContent).toContain("Review 1");
  });
  it("does not present an empty file as ready", () => {
    setup({ ...fixture(), documents: [], canSave: false, saveBlockedReason: "Add supporting documents first." });
    expect(screen.getByTestId("file-review-empty")).toBeTruthy();
    expect(screen.getByTestId("file-review-save").hasAttribute("disabled")).toBe(true);
  });
  it("hides stale cached evidence when refresh fails", async () => {
    setup(fixture(), true);
    await waitFor(() => expect(screen.getByTestId("file-review-error")).toBeTruthy());
    expect(screen.queryByTestId("file-review-save")).toBeNull();
  });
  it("opens the evidence assignment controls from the current version", async () => {
    setup();
    await userEvent.click(screen.getByTestId("file-review-edit-lineage-d"));
    expect(await screen.findByText("Identify who or what this document supports and the period it covers.")).toBeTruthy();
    expect(screen.getByLabelText("Period start")).toBeTruthy();
    expect(screen.getByTestId("file-review-save-lineage-d")).toBeTruthy();
  });
  it("keeps a large evidence file searchable and reveals it in manageable groups", async () => {
    const data = fixture();
    data.documents = Array.from({ length: 30 }, (_, index) => ({
      ...data.documents[0],
      id: `d-${index + 1}`,
      name: index === 29 ? "Unique rental lease.pdf" : `Supporting statement ${index + 1}.pdf`,
      lineage: {
        ...data.documents[0].lineage,
        lineageId: `lineage-${index + 1}`,
        history: [{ ...data.documents[0].lineage.history[0], documentId: `d-${index + 1}` }],
      },
    }));
    setup(data);

    expect(screen.getByText("Showing 25 of 30 matching current documents")).toBeTruthy();
    expect(screen.queryByText("Supporting statement 29.pdf")).toBeNull();
    await userEvent.click(screen.getByTestId("file-review-show-more"));
    expect(screen.getByText("Supporting statement 29.pdf")).toBeTruthy();

    await userEvent.type(screen.getByTestId("file-review-document-search"), "rental lease");
    expect(screen.getByText("Unique rental lease.pdf")).toBeTruthy();
    expect(screen.getByText("Showing 1 of 1 matching current documents")).toBeTruthy();
  });
});
