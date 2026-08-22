import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";

// ---------------------------------------------------------------------------
// The borrower's own upload must persist what the model read — not just the
// field NAMES.
//
// THE SEAM (Workflow 4, step 3 → step 4). There are two extraction paths:
//
//   A. POST /api/documents/:id/extract   — pressed by STAFF in the review
//      workbench (client/src/components/staff/DocumentReviewPanel.tsx is its
//      only caller).
//   B. the fire-and-forget auto-extraction inside POST /api/documents/upload  —
//      the path that runs when a BORROWER uploads a pay stub, bank statement
//      or lease. Nothing in the borrower UI triggers (A).
//
// F-028 (`server/services/documentFacts.ts`) and F-030 (`wireExtractionToReadiness`)
// were both wired into (A) and never into (B) — even though F-028's own docblock
// describes the borrower upload as the scenario it closes: "A borrower uploads a
// pay stub. A model reads it. The numbers are then discarded ... the platform
// kept asking for figures it had already been shown."
//
// So on the only path a borrower can actually reach, the model read the stub,
// the values were thrown away, and the file went on asking for them. Same class
// as the #451 co-borrower fix that covered slot 1 only: the fix landed on one
// caller of a two-caller behaviour.
//
// These tests drive the REAL upload route (same hermetic express-on-an-ephemeral-
// port harness as tests/documentUploadTerminalGuard.test.ts) with a stubbed
// extractor, and assert the borrower path persists facts, wires readiness, and
// records model/prompt lineage exactly as the staff path does.
// ---------------------------------------------------------------------------

vi.mock("../server/integrations/object_storage/objectStorage", () => ({
  ObjectStorageService: class {
    async verifyAndClaimObject() {
      return { configured: false as const };
    }
  },
}));

vi.mock("../server/auth", () => ({
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../server/auditLog", () => ({ logAudit: vi.fn() }));

vi.mock("../server/services/taskEventEmitter", () => ({
  taskEventEmitter: { emitDocumentEvent: vi.fn() },
}));
vi.mock("../server/pipelineEngine", () => ({
  matchUploadedDocumentToConditions: vi.fn(),
}));
vi.mock("../server/services/autopilot/config", () => ({
  getAutopilotConfig: vi.fn(async () => ({ enabled: false })),
  isAutopilotEnabled: vi.fn(async () => false),
}));

// A high-confidence pay stub: YTD gross over a period end date six months in,
// which is exactly the shape buildDocumentFacts turns into a monthly figure.
const PAY_STUB = {
  employeeName: "Dana Reyes",
  employerName: "Northwind Logistics",
  payPeriodStartDate: "2026-06-16",
  payPeriodEndDate: "2026-06-30",
  grossPay: 4200,
  netPay: 3100,
  ytdGross: 50400,
  ytdNetPay: 37200,
  ytdTaxes: 13200,
  confidence: "high" as const,
  extractedFields: ["employerName", "grossPay", "ytdGross", "payPeriodEndDate"],
  warnings: [],
  modelId: "claude-sonnet-5",
  promptVersion: "pay_stub/v3",
  rawResponseHash: "sha256:deadbeef",
  rawResponseEncrypted: "ciphertext",
  rawResponseIv: "iv",
  rawResponseKeyId: "key-1",
};

vi.mock("../server/extractionService", () => ({
  extractPayStubData: vi.fn(async () => PAY_STUB),
  extractBankStatementData: vi.fn(async () => ({
    confidence: "high" as const,
    extractedFields: [],
    closingBalance: 18_000,
    accountType: "checking",
  })),
  extractLeaseData: vi.fn(async () => ({ confidence: "high" as const, extractedFields: [] })),
}));

// Coarse confidence bookkeeping is its own unit (tests/documentConfidence.test.ts);
// here it only has to answer "does this need a human?".
vi.mock("../server/services/documentConfidence", () => ({
  recordCoarseExtraction: vi.fn(async ({ confidence }: { confidence: string }) => ({
    humanReviewRequired: confidence === "low",
  })),
  coarseConfidenceToNumeric: (c: string) => (c === "high" ? 0.95 : c === "medium" ? 0.7 : 0.3),
}));

const persistDocumentFacts = vi.fn(async () => 2);
vi.mock("../server/services/documentFacts", () => ({
  persistDocumentFacts: (...args: any[]) => persistDocumentFacts(...(args as [])),
}));

const wireExtractionToReadiness = vi.fn(async () => ({ fieldsUpdated: ["monthly_income"] }));
vi.mock("../server/services/optimizationEngine", () => ({
  wireExtractionToReadiness: (...args: any[]) => wireExtractionToReadiness(...(args as [])),
  creditDocumentPresence: vi.fn(async () => undefined),
}));

const h = {
  createdDocuments: [] as any[],
  updates: [] as Array<{ id: string; patch: any }>,
  reset() {
    this.createdDocuments = [];
    this.updates = [];
  },
};

const storageStub = {
  getLoanApplicationWithAccess: async () => undefined,
  getLoanApplicationsByUser: async () => [],
  getDocumentsByUser: async () => [],
  createDocument: async (doc: any) => {
    const created = { id: `doc-${h.createdDocuments.length + 1}`, createdAt: new Date(), ...doc };
    h.createdDocuments.push(created);
    return created;
  },
  updateDocument: async (id: string, patch: any) => {
    h.updates.push({ id, patch });
    return { id, ...patch };
  },
  createDealActivity: async (a: any) => a,
  getLoanApplication: async () => undefined,
} as any;

// ---------------------------------------------------------------------------
// SYNCHRONISING ON A FIRE-AND-FORGET SIDE EFFECT
//
// The route answers 201 as soon as the document ROW exists; extraction runs
// unawaited after that ("the record is created either way; extraction enriches
// it in the background"). So `await fetch(...)` is a barrier for the response
// and for nothing else.
//
// Nor do the extraction's side effects land together. `applyExtractionToDocument`
// writes the document FIRST, and calls `persistDocumentFacts` and
// `wireExtractionToReadiness` after it, each behind a dynamic import. Waiting on
// `h.updates` therefore released the test at step 1 of 3 — and under parallel
// load the later steps had not run yet (0 calls), then landed inside the NEXT
// test, which counted them as its own (2 calls). One race, seen from both ends.
//
// So: wait for the side effect the assertion is actually about, and let every
// test wait for the WHOLE extraction to settle before it ends — a straggler
// that outlives its test is exactly what leaks into the next one. Never a fixed
// sleep, and never a raised call count: both only move the flake.
// ---------------------------------------------------------------------------

/**
 * Polls until nothing is outstanding. On timeout it throws naming what never
 * arrived, so a real regression reads as the missing side effect rather than as
 * a bare "expected 1 call, got 0" a page away from its cause.
 */
async function waitFor(pending: () => string[], timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const outstanding = pending();
    if (outstanding.length === 0) return;
    if (Date.now() > deadline) {
      throw new Error(`extraction never settled within ${timeoutMs}ms — still missing: ${outstanding.join(", ")}`);
    }
    await new Promise((r) => setTimeout(r, 5));
  }
}

/** Every side effect of a high-confidence read has landed. */
const settleExtraction = () =>
  waitFor(() => [
    ...(h.updates.length > 0 ? [] : ["the document update"]),
    ...(persistDocumentFacts.mock.calls.length > 0 ? [] : ["persistDocumentFacts (F-028)"]),
    ...(wireExtractionToReadiness.mock.calls.length > 0 ? [] : ["wireExtractionToReadiness (F-030)"]),
  ]);

/**
 * A low-confidence read returns immediately after recording itself on the
 * document, so that update IS its last side effect — there is no later call to
 * wait for, which is the very thing the test then asserts.
 */
const settleLowConfidenceExtraction = () =>
  waitFor(() => (h.updates.length > 0 ? [] : ["the low-confidence read being recorded on the document"]));

describe("POST /api/documents/upload — the borrower's upload keeps what the model read", () => {
  let server: import("node:http").Server;
  let base: string;

  beforeAll(async () => {
    const express = (await import("express")).default;
    const { registerDocumentRoutes } = await import("../server/routes/lending/documents");

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { id: "borrower-1", role: "borrower" };
      next();
    });
    registerDocumentRoutes(app, storageStub);

    server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(() => {
    server?.close();
  });

  beforeEach(() => {
    h.reset();
    persistDocumentFacts.mockClear();
    wireExtractionToReadiness.mockClear();
  });

  const upload = (body: Record<string, unknown> = {}) =>
    fetch(`${base}/api/documents/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objectPath: "/objects/uploads/abc-123",
        fileName: "paystub.pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
        documentType: "pay_stub",
        ...body,
      }),
    });

  it("persists the extracted VALUES, not just the field names", async () => {
    const res = await upload();
    expect(res.status).toBe(201);
    await settleExtraction();

    expect(
      persistDocumentFacts,
      "the borrower's pay stub was extracted and the values discarded — the F-028 gap, on the only path a borrower can reach",
    ).toHaveBeenCalledTimes(1);

    const [documentId, documentType, extracted, confidence] = persistDocumentFacts.mock.calls[0] as any[];
    expect(documentId).toBe(h.createdDocuments[0].id);
    expect(documentType).toBe("pay_stub");
    // The extraction RESULT, never `extractedFields` (a string[] of NAMES) —
    // handing the names to a value-reading map is what hid F-030.
    expect(extracted.ytdGross).toBe(50_400);
    expect(confidence).toBe("high");
  });

  it("credits the readiness fields the values support", async () => {
    await upload();
    await settleExtraction();

    expect(
      wireExtractionToReadiness,
      "readiness never saw the borrower's upload — F-030 was wired to the staff route only",
    ).toHaveBeenCalledTimes(1);
    const [, , documentType, extracted] = wireExtractionToReadiness.mock.calls[0] as any[];
    expect(documentType).toBe("pay_stub");
    expect(extracted.ytdGross).toBe(50_400);
  });

  it("records model and prompt lineage on the document, as the staff path does", async () => {
    await upload();
    await settleExtraction();

    expect(h.updates).toHaveLength(1);
    const { patch } = h.updates[0];

    // WORKFLOWS.md §4 step 3: "structured fields persisted with model + prompt
    // lineage; sensitive extracted values encrypted."
    expect(patch.extractionResponseHash).toBe("sha256:deadbeef");
    expect(patch.extractionRawEncrypted).toBe("ciphertext");
    expect(patch.extractionRawIv).toBe("iv");
    expect(patch.extractionRawKeyId).toBe("key-1");

    const notes = JSON.parse(patch.notes);
    expect(notes.modelId).toBe("claude-sonnet-5");
    expect(notes.promptVersion).toBe("pay_stub/v3");
    expect(notes.responseHash).toBe("sha256:deadbeef");
  });

  it("still refuses to self-verify: extraction stages, a human disposes (MR-2)", async () => {
    await upload();
    await settleExtraction();

    // humanReviewRequired=false is the *clear* case, and even then the highest
    // status extraction may reach is "verifying".
    expect(h.updates[0].patch.status).toBe("verifying");
  });

  it("a low-confidence read persists no facts — a guess is not a fact", async () => {
    const svc = await import("../server/extractionService");
    (svc.extractPayStubData as any).mockResolvedValueOnce({
      confidence: "low",
      extractedFields: [],
      warnings: ["Failed to extract data from pay stub"],
    });

    await upload();
    await settleLowConfidenceExtraction();

    expect(persistDocumentFacts).not.toHaveBeenCalled();
    expect(wireExtractionToReadiness).not.toHaveBeenCalled();
    // The document is still updated — the failed read is recorded, not silently dropped.
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0].patch.status).toBe("uploaded");
  });
});
