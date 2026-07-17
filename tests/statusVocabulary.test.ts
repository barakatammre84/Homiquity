import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { describe, expect, it } from "vitest";
import {
  LOAN_APP_STATUSES,
  LOAN_APP_TERMINAL_STATUSES,
  LOAN_APP_IN_FLIGHT_STATUSES,
  LOAN_APP_TRANSITIONS,
  LOAN_APP_STATUS_META,
  isInFlightLoanAppStatus,
  isValidLoanAppTransition,
  pickActiveLoanApplication,
  TASK_STATUSES,
  ACTIVE_TASK_STATUSES,
  TERMINAL_TASK_STATUSES,
  TASK_VERIFICATION_STATUSES,
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

  it("named status lists used via .includes() carry no phantoms", () => {
    // `const validStatuses = [ … ]; validStatuses.includes(x)` — the receiver
    // is often a bare destructured `status`, so the APP_VAR regexes can't
    // anchor on it. Instead anchor on the LIST: resolve every same-file
    // `NAME.includes(…)` whose const is an array of string literals, and if
    // two or more members are canonical loan-app statuses, the list is
    // treated as a loan-app list and every member must be canonical. Lists
    // from other vocabularies share at most one word with LOAN_APP_STATUSES
    // ("submitted"), so they never trip the threshold.
    const CALL_RE = /\b([A-Za-z_$][\w$]*)\.includes\(/g;
    const violations: string[] = [];
    for (const file of SOURCE_FILES) {
      const source = readFileSync(file, "utf8");
      const rel = relative(ROOT, file);
      const checked = new Set<string>();

      for (const match of source.matchAll(CALL_RE)) {
        const name = match[1];
        if (checked.has(name)) continue;
        checked.add(name);
        const decl = source.match(
          new RegExp(`const\\s+${name}\\s*(:[^=]+)?=\\s*\\[([^\\]]*)\\]`),
        );
        if (!decl) continue;
        // A type-annotated list belongs to whatever vocabulary its type names,
        // and the compiler already validates its members — skip it here.
        if (decl[1]) continue;
        const members = [...decl[2].matchAll(/["']([a-z_]+)["']/g)].map((m) => m[1]);
        if (members.length === 0) continue;
        const canonicalCount = members.filter((m) => CANONICAL.has(m)).length;
        if (canonicalCount < 2) continue; // not a loan-app status list
        for (const m of members) {
          if (!CANONICAL.has(m)) {
            violations.push(`${rel}: status list "${name}" contains phantom "${m}"`);
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

/**
 * tasks.status vocabulary — same guardrails for the task table, added when the
 * dual-vocabulary rows were unified (migration 0033). The failure class: the
 * table held engine-written "OPEN"/"COMPLETED" alongside pipeline-written
 * "pending" and route-written "submitted"/"verified", so SLA sweeps skipped
 * legacy rows and the borrower dashboard counted engine-COMPLETED tasks as
 * open action items (it compared verificationStatus values against status).
 */
describe("task status vocabulary is canonical", () => {
  const TASK_CANONICAL = new Set<string>(TASK_STATUSES);
  const VERIFICATION_CANONICAL = new Set<string>(TASK_VERIFICATION_STATUSES);

  // Variable names that hold a task row across server + client code. Bare "t"
  // is deliberately excluded — it binds to documents/conditions/invites in the
  // same files, which have their own (lowercase) vocabularies.
  const TASK_VAR = "(?:task|currentTask|existingTask|updatedTask|newTask|selectedTask)";

  it("every literal compared against <task>.status is canonical", () => {
    const RE = new RegExp(
      `${TASK_VAR}\\.status\\s*[!=]==?\\s*["']([A-Za-z_]+)["']`,
      "g",
    );
    const violations: string[] = [];
    for (const file of SOURCE_FILES) {
      const source = readFileSync(file, "utf8");
      const rel = relative(ROOT, file);
      for (const match of source.matchAll(RE)) {
        if (!TASK_CANONICAL.has(match[1])) {
          violations.push(`${rel}: compares <task>.status to phantom "${match[1]}"`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every literal in includes() lists tested against <task>.status is canonical", () => {
    const RE = new RegExp(
      `\\[((?:\\s*["'][A-Za-z_]+["']\\s*,?)+)\\]\\.includes\\(\\s*${TASK_VAR}\\.status\\s*\\)`,
      "g",
    );
    const violations: string[] = [];
    for (const file of SOURCE_FILES) {
      const source = readFileSync(file, "utf8");
      const rel = relative(ROOT, file);
      for (const match of source.matchAll(RE)) {
        for (const litMatch of match[1].matchAll(/["']([A-Za-z_]+)["']/g)) {
          if (!TASK_CANONICAL.has(litMatch[1])) {
            violations.push(`${rel}: includes() list contains phantom "${litMatch[1]}"`);
          }
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every status list fed to inArray(tasks.status, …) is canonical", () => {
    // Same Drizzle-column idiom scan as the loanApplications one above:
    // resolves inline array literals, `[...NAME]`, and same-file const arrays.
    // Lists derived from TASK_STATUSES have no literals and are canonical by
    // construction — skipped.
    const INARRAY_RE = /inArray\(\s*tasks\.status\s*,\s*([^)]*)\)/g;
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
        for (const lit of expr.matchAll(/["']([A-Za-z_]+)["']/g)) {
          if (!TASK_CANONICAL.has(lit[1])) {
            violations.push(
              `${rel}: inArray(tasks.status, …) list contains phantom "${lit[1]}"`,
            );
          }
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every literal in eq/ne(tasks.status, …) is canonical", () => {
    const EQ_RE = /\b(?:eq|ne)\(\s*tasks\.status\s*,\s*["']([A-Za-z_]+)["']\s*\)/g;
    const violations: string[] = [];
    for (const file of SOURCE_FILES) {
      const source = readFileSync(file, "utf8");
      const rel = relative(ROOT, file);
      for (const match of source.matchAll(EQ_RE)) {
        if (!TASK_CANONICAL.has(match[1])) {
          violations.push(`${rel}: eq/ne(tasks.status, "${match[1]}") uses a phantom status`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("no raw SQL IN-list on tasks.status (use inArray with typed values)", () => {
    // sql`${tasks.status} IN (…)` carries string literals the type system and
    // the scans above can't see — the optimizationEngine sweep hid this way.
    const RE = /sql`[^`]*\$\{tasks\.status\}\s+IN\s*\(/g;
    const violations: string[] = [];
    for (const file of SOURCE_FILES) {
      const source = readFileSync(file, "utf8");
      const rel = relative(ROOT, file);
      if (RE.test(source)) {
        violations.push(`${rel}: raw sql IN-list on tasks.status`);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every literal compared against <task>.verificationStatus is canonical", () => {
    const RE = new RegExp(
      `${TASK_VAR}\\.verificationStatus\\s*[!=]==?\\s*["']([A-Za-z_]+)["']`,
      "g",
    );
    const violations: string[] = [];
    for (const file of SOURCE_FILES) {
      const source = readFileSync(file, "utf8");
      const rel = relative(ROOT, file);
      for (const match of source.matchAll(RE)) {
        if (!VERIFICATION_CANONICAL.has(match[1])) {
          violations.push(
            `${rel}: compares <task>.verificationStatus to phantom "${match[1]}"`,
          );
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("active + terminal subsets partition the vocabulary exactly", () => {
    expect(
      [...ACTIVE_TASK_STATUSES, ...TERMINAL_TASK_STATUSES].sort(),
    ).toEqual([...TASK_STATUSES].sort());
  });

  it("lifecycle and verification vocabularies never share a value", () => {
    // The dashboard defect was exactly this ambiguity: "pending"/"rejected"
    // compared against the wrong column. Keeping the two sets disjoint means a
    // literal can always be attributed to one axis.
    const overlap = TASK_STATUSES.filter((s) =>
      (TASK_VERIFICATION_STATUSES as readonly string[]).includes(s),
    );
    expect(overlap).toEqual([]);
  });
});

describe("in-flight set and the active-application selector", () => {
  it("in-flight = every canonical status except draft and the terminals", () => {
    const expected = LOAN_APP_STATUSES.filter(
      (s) => s !== "draft" && !LOAN_APP_TERMINAL_STATUSES.includes(s),
    );
    expect([...LOAN_APP_IN_FLIGHT_STATUSES]).toEqual(expected);
    for (const s of [...LOAN_APP_TERMINAL_STATUSES, "draft"]) {
      expect(isInFlightLoanAppStatus(s), `${s} must not be in-flight`).toBe(false);
    }
    // A suspension pauses a file, it doesn't end it.
    expect(isInFlightLoanAppStatus("suspended")).toBe(true);
  });

  it("pickActiveLoanApplication takes the first in-flight entry, skipping closed files", () => {
    const apps = [
      { id: "newer-withdrawn", status: "withdrawn" },
      { id: "live", status: "underwriting" },
      { id: "older-funded", status: "funded" },
    ];
    expect(pickActiveLoanApplication(apps)?.id).toBe("live");
  });

  it("pickActiveLoanApplication returns undefined when nothing is in-flight", () => {
    expect(pickActiveLoanApplication([])).toBeUndefined();
    expect(pickActiveLoanApplication([{ status: "draft" }])).toBeUndefined();
    expect(
      pickActiveLoanApplication(LOAN_APP_TERMINAL_STATUSES.map((status) => ({ status }))),
    ).toBeUndefined();
  });
});
