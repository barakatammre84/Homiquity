import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

import * as schema from "../shared/schema";
import * as incomePackage from "../shared/incomePackage";
import * as situationProfile from "../shared/situationProfile";
import * as taxFormExtraction from "../shared/taxFormExtraction";
import * as riskBrief from "../shared/riskBrief";
import * as incomePaths from "../shared/incomePaths";

// -----------------------------------------------------------------------------
// What every exported schema ACCEPTS and REJECTS, pinned.
//
// zod validates URLA, loan-delivery and compliance payloads at ~116 parse sites.
// A dependency bump that quietly flips one field from required to optional — or
// stops rejecting a malformed payload — would not fail a typecheck and would not
// fail a route test that only exercises the happy path. It would just start
// letting bad data into a loan file.
//
// This snapshots the DECISION (accept/reject) and WHICH FIELD is faulted, and
// deliberately NOT the message text or the issue-code name. Those are cosmetic
// and churn on every zod release; the zod 3 -> 4 migration changed 1674 message
// strings and 105 issue codes while changing zero decisions and zero field
// paths, which is exactly the distinction this test encodes.
//
// If this fails after a zod upgrade, read the diff before re-recording: a
// changed path or a flipped `ok` is a real behaviour change on regulated data.
// Re-record deliberately with UPDATE_ZOD_SNAPSHOT=1 pnpm test.
// -----------------------------------------------------------------------------

const SNAPSHOT = join(__dirname, "__snapshots__", "zod-schema-semantics.json");

const MODULES: Array<[string, Record<string, unknown>]> = [
  ["schema", schema as Record<string, unknown>],
  ["incomePackage", incomePackage as Record<string, unknown>],
  ["situationProfile", situationProfile as Record<string, unknown>],
  ["taxFormExtraction", taxFormExtraction as Record<string, unknown>],
  ["riskBrief", riskBrief as Record<string, unknown>],
  ["incomePaths", incomePaths as Record<string, unknown>],
];

interface ZodLike {
  safeParse: (v: unknown) => { success: boolean; error?: { issues?: Array<{ path?: unknown[] }> } };
  shape?: Record<string, unknown>;
}

function isSchema(v: unknown): v is ZodLike {
  return !!v && typeof v === "object" && typeof (v as ZodLike).safeParse === "function";
}

/** Deterministic probes — no randomness, so the snapshot is stable. */
const SCALAR_PROBES: Array<[string, unknown]> = [
  ["undefined", undefined],
  ["null", null],
  ["empty-object", {}],
  ["empty-array", []],
  ["empty-string", ""],
  ["zero", 0],
  ["false", false],
  ["string", "x"],
  ["number", 1],
  ["true", true],
];

/** A plausible value for a field, chosen from its name so probes stay realistic. */
function valueForKey(k: string): unknown {
  const n = k.toLowerCase();
  if (n === "id" || n.endsWith("id")) return "00000000-0000-4000-8000-000000000000";
  if (n.includes("email")) return "a@b.com";
  if (n.includes("date") || n.endsWith("at")) return "2026-01-01T00:00:00.000Z";
  if (n.includes("url")) return "https://example.com";
  if (
    n.includes("count") || n.includes("amount") || n.includes("score") ||
    n.includes("rate") || n.includes("year") || n.includes("num") ||
    n.includes("order") || n.includes("value") || n.includes("months")
  ) return 1;
  if (n.startsWith("is") || n.startsWith("has") || n.includes("enabled")) return true;
  return "x";
}

/**
 * Find the object shape behind whatever wrappers a schema is exported with.
 *
 * WHY THIS IS NOT JUST `s.shape`. A schema wrapped in `z.preprocess(...)` or
 * `.transform(...)` exposes no `.shape` of its own, so the per-field probes
 * below produced NOTHING for it and only the ten scalar probes ran. Five of the
 * ~195 exported schemas were in that state — including
 * `loanApplicationIntakeSchema` and `loanApplicationIntakeUpdateSchema`, the
 * pair that admits borrower financial data into a loan file. Their per-field
 * rules were entirely unpinned, and a change to what ten of those fields accept
 * passed this test unchanged (PR #547, ticket 6).
 *
 * The wrappers put the object on different sides depending on which one it is —
 * `z.preprocess(fn, obj)` keeps it on `.out` (`.in` is the preprocessing step),
 * while `obj.transform(fn)` keeps it on `.in` (`.out` is the transform). Rather
 * than encode that per constructor name, which is exactly the sort of internal
 * that moves between zod majors, this walks both sides breadth-first and takes
 * the first shape it finds. Only one side ever carries one.
 *
 * NOTE WHAT THIS DOES NOT CHANGE: the shape is used only to CHOOSE PROBE FIELD
 * NAMES. Every probe is still parsed against the OUTER exported schema
 * (`outcome(val, input)` in buildSnapshot), so the recorded decision is still
 * "what does the thing we export accept?" — preprocessing included — and not
 * "what does its inner object accept?". Those are different questions and only
 * the first one is worth pinning.
 */
function unwrapToShape(s: ZodLike): Record<string, unknown> | undefined {
  const seen = new Set<unknown>();
  const queue: unknown[] = [s];
  // Generous enough for preprocess(obj.superRefine().transform()) and then
  // some; bounded so a self-referential schema cannot spin.
  for (let steps = 0; steps < 32 && queue.length; steps++) {
    const node = queue.shift();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);

    let shape: unknown;
    try {
      shape = (node as ZodLike).shape;
    } catch {
      shape = undefined; // some wrappers throw rather than return undefined
    }
    if (shape && typeof shape === "object") return shape as Record<string, unknown>;

    const n = node as Record<string, any>;
    // `.in`/`.out` are the zod 4 pipe sides; `innerType` covers the
    // optional/nullable/default wrappers in both majors.
    queue.push(n.in, n.out, n._zod?.def?.innerType, n._def?.innerType, n._def?.schema);
  }
  return undefined;
}

function shapeProbes(s: ZodLike): Array<[string, unknown]> {
  const shape = unwrapToShape(s);
  if (!shape || typeof shape !== "object") return [];
  const keys = Object.keys(shape);
  if (!keys.length) return [];

  const filled: Record<string, unknown> = {};
  for (const k of keys) filled[k] = valueForKey(k);

  const probes: Array<[string, unknown]> = [["all-keys-typed", filled]];
  for (const k of keys.slice(0, 6)) {
    const copy = { ...filled };
    delete copy[k];
    probes.push([`missing-${k}`, copy]);
  }
  probes.push([`wrongtype-${keys[0]}`, { ...filled, [keys[0]]: { nested: "wrong" } }]);

  // WHICH FIELDS ACCEPT NULL — one probe, every key at once.
  //
  // The faulted-path list is the payload here: a field that starts admitting
  // null DROPS OUT of it, so this single line pins nullability across the whole
  // shape without six probes per schema.
  //
  // It exists because the probes above would not have caught the change that
  // exposed this file's blind spot. `valueForKey` supplies plausible values, so
  // the null question was never asked — and "does this field accept null?" is a
  // data-admission question on a loan file, not a cosmetic one: null is how
  // `loanApplicationIntakeUpdateSchema` says "clear this borrower's answer"
  // (CLEARABLE_INTAKE_FIELDS, shared/intakeClearable.ts). Widening that set is
  // exactly the kind of change that should have to walk past a recorded line.
  const nulled: Record<string, unknown> = {};
  for (const k of keys) nulled[k] = null;
  probes.push(["all-keys-null", nulled]);

  return probes;
}

/** ok + which fields were faulted. Deliberately excludes message and code. */
function outcome(s: ZodLike, input: unknown): string {
  let r: ReturnType<ZodLike["safeParse"]>;
  try {
    r = s.safeParse(input);
  } catch (e) {
    return `threw:${(e as Error)?.name ?? "Error"}`;
  }
  if (r.success) return "accept";
  const paths = (r.error?.issues ?? [])
    .map((i) => (i.path ?? []).join("."))
    .sort()
    .join(",");
  return `reject:${paths}`;
}

function buildSnapshot(): Record<string, Record<string, string>> {
  const snap: Record<string, Record<string, string>> = {};
  for (const [modName, mod] of MODULES) {
    for (const [expName, val] of Object.entries(mod)) {
      if (!isSchema(val)) continue;
      const results: Record<string, string> = {};
      for (const [probe, input] of [...SCALAR_PROBES, ...shapeProbes(val)]) {
        results[probe] = outcome(val, input);
      }
      snap[`${modName}.${expName}`] = results;
    }
  }
  return snap;
}

describe("zod schema semantics", () => {
  const current = buildSnapshot();

  it("exercises the whole exported schema surface", () => {
    // Guards against the snapshot silently emptying out if a barrel export moves.
    expect(Object.keys(current).length).toBeGreaterThan(150);
  });

  it("accepts and rejects exactly what it did before", () => {
    if (process.env.UPDATE_ZOD_SNAPSHOT === "1" || !existsSync(SNAPSHOT)) {
      writeFileSync(SNAPSHOT, JSON.stringify(current, null, 2) + "\n");
      return;
    }
    const recorded = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as typeof current;

    const changes: string[] = [];
    for (const key of new Set([...Object.keys(recorded), ...Object.keys(current)])) {
      const before = recorded[key];
      const after = current[key];
      if (!before || !after) {
        changes.push(`${key}: ${before ? "schema removed" : "schema added"}`);
        continue;
      }
      for (const probe of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (before[probe] !== after[probe]) {
          changes.push(`${key} [${probe}]: ${before[probe]} -> ${after[probe]}`);
        }
      }
    }

    expect(
      changes,
      "A schema changed what it accepts, rejects, or which field it faults. " +
        "On URLA/compliance payloads that is a data-admission change, not a " +
        "cosmetic one — read every line before re-recording with " +
        "UPDATE_ZOD_SNAPSHOT=1.",
    ).toEqual([]);
  });
});
