import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/services/coachProfileSync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/services/coachProfileSync")>();
  return { ...actual, syncCoachIntakeToApplication: vi.fn() };
});

// The DPA lookup tool reads the seed-verified directory through the storage
// singleton; mock it so these tests need no database.
vi.mock("../server/storage", () => ({
  storage: { getDpaPrograms: vi.fn() },
}));

import {
  COACH_TOOLS,
  executeCoachTool,
  type CoachStreamEvent,
  type CoachToolContext,
} from "../server/services/coachTools";
import { syncCoachIntakeToApplication } from "../server/services/coachProfileSync";
import { storage } from "../server/storage";

function makeCtx(): { ctx: CoachToolContext; events: CoachStreamEvent[] } {
  const events: CoachStreamEvent[] = [];
  const ctx: CoachToolContext = {
    req: { user: { id: "user-1" }, headers: {} } as never,
    userId: "user-1",
    conversationId: "conv-1",
    emit: (e) => events.push(e),
    state: {},
  };
  return { ctx, events };
}

describe("COACH_TOOLS definition stability (prompt-cache contract)", () => {
  it("keeps the tool names in a FIXED order — reordering invalidates the prompt cache", () => {
    expect(COACH_TOOLS.map((t) => t.name)).toEqual([
      "record_intake",
      "update_readiness",
      "set_action_plan",
      "set_document_checklist",
      "generate_borrower_package",
      "suggest_next_steps",
      // Appended 2026-08-04 (renter-incubation adjudication Leg C) — new tools
      // append at the END only.
      "lookup_dpa_programs",
    ]);
  });

  it("every tool description states WHEN to call it", () => {
    for (const tool of COACH_TOOLS) {
      expect(tool.description, tool.name).toMatch(/call/i);
    }
  });
});

describe("executeCoachTool: record_intake", () => {
  beforeEach(() => vi.clearAllMocks());

  it("filters unknown keys, syncs the rest, emits captured, and reports honestly", async () => {
    vi.mocked(syncCoachIntakeToApplication).mockResolvedValue({
      applicationId: "app-1",
      created: false,
      applied: [{ field: "annualIncome", value: "85000" }],
      skipped: [{ field: "creditScore", reason: "verified_locked" }],
    });
    const { ctx, events } = makeCtx();

    const result = await executeCoachTool(ctx, "record_intake", {
      annualIncome: "85000",
      creditScore: "720",
      favoriteColor: "blue", // hallucinated key must not void the real fields
    });

    expect(result.isError).toBeUndefined();
    expect(result.content).toContain("annualIncome");
    expect(result.content).toContain("verified_locked");
    expect(result.content).toContain("favoriteColor");
    expect(vi.mocked(syncCoachIntakeToApplication)).toHaveBeenCalledWith(
      ctx.req,
      "user-1",
      { annualIncome: "85000", creditScore: "720" },
      "conv-1",
    );
    expect(ctx.state.intake).toEqual({ annualIncome: "85000", creditScore: "720" });
    expect(ctx.state.syncedApplicationId).toBe("app-1");
    expect(events).toEqual([
      expect.objectContaining({ type: "captured", applicationId: "app-1", applied: [{ field: "annualIncome", value: "85000" }] }),
    ]);
  });

  it("rejects wrongly-typed fields with an is_error tool_result (model self-corrects)", async () => {
    const { ctx } = makeCtx();
    const result = await executeCoachTool(ctx, "record_intake", { annualIncome: 85000 });
    expect(result.isError).toBe(true);
    expect(vi.mocked(syncCoachIntakeToApplication)).not.toHaveBeenCalled();
  });

  it("rejects an empty intake", async () => {
    const { ctx } = makeCtx();
    const result = await executeCoachTool(ctx, "record_intake", { nonsense: true });
    expect(result.isError).toBe(true);
  });

  it("keeps the conversation snapshot but tells the model NOT to claim a save when sync fails", async () => {
    vi.mocked(syncCoachIntakeToApplication).mockRejectedValue(new Error("db down"));
    const { ctx, events } = makeCtx();

    const result = await executeCoachTool(ctx, "record_intake", { annualIncome: "85000" });

    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/Do NOT tell the user/i);
    expect(ctx.state.intake).toEqual({ annualIncome: "85000" }); // structuredData still persists it
    expect(events).toEqual([]); // no captured event for a failed save
  });
});

describe("executeCoachTool: panel tools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("update_readiness stores the profile with a placeholder completion the server overrides", async () => {
    const { ctx } = makeCtx();
    const result = await executeCoachTool(ctx, "update_readiness", {
      readinessTier: "building",
      statusNote: "Core inputs collected.",
      completedInputs: ["annual_income"],
      outstandingInputs: ["credit_score"],
      estimatedTimeline: "3-6 months",
    });
    expect(result.isError).toBeUndefined();
    expect(ctx.state.profile?.readinessTier).toBe("building");
    expect(ctx.state.profile?.completionPercentage).toBe(0); // server-derived later
  });

  it("update_readiness coerces an invalid tier to the safe default (schema .catch)", async () => {
    const { ctx } = makeCtx();
    await executeCoachTool(ctx, "update_readiness", {
      readinessTier: "definitely_approved",
      statusNote: "x",
      completedInputs: [],
      outstandingInputs: [],
      estimatedTimeline: "",
    });
    expect(ctx.state.profile?.readinessTier).toBe("exploring");
  });

  it("set_action_plan validates items strictly", async () => {
    const { ctx, events } = makeCtx();
    const bad = await executeCoachTool(ctx, "set_action_plan", {
      items: [{ id: "a", phase: 1, title: "t", description: "d", priority: "urgent", category: "credit", completed: false }],
    });
    expect(bad.isError).toBe(true);

    const good = await executeCoachTool(ctx, "set_action_plan", {
      items: [{ id: "a", phase: 1, title: "t", description: "d", priority: "high", category: "credit", completed: false }],
    });
    expect(good.isError).toBeUndefined();
    expect(ctx.state.actionPlan?.length).toBe(1);
    expect(events.at(-1)).toEqual(expect.objectContaining({ type: "panel" }));
  });

  it("generate_borrower_package strips model-authored access links", async () => {
    const { ctx } = makeCtx();
    const pkg = {
      generatedDate: "2026-07-12",
      borrowerOverview: { borrowerNames: "A B", householdComposition: "Single Borrower", primaryResidenceState: "IL", incomeProfileType: "W-2" },
      householdOverview: { firstTimeBuyer: "Yes", veteranStatus: "No" },
      transactionIntent: { transactionType: "Purchase", propertyIntent: "Primary Residence", targetTimeframe: "Not Provided" },
      incomeSources: [{ source: "Acme", type: "W-2", frequency: "Annual", documentationStatus: "Pending" }],
      assetSummary: [{ assetType: "Savings Account", accountCategory: "Liquid", ownershipType: "Individual", documentationStatus: "Pending", lastStatementDate: "Not Provided", validationNotes: "", accessLink: "https://evil.example/exfil" }],
      creditAndDebt: { creditScore: "720", creditScoreVerification: "Tier 3", monthlyDebts: "1200", monthlyDebtsVerification: "Tier 3", dtiRatio: "Insufficient Data", dtiNote: "Preparatory calculation only." },
      propertyContext: { propertyAddress: "Not Provided", estimatedValueOrPrice: "350000", occupancyIntent: "Primary Residence" },
      documentInventory: [{ docType: "pay_stub", label: "Pay Stub", status: "Not Yet Received", flags: [] }],
      readinessStatus: { intakeStatus: "Complete", documentStatus: "Not Started", packageStatus: "Pending Items", pendingItems: ["pay stub"] },
      auditTrail: { intakeStartDate: "2026-07-12", lastUpdateDate: "2026-07-12", events: [{ date: "2026-07-12", activity: "Intake started" }] },
      validationNotes: { recencyChecks: [], completenessChecks: [], consistencyObservations: [] },
      complianceFooter: "This intake summary is prepared for informational purposes only.",
    };
    const result = await executeCoachTool(ctx, "generate_borrower_package", pkg);
    expect(result.isError).toBeUndefined();
    expect(ctx.state.borrowerPackage?.assetSummary[0].accessLink).toBe("");
  });

  it("suggest_next_steps enforces the 1-3 chip contract", async () => {
    const { ctx } = makeCtx();
    const tooMany = await executeCoachTool(ctx, "suggest_next_steps", {
      suggestions: ["a", "b", "c", "d"],
    });
    expect(tooMany.isError).toBe(true);

    const ok = await executeCoachTool(ctx, "suggest_next_steps", {
      suggestions: ["What documents do I need?", "How is my readiness?"],
    });
    expect(ok.isError).toBeUndefined();
    expect(ctx.state.suggestions?.length).toBe(2);
  });

  it("returns is_error for an unknown tool name", async () => {
    const { ctx } = makeCtx();
    const result = await executeCoachTool(ctx, "delete_everything", {});
    expect(result.isError).toBe(true);
  });
});

describe("executeCoachTool: lookup_dpa_programs (renter-incubation adjudication Leg C)", () => {
  const getDpaPrograms = vi.mocked(storage.getDpaPrograms);
  const ihda = {
    name: "IHDAccess Forgivable",
    programType: "state",
    assistanceType: "forgivable_loan",
    state: "IL",
    description: "4% of the purchase price as a forgivable loan.",
    maxAssistanceAmount: "6000",
    maxAssistancePercent: "4",
    minCreditScore: 640,
    firstTimeBuyerOnly: false,
    eligibilityNotes: "County limits apply; as of July 2026.",
    applicationUrl: "https://www.ihda.org/",
    isActive: true,
  };

  beforeEach(() => vi.clearAllMocks());

  it("returns the verified rows with the confirm-with-agency instruction", async () => {
    getDpaPrograms.mockResolvedValueOnce([ihda as never]);
    const { ctx } = makeCtx();
    const result = await executeCoachTool(ctx, "lookup_dpa_programs", { state: "il" });
    expect(result.isError).toBeUndefined();
    // Zod normalizes the state filter before it reaches storage.
    expect(getDpaPrograms).toHaveBeenCalledWith({ state: "IL" });
    expect(result.content).toContain("IHDAccess Forgivable");
    expect(result.content).toContain("minimum credit score 640");
    expect(result.content).toContain("HUD-approved housing counselor");
    expect(result.content).toContain("do not state or imply that they qualify");
  });

  it("tells the model the directory is IL-only on an empty result — never invent", async () => {
    getDpaPrograms.mockResolvedValueOnce([]);
    const { ctx } = makeCtx();
    const result = await executeCoachTool(ctx, "lookup_dpa_programs", { state: "TX" });
    expect(result.isError).toBeUndefined();
    expect(result.content).toContain("Illinois programs only");
    expect(result.content).toContain("do NOT invent programs");
  });

  it("rejects malformed filters without touching storage", async () => {
    const { ctx } = makeCtx();
    const result = await executeCoachTool(ctx, "lookup_dpa_programs", { state: "Texas" });
    expect(result.isError).toBe(true);
    expect(getDpaPrograms).not.toHaveBeenCalled();
  });

  it("degrades honestly when the directory read fails", async () => {
    getDpaPrograms.mockRejectedValueOnce(new Error("db down"));
    const { ctx } = makeCtx();
    const result = await executeCoachTool(ctx, "lookup_dpa_programs", {});
    expect(result.isError).toBe(true);
    expect(result.content).toContain("do not answer from memory");
  });
});
