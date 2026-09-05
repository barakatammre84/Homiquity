import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getLoanApplication: vi.fn(),
  runInstantDecision: vi.fn(),
  evaluateBrokerSubmissionReadiness: vi.fn(),
  computePrediction: vi.fn(),
  getLatestSituationProfile: vi.fn(),
}));

vi.mock("../server/storage", () => ({
  storage: { getLoanApplication: mocks.getLoanApplication },
}));
vi.mock("../server/services/decisionEngine", () => ({
  runInstantDecision: mocks.runInstantDecision,
}));
vi.mock("../server/services/brokerSubmissionReadiness", () => ({
  evaluateBrokerSubmissionReadiness: mocks.evaluateBrokerSubmissionReadiness,
}));
vi.mock("../server/services/predictiveEngine", () => ({
  computePrediction: mocks.computePrediction,
}));
vi.mock("../server/services/situationClassifier", () => ({
  getLatestSituationProfile: mocks.getLatestSituationProfile,
}));
vi.mock("../server/services/aiInteractionLog", () => ({ logAiInteraction: vi.fn() }));

import { assembleRiskBriefFacts } from "../server/services/riskBrief";

describe("risk brief application scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLoanApplication.mockResolvedValue({
      id: "app-a",
      userId: "borrower-1",
      preUwFlags: null,
    });
    mocks.runInstantDecision.mockResolvedValue({
      qualifier: "PRELIMINARY",
      status: "NEEDS_MORE_INFO",
      decision: null,
      reasons: [],
      missingItems: [],
      metrics: null,
      resolvedPolicy: null,
    });
    mocks.evaluateBrokerSubmissionReadiness.mockResolvedValue({
      readyToSubmitToLender: false,
      currentStage: "application",
      stages: [],
      nextActions: [],
    });
    mocks.computePrediction.mockResolvedValue({ riskFactors: [], positiveFactors: [] });
    mocks.getLatestSituationProfile.mockResolvedValue(null);
  });

  it("loads the tax situation for the selected loan file", async () => {
    await assembleRiskBriefFacts("app-a");

    expect(mocks.computePrediction).toHaveBeenCalledWith("borrower-1", "app-a");
    expect(mocks.getLatestSituationProfile).toHaveBeenCalledWith("borrower-1", "app-a");
  });
});
