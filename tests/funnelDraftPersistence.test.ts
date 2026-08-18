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

describe("buildDraftClears — a clear the borrower actually made", () => {
  const load = () =>
    import("../client/src/pages/lending/preApproval/useServerDraftAutosave");

  const FRESH = {
    annualIncome: "",
    monthlyDebts: "",
    creditScore: "",
    employmentType: "employed",
    employmentYears: "",
    propertyType: "single_family",
    propertyState: "",
    purchasePrice: "",
    downPayment: "",
    loanPurpose: "purchase",
    isVeteran: false,
    isFirstTimeBuyer: false,
    hasAdditionalIncome: false,
    incomeSources: [],
  } as never;

  it("🚨 a fresh visit clears NOTHING, even though every field is empty", async () => {
    // The failure this design exists to prevent. The funnel form starts blank
    // on every visit while the server draft may hold a full set of answers
    // from another device; sending null for "empty" would null out the whole
    // draft on the first debounce — "resume where you left off" turned into
    // "lose everything you had".
    const { buildDraftClears } = await load();
    expect(buildDraftClears(new Set(), FRESH)).toEqual({});
  });

  it("clears a field the session saw hold a value", async () => {
    const { buildDraftClears } = await load();
    expect(buildDraftClears(new Set(["annualIncome"]), FRESH)).toEqual({
      annualIncome: null,
    });
  });

  it("does not clear a field that still has a value", async () => {
    const { buildDraftClears } = await load();
    const values = { ...(FRESH as object), annualIncome: "85000" } as never;
    expect(buildDraftClears(new Set(["annualIncome"]), values)).toEqual({});
  });

  it("treats whitespace as empty, the same as the payload builder", async () => {
    const { buildDraftClears } = await load();
    const values = { ...(FRESH as object), monthlyDebts: "   " } as never;
    expect(buildDraftClears(new Set(["monthlyDebts"]), values)).toEqual({
      monthlyDebts: null,
    });
  });

  it("sends [] for emptied income sources, not null", async () => {
    // The column takes an array and the schema already accepts an empty one,
    // so [] is the honest value for "I removed them all" — no catalog entry
    // and no schema change needed.
    const { buildDraftClears } = await load();
    expect(buildDraftClears(new Set(["incomeSources"]), FRESH)).toEqual({
      incomeSources: [],
    });
  });

  it("🚨 omits a field with no wire clear rather than nulling it", async () => {
    // A null on a field whose validator rejects it 400s the WHOLE PATCH, and
    // this hook swallows failures — one bad key would silently stop persisting
    // every other answer on the page.
    const { buildDraftClears } = await load();
    const values = { ...(FRESH as object), creditScore: "", loanPurpose: "" } as never;
    expect(buildDraftClears(new Set(["creditScore", "loanPurpose"]), values)).toEqual({});
  });

  it("ignores the UI-only helper", async () => {
    const { buildDraftClears } = await load();
    expect(buildDraftClears(new Set(["hasAdditionalIncome"]), FRESH)).toEqual({});
  });

  it("every scalar it emits is one the wire can actually clear", async () => {
    const { buildDraftClears } = await load();
    const { isClearableIntakeField } = await import("../shared/intakeClearable");
    // Ask for a clear on every key at once; whatever comes back as null must
    // be catalogued, or the PATCH it lands in is a 400.
    const clears = buildDraftClears(new Set(Object.keys(FRESH as object)), FRESH);
    const nulled = Object.entries(clears).filter(([, v]) => v === null).map(([k]) => k);
    expect(nulled.length).toBeGreaterThan(0);
    for (const key of nulled) {
      expect(isClearableIntakeField(key), `${key} is nulled but not clearable`).toBe(true);
    }
  });
});

describe("server autosave hook — clears are committed, not dropped", () => {
  const hook = read("client/src/pages/lending/preApproval/useServerDraftAutosave.ts");

  it("remembers held fields on every observed change, not only at debounce time", () => {
    // The restore banner hydrates the form in one shot; a borrower who
    // restores and immediately clears a field must still have that clear
    // travel, which waiting for a debounce to notice the value would miss.
    expect(hook).toContain("heldValueRef.current.add(key)");
  });

  it("forgets a cleared field only AFTER the request succeeds", () => {
    // Before the await, every later tick re-sends the same nulls; dropping it
    // on failure loses the clear in silence — the defect this whole thread is
    // about.
    const sendIdx = hook.indexOf("await apiRequest(\"PATCH\"");
    const forgetIdx = hook.indexOf("heldValueRef.current.delete(key)");
    expect(sendIdx).toBeGreaterThan(0);
    expect(forgetIdx).toBeGreaterThan(sendIdx);
  });
});
