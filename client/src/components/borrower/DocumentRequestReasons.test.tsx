import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SituationProfile } from "@shared/situationProfile";

// Borrower Clarity PR 3: the "Why we need these" card renders ONLY the
// SituationProfile's documentRequests — description, reason, tax year, entity.
// It must NEVER surface incomePaths signals or the classifier summary to a
// borrower: path candidacy reads as product steering and the profile is
// documented "NEVER a prequalification" (Reg N).

let response: {
  profile: Pick<SituationProfile, "documentRequests" | "incomePaths" | "summary">;
} | null;

import { DocumentRequestReasons } from "./DocumentRequestReasons";

function renderCard() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, queryFn: async () => response },
    },
  });
  client.setQueryData(["/api/tax-intelligence/situation"], response);
  return render(
    <QueryClientProvider client={client}>
      <DocumentRequestReasons />
    </QueryClientProvider>,
  );
}

const request = {
  id: "req-1",
  description: "2023 K-1 for Barakat Holdings LLC",
  reason: "Your 1065 shows a 40% ownership stake; the K-1 confirms the income split.",
  taxYear: 2023,
  entityName: "Barakat Holdings LLC",
};

beforeEach(() => {
  response = {
    profile: {
      documentRequests: [request],
      incomePaths: [
        { pathId: "bank_statement", signal: "candidate", reason: "internal candidacy note" },
      ] as SituationProfile["incomePaths"],
      summary: "Self-employed multi-entity borrower with rental income",
    },
  };
});

describe("DocumentRequestReasons", () => {
  it("renders each request's description, reason, year, and entity", () => {
    renderCard();
    const card = screen.getByTestId("card-document-request-reasons");
    expect(card.textContent).toContain("2023 K-1 for Barakat Holdings LLC");
    expect(card.textContent).toContain("the K-1 confirms the income split");
    expect(screen.getByTestId("text-request-reason-req-1").textContent).toContain(
      "40% ownership stake",
    );
  });

  it("never renders income-path signals or the classifier summary (Reg N)", () => {
    const { container } = renderCard();
    expect(container.textContent).not.toContain("internal candidacy note");
    expect(container.textContent).not.toContain("bank_statement");
    expect(container.textContent).not.toContain(
      "Self-employed multi-entity borrower with rental income",
    );
  });

  it("renders nothing when the profile has no document requests", () => {
    response = {
      profile: { documentRequests: [], incomePaths: [], summary: "irrelevant" },
    };
    const { container } = renderCard();
    expect(container.textContent).toBe("");
  });

  it("renders nothing while the profile is unavailable", () => {
    response = null;
    const { container } = renderCard();
    expect(container.textContent).toBe("");
  });
});
