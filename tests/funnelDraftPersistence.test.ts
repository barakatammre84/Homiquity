import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Roadmap A1: the funnel's "finish later" state was localStorage-only — a
// borrower switching devices lost everything. These guards pin the three
// pieces of the fix and the defect it retired:
//   1. a find-or-create draft container endpoint (no figures accepted —
//      answers arrive only through the validated drafts-only PATCH),
//   2. the intake POST consumes the user's existing draft instead of minting
//      a sibling row, flipping status through updatePipelineStage (THE single
//      status writer — statusVocabulary.test.ts enforces that globally),
//   3. the funnel submit no longer has the PATCH branch that skipped the
//      status flip, analysis, and notifications entirely.
// ---------------------------------------------------------------------------

const repoRoot = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(repoRoot, p), "utf8");

describe("draft container endpoint", () => {
  const src = read("server/routes/lending/applications.ts");

  it("find-or-creates the ONE draft row behind the intake gates", () => {
    const at = src.indexOf('"/api/loan-applications/draft"');
    expect(at).toBeGreaterThan(-1);
    const registration = src.slice(at, at + 200);
    expect(registration).toContain("isAuthenticated");
    expect(registration).toContain("prelaunchGate");
    expect(registration).toContain("intakePausedGate");
    const handler = src.slice(at, at + 900);
    expect(handler).toContain('a.status === "draft"');
  });

  it("accepts no figures — the container is minted bare", () => {
    const at = src.indexOf('"/api/loan-applications/draft"');
    const handler = src.slice(at, at + 900);
    expect(handler).toContain('createLoanApplication({ userId, status: "draft" })');
    expect(handler).not.toContain("req.body");
  });
});

describe("intake POST consumes the draft", () => {
  const src = read("server/routes/lending/applications.ts");

  it("finds the user's draft and flips it through updatePipelineStage", () => {
    expect(src).toContain('updatePipelineStage(existingDraft.id, "submitted")');
  });

  it("the funnel-entry outcome stamp only runs on the create path (the pipeline engine stamps the draft path)", () => {
    const at = src.indexOf("if (!existingDraft) {");
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, at + 400)).toContain("recordStageTimestamp");
  });
});

describe("funnel submit path", () => {
  const page = read("client/src/pages/lending/PreApproval.tsx");

  it("always POSTs — the draft-consuming server owns the upgrade; no client PATCH-submit branch", () => {
    expect(page).toContain('apiRequest("POST", "/api/loan-applications"');
    expect(page).not.toContain('apiRequest("PATCH"');
  });

  it("wires the server autosave, disabled once a submit is in flight", () => {
    expect(page).toContain("useServerDraftAutosave({");
    expect(page).toContain("!submitMutation.isPending && !submitMutation.isSuccess");
  });
});

describe("server autosave hook contracts", () => {
  const hook = read("client/src/pages/lending/preApproval/useServerDraftAutosave.ts");

  it("writes only through the existing validated routes", () => {
    expect(hook).toContain('apiRequest("POST", "/api/loan-applications/draft"');
    expect(hook).toContain("apiRequest(\"PATCH\", `/api/loan-applications/${id}`");
  });

  it("failures are silent by design — no toast, no throw", () => {
    // Match real usage, not the comment documenting this very rule.
    expect(hook).not.toContain("useToast");
    expect(hook).not.toMatch(/\btoast\(/);
    expect(hook).toContain("Deliberately swallowed");
  });
});

describe("buildDraftPatchPayload", () => {
  // The pure filter, imported from the client tree (path-mapped, no DOM).
  it("omits empty answers and UI-only helpers, keeps real ones", async () => {
    const { buildDraftPatchPayload } = await import(
      "../client/src/pages/lending/preApproval/useServerDraftAutosave"
    );
    const payload = buildDraftPatchPayload({
      annualIncome: "95,000",
      monthlyDebts: "",
      purchasePrice: "  ",
      downPayment: "20000",
      creditScore: "",
      employmentType: "employed",
      employmentYears: "",
      propertyType: "single_family",
      propertyState: "",
      loanPurpose: "purchase",
      isVeteran: false,
      isFirstTimeBuyer: true,
      hasAdditionalIncome: true,
      incomeSources: [],
    } as never);
    expect(payload).toEqual({
      annualIncome: "95,000",
      downPayment: "20000",
      employmentType: "employed",
      propertyType: "single_family",
      loanPurpose: "purchase",
      isVeteran: false,
      isFirstTimeBuyer: true,
    });
  });
});
