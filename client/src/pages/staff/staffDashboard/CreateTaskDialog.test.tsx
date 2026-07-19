import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { documentCategories, documentYears, priorityOptions } from "./model";
import type { LoanApplication } from "@shared/schema";

// Characterization for the extracted Create Task dialog: the task-type
// conditional fields (document requests derive their title from category+year
// and carry borrower instructions; other types take a free title), and the
// priority picker pinned to the shared task-engine vocabulary.

beforeAll(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

const apps = [
  { id: "app-1", userId: "u-1", status: "doc_collection" },
] as unknown as LoanApplication[];

function renderDialog(over?: Partial<Parameters<typeof CreateTaskDialog>[0]>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CreateTaskDialog
        open={true}
        onOpenChange={vi.fn()}
        selectedApplication=""
        onSelectedApplicationChange={vi.fn()}
        applications={apps}
        getUserName={() => "Active Buyer"}
        {...over}
      />
    </QueryClientProvider>,
  );
}

describe("CreateTaskDialog", () => {
  it("defaults to a document request: category/year/instructions shown, free title hidden", () => {
    renderDialog();
    expect(screen.getByTestId("select-document-category")).toBeTruthy();
    expect(screen.getByTestId("select-document-year")).toBeTruthy();
    expect(screen.getByTestId("input-document-instructions")).toBeTruthy();
    expect(screen.queryByTestId("input-task-title")).toBeNull();
  });

  it("switching to a non-document type swaps to free title + description", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByTestId("select-task-type"));
    const listbox = await screen.findByRole("listbox");
    await user.click(within(listbox).getByText("Verification"));
    expect(screen.getByTestId("input-task-title")).toBeTruthy();
    expect(screen.getByTestId("input-task-description")).toBeTruthy();
    expect(screen.queryByTestId("select-document-category")).toBeNull();
  });

  it("priority picker offers exactly the shared task-engine vocabulary", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByTestId("select-priority"));
    const listbox = await screen.findByRole("listbox");
    const labels = within(listbox).getAllByRole("option").map((o) => o.textContent);
    expect(labels).toEqual(priorityOptions.map((o) => o.label));
  });

  it("document category and year pickers derive from the shared model lists", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByTestId("select-document-category"));
    let listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual(
      documentCategories.map((c) => c.label),
    );
    await user.keyboard("{Escape}");
    await user.click(screen.getByTestId("select-document-year"));
    listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual([...documentYears]);
  });
});
