import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";

// ---------------------------------------------------------------------------
// Admin task removal = audited cancellation, never a hard delete.
//
// The regression this pins: DELETE /api/tasks/:id used to issue a bare
// DELETE FROM tasks, which 500'd with FK violation 23503
// (task_audit_log_task_id_tasks_id_fk) for every task the engine ever created
// — taskEngine.createTask writes a "created" row to the immutable audit trail
// at birth, and task_events.resulting_task_id / underwriting_conditions
// .linked_task_id also reference tasks as loan-record history. The fix makes
// removal a terminal-status cancellation (EXPIRED + resolution stamps + an
// audit entry); these tests assert no DELETE statement is ever issued and pin
// the route contract (403 / 404 / 409-on-COMPLETED / idempotent EXPIRED).
//
// Hermetic: the drizzle `db` singleton and the auth middleware are mocked
// (same pattern as tests/mcpAudit.test.ts); the route is mounted on a real
// express app and driven over an ephemeral port.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  selectResult: [] as any[],
  updateCalls: [] as Array<{ table: any; vals: any }>,
  insertCalls: [] as Array<{ table: any; values: any }>,
  deleteCalls: 0,
  reset() {
    this.selectResult = [];
    this.updateCalls = [];
    this.insertCalls = [];
    this.deleteCalls = 0;
  },
}));

vi.mock("../server/db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: async (_cond: any) => h.selectResult }),
    }),
    update: (table: any) => ({
      set: (vals: any) => ({
        where: (_cond: any) => ({
          returning: async () => {
            h.updateCalls.push({ table, vals });
            return [{ ...h.selectResult[0], ...vals }];
          },
        }),
      }),
    }),
    insert: (table: any) => ({
      values: (values: any) => ({
        returning: async () => {
          h.insertCalls.push({ table, values });
          return [{ id: "audit-row-1", ...values }];
        },
      }),
    }),
    delete: (_table: any) => {
      h.deleteCalls++;
      return { where: async () => [] };
    },
  },
}));

vi.mock("../server/auth", () => ({
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
  requireRole:
    (...roles: string[]) =>
    (req: any, res: any, next: any) =>
      roles.includes(req.user?.role) ? next() : res.status(403).json({ error: "Forbidden" }),
}));

import { tasks, taskAuditLog } from "../shared/schema";
import { taskEngine, TaskNotCancellableError } from "../server/services/taskEngine";

const baseTask = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "task-1",
  applicationId: "app-1",
  status: "OPEN",
  resolutionNotes: null,
  resolvedByUserId: null,
  ...overrides,
});

beforeEach(() => {
  h.reset();
});

describe("taskEngine.cancelTask — soft close, audit-preserving", () => {
  it("cancels an active task: EXPIRED + resolution stamps + a 'cancelled' audit row, and never issues a DELETE", async () => {
    for (const status of ["OPEN", "IN_PROGRESS", "BLOCKED"]) {
      h.reset();
      h.selectResult = [baseTask({ status })];

      const result = await taskEngine.cancelTask("task-1", "admin-1", "duplicate of task-2");

      expect(result?.status).toBe("EXPIRED");
      expect(h.updateCalls).toHaveLength(1);
      expect(h.updateCalls[0].table).toBe(tasks);
      expect(h.updateCalls[0].vals).toMatchObject({
        status: "EXPIRED",
        resolvedByUserId: "admin-1",
        resolutionNotes: "Cancelled by admin: duplicate of task-2",
      });

      // The removal itself becomes part of the immutable trail.
      expect(h.insertCalls).toHaveLength(1);
      expect(h.insertCalls[0].table).toBe(taskAuditLog);
      expect(h.insertCalls[0].values).toMatchObject({
        taskId: "task-1",
        action: "cancelled",
        previousValue: { status },
        newValue: { status: "EXPIRED" },
        actorUserId: "admin-1",
      });

      // The original bug: a bare DELETE FROM tasks (FK 23503 on task_audit_log).
      expect(h.deleteCalls).toBe(0);
    }
  });

  it("appends the cancellation note after existing resolution notes instead of clobbering them", async () => {
    h.selectResult = [baseTask({ status: "IN_PROGRESS", resolutionNotes: "Borrower uploaded wrong year" })];

    await taskEngine.cancelTask("task-1", "admin-1");

    expect(h.updateCalls[0].vals.resolutionNotes).toBe(
      "Borrower uploaded wrong year\nCancelled by admin — removed from active queues; record retained",
    );
  });

  it("refuses to cancel a COMPLETED task — completed work is part of the loan record", async () => {
    h.selectResult = [baseTask({ status: "COMPLETED" })];

    await expect(taskEngine.cancelTask("task-1", "admin-1")).rejects.toBeInstanceOf(
      TaskNotCancellableError,
    );
    expect(h.updateCalls).toHaveLength(0);
    expect(h.insertCalls).toHaveLength(0);
    expect(h.deleteCalls).toBe(0);
  });

  it("is idempotent on an already-EXPIRED task: no second write, no duplicate audit row", async () => {
    const expired = baseTask({ status: "EXPIRED" });
    h.selectResult = [expired];

    const result = await taskEngine.cancelTask("task-1", "admin-1");

    expect(result).toBe(expired);
    expect(h.updateCalls).toHaveLength(0);
    expect(h.insertCalls).toHaveLength(0);
    expect(h.deleteCalls).toBe(0);
  });

  it("returns null for an unknown task id", async () => {
    h.selectResult = [];
    expect(await taskEngine.cancelTask("nope", "admin-1")).toBeNull();
  });
});

describe("DELETE /api/tasks/:id — route contract", () => {
  let server: import("node:http").Server;
  let base: string;
  let currentUser: { id: string; role: string };
  let cancelSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    const express = (await import("express")).default;
    const { registerTaskEngineRoutes } = await import("../server/routes/task-engine");

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = currentUser;
      next();
    });
    // The DELETE route only touches taskEngine; other routes in the registrar
    // capture storage lazily, so an empty stub is safe here.
    await registerTaskEngineRoutes(app, {} as any);

    server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(() => {
    server?.close();
  });

  beforeEach(() => {
    currentUser = { id: "admin-1", role: "admin" };
    cancelSpy = vi.spyOn(taskEngine, "cancelTask");
  });

  afterEach(() => {
    cancelSpy.mockRestore();
  });

  const del = (id: string, body?: unknown) =>
    fetch(`${base}/api/tasks/${id}`, {
      method: "DELETE",
      ...(body !== undefined
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        : {}),
    });

  it("remains admin-only", async () => {
    for (const role of ["processor", "underwriter", "lo", "borrower", "broker"]) {
      currentUser = { id: "user-1", role };
      const res = await del("task-1");
      expect(res.status, `${role} must be rejected`).toBe(403);
    }
    expect(cancelSpy).not.toHaveBeenCalled();
  });

  it("404s on an unknown task instead of silently succeeding", async () => {
    cancelSpy.mockResolvedValue(null);
    const res = await del("missing-task");
    expect(res.status).toBe(404);
  });

  it("cancels (not deletes) an engine-created task and says so — the FK-500 regression", async () => {
    cancelSpy.mockResolvedValue(baseTask({ status: "EXPIRED" }) as any);
    const res = await del("task-1");

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.task.status).toBe("EXPIRED");
    expect(payload.message).toMatch(/retained/i);
    expect(cancelSpy).toHaveBeenCalledWith("task-1", "admin-1", undefined);
  });

  it("passes an optional reason through to the audit trail", async () => {
    cancelSpy.mockResolvedValue(baseTask({ status: "EXPIRED" }) as any);
    const res = await del("task-1", { reason: "created against the wrong application" });
    expect(res.status).toBe(200);
    expect(cancelSpy).toHaveBeenCalledWith("task-1", "admin-1", "created against the wrong application");
  });

  it("400s a malformed reason before touching the task", async () => {
    const res = await del("task-1", { reason: 123 });
    expect(res.status).toBe(400);
    expect(cancelSpy).not.toHaveBeenCalled();
  });

  it("409s on a COMPLETED task with the loan-record explanation", async () => {
    cancelSpy.mockRejectedValue(new TaskNotCancellableError("task-1"));
    const res = await del("task-1");
    expect(res.status).toBe(409);
    const payload = await res.json();
    expect(payload.error).toMatch(/loan record/i);
  });
});
