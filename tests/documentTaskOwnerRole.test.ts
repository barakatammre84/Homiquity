import { describe, expect, it, vi, beforeEach } from "vitest";

import { deriveDocumentTaskOwnerRole, type InsertTask } from "../shared/schema";

// generateDocumentTasks persists through the storage singleton — capture the
// inserts instead of hitting a database (unit suite is hermetic).
vi.mock("../server/storage", () => ({
  storage: {
    createTask: vi.fn(async (data: InsertTask) => ({ id: "task-1", ...data })),
  },
}));

import { generateDocumentTasks } from "../server/pipelineEngine";
import { storage } from "../server/storage";

const createTaskMock = vi.mocked(storage.createTask);

const requirement = (documentType: string) => ({
  documentType,
  description: `${documentType} needed`,
  priority: "prior_to_docs" as const,
  conditionCategory: "income",
  conditionTitle: `Upload ${documentType}`,
});

describe("deriveDocumentTaskOwnerRole", () => {
  it("derives BORROWER for a document request assigned to the application owner", () => {
    expect(
      deriveDocumentTaskOwnerRole(
        { taskType: "document_request", assignedToUserId: "borrower-1" },
        "borrower-1",
      ),
    ).toBe("BORROWER");
  });

  it("leaves a document request assigned to someone else (staff chase task) to the default", () => {
    expect(
      deriveDocumentTaskOwnerRole(
        { taskType: "document_request", assignedToUserId: "processor-9" },
        "borrower-1",
      ),
    ).toBeUndefined();
  });

  it("leaves an unassigned document request (document-intelligence review item) to the default", () => {
    expect(
      deriveDocumentTaskOwnerRole({ taskType: "document_request" }, "borrower-1"),
    ).toBeUndefined();
    expect(
      deriveDocumentTaskOwnerRole(
        { taskType: "document_request", assignedToUserId: null },
        "borrower-1",
      ),
    ).toBeUndefined();
  });

  it("never claims non-document task types, even when borrower-assigned", () => {
    expect(
      deriveDocumentTaskOwnerRole(
        { taskType: "review", assignedToUserId: "borrower-1" },
        "borrower-1",
      ),
    ).toBeUndefined();
  });

  it("does not match when the application owner is unknown", () => {
    // Guards the degenerate undefined === undefined coincidence: an unassigned
    // task plus a missing application must not read as borrower work.
    expect(
      deriveDocumentTaskOwnerRole({ taskType: "document_request" }, undefined),
    ).toBeUndefined();
  });
});

describe("generateDocumentTasks — borrower ownership", () => {
  beforeEach(() => {
    createTaskMock.mockClear();
  });

  it("stamps every pipeline document task BORROWER-owned and OPEN", async () => {
    // The regression this pins: omitting ownerRole let the column default
    // (PROCESSOR) hide 1,015 dev tasks from the borrower badge and requests
    // panel while polluting the staff processor queue (migration 0034).
    const tasks = await generateDocumentTasks(
      "app-1",
      "borrower-1",
      [requirement("w2"), requirement("bank_statement")],
      "creator-1",
    );

    expect(tasks).toHaveLength(2);
    expect(createTaskMock).toHaveBeenCalledTimes(2);
    for (const call of createTaskMock.mock.calls) {
      const inserted = call[0];
      expect(inserted.ownerRole).toBe("BORROWER");
      expect(inserted.status).toBe("OPEN");
      expect(inserted.taskType).toBe("document_request");
      expect(inserted.assignedToUserId).toBe("borrower-1");
    }
  });
});
