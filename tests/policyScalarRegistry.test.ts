import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import {
  POLICY_MATRICES,
  POLICY_SCALARS,
  hasSinglePolicySystemOfRecord,
  policyScalarByCode,
} from "../shared/policyScalarRegistry";

const ROOT = join(__dirname, "..");

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (entry.endsWith(".ts")) acc.push(full);
  }
  return acc;
}

/** Every getPolicyScalar("X") the server actually makes. */
function scalarCodesInServer(): string[] {
  const found = new Set<string>();
  for (const file of walk(join(ROOT, "server"))) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/getPolicyScalar\("([A-Z0-9_]+)"\)/g)) {
      found.add(m[1]);
    }
  }
  return [...found].sort();
}

describe("policy scalar registry", () => {
  it("lists exactly the scalars the engine resolves", () => {
    // The inventory cannot silently fall behind the code: a new
    // getPolicyScalar() call fails here until it is registered, which is what
    // stops the two policy systems drifting further apart while the
    // consolidation direction is being decided.
    expect(POLICY_SCALARS.map((s) => s.matrixCode).sort()).toEqual(scalarCodesInServer());
  });

  it("gives every scalar a threshold equivalent and a description", () => {
    for (const s of POLICY_SCALARS) {
      expect(s.thresholdEquivalent.category, s.matrixCode).toBeTruthy();
      expect(s.thresholdEquivalent.thresholdKey, s.matrixCode).toBeTruthy();
      expect(s.description.length, s.matrixCode).toBeGreaterThan(10);
    }
  });

  it("keeps matrix codes and scalar codes disjoint", () => {
    // The four matrices are grids resolved by coordinate. policy_thresholds
    // stores one value per row with no cell model, so they cannot move there
    // and must not acquire a threshold equivalent by accident.
    for (const code of POLICY_MATRICES) {
      expect(policyScalarByCode(code), code).toBeUndefined();
    }
  });

  it("has no duplicate codes or duplicate threshold coordinates", () => {
    const codes = POLICY_SCALARS.map((s) => s.matrixCode);
    expect(new Set(codes).size).toBe(codes.length);
    // Two scalars mapping to one threshold row would make the catalogue
    // ambiguous the moment anything read from it.
    const coords = POLICY_SCALARS.map(
      (s) => `${s.thresholdEquivalent.category}.${s.thresholdEquivalent.thresholdKey}`,
    );
    expect(new Set(coords).size).toBe(coords.length);
  });

  it("all engine thresholds still come from one store", () => {
    // The property that matters. While this holds, a decision's ResolvedPolicy
    // fingerprint identifies one governing policy. If thresholds were split
    // across lookup_matrices and policy_thresholds, the same fingerprint would
    // cover two catalogues with independent lifecycles and would no longer
    // answer "which policy decided this loan".
    expect(hasSinglePolicySystemOfRecord()).toBe(true);
    expect(new Set(POLICY_SCALARS.map((s) => s.systemOfRecord))).toEqual(
      new Set(["lookup_matrices"]),
    );
  });
});

describe("the policy catalogue does not yet decide loans", () => {
  // Recorded as a test rather than a comment so that wiring policy_thresholds
  // into the engine cannot happen without someone deliberately updating this
  // file — and, with it, the registry's systemOfRecord and the notice the
  // Policy Ops console shows its operators.
  const ENGINE_FILES = [
    "server/underwritingEngine.ts",
    "server/services/decisionEngine.ts",
    "server/services/ruleEngine.ts",
  ];

  it("no engine reads policy_profiles or policy_thresholds", () => {
    for (const rel of ENGINE_FILES) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src, `${rel} now reads the policy catalogue`).not.toMatch(
        /policyThresholds|policyProfiles|policy-thresholds/,
      );
    }
  });

  it("Policy Operations stays off the navigation while it governs nothing", () => {
    // Parked, not deleted: the routes still resolve for anyone with the URL,
    // but a role-gated console that looks authoritative and decides no loan is
    // an invitation to change a DTI cap and believe it took effect. It comes
    // back to the nav when activating a policy compiles its thresholds into
    // the catalogue the engine reads.
    const sidebar = readFileSync(join(ROOT, "client/src/components/app-sidebar.tsx"), "utf8");
    expect(sidebar, "Policy Operations is back on the nav").not.toMatch(
      /title:\s*"Policy Operations"/,
    );
    // Pricing Matrices — the console that DOES govern decisions — stays.
    expect(sidebar).toMatch(/title:\s*"Pricing Matrices"/);
  });

  it("the Policy Ops console says so, so no underwriter believes otherwise", () => {
    // Same failure class as the "Draft Saved" toast one level up: an
    // underwriter editing a DTI cap here could reasonably believe it governs
    // underwriting. It does not, and the console has to say that until it does.
    const notice = readFileSync(
      join(ROOT, "client/src/pages/staff/policyOps/GovernanceNotice.tsx"),
      "utf8",
    );
    expect(notice).toMatch(/do not yet govern/i);
    expect(notice).toMatch(/Pricing Matrices/);
  });
});
