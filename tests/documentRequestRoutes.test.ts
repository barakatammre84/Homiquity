import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";

vi.mock("../server/auth", () => ({
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../server/auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("../server/services/emailService", () => ({ sendNotificationEmail: vi.fn() }));
vi.mock("../server/services/complaintEscalation", () => ({
  escalateFlaggedMessage: vi.fn(async () => undefined),
}));

type Actor = { id: string; role: string; firstName?: string; lastName?: string };
type Doc = {
  id: string;
  userId: string;
  applicationId: string;
  documentType: string;
  status: string;
};

const state = {
  actor: { id: "borrower-1", role: "active_buyer" } as Actor,
  request: null as any,
  documents: [] as Doc[],
  applications: [] as Array<{ id: string; userId: string; status: string }>,
  messages: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
  notifications: [] as Array<Record<string, unknown>>,
  staffApplicationIds: new Set<string>(),
  reset() {
    this.actor = { id: "borrower-1", role: "active_buyer" };
    this.request = {
      id: "request-1",
      senderId: "lo-1",
      recipientId: "borrower-1",
      applicationId: "app-1",
      message: "Document Request: Recent Pay Stubs",
      messageType: "document_request",
      documentRequestData: {
        documentType: "pay_stub",
        documentName: "Recent Pay Stubs",
        status: "pending",
      },
      isRead: false,
      readAt: null,
      createdAt: new Date(),
    };
    this.documents = [];
    this.applications = [
      { id: "app-1", userId: "borrower-1", status: "underwriting" },
    ];
    this.messages = [];
    this.updates = [];
    this.notifications = [];
    this.staffApplicationIds = new Set(["app-1"]);
  },
};

const storage = {
  getMessageById: async (id: string) => (state.request?.id === id ? state.request : null),
  getLoanApplicationWithAccess: async (id: string, userId: string) => {
    const application = state.applications.find((candidate) => candidate.id === id);
    if (!application) return undefined;
    if (application.userId === userId) return application;
    return userId === "lo-1" && state.staffApplicationIds.has(id)
      ? application
      : undefined;
  },
  getDocument: async (id: string) => state.documents.find((doc) => doc.id === id),
  getDocumentsByApplication: async (id: string) =>
    state.documents.filter((doc) => doc.applicationId === id),
  getUser: async (id: string) =>
    id === "borrower-1"
      ? { id, role: "active_buyer", firstName: "Avery", email: "avery@example.test" }
      : id === "lo-1"
        ? { id, role: "lo", firstName: "Lee", email: "lee@example.test" }
        : undefined,
  getLoanApplication: async (id: string) =>
    state.applications.find((application) => application.id === id),
  getLoanApplicationsByUser: async () => state.applications,
  isStaffOnBorrowerTeam: async (_borrowerId: string, staffId: string) => staffId === "lo-1",
  sendDocumentRequestOnce: async () => ({ message: state.request, created: false }),
  sendMessage: async (row: Record<string, unknown>) => {
    const message = { id: `message-${state.messages.length + 1}`, ...row };
    state.messages.push(message);
    return message;
  },
  createNotification: async (row: Record<string, unknown>) => {
    state.notifications.push(row);
    return row;
  },
} as any;

describe("document request routes", () => {
  let server: import("node:http").Server;
  let base: string;

  beforeAll(async () => {
    const express = (await import("express")).default;
    const { registerMessagingRoutes } = await import("../server/routes/borrower/messaging");
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = state.actor;
      next();
    });
    registerMessagingRoutes(app, storage);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => server?.close());
  beforeEach(() => state.reset());

  it("returns the existing open request without sending another notification", async () => {
    state.actor = { id: "lo-1", role: "lo", firstName: "Lee" };
    const response = await fetch(`${base}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientId: "borrower-1",
        applicationId: "app-1",
        message: "Document Request: Recent Pay Stubs",
        messageType: "document_request",
        documentRequestData: {
          documentType: "paystub",
          documentName: "Recent Pay Stubs",
          status: "pending",
        },
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "request-1", deduplicated: true });
    expect(state.notifications).toHaveLength(0);
  });

  it("does not let staff outside the deal team request a borrower document", async () => {
    state.actor = { id: "lo-outside", role: "lo", firstName: "Outside" };
    const response = await fetch(`${base}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientId: "borrower-1",
        applicationId: "app-1",
        message: "Document Request: Recent Pay Stubs",
        messageType: "document_request",
        documentRequestData: {
          documentType: "pay_stub",
          documentName: "Recent Pay Stubs",
          status: "pending",
        },
      }),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: "You do not have access to this loan application",
    });
    expect(state.notifications).toHaveLength(0);
  });

  it("does not send new file activity to staff assigned only to another application", async () => {
    state.applications.push({ id: "app-2", userId: "borrower-1", status: "underwriting" });
    state.staffApplicationIds = new Set(["app-2"]);

    const response = await fetch(`${base}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientId: "lo-1",
        applicationId: "app-1",
        message: "I uploaded the corrected tax return for this file.",
      }),
    });

    expect(response.status).toBe(403);
    expect(state.messages).toHaveLength(0);
    expect(state.notifications).toHaveLength(0);
  });

  it("does not let an external lender contact a borrower without a loan assignment", async () => {
    state.actor = { id: "lender-outside", role: "lender", firstName: "Outside" };
    state.applications = [];
    const response = await fetch(`${base}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientId: "borrower-1",
        message: "Please send your documents directly to me.",
      }),
    });
    expect(response.status).toBe(403);
    expect(state.messages).toHaveLength(0);
    expect(state.notifications).toHaveLength(0);
  });

  it("does not let a former file participant bypass assignment by omitting a closed application", async () => {
    state.actor = { id: "lo-outside", role: "lo", firstName: "Outside" };
    state.applications = [
      { id: "app-closed", userId: "borrower-1", status: "funded" },
    ];
    const response = await fetch(`${base}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientId: "borrower-1",
        message: "Please reopen this conversation.",
      }),
    });
    expect(response.status).toBe(403);
    expect(state.messages).toHaveLength(0);
  });

  it("keeps internal pre-application outreach available", async () => {
    state.actor = { id: "lo-1", role: "lo", firstName: "Lee" };
    state.applications = [];
    const response = await fetch(`${base}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientId: "borrower-1",
        message: "I can help you start an application.",
      }),
    });
    expect(response.status).toBe(201);
    expect(state.messages).toHaveLength(1);
  });
});
