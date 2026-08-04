import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { SCENARIO_CATALOG } from "../server/services/scenarioCatalog";

/**
 * Catalog sync contract: the machine-readable catalog must stay a faithful
 * projection of the registry and the engine — unique IDs, real citations,
 * and every implemented S-XX from knowledge-base/compliance/UNDERWRITING_SCENARIOS.md present.
 * (Flag codes are enforced at compile time via the PreUwFlagCode type.)
 */

const registry = readFileSync(join(__dirname, "../knowledge-base/compliance/UNDERWRITING_SCENARIOS.md"), "utf8");

describe("scenario catalog integrity", () => {
  it("has unique scenario ids", () => {
    const ids = SCENARIO_CATALOG.map((s) => s.scenarioId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry cites at least one regulation or explicit platform policy", () => {
    for (const entry of SCENARIO_CATALOG) {
      expect(entry.regulations.length, entry.scenarioId).toBeGreaterThan(0);
      for (const citation of entry.regulations) {
        expect(citation.length, entry.scenarioId).toBeGreaterThan(10);
      }
    }
  });

  it("every entry has semantic versioning and non-empty workflow instructions", () => {
    for (const entry of SCENARIO_CATALOG) {
      expect(entry.version, entry.scenarioId).toMatch(/^\d+\.\d+\.\d+$/);
      expect(entry.triggers.length, entry.scenarioId).toBeGreaterThan(0);
      expect(entry.workflow.automationEngineActions.length, entry.scenarioId).toBeGreaterThan(0);
      expect(entry.workflow.borrowerActions.length, entry.scenarioId).toBeGreaterThan(0);
    }
  });

  it("every implemented S-XX in the registry appears in the catalog", () => {
    const implementedSection = registry.split("## Implemented")[1]?.split("## Backlog")[0] ?? "";
    const registryIds = [...implementedSection.matchAll(/### (S-\d+):/g)].map((m) => m[1]);
    expect(registryIds.length).toBeGreaterThan(0);
    const catalogIds = new Set(SCENARIO_CATALOG.map((s) => s.scenarioId));
    for (const id of registryIds) {
      expect(catalogIds.has(id), `registry ${id} missing from scenarioCatalog.ts`).toBe(true);
    }
  });

  it("engine references point at files that exist", () => {
    for (const entry of SCENARIO_CATALOG) {
      const files = entry.engineRef
        .split(/[+;,]/)
        .map((part) => part.trim().split(" ")[0])
        .filter((p) => p.includes("/"));
      for (const file of files) {
        expect(() => readFileSync(join(__dirname, "..", file))).not.toThrow();
      }
    }
  });

  // The two directions the original section-scan test cannot see: an entry
  // whose Status says Implemented while it physically sits outside the
  // "## Implemented" section is invisible to that scan (this is exactly how
  // S-07 went missing), and a flag the engine raises with no catalog entry is
  // only caught at compile time in the catalog→engine direction, never
  // engine→catalog.
  it("an entry marked Implemented never sits outside the Implemented section", () => {
    const sections = registry.split(/^## /m);
    for (const section of sections) {
      const sectionName = section.split("\n")[0]?.trim() ?? "";
      if (sectionName.startsWith("Implemented")) continue;
      for (const match of section.matchAll(/### (S-\d+)[^\n]*\n([\s\S]*?)(?=\n### |$)/g)) {
        const [, id, block] = match;
        expect(
          /Status:\s*\**\s*Implemented/.test(block),
          `registry ${id} is marked Implemented but sits under "## ${sectionName}" — move it into the Implemented section`,
        ).toBe(false);
      }
    }
  });

  it("every PreUwFlagCode the engine can raise has a catalog entry", () => {
    const engineSource = readFileSync(join(__dirname, "../server/services/preUnderwriting.ts"), "utf8");
    const union = engineSource.match(/export type PreUwFlagCode =([\s\S]*?);/)?.[1] ?? "";
    const raisableCodes = [...union.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);
    expect(raisableCodes.length).toBeGreaterThan(0);
    const catalogFlags = new Set(SCENARIO_CATALOG.map((s) => s.flagCode));
    for (const code of raisableCodes) {
      expect(
        catalogFlags.has(code as (typeof SCENARIO_CATALOG)[number]["flagCode"]),
        `flag ${code} is raisable by preUnderwriting.ts but has no scenarioCatalog.ts entry`,
      ).toBe(true);
    }
  });
});
