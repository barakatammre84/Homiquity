import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { PreQualLetterCard } from "./PreQualLetterCard";
import { loanApplicationKeys } from "@/lib/queryClient";

// The borrower dashboard's letter card. It used to render "Your letter is
// ready to download" from `hasLetter` alone — true of an expired letter, and
// of one the loan team withdrew.

const APP_ID = "app-1";
const FUTURE = "2099-01-01T00:00:00.000Z";
const PAST = "2020-03-04T12:00:00.000Z"; // midday UTC so the rendered local date is stable

function renderCard(payload: Record<string, unknown> | undefined) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  if (payload) queryClient.setQueryData(loanApplicationKeys.prequalStatus(APP_ID), payload);
  return render(
    <QueryClientProvider client={queryClient}>
      <PreQualLetterCard applicationId={APP_ID} />
    </QueryClientProvider>,
  );
}

describe("PreQualLetterCard", () => {
  it("offers the download and names the date the letter is good through", () => {
    renderCard({ hasLetter: true, letterNumber: "PQ-1", status: "issued", expirationDate: FUTURE });
    expect(screen.getByTestId("button-download-prequal-dash")).toBeTruthy();
    expect(screen.getByTestId("text-prequal-subtitle").textContent).toContain("valid through");
    expect(screen.queryByTestId("button-generate-prequal-dash")).toBeNull();
  });

  it("does not call an expired letter ready, and offers an updated one", () => {
    renderCard({ hasLetter: true, letterNumber: "PQ-1", status: "expired", expirationDate: PAST });
    expect(screen.queryByTestId("button-download-prequal-dash")).toBeNull();
    const subtitle = screen.getByTestId("text-prequal-subtitle").textContent ?? "";
    expect(subtitle).not.toContain("ready to download");
    expect(subtitle).toContain("expired on Mar 4, 2020");
    expect(screen.getByTestId("button-generate-prequal-dash").textContent).toContain("updated");
  });

  it("offers no action at all on a letter the loan team withdrew", () => {
    renderCard({ hasLetter: true, letterNumber: "PQ-1", status: "revoked", expirationDate: FUTURE });
    expect(screen.queryByTestId("button-download-prequal-dash")).toBeNull();
    expect(screen.queryByTestId("button-generate-prequal-dash")).toBeNull();
    expect(screen.getByTestId("text-prequal-subtitle").textContent).toContain("withdrew");
  });

  it("still offers the first letter when none exists", () => {
    renderCard({ hasLetter: false });
    expect(screen.getByTestId("button-generate-prequal-dash").textContent).toContain("Generate");
    expect(screen.queryByTestId("button-download-prequal-dash")).toBeNull();
  });
});
