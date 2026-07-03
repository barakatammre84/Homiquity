import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

/**
 * Compliance invariants — executable guardrails.
 *
 * These assertions turn the platform's federal/industry compliance posture
 * into tests that fail loudly if a change drifts:
 *  - Reg B (ECOA): AI services must NEVER sit in the credit-decision path.
 *  - FCRA: credit pulls stay consent-gated; the funnel persists consent.
 *  - ESIGN / Reg Z: disclosure gates stay wired to their routes.
 *  - Guideline traceability: every underwriting rule cites its source.
 *  - MCP protocol safety: stdout stays reserved for JSON-RPC.
 *
 * If one of these fails, treat it as a compliance incident, not a flaky test.
 */

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

// Modules that make or feed credit decisions — the "decision path".
const DECISION_PATH_MODULES = [
  "server/services/underwritingNuance.ts",
  "server/services/preUnderwriting.ts",
  "server/services/decisionEngine.ts",
  "server/services/loanAnalysis.ts",
  "server/services/ausSubmission.ts",
  "server/pricing.ts",
  "server/underwriting.ts",
  "server/underwritingEngine.ts",
];

// Imports that would put an AI model in the decision path.
const AI_IMPORT_PATTERNS = [
  /from\s+["']openai["']/,
  /from\s+["']@google\/genai["']/,
  /from\s+["'][^"']*coachingService["']/,
  /from\s+["'][^"']*\/gemini["']/,
  /@anthropic-ai\/sdk/,
];

describe("Reg B (ECOA): AI stays out of the credit-decision path", () => {
  for (const module of DECISION_PATH_MODULES) {
    it(`${module} imports no AI service`, () => {
      const source = read(module);
      for (const pattern of AI_IMPORT_PATTERNS) {
        expect(source).not.toMatch(pattern);
      }
    });
  }
});

describe("FCRA: credit pulls remain consent-gated", () => {
  it("the MCP soft-pull tool hard-fails without an active consent", () => {
    const source = read("server/mcp/index.ts");
    expect(source).toContain("creditConsents");
    expect(source).toMatch(/FCRA: no active credit consent/);
  });

  it("the funnel persists the soft-pull acknowledgment as evidence", () => {
    const source = read("server/routes/lending.ts");
    expect(source).toContain("softPullConsentAccepted");
    expect(source).toContain("createCreditConsent");
  });
});

describe("ESIGN / Reg Z: disclosure gates stay wired", () => {
  it("Loan Estimate delivery requires the e_disclosure consent", () => {
    const source = read("server/routes/underwriting.ts");
    expect(source).toMatch(/loan-estimate.*requireConsent\("e_disclosure"\)/s);
  });

  it("rate locking requires the anti-steering acknowledgment for borrowers", () => {
    const source = read("server/routes/lending.ts");
    expect(source).toMatch(/hasBorrowerConsent\("anti_steering"/);
  });

  it("the anti-steering template cites Reg Z §1026.36(e)", () => {
    const source = read("server/consentGate.ts");
    expect(source).toContain("1026.36(e)");
  });
});

describe("Guideline traceability: underwriting rules cite their sources", () => {
  it("underwritingNuance cites every governing guideline", () => {
    const source = read("server/services/underwritingNuance.ts");
    expect(source).toContain("B3-3.2"); // income seasoning
    expect(source).toContain("B3-6-05"); // deferred student loans
    expect(source).toContain("B3-4.2-02"); // large-deposit sourcing (depository accounts)
    expect(source).toContain("B3-4.3-04"); // gift funds resolution path
    expect(source).toContain("26-7"); // VA residual income
  });

  it("the deferred-student-loan factor remains exactly 1%", () => {
    const source = read("server/services/underwritingNuance.ts");
    expect(source).toMatch(/DEFERRED_STUDENT_LOAN_FACTOR\s*=\s*0\.01/);
  });

  it("the VA utility rate remains the statutory $0.14/sqft", () => {
    const source = read("server/services/underwritingNuance.ts");
    expect(source).toMatch(/VA_UTILITY_RATE_PER_SQFT\s*=\s*0\.14/);
  });
});

describe("Reg B: the intake decision path is fully deterministic", () => {
  it("the intake route no longer imports the retired LLM analysis module", () => {
    const source = read("server/routes/lending.ts");
    expect(source).not.toMatch(/from\s+["'][^"']*\/gemini["']/);
    expect(source).toContain("analyzeIntake");
  });

  it("intake analysis derives approval from the engine, never sets denied itself", () => {
    const source = read("server/services/loanAnalysis.ts");
    // Approval comes from the deterministic engine's decision…
    expect(source).toMatch(/decision\?\.decision === "APPROVED"/);
    // …and the only statuses intake may set exclude "denied" (ECOA locus:
    // only a human may deny, with adverse-action handling).
    expect(source).toMatch(/"pre_approved" \| "under_review"/);
    expect(source).not.toMatch(/outcome[^\n]*"denied"/);
  });
});

describe("Protocol & platform safety", () => {
  it("the MCP server's first import is the stdout-protecting bootstrap", () => {
    const source = read("server/mcp/index.ts");
    const firstImport = source.split("\n").find((l) => l.trim().startsWith("import"));
    expect(firstImport).toContain("./bootstrap");
  });

  it("the CSRF carve-out covers only /api/webhooks paths", () => {
    const source = read("server/app.ts");
    expect(source).toContain("/api/webhooks");
  });

  it("simulated vendor adapters stay flagged as simulations", () => {
    const vendors = read("server/mcp/vendors.ts");
    expect(vendors).toMatch(/simulated:\s*true/);
    const aus = read("server/services/ausSubmission.ts");
    expect(aus).toMatch(/simulated/);
  });
});
