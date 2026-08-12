import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { taskKeys } from "@/lib/queryClient";

// #484 — Approve and Reject both acted on `documents[documents.length - 1]`.
//
// On a multi-upload task ("2 years of tax returns", "last 3 pay stubs") every
// earlier document was unreachable: a reviewer who believed they had approved
// "the tax returns" had approved exactly one file, and the rest stayed
// unverified forever. The API has always taken a docId — only the UI collapsed
// the choice — so this is a targeting bug, not a missing capability.
//
// These pins are about WHICH document each control acts on. That is the whole
// defect, and it is invisible unless a task has more than one upload.

const apiRequestMock = vi.hoisted(() => vi.fn(async () => ({ json: async () => ({}) })));
vi.mock("@/lib/queryClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queryClient")>();
  return { ...actual, apiRequest: apiRequestMock };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "staff-1", role: "processor" }, isLoading: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-upload", () => ({ useUpload: () => ({ upload: vi.fn() }) }));
vi.mock("wouter", () => ({
  useLocation: () => ["/tasks/task-1", vi.fn()],
  useRoute: () => [true, { id: "task-1" }],
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const taskDoc = (id: string, fileName: string, isVerified = false) => ({
  id,
  taskId: "task-1",
  documentId: `doc-${id}`,
  isVerified,
  verificationNotes: null,
  createdAt: "2026-08-01T12:00:00.000Z",
  document: { id: `doc-${id}`, fileName },
});

// Three uploads — the shape the bug needed to be visible at all.
const task = {
  id: "task-1",
  title: "Upload 2 years of tax returns",
  description: "We need both years.",
  status: "IN_PROGRESS",
  verificationStatus: "pending",
  taskType: "document_upload",
  documentCategory: null,
  priority: "normal",
  dueDate: null,
  createdAt: "2026-08-01T12:00:00.000Z",
  documents: [
    taskDoc("td-2023", "tax-return-2023.pdf"),
    taskDoc("td-2024", "tax-return-2024.pdf"),
    taskDoc("td-w2", "w2-2024.pdf"),
  ],
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, enabled: false } },
  });
  client.setQueryData(taskKeys.detail("task-1"), task);
  return render(
    <QueryClientProvider client={client}>
      <TaskDetail />
    </QueryClientProvider>,
  );
}

// Imported after the mocks are registered.
const { default: TaskDetail } = await import("./TaskDetail");

describe("TaskDetail — verifying a task with more than one document", () => {
  beforeEach(() => apiRequestMock.mockClear());

  it("gives every document its own Approve and Reject, not one pair for the task", () => {
    renderPage();
    for (const id of ["td-2023", "td-2024", "td-w2"]) {
      expect(screen.getByTestId(`button-approve-document-${id}`)).toBeTruthy();
      expect(screen.getByTestId(`button-reject-document-${id}`)).toBeTruthy();
    }
  });

  it("approves the document whose button was pressed — not the last upload", async () => {
    // The regression: this used to send td-w2 (documents[length - 1]) no matter
    // which row the reviewer clicked.
    renderPage();
    await userEvent.click(screen.getByTestId("button-approve-document-td-2023"));

    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    const [method, url, body] = apiRequestMock.mock.calls[0] as any[];
    expect(method).toBe("PATCH");
    expect(url).toBe("/api/tasks/task-1/documents/td-2023/verify");
    expect(body).toMatchObject({ isVerified: true });
  });

  it("rejects the document whose button was pressed", async () => {
    renderPage();
    await userEvent.click(screen.getByTestId("button-reject-document-td-2024"));

    const [, url, body] = apiRequestMock.mock.calls[0] as any[];
    expect(url).toBe("/api/tasks/task-1/documents/td-2024/verify");
    expect(body).toMatchObject({ isVerified: false });
  });

  it("can reach the FIRST upload, which was previously unreachable", async () => {
    renderPage();
    await userEvent.click(screen.getByTestId("button-approve-document-td-2023"));
    expect((apiRequestMock.mock.calls[0] as any[])[1]).toContain("td-2023");
  });

  it("labels each control with its file name, so the target is unambiguous", () => {
    renderPage();
    expect(screen.getByLabelText("Approve and verify tax-return-2023.pdf")).toBeTruthy();
    expect(screen.getByLabelText("Reject w2-2024.pdf")).toBeTruthy();
  });

  it("shows per-document verification state rather than one status for the task", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity, enabled: false } },
    });
    client.setQueryData(taskKeys.detail("task-1"), {
      ...task,
      documents: [taskDoc("td-a", "a.pdf", true), taskDoc("td-b", "b.pdf", false)],
    });
    render(
      <QueryClientProvider client={client}>
        <TaskDetail />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("verify-row-td-a").textContent).toContain("Verified");
    expect(screen.getByTestId("verify-row-td-b").textContent).toContain("Not yet verified");
  });
});
