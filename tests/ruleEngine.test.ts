import { describe, it, expect } from "vitest";
import { executeRules } from "../server/services/ruleEngine";
import type { IStorage } from "../server/storage";

// ---------------------------------------------------------------------------
// Roadmap CH-5: first dedicated coverage for the DSL rule engine behind
// /api/underwriting-rules/execute. These are characterization tests — they pin
// the engine's current, deliberate semantics so a future edit can't silently
// change decision-adjacent behavior:
//   - numeric operators REQUIRE a number on the context side (a string "700"
//     never satisfies `< 700` — fail-closed, no coercion),
//   - an unknown operator is false, never a throw,
//   - AND/OR groups nest, priority orders execution, stopOnMatch halts only
//     after a MATCHED rule, inactive rules never run,
//   - every evaluated rule is logged, matched or not.
// ---------------------------------------------------------------------------

type AnyRule = Record<string, unknown>;

function makeRule(overrides: AnyRule): AnyRule {
  return {
    id: "r-" + Math.abs(JSON.stringify(overrides).length),
    ruleCode: "TEST_RULE",
    version: 1,
    triggerType: "manual",
    priority: 100,
    isActive: true,
    stopOnMatch: false,
    actions: [],
    ...overrides,
  };
}

function stubStorage(rules: AnyRule[]) {
  const logs: unknown[] = [];
  const storage = {
    getUnderwritingRules: async () => rules,
    getUnderwritingRule: async (id: string) => rules.find((r) => r.id === id),
    createRuleExecutionLog: async (entry: unknown) => {
      logs.push(entry);
      return entry;
    },
  } as unknown as IStorage;
  return { storage, logs };
}

async function run(rules: AnyRule[], context: Record<string, unknown>, ruleIds?: string[]) {
  const { storage, logs } = stubStorage(rules);
  const results = await executeRules(storage, "snap-1", context, ruleIds);
  return { results, logs };
}

const cond = (field: string, operator: string, value?: unknown) => ({ field, operator, value });
const group = (operator: "AND" | "OR", ...conditions: unknown[]) => ({ operator, conditions });

async function evalOne(condition: unknown, context: Record<string, unknown>): Promise<boolean> {
  const { results } = await run(
    [makeRule({ id: "solo", conditionsDsl: group("AND", condition) })],
    context,
  );
  return results[0].conditionsMet;
}

describe("operator semantics", () => {
  it("EQUALS is strict — no type coercion", async () => {
    expect(await evalOne(cond("score", "EQUALS", 700), { score: 700 })).toBe(true);
    expect(await evalOne(cond("score", "EQUALS", 700), { score: "700" })).toBe(false);
  });

  it("numeric operators require a number on the context side (fail-closed)", async () => {
    expect(await evalOne(cond("score", "<", 700), { score: 650 })).toBe(true);
    expect(await evalOne(cond("score", "<", 700), { score: "650" })).toBe(false);
    expect(await evalOne(cond("score", ">=", 700), { score: undefined })).toBe(false);
  });

  it("BETWEEN is inclusive on both ends and needs a numeric actual", async () => {
    expect(await evalOne(cond("dti", "BETWEEN", [36, 43]), { dti: 36 })).toBe(true);
    expect(await evalOne(cond("dti", "BETWEEN", [36, 43]), { dti: 43 })).toBe(true);
    expect(await evalOne(cond("dti", "BETWEEN", [36, 43]), { dti: 43.01 })).toBe(false);
    expect(await evalOne(cond("dti", "BETWEEN", [36, 43]), { dti: "40" })).toBe(false);
  });

  it("IN / NOT_IN require an array on the rule side", async () => {
    expect(await evalOne(cond("state", "IN", ["IL", "WI"]), { state: "IL" })).toBe(true);
    expect(await evalOne(cond("state", "IN", "IL"), { state: "IL" })).toBe(false);
    expect(await evalOne(cond("state", "NOT_IN", ["IL"]), { state: "TX" })).toBe(true);
  });

  it("EXISTS / NOT_EXISTS treat null and undefined alike", async () => {
    expect(await evalOne(cond("coBorrower", "EXISTS"), { coBorrower: null })).toBe(false);
    expect(await evalOne(cond("coBorrower", "NOT_EXISTS"), {})).toBe(true);
    expect(await evalOne(cond("coBorrower", "EXISTS"), { coBorrower: false })).toBe(true);
  });

  it("CONTAINS / STARTS_WITH require a string actual", async () => {
    expect(await evalOne(cond("name", "CONTAINS", "mi"), { name: "Smith" })).toBe(true);
    expect(await evalOne(cond("name", "STARTS_WITH", "Sm"), { name: "Smith" })).toBe(true);
    expect(await evalOne(cond("name", "CONTAINS", "1"), { name: 100 })).toBe(false);
  });

  it("an unknown operator evaluates false — never throws, never passes", async () => {
    expect(await evalOne(cond("score", "REGEX_MATCH", ".*"), { score: 700 })).toBe(false);
  });

  it("dotted field paths traverse nested context; a broken path is undefined, not a throw", async () => {
    expect(await evalOne(cond("credit.score", ">=", 620), { credit: { score: 700 } })).toBe(true);
    expect(await evalOne(cond("credit.score.deep", "NOT_EXISTS"), { credit: null })).toBe(true);
  });
});

describe("condition groups", () => {
  it("AND needs every condition; OR needs one; groups nest", async () => {
    const dsl = group(
      "AND",
      cond("score", ">=", 620),
      group("OR", cond("dti", "<=", 43), cond("reserves", ">=", 6)),
    );
    const { results } = await run(
      [makeRule({ id: "nested", conditionsDsl: dsl })],
      { score: 700, dti: 50, reserves: 8 },
    );
    expect(results[0].conditionsMet).toBe(true);

    const { results: fails } = await run(
      [makeRule({ id: "nested2", conditionsDsl: dsl })],
      { score: 700, dti: 50, reserves: 2 },
    );
    expect(fails[0].conditionsMet).toBe(false);
  });
});

describe("execution order and halting", () => {
  const matchAll = group("AND", cond("x", "EXISTS"));
  const matchNone = group("AND", cond("missing", "EXISTS"));

  it("runs in ascending priority (missing priority defaults to 100)", async () => {
    const { results } = await run(
      [
        makeRule({ id: "late", ruleCode: "LATE", priority: 200, conditionsDsl: matchAll }),
        makeRule({ id: "early", ruleCode: "EARLY", priority: 10, conditionsDsl: matchAll }),
        makeRule({ id: "default", ruleCode: "DEFAULT", priority: null, conditionsDsl: matchAll }),
      ],
      { x: 1 },
    );
    expect(results.map((r) => r.ruleCode)).toEqual(["EARLY", "DEFAULT", "LATE"]);
  });

  it("stopOnMatch halts the chain only when the rule actually matched", async () => {
    const { results } = await run(
      [
        makeRule({ id: "a", ruleCode: "A", priority: 1, conditionsDsl: matchNone, stopOnMatch: true }),
        makeRule({ id: "b", ruleCode: "B", priority: 2, conditionsDsl: matchAll, stopOnMatch: true }),
        makeRule({ id: "c", ruleCode: "C", priority: 3, conditionsDsl: matchAll }),
      ],
      { x: 1 },
    );
    // A didn't match, so its stopOnMatch is inert; B matched and stops; C never runs.
    expect(results.map((r) => r.ruleCode)).toEqual(["A", "B"]);
  });

  it("inactive and unknown rules are filtered on the ruleIds path", async () => {
    const { results } = await run(
      [
        makeRule({ id: "on", ruleCode: "ON", conditionsDsl: matchAll }),
        makeRule({ id: "off", ruleCode: "OFF", conditionsDsl: matchAll, isActive: false }),
      ],
      { x: 1 },
      ["on", "off", "ghost"],
    );
    expect(results.map((r) => r.ruleCode)).toEqual(["ON"]);
  });
});

describe("actions and audit", () => {
  it("actions run only on a match, and each known type returns its shaped result", async () => {
    const actions = [
      { type: "set_qualification_status", status: "requires_review", reason: "manual" },
      { type: "flag_for_review", reason: "check assets" },
      { type: "some_future_action", foo: 1 },
    ];
    const { results } = await run(
      [
        makeRule({ id: "hit", ruleCode: "HIT", priority: 1, conditionsDsl: group("AND", cond("x", "EXISTS")), actions }),
        makeRule({ id: "miss", ruleCode: "MISS", priority: 2, conditionsDsl: group("AND", cond("missing", "EXISTS")), actions }),
      ],
      { x: 1 },
    );
    const hit = results.find((r) => r.ruleCode === "HIT")!;
    const miss = results.find((r) => r.ruleCode === "MISS")!;
    expect(hit.actionsExecuted).toEqual(["set_qualification_status", "flag_for_review", "some_future_action"]);
    expect((hit.actionResults as Array<{ type: string; result: Record<string, unknown> }>)[1].result).toEqual({
      reason: "check assets",
      severity: "warning",
    });
    // Unknown action types pass through raw instead of throwing — forward-compatible.
    expect((hit.actionResults as Array<{ type: string }>)[2].type).toBe("some_future_action");
    expect(miss.actionsExecuted).toEqual([]);
    expect(miss.actionResults).toEqual([]);
  });

  it("every evaluated rule writes an execution log, matched or not", async () => {
    const { logs, results } = await run(
      [
        makeRule({ id: "1", ruleCode: "M", priority: 1, conditionsDsl: group("AND", cond("x", "EXISTS")) }),
        makeRule({ id: "2", ruleCode: "N", priority: 2, conditionsDsl: group("AND", cond("missing", "EXISTS")) }),
      ],
      { x: 1 },
    );
    expect(logs).toHaveLength(2);
    expect(results.every((r) => r.snapshotId === "snap-1")).toBe(true);
    expect(results[1].evaluationDetails).toEqual({
      conditions: ['missing EXISTS undefined => actual: undefined => false'],
    });
  });
});
