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

  // 2026-07-04 (roadmap #29): the live engine carried its own inline VA residual
  // math (uncited 18% tax rate, &&-gated 5% reduction, uncapped family addition)
  // that drifted from the cited reference module — and these citation checks only
  // read underwritingNuance.ts, so the drift was invisible. The engine must now
  // share the cited constants; duplicated regulated math is itself a violation.
  it("the live engine shares the cited VA residual constants — no forked regulated math", () => {
    const engine = read("server/underwritingEngine.ts");
    expect(engine).toContain("RESIDUAL_TAX_RATE");
    expect(engine).toContain("VA_RESIDUAL_REDUCTION_FACTOR");
    expect(engine).toContain("VA_EXTRA_MEMBER_FAMILY_CAP");
    // The retired inline literals must not reappear:
    expect(engine).not.toMatch(/\*\s*0\.18\b/);
    expect(engine).not.toMatch(/\*\s*0\.95\b/);
  });

  it("the VA residual reduction stays 5% and DISJUNCTIVE (26-7 Ch. 4, Topic 9, Item 43)", () => {
    const source = read("server/services/underwritingNuance.ts");
    expect(source).toMatch(/VA_RESIDUAL_REDUCTION_FACTOR\s*=\s*0\.95/);
    const engine = read("server/underwritingEngine.ts");
    expect(engine).toMatch(/input\.isActiveDuty\s*\|\|\s*input\.hasExchangeAccess/);
  });

  it("the extra-member addition caps at a family of seven (26-7 Ch. 4, Topic 9, Item 43)", () => {
    const source = read("server/services/underwritingNuance.ts");
    expect(source).toMatch(/VA_EXTRA_MEMBER_FAMILY_CAP\s*=\s*7/);
    const engine = read("server/underwritingEngine.ts");
    expect(engine).toContain("Math.min(familySize, VA_EXTRA_MEMBER_FAMILY_CAP)");
  });

  // UAL P7: the alternative-structure translation math is regulated
  // calculation surface. The research doc (§3) requires the author to extend
  // this guard to the new file — citations must be present, and the
  // equivalent rate must come from the SHARED Appendix J solver, never a
  // forked one (same rule as the VA-residual case above).
  it("structureTranslation cites its authority and shares the Appendix J solver", () => {
    const source = read("server/services/structureTranslation.ts");
    expect(source).toContain("UNIVERSAL_ADAPTATION_LAYER.md");
    expect(source).toContain("§1026.22");
    expect(source).toMatch(/import \{[^}]*solveAPRFromStream[^}]*\} from "\.\/apr"/);
    // No forked solver: the file must not implement its own root-finding.
    expect(source).not.toMatch(/presentValue|bisection|while\s*\(/i);
  });

  it("structureTranslation stays translation-only — no pricing or Shariah judgment", () => {
    const source = read("server/services/structureTranslation.ts");
    // Every economic input comes from the funder's term sheet; the module
    // must not carry its own rate/markup defaults.
    expect(source).not.toMatch(/DEFAULT_(RATE|YIELD|MARKUP)/);
    expect(source).toContain("TRANSLATION ONLY");
  });
});

describe("Reg B: the intake decision path is fully deterministic", () => {
  it("the intake route no longer imports the retired LLM analysis module", () => {
    const source = read("server/routes/lending.ts");
    expect(source).not.toMatch(/from\s+["'][^"']*\/gemini["']/);
    // The route drives the deterministic finalizer, which wraps the engine.
    expect(source).toContain("finalizeIntake");
    const analysis = read("server/services/loanAnalysis.ts");
    expect(analysis).toContain("analyzeIntake");
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

describe("TRID (Reg Z §1026.19): the LE clock is triggered, business-day based, and enforced", () => {
  it("the six-piece trigger is evaluated on every write path that can complete an application", () => {
    // Intake creation + borrower PATCH (income, property address, value, loan amount)…
    const lending = read("server/routes/lending.ts");
    expect(lending.match(/evaluateTridTrigger\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    // …and the URLA personal-info save (SSN).
    const borrower = read("server/routes/borrower.ts");
    expect(borrower).toMatch(/evaluateTridTrigger\(/);
  });

  it("only the trid service writes tridTriggeredAt", () => {
    const trid = read("server/services/trid.ts");
    expect(trid).toMatch(/updateLoanApplication\([^)]*tridTriggeredAt/s);
    for (const route of ["server/routes/lending.ts", "server/routes/borrower.ts", "server/routes/underwriting.ts"]) {
      expect(read(route)).not.toMatch(/tridTriggeredAt\s*:/);
    }
  });

  it("LE timing math is business-day based — never calendar setDate arithmetic", () => {
    const loanEstimate = read("server/services/loanEstimate.ts");
    expect(loanEstimate).toMatch(/from\s+["']\.\/businessDays["']/);
    expect(loanEstimate).not.toMatch(/setDate\([^)]*\+\s*3\)/);
    const mismo = read("server/services/mismoValidation.ts");
    expect(mismo).toMatch(/from\s+["']\.\/businessDays["']/);
  });

  it("status and stage advancement enforce the TRID hard stop", () => {
    expect(read("server/routes/lending.ts")).toMatch(/tridHardStopError\(/);
    expect(read("server/routes/underwriting.ts")).toMatch(/tridHardStopError\(/);
  });

  it("borrower LE retrieval persists the delivery date", () => {
    const underwriting = read("server/routes/underwriting.ts");
    expect(underwriting).toMatch(/leIssuedDate/);
    expect(underwriting).toMatch(/trid\.loan_estimate_delivered/);
  });
});

describe("Reg Z §1026.22: every displayed APR comes from the actuarial engine", () => {
  it("advertised rates use the APR solver, not flat spreads", () => {
    const rateService = read("server/services/rateService.ts");
    expect(rateService).toMatch(/advertisedAPR\(/);
    expect(rateService).not.toMatch(/rate\s*\+\s*0\.(2|45)\b/);
    expect(rateService).not.toMatch(/rate\.rate\s*\+\s*0\.002/);
  });

  it("the Loan Estimate APR is solved from the payment stream and its fee schedule", () => {
    const loanEstimate = read("server/services/loanEstimate.ts");
    expect(loanEstimate).toMatch(/calculateMortgageAPR\(/);
    expect(loanEstimate).toMatch(/prepaidFinanceCharges/);
  });

  it("pre-approval letters price payments from the advertised rate, not a constant", () => {
    const lending = read("server/routes/lending.ts");
    expect(lending).not.toMatch(/const rate = 0\.065/);
    expect(lending).toMatch(/currentAdvertised30YrRate/);
  });
});

describe("ECOA/Reg B §1002.9: a denial cannot outrun its adverse-action notice", () => {
  it("EVERY denial route runs through the shared adverse-action chokepoint", () => {
    // Both denial paths — the status PATCH and the pipeline advance-stage
    // POST — must call ensureAdverseActionForDenial before the disposition
    // is applied. A denial path that skips it reopens the §1002.9 hole.
    for (const route of ["server/routes/lending.ts", "server/routes/underwriting.ts"]) {
      expect(read(route)).toMatch(/ensureAdverseActionForDenial\(/);
    }
  });

  it("the chokepoint and its HMDA→Reg B mapping live only in creditService", () => {
    const credit = read("server/services/creditService.ts");
    expect(credit).toMatch(/export async function ensureAdverseActionForDenial/);
    expect(credit).toMatch(/HMDA_TO_ADVERSE_ACTION_REASON/);
    // Routes must not carry their own copy of the mapping (single source).
    for (const route of ["server/routes/lending.ts", "server/routes/underwriting.ts"]) {
      expect(read(route)).not.toMatch(/HMDA_TO_ADVERSE_ACTION_REASON\s*:/);
    }
  });

  it("the adverse-action notice carries the mandatory ECOA §1002.9 block, not just FCRA", () => {
    const credit = read("server/services/creditService.ts");
    expect(credit).toMatch(/EQUAL CREDIT OPPORTUNITY ACT/);
    expect(credit).toMatch(/prohibits creditors from discriminating/);
    // Creditor identity + administering agency are required alongside the notice.
    expect(credit).toMatch(/ECOA_ADMINISTERING_AGENCY/);
    expect(credit).toMatch(/COMPANY_CONFIG\.legalName/);
  });

  it("the automated denial email stays decision-neutral", () => {
    const email = read("server/services/emailService.ts");
    // The compliant adverse-action notice lives in-app (creditService); the
    // email may only point the borrower at their account.
    expect(email).not.toMatch(/unable to issue/i);
    expect(email).not.toMatch(/we're unable|not approved|has been denied/i);
    expect(email).toMatch(/There's an update on your mortgage application/);
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

describe("AI governance (AG-1): MCP tool actions land in the tamper-evident audit chain", () => {
  it("the MCP server never inserts credit pulls directly — persistence goes through creditService", () => {
    const source = read("server/mcp/index.ts");
    expect(source).not.toMatch(/insert\(\s*creditPulls\s*\)/);
    expect(source).toContain("recordExternalSoftPull");
  });

  it("every registered tool writes an invocation entry (tool name + args hash) to the chain", () => {
    const source = read("server/mcp/index.ts");
    const registered = [...source.matchAll(/server\.registerTool\(\s*\n?\s*"([a-z_]+)"/g)].map(
      (m) => m[1],
    );
    expect(registered.length).toBeGreaterThanOrEqual(3);
    for (const tool of registered) {
      // Each tool handler pins its toolName, and the shared audit helper
      // hashes the args and routes through creditService's hash chain.
      expect(source).toMatch(new RegExp(`const toolName = "${tool}"`));
    }
    expect(source).toContain("auditInvocation");
    expect(source).toContain("logAgentToolInvocation");
    expect(source).toMatch(/createHash\("sha256"\)/);
  });

  it("audited soft-pull persistence re-verifies FCRA consent inside creditService", () => {
    const credit = read("server/services/creditService.ts");
    expect(credit).toMatch(/export async function recordExternalSoftPull/);
    expect(credit).toMatch(/Valid consent required before credit pull/);
    expect(credit).toMatch(/does not belong to this borrower/);
  });

  it("agent caller identity stays pluggable (AG-2 seam)", () => {
    expect(read("server/services/creditService.ts")).toMatch(
      /DEFAULT_AGENT_CALLER_IDENTITY = "mcp-stdio"/,
    );
    expect(read("server/mcp/identity.ts")).toMatch(/MCP_CALLER_IDENTITY/);
  });
});

describe("AI governance (AG-2): the MCP surface authenticates WHICH agent it serves", () => {
  it("identity is resolved and enforced before the transport connects", () => {
    const source = read("server/mcp/index.ts");
    const resolveAt = source.indexOf("resolveAgentIdentity(process.env)");
    const enforceAt = source.indexOf("assertDeploymentAllowed(");
    const connectAt = source.indexOf("await server.connect(");
    expect(resolveAt).toBeGreaterThan(-1);
    expect(enforceAt).toBeGreaterThan(resolveAt);
    expect(connectAt).toBeGreaterThan(enforceAt);
  });

  it("the registry holds token hashes, compared in constant time — never plaintext", () => {
    const identity = read("server/mcp/identity.ts");
    expect(identity).toMatch(/createHash\("sha256"\)/);
    expect(identity).toMatch(/timingSafeEqual/);
    expect(identity).not.toMatch(/token\s*===\s*/);
  });

  it("production deployments refuse to serve without an authenticated agent", () => {
    const identity = read("server/mcp/identity.ts");
    expect(identity).toMatch(/NODE_ENV === "production"/);
    expect(identity).toMatch(/MCP_REQUIRE_AGENT_IDENTITY/);
    expect(identity).toMatch(/Refusing to serve tools/);
  });

  it("a failed handshake never downgrades to the unauthenticated fallback", () => {
    expect(read("server/mcp/identity.ts")).toMatch(/handshake failed/);
  });

  it("agent identity is stamped on every row the MCP surface persists", () => {
    expect(read("shared/schema/compliance.ts")).toMatch(/agent_identity/);
    expect(read("shared/schema/property.ts")).toMatch(/avm_agent_identity/);
    expect(read("server/services/creditService.ts")).toMatch(/agentIdentity: callerIdentity/);
    expect(read("server/mcp/index.ts")).toMatch(/avmAgentIdentity: CALLER_IDENTITY/);
    expect(read("migrations/0005_ag2_agent_identity.sql")).toMatch(/ADD COLUMN IF NOT EXISTS/);
  });

  it("every audit entry carries the resolved agent context", () => {
    const source = read("server/mcp/index.ts");
    expect(source).toMatch(/agentContext: agentContext\(\)/);
    expect(read("server/services/creditService.ts")).toMatch(/agentContext/);
  });
});
