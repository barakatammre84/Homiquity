import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Roadmap CH-6: coverage for pipelineEngine's core — updatePipelineStage, THE
// single writer for loanApplications.status (finding F-015: previously
// untested). Everything below runs against mocked storage/services: these are
// behavior pins for the transition gate, milestone stamping, the HMDA Reg C
// action-taken rules, and the never-fail-the-transition side-effect contract.
// determineDocumentRequirements already has its own file
// (pipelineEngineDocumentRequirements.test.ts).
// ---------------------------------------------------------------------------

vi.mock("../server/storage", () => ({
  storage: {
    getLoanApplication: vi.fn(),
    updateLoanMilestones: vi.fn(),
    updateLoanApplication: vi.fn(),
    getLoanConditionsByApplication: vi.fn(),
    getDocumentsByApplication: vi.fn(),
    updateLoanCondition: vi.fn(),
    createDealActivity: vi.fn(),
  },
}));
vi.mock("../server/db", () => ({ db: {} }));
vi.mock("../server/underwriting", () => ({
  verifyAssets: vi.fn(),
  assessLiabilities: vi.fn(),
  calculateDTI: vi.fn(),
}));
vi.mock("../server/services/fileHealth", () => ({
  computeFileHealth: vi.fn(),
  daysSince: vi.fn(),
}));
vi.mock("../server/services/lifecycleEngine", () => ({
  graduateClosedLoan: vi.fn(),
}));
vi.mock("../server/services/outcomeTracker", () => ({
  recordStageTimestamp: vi.fn(),
}));
vi.mock("../server/services/optimizationEngine", () => ({
  syncApplicationStatusToStateMachine: vi.fn(),
}));
vi.mock("../server/services/taskEventEmitter", () => ({
  taskEventEmitter: { emitWorkflowEvent: vi.fn() },
}));

import {
  updatePipelineStage,
  conditionsToRevertAfterRejection,
  PipelineTransitionError,
} from "../server/pipelineEngine";
import { storage } from "../server/storage";
import { graduateClosedLoan } from "../server/services/lifecycleEngine";
import { taskEventEmitter } from "../server/services/taskEventEmitter";

const mockStorage = storage as unknown as Record<string, ReturnType<typeof vi.fn>>;

function seedApplication(status: string) {
  mockStorage.getLoanApplication.mockResolvedValue({
    id: "app-1",
    userId: "user-1",
    status,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.updateLoanMilestones.mockResolvedValue(undefined);
  mockStorage.updateLoanApplication.mockResolvedValue(undefined);
  (graduateClosedLoan as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  (taskEventEmitter.emitWorkflowEvent as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
});

describe("updatePipelineStage — the transition gate", () => {
  it("rejects an unknown status before touching storage", async () => {
    await expect(updatePipelineStage("app-1", "bogus" as never)).rejects.toThrow(
      PipelineTransitionError,
    );
    expect(mockStorage.getLoanApplication).not.toHaveBeenCalled();
  });

  it("re-asserting the current stage is an idempotent no-op, not an error", async () => {
    seedApplication("processing");
    await updatePipelineStage("app-1", "processing");
    expect(mockStorage.updateLoanApplication).not.toHaveBeenCalled();
    expect(mockStorage.updateLoanMilestones).not.toHaveBeenCalled();
  });

  it("a forbidden transition throws with the allowed targets attached", async () => {
    seedApplication("funded"); // terminal — nothing is allowed from here
    const err = await updatePipelineStage("app-1", "processing").catch((e) => e);
    expect(err).toBeInstanceOf(PipelineTransitionError);
    expect(err.fromStage).toBe("funded");
    expect(err.allowed).toEqual([]);
    expect(mockStorage.updateLoanApplication).not.toHaveBeenCalled();
  });

  it("force skips transition validation but still runs the side effects", async () => {
    seedApplication("funded");
    await updatePipelineStage("app-1", "processing", { force: true });
    expect(mockStorage.updateLoanMilestones).toHaveBeenCalledWith(
      "app-1",
      expect.objectContaining({ processingStartedAt: expect.any(Date) }),
    );
    expect(mockStorage.updateLoanApplication).toHaveBeenCalledWith(
      "app-1",
      expect.objectContaining({ status: "processing" }),
    );
  });

  it("stamps the stage milestone on a legal transition", async () => {
    seedApplication("pre_approved");
    await updatePipelineStage("app-1", "doc_collection");
    expect(mockStorage.updateLoanMilestones).toHaveBeenCalledWith(
      "app-1",
      expect.objectContaining({ docCollectionStartedAt: expect.any(Date) }),
    );
  });
});

describe("updatePipelineStage — HMDA Reg C action-taken rules", () => {
  it("funded records code 1, stamps fundedAt/actualCloseDate, and graduates the homeowner", async () => {
    seedApplication("closing");
    await updatePipelineStage("app-1", "funded");
    expect(mockStorage.updateLoanApplication).toHaveBeenCalledWith(
      "app-1",
      expect.objectContaining({ status: "funded", hmdaActionTaken: "1" }),
    );
    expect(mockStorage.updateLoanMilestones).toHaveBeenCalledWith(
      "app-1",
      expect.objectContaining({ fundedAt: expect.any(Date), actualCloseDate: expect.any(Date) }),
    );
    expect(graduateClosedLoan).toHaveBeenCalledWith("app-1");
  });

  it("denied WITH reasons records code 3 plus the reasons for the LAR", async () => {
    seedApplication("underwriting");
    await updatePipelineStage("app-1", "denied", { denialReasons: ["dti", "collateral"] });
    expect(mockStorage.updateLoanApplication).toHaveBeenCalledWith(
      "app-1",
      expect.objectContaining({
        status: "denied",
        hmdaActionTaken: "3",
        hmdaDenialReasons: ["dti", "collateral"],
      }),
    );
  });

  it("denied WITHOUT reasons never fabricates a LAR entry — the automated path finalizes through adverse action", async () => {
    seedApplication("underwriting");
    await updatePipelineStage("app-1", "denied");
    const update = mockStorage.updateLoanApplication.mock.calls[0][1];
    expect(update.status).toBe("denied");
    expect(update).not.toHaveProperty("hmdaActionTaken");
    expect(update).not.toHaveProperty("hmdaDenialReasons");
  });

  it("withdrawn records code 4 regardless of who initiated it", async () => {
    seedApplication("processing");
    await updatePipelineStage("app-1", "withdrawn");
    expect(mockStorage.updateLoanApplication).toHaveBeenCalledWith(
      "app-1",
      expect.objectContaining({ status: "withdrawn", hmdaActionTaken: "4" }),
    );
  });
});

describe("updatePipelineStage — side-effect failures never fail the transition", () => {
  it("a graduation failure on funding is swallowed (non-fatal by design)", async () => {
    seedApplication("closing");
    (graduateClosedLoan as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));
    await expect(updatePipelineStage("app-1", "funded")).resolves.toBeUndefined();
    expect(mockStorage.updateLoanApplication).toHaveBeenCalled();
  });

  it("a task-event emission failure is swallowed", async () => {
    seedApplication("processing");
    (taskEventEmitter.emitWorkflowEvent as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("emitter down"),
    );
    await expect(updatePipelineStage("app-1", "underwriting")).resolves.toBeUndefined();
  });
});

describe("conditionsToRevertAfterRejection (pure)", () => {
  const submitted = (id: string, types: string[]) => ({
    id,
    status: "submitted",
    requiredDocumentTypes: types,
  });

  it("reverts a submitted condition whose only satisfying document was rejected", () => {
    const ids = conditionsToRevertAfterRejection({
      conditions: [submitted("c1", ["w2"])],
      documents: [{ documentType: "w2", status: "rejected" }],
      rejectedDocumentType: "w2",
    });
    expect(ids).toEqual(["c1"]);
  });

  it("keeps a condition submitted when another non-rejected upload still satisfies it", () => {
    const ids = conditionsToRevertAfterRejection({
      conditions: [submitted("c1", ["w2"])],
      documents: [
        { documentType: "w2", status: "rejected" },
        { documentType: "w2", status: "verified" },
      ],
      rejectedDocumentType: "w2",
    });
    expect(ids).toEqual([]);
  });

  it("only touches submitted conditions of the rejected type", () => {
    const ids = conditionsToRevertAfterRejection({
      conditions: [
        { id: "outstanding", status: "outstanding", requiredDocumentTypes: ["w2"] },
        submitted("other-type", ["bank_statement"]),
        submitted("match", ["w2"]),
      ],
      documents: [{ documentType: "w2", status: "rejected" }],
      rejectedDocumentType: "w2",
    });
    expect(ids).toEqual(["match"]);
  });
});
