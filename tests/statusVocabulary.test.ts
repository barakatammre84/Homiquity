import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { describe, expect, it } from "vitest";
import {
  LOAN_APP_STATUSES,
  LOAN_APP_TERMINAL_STATUSES,
  LOAN_APP_TRANSITIONS,
  LOAN_APP_STATUS_META,
  isValidLoanAppTransition,
} from "../shared/schema";

/**
 * Status vocabulary invariants — the guardrails behind the single-writer
 * pipeline refactor (knowledge-base/logs/assessments/BACKEND_UI_OPTIMIZATION_AUDIT.md).
 *
 * Two failure classes these catch:
 *  1. A new code path compares or writes a loan-application status literal
 *     that isn't in the canonical vocabulary ("declined", "closed",
 *     "under_review"… — the phantom statuses that produced dead UI branches).
 *  2. A new code path writes loanApplications.status directly instead of
 *     going through updatePipelineStage, silently skipping milestones, HMDA
 *     codes, task events, state-machine sync, and homeowner graduation.
 */

const ROOT = join(__dirname, "..");
const CANONICAL = new Set<string>(LOAN_APP_STATUSES);

function walk(dir: string, exts: string[], acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, exts, acc);
    else if (exts.some((e) => entry.endsWith(e))) acc.push(full);
  }
  return acc;
}

const SOURCE_FILES = [
  ...walk(join(ROOT, "server"), [".ts"]),
  ...walk(join(ROOT, "client/src"), [".ts", ".tsx"]),
  ...walk(join(ROOT, "shared"), [".ts"]),
];

// Variable names that hold a loan application across the codebase. Comparing
// `<name>.status` against a literal is only legal with canonical values.
const APP_VAR = "(?:application|activeApplication|activeApp|app|updatedApp|loanApplication|loanApp)";

// `app.status === "x"`, `app.status !== "x"`, `case "x":` inside a
// switch(application.status) is harder to bind statically, so we rely on the
// comparison and includes() forms which cover every regression found in the audit.
const COMPARISON_RE = new RegExp(
  `${APP_VAR}\\.status\\s*[!=]==?\\s*["']([a-z_]+)["']`,
  "g",
);
// `["a", "b"].includes(app.status)`
const INCLUDES_RE = new RegExp(
  `\\[((?:\\s*["'][a-z_]+["']\\s*,?)+)\\]\\.includes\\(\\s*${APP_VAR}\\.status\\s*\\)`,
  "g",
);

describe("loan-application status vocabulary is canonical", () => {
  it("every status literal compared against <app>.status is in LOAN_APP_STATUSES", () => {
    const violations: string[] = [];
    for (const file of SOURCE_FILES) {
      const source = readFileSync(file, "utf8");
      const rel = relative(ROOT, file);

      for (const match of source.matchAll(COMPARISON_RE)) {
        if (!CANONICAL.has(match[1])) {
          violations.push(`${rel}: compares <app>.status to phantom "${match[1]}"`);
        }
      }
      for (const match of source.matchAll(INCLUDES_RE)) {
        for (const litMatch of match[1].matchAll(/["']([a-z_]+)["']/g)) {
          if (!CANONICAL.has(litMatch[1])) {
            violations.push(`${rel}: includes() list contains phantom "${litMatch[1]}"`);
          }
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every status list fed to inArray(loanApplications.status, …) is canonical", () => {
    // The Drizzle-column idiom the <app>.status regexes above can't see: the
    // receiver is the column, not an application variable, so a hand-listed
    // filter array can carry phantoms (or silently omit canonical statuses)
    // without tripping the comparison scans. Resolves the second argument
    // when it is an inline array literal, `[...NAME]`, or a bare NAME whose
    // same-file `const NAME = [ … ]` is an array literal. Lists DERIVED from
    // LOAN_APP_STATUSES (e.g. via .filter) have no literals to check and are
    // canonical by construction — those are skipped.
    const INARRAY_RE = /inArray\(\s*loanApplications\.status\s*,\s*([^)]*)\)/g;
    const violations: string[] = [];
    for (const file of SOURCE_FILES) {
      const source = readFileSync(file, "utf8");
      const rel = relative(ROOT, file);

      for (const match of source.matchAll(INARRAY_RE)) {
        let expr = match[1].trim();
        const ident = expr.match(/^\[?\s*(?:\.\.\.)?\s*([A-Za-z_$][\w$]*)\s*\]?$/);
        if (ident) {
          const decl = source.match(
            new RegExp(`const\\s+${ident[1]}[^=]*=\\s*\\[([^\\]]*)\\]`),
          );
          if (!decl) continue; // derived or imported — typing covers it
          expr = decl[1];
        }
        for (const lit of expr.matchAll(/["']([a-z_]+)["']/g)) {
          if (!CANONICAL.has(lit[1])) {
            violations.push(
              `${rel}: inArray(loanApplications.status, …) list contains phantom "${lit[1]}"`,
            );
          }
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every literal in eq/ne(loanApplications.status, …) is canonical", () => {
    // Companion to the inArray scan: the single-value Drizzle comparators.
    const EQ_RE = /\b(?:eq|ne)\(\s*loanApplications\.status\s*,\s*["']([a-z_]+)["']\s*\)/g;
    const violations: string[] = [];
    for (const file of SOURCE_FILES) {
      const source = readFileSync(file, "utf8");
      const rel = relative(ROOT, file);
      for (const match of source.matchAll(EQ_RE)) {
        if (!CANONICAL.has(match[1])) {
          violations.push(`${rel}: eq/ne(loanApplications.status, "${match[1]}") uses a phantom status`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("no direct status writes outside the single writer (updatePipelineStage)", () => {
    // A storage.updateLoanApplication / db.update(loanApplications) call whose
    // payload sets `status:` must live in pipelineEngine.ts (the single
    // writer), the migration script, or seed data. Everything else must call
    // updatePipelineStage so side effects can't drift.
    //
    // loanAnalysis.ts (finalizeIntake) is the one other sanctioned writer: it
    // owns the self-contained intake→analysis flow (analyzing → pre_approved /
    // under_review), does its own state-machine sync, and is idempotent with a
    // recovery sweep. It is NOT a general status writer — pipeline/staff
    // transitions still go through updatePipelineStage.
    const ALLOWED = new Set([
      "server/pipelineEngine.ts",
      "server/services/loanAnalysis.ts",
      "scripts/migrate-status-vocabulary.ts",
      "server/seed.ts",
    ]);
    const violations: string[] = [];
    for (const file of SOURCE_FILES) {
      const rel = relative(ROOT, file);
      if (ALLOWED.has(rel)) continue;
      const source = readFileSync(file, "utf8");

      // Window scan: updateLoanApplication( ... status: ... within the next
      // ~400 chars (covers multi-line payload objects without full parsing).
      for (const match of source.matchAll(/updateLoanApplication(?:WithAccess)?\s*\(/g)) {
        const windowText = source.slice(match.index!, match.index! + 400);
        // First argument object only — stop at the closing of the call when
        // detectable; the status key with a string literal is the signal.
        if (/[{,]\s*status:\s*["'`]/.test(windowText) || /[{,]\s*status\s*[,}]/.test(windowText)) {
          violations.push(`${rel}: direct loanApplications.status write near "${windowText.slice(0, 60).replace(/\s+/g, " ")}…"`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});

describe("transition table integrity", () => {
  it("covers every canonical status exactly", () => {
    expect(Object.keys(LOAN_APP_TRANSITIONS).sort()).toEqual([...LOAN_APP_STATUSES].sort());
  });

  it("every transition target is a canonical status", () => {
    for (const [from, targets] of Object.entries(LOAN_APP_TRANSITIONS)) {
      for (const to of targets) {
        expect(CANONICAL.has(to), `${from} → ${to}`).toBe(true);
      }
    }
  });

  it("terminal statuses allow no outbound transitions except expired→submitted renewal", () => {
    for (const terminal of LOAN_APP_TERMINAL_STATUSES) {
      const targets = LOAN_APP_TRANSITIONS[terminal];
      if (terminal === "expired") {
        expect(targets).toEqual(["submitted"]);
      } else {
        expect(targets, `${terminal} must be terminal`).toEqual([]);
      }
    }
  });

  it("every non-draft status is reachable from draft", () => {
    const reachable = new Set<string>(["draft"]);
    let frontier = ["draft"];
    while (frontier.length) {
      const next: string[] = [];
      for (const s of frontier) {
        for (const t of LOAN_APP_TRANSITIONS[s as keyof typeof LOAN_APP_TRANSITIONS]) {
          if (!reachable.has(t)) {
            reachable.add(t);
            next.push(t);
          }
        }
      }
      frontier = next;
    }
    for (const status of LOAN_APP_STATUSES) {
      expect(reachable.has(status), `${status} unreachable from draft`).toBe(true);
    }
  });

  it("the happy path is fully connected", () => {
    const happyPath = [
      "draft", "submitted", "analyzing", "pre_approved", "doc_collection",
      "processing", "underwriting", "conditional", "clear_to_close",
      "closing", "funded",
    ] as const;
    for (let i = 0; i < happyPath.length - 1; i++) {
      expect(
        isValidLoanAppTransition(happyPath[i], happyPath[i + 1]),
        `${happyPath[i]} → ${happyPath[i + 1]}`,
      ).toBe(true);
    }
  });

  it("every status has display metadata", () => {
    expect(Object.keys(LOAN_APP_STATUS_META).sort()).toEqual([...LOAN_APP_STATUSES].sort());
  });
});
