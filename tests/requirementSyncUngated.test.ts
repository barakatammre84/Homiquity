import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Document-requirement derivation must run whether or not autopilot is on.
 *
 * It is the same deterministic rule evaluation intake already runs ungated
 * (`initializeLoanPipeline`), producing the same `DOC_REQ_<TYPE>` conditions
 * with the same idempotency. No model reads anything, no decision is issued,
 * nothing is narrated — so the autopilot kill switch was never the right gate
 * for it. Behind that gate the requirement set froze at whatever the borrower
 * said FIRST: someone who later added a second employer or an other-income row
 * owed documents nobody would ever ask for.
 *
 * These are structural assertions on source, which is a weak form of test
 * (finding F-014). They are used here because the property at risk is exactly
 * a structural one — "is this call inside the `enabled` branch or outside it" —
 * and a future edit that re-nests it would otherwise be silent.
 */
const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

describe("requirement sync is ungated", () => {
  const urlaRoute = read("server/routes/borrower/urla.ts");

  it("calls syncDocumentRequirements on the URLA section save", () => {
    expect(urlaRoute).toContain("syncDocumentRequirements");
  });

  it("calls it BEFORE the autopilot-enabled check, not inside that branch", () => {
    const sync = urlaRoute.indexOf("syncDocumentRequirements(application)");
    const gate = urlaRoute.indexOf("getAutopilotConfig()).enabled");
    expect(sync, "syncDocumentRequirements(application) not found").toBeGreaterThan(-1);
    expect(gate, "autopilot enabled-check not found").toBeGreaterThan(-1);
    // If the sync moves after the gate it has almost certainly been re-nested
    // inside it, which silently restores the frozen-requirements defect.
    expect(sync).toBeLessThan(gate);
  });

  it("keeps the agentic half — narration and decision recalculation — gated", () => {
    // runAutopilotForSection is what narrates and recalculates; it must still
    // sit inside the enabled branch.
    const gate = urlaRoute.indexOf("getAutopilotConfig()).enabled");
    const run = urlaRoute.indexOf("runAutopilotForSection({");
    expect(run).toBeGreaterThan(gate);
  });

  it("derives once per save — autopilot reuses the caller's conditions", () => {
    const orchestrator = read("server/services/autopilot/orchestrator.ts");
    expect(orchestrator).toContain("params.createdConditions ??");
  });

  describe("syncDocumentRequirements itself", () => {
    const engine = read("server/pipelineEngine.ts");
    const body = engine.slice(
      engine.indexOf("export async function syncDocumentRequirements"),
      engine.indexOf("export async function initializeLoanPipeline"),
    );

    it("exists and is exported", () => {
      expect(body.length).toBeGreaterThan(0);
    });

    it("consults no kill switch, allowlist or agent config of any kind", () => {
      for (const forbidden of [
        "isAutopilotEnabled",
        "getAutopilotConfig",
        "canGenerateFollowUps",
        "autopilot",
      ]) {
        expect(body.toLowerCase()).not.toContain(forbidden.toLowerCase());
      }
    });

    it("is the single derivation path — intake routes through it too", () => {
      const intake = engine.slice(engine.indexOf("export async function initializeLoanPipeline"));
      expect(intake).toContain("syncDocumentRequirements(application)");
      // Intake must not keep a private copy of the derivation.
      const intakeHead = intake.slice(0, intake.indexOf("return {"));
      expect(intakeHead).not.toContain("determineDocumentRequirements(");
    });
  });
});
