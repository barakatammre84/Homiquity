import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { LoanLetterButton } from "./LoanLetterButton";
import { loanApplicationKeys } from "@/lib/queryClient";

// The borrower's letter control on the Loan Options page. Before this test the
// component read `hasLetter` alone: an expired or revoked letter still rendered
// "Download Pre-Approval Letter", and there was no path to a fresh one — while
// the staff card rendered "Expired"/"Revoked" from the same field
// (DESIGN_SYSTEM.md §13 Agreement).

const APP_ID = "app-1";
const FUTURE = "2099-01-01T00:00:00.000Z";
const PAST = "2020-01-01T00:00:00.000Z";

function renderButton(
  kind: "prequal" | "preapproval",
  status: string,
  payload: Record<string, unknown> | undefined,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const key = kind === "prequal"
    ? loanApplicationKeys.prequalStatus(APP_ID)
    : loanApplicationKeys.letterStatus(APP_ID);
  if (payload) queryClient.setQueryData(key, payload);
  return render(
    <QueryClientProvider client={queryClient}>
      <LoanLetterButton applicationId={APP_ID} status={status} kind={kind} />
    </QueryClientProvider>,
  );
}

describe("LoanLetterButton", () => {
  it("offers a download only while the pre-approval letter is live", () => {
    renderButton("preapproval", "pre_approved", {
      hasLetter: true,
      letterNumber: "BN-1",
      status: "issued",
      expirationDate: FUTURE,
    });
    expect(screen.getByTestId("button-download-letter")).toBeTruthy();
    expect(screen.queryByTestId("text-letter-unusable")).toBeNull();
  });

  it("says a pre-approval letter expired and offers a fresh one instead of a download", () => {
    renderButton("preapproval", "pre_approved", {
      hasLetter: true,
      letterNumber: "BN-1",
      status: "expired",
      expirationDate: PAST,
    });
    expect(screen.queryByTestId("button-download-letter")).toBeNull();
    expect(screen.getByTestId("text-letter-unusable").textContent).toContain("expired");
    expect(screen.getByTestId("button-generate-letter")).toBeTruthy();
  });

  it("neither downloads nor re-mints a revoked pre-approval letter", () => {
    renderButton("preapproval", "pre_approved", {
      hasLetter: true,
      letterNumber: "BN-1",
      status: "revoked",
      expirationDate: FUTURE,
    });
    expect(screen.queryByTestId("button-download-letter")).toBeNull();
    expect(screen.queryByTestId("button-generate-letter")).toBeNull();
    expect(screen.getByTestId("text-letter-unusable").textContent).toContain("withdrew");
  });

  it("applies the same rule to the pre-qualification letter", () => {
    renderButton("prequal", "submitted", {
      hasLetter: true,
      letterNumber: "PQ-1",
      status: "expired",
      expirationDate: PAST,
    });
    expect(screen.queryByTestId("button-download-prequal")).toBeNull();
    expect(screen.getByTestId("button-generate-prequal")).toBeTruthy();
    expect(screen.getByTestId("text-letter-unusable").textContent).toContain("expired");
  });

  it("still offers to generate the first letter when the file has none", () => {
    renderButton("prequal", "submitted", { hasLetter: false });
    expect(screen.getByTestId("button-generate-prequal")).toBeTruthy();
    expect(screen.queryByTestId("text-letter-unusable")).toBeNull();
  });

  it("renders nothing for a status the letter does not apply to", () => {
    const { container } = renderButton("preapproval", "submitted", { hasLetter: true, status: "issued" });
    expect(container.textContent).toBe("");
  });
});
