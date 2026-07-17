import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import {
  SLA_CLASSES,
  TASK_OWNER_ROLES,
  TASK_TYPE_CODES,
} from "../shared/schema";
import {
  SLA_CLASS_CONFIG_SEED,
  TASK_TYPE_SLA_MAPPING_SEED,
} from "../server/seedData/taskEngineSla";

const ROOT = join(__dirname, "..");

/**
 * Task-engine SLA seed invariants. The mapping/config tables sat empty for the
 * engine's whole life while the emitters minted codes the schema never
 * declared — so nothing here can rely on runtime wiring; these checks pin the
 * three vocabularies (declared codes, emitted codes, seeded codes) together
 * statically, the same way statusVocabulary.test.ts pins status literals.
 */
describe("SLA class config seed", () => {
  it("covers exactly the declared SLA classes, once each", () => {
    expect(SLA_CLASS_CONFIG_SEED.map((c) => c.slaClass).sort()).toEqual(
      [...SLA_CLASSES].sort(),
    );
  });

  it("gives every class except S5 a resolution target (S5 = informational, no clock)", () => {
    for (const config of SLA_CLASS_CONFIG_SEED) {
      if (config.slaClass === "S5") {
        expect(config.targetResolutionMinutes).toBeNull();
      } else {
        expect(
          config.targetResolutionMinutes,
          `${config.slaClass} needs a target — it is what sets tasks.slaDueAt`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("keeps targets strictly increasing from S0 to S4 (urgency ordering)", () => {
    const targets = SLA_CLASS_CONFIG_SEED.filter((c) => c.slaClass !== "S5")
      .sort((a, b) => a.slaClass.localeCompare(b.slaClass))
      .map((c) => c.targetResolutionMinutes!);
    for (let i = 1; i < targets.length; i++) {
      expect(targets[i]).toBeGreaterThan(targets[i - 1]);
    }
  });
});

describe("task-type SLA mapping seed", () => {
  it("uses only declared task codes, SLA classes, and owner roles — no duplicates", () => {
    const seen = new Set<string>();
    for (const mapping of TASK_TYPE_SLA_MAPPING_SEED) {
      expect(TASK_TYPE_CODES).toContain(mapping.taskTypeCode);
      expect(SLA_CLASSES).toContain(mapping.slaClass);
      expect(TASK_OWNER_ROLES).toContain(mapping.defaultOwnerRole);
      expect(seen.has(mapping.taskTypeCode), `duplicate ${mapping.taskTypeCode}`).toBe(false);
      seen.add(mapping.taskTypeCode);
    }
  });

  it("never defaults an event task to BORROWER ownership", () => {
    // Event tasks are created unassigned; a BORROWER default here would put
    // them in the borrower queue with nobody's badge counting them. Borrower
    // action items come from deriveDocumentTaskOwnerRole (assignee = the
    // application owner), not from event codes.
    for (const mapping of TASK_TYPE_SLA_MAPPING_SEED) {
      expect(mapping.defaultOwnerRole).not.toBe("BORROWER");
    }
  });

  it("every borrower-visible mapping carries borrowerDisplayText", () => {
    for (const mapping of TASK_TYPE_SLA_MAPPING_SEED) {
      if (mapping.visibleToBorrower) {
        expect(
          mapping.borrowerDisplayText,
          `${mapping.taskTypeCode} is visibleToBorrower without display text`,
        ).toBeTruthy();
      }
    }
  });

  it("every code the emitters write is declared AND seeded (drift guard)", () => {
    // Scan the emitter the way the vocabulary guards scan status literals: a
    // new `taskTypeCode: "X"` in the emitter without a declaration + mapping
    // recreates the unmapped-code era this seed retired.
    const emitterSource = readFileSync(
      join(ROOT, "server/services/taskEventEmitter.ts"),
      "utf8",
    );
    const emitted = new Set(
      [...emitterSource.matchAll(/taskTypeCode:\s*"([A-Z_]+)"/g)].map((m) => m[1]),
    );
    // createTaskFromEvent's payload fallback code is part of the spoken set.
    const engineSource = readFileSync(
      join(ROOT, "server/services/taskEngine.ts"),
      "utf8",
    );
    const fallback = engineSource.match(/taskTypeCode\s*\|\|\s*"([A-Z_]+)"/);
    if (fallback) emitted.add(fallback[1]);

    expect(emitted.size).toBeGreaterThan(0);
    const seeded = new Set(TASK_TYPE_SLA_MAPPING_SEED.map((m) => m.taskTypeCode));
    const undeclared = [...emitted].filter(
      (code) => !(TASK_TYPE_CODES as readonly string[]).includes(code),
    );
    const unseeded = [...emitted].filter((code) => !seeded.has(code));
    expect(undeclared, `emitter codes missing from TASK_TYPE_CODES: ${undeclared.join(", ")}`).toEqual([]);
    expect(unseeded, `emitter codes missing an SLA mapping: ${unseeded.join(", ")}`).toEqual([]);
  });

  it("migration 0036's code→role remap mirrors the seed's default owners", () => {
    // The migration realigns rows written before the seed existed; if the two
    // ever disagree, historical rows and future rows get different owners for
    // the same code.
    const migration = readFileSync(
      join(ROOT, "migrations/0036_event_task_owner_roles.sql"),
      "utf8",
    );
    const statements = [
      ...migration.matchAll(
        /SET "owner_role" = '([A-Z_]+)'\s+WHERE "owner_role" = 'PROCESSOR' AND "task_type_code" (?:IN \(([^)]+)\)|= '([A-Z_]+)')/g,
      ),
    ];
    expect(statements.length).toBeGreaterThan(0);

    const migrated = new Map<string, string>();
    for (const [, role, inList, single] of statements) {
      const codes = inList
        ? [...inList.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1])
        : [single];
      for (const code of codes) migrated.set(code, role);
    }

    // Every migrated code must match its seeded default…
    for (const [code, role] of migrated) {
      const mapping = TASK_TYPE_SLA_MAPPING_SEED.find((m) => m.taskTypeCode === code);
      expect(mapping, `migration remaps ${code} but the seed has no mapping for it`).toBeDefined();
      expect(mapping!.defaultOwnerRole, `migration says ${code}→${role}`).toBe(role);
    }
    // …and every seeded non-PROCESSOR default must be covered by the migration.
    for (const mapping of TASK_TYPE_SLA_MAPPING_SEED) {
      if (mapping.defaultOwnerRole !== "PROCESSOR") {
        expect(
          migrated.get(mapping.taskTypeCode),
          `${mapping.taskTypeCode} defaults to ${mapping.defaultOwnerRole} but migration 0036 does not remap it`,
        ).toBe(mapping.defaultOwnerRole);
      }
    }
  });
});
