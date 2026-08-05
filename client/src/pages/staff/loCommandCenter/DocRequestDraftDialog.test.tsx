import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DocRequestDraftDialog } from "./DocRequestDraftDialog";

// LO-M17 pins: the draft is pre-filled and *approval-gated* — the LO sees the
// items with the conditions they clear, can exclude any, and nothing implies
// auto-send. Empty drafts read as the normal state, not an error.

const APP_ID = "app-1";

const draft = {
  applicationId: APP_ID,
  recipientId: "borrower-1",
  items: [
    { documentType: "w2", documentName: "W2", conditionTitles: ["Verify 2024 income"] },
    { documentType: "bank_statement", documentName: "Bank statement", conditionTitles: ["Asset docs"] },
  ],
};

function renderDialog(data: unknown = draft) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["/api/staff/applications", APP_ID, "doc-request-draft"], data);
  return render(
    <QueryClientProvider client={client}>
      <DocRequestDraftDialog applicationId={APP_ID} />
    </QueryClientProvider>,
  );
}

describe("DocRequestDraftDialog", () => {
  it("pre-fills items with the conditions they clear, and the send button counts them", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByTestId("button-doc-request-draft"));
    expect(screen.getByTestId("draft-item-w2").textContent).toMatch(/Verify 2024 income/);
    expect(screen.getByTestId("button-send-draft").textContent).toMatch(/Send 2 requests/);
  });

  it("unchecking an item excludes it from the send count; zero selected disables send", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByTestId("button-doc-request-draft"));
    await user.click(screen.getByTestId("checkbox-w2"));
    expect(screen.getByTestId("button-send-draft").textContent).toMatch(/Send 1 request$/);
    await user.click(screen.getByTestId("checkbox-bank_statement"));
    expect((screen.getByTestId("button-send-draft") as HTMLButtonElement).disabled).toBe(true);
  });

  it("an empty draft reads as the normal nothing-missing state", async () => {
    const user = userEvent.setup();
    renderDialog({ applicationId: APP_ID, recipientId: "borrower-1", items: [] });
    await user.click(screen.getByTestId("button-doc-request-draft"));
    expect(screen.getByTestId("text-no-missing-docs").textContent).toMatch(/Nothing to request/);
  });

  it("states that nothing sends without approval", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByTestId("button-doc-request-draft"));
    expect(screen.getByTestId("dialog-doc-request-draft").textContent).toMatch(
      /nothing sends until you approve/i,
    );
  });
});
