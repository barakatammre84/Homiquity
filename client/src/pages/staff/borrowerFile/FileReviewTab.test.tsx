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
  documents: [{ id: "d", name: "Supporting statement.pdf", documentType: "bank_statement", status: "uploaded", reviewedAt: null }],
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
    const data = fixture(); data.checkpoints = [{ id: "r", version: 1, reviewedAt: "2026-09-04T00:00:00Z", reviewedBy: "lo", isStale: true, staleReasons: ["Uploaded documents changed after this review."] }];
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
});
