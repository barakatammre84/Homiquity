import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ActionItemsSection } from "./ActionItemsSection";
import { loanApplicationKeys } from "@/lib/queryClient";

// The post-submit page's lead section: the server-computed action items.
// These pin the wiring (server payload → visible CTAs) and the two empty
// states — "list is coming" during analysis vs "genuinely caught up" after.

const APP_ID = "app-123";

function renderSection(
  payload: { items: unknown[]; stats: { total: number; urgent: number; pending: number; completed: number } } | null,
  stillAnalyzing = false,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  if (payload) {
    queryClient.setQueryData(loanApplicationKeys.actionItems(APP_ID), payload);
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <ActionItemsSection applicationId={APP_ID} stillAnalyzing={stillAnalyzing} />
    </QueryClientProvider>,
  );
}

const item = (over: Record<string, unknown> = {}) => ({
  id: "task-1",
  type: "document",
  title: "Upload: W-2 Forms Required",
  description: "Most recent 2 years of W-2 forms",
  priority: "normal",
  status: "pending",
  actionUrl: "/documents",
  actionLabel: "Upload",
  ...over,
});

describe("ActionItemsSection", () => {
  it("renders each item with its CTA linking to the server-provided route", () => {
    renderSection({
      items: [
        item({ id: "t1", priority: "urgent", title: "Sign Required Disclosures", actionUrl: "/e-consent", actionLabel: "Review & Sign" }),
        item({ id: "t2" }),
      ],
      stats: { total: 2, urgent: 1, pending: 2, completed: 0 },
    });

    expect(screen.getByTestId("text-action-items-count").textContent).toBe("2");
    expect(screen.getByTestId("action-item-t1").textContent).toContain("Sign Required Disclosures");

    const firstCta = screen.getByTestId("button-action-item-t1");
    expect(firstCta.textContent).toBe("Review & Sign");
    expect(firstCta.closest("a")?.getAttribute("href")).toBe("/e-consent");
    expect(screen.getByTestId("button-action-item-t2").closest("a")?.getAttribute("href")).toBe(
      "/documents",
    );
  });

  it("caps the visible list and points the rest at the dashboard", () => {
    renderSection({
      items: Array.from({ length: 7 }, (_, i) => item({ id: `t${i}` })),
      stats: { total: 7, urgent: 0, pending: 7, completed: 0 },
    });
    expect(screen.getAllByTestId(/^action-item-/)).toHaveLength(5);
    expect(screen.getByTestId("text-action-items-overflow").textContent).toContain("+2 more");
  });

  it("says the list is on its way while intake is still analyzing", () => {
    renderSection({ items: [], stats: { total: 0, urgent: 0, pending: 0, completed: 0 } }, true);
    expect(screen.getByTestId("text-action-items-empty").textContent).toContain(
      "personalized document list",
    );
  });

  it("says caught-up (not 'coming soon') once analysis is settled and the list is truly empty", () => {
    renderSection({ items: [], stats: { total: 0, urgent: 0, pending: 0, completed: 3 } }, false);
    expect(screen.getByTestId("text-action-items-empty").textContent).toContain(
      "Nothing needed from you right now",
    );
  });
});
