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

function shapeProbes(s: ZodLike): Array<[string, unknown]> {
  let shape: Record<string, unknown> | undefined;
  try {
    shape = s.shape;
  } catch {
    return [];
  }
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
