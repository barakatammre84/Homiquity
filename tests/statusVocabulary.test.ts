import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { describe, expect, it } from "vitest";
import {
  LOAN_APP_STATUSES,
  LOAN_APP_TERMINAL_STATUSES,
  LOAN_APP_IN_FLIGHT_STATUSES,
  LOAN_APP_TRANSITIONS,
  LOAN_APP_STATUS_META,
  STAFF_SETTABLE_STATUSES,
  PROTECTED_CREDIT_DECISION_STATUSES,
  APPROVAL_OUTCOME_STATUSES,
  CREDIT_DECISION_ROLES,
  isInFlightLoanAppStatus,
  isTerminalLoanAppStatus,
  isValidLoanAppTransition,
  pickActiveLoanApplication,
  pickWorkableLoanApplication,
  pickApprovedGradeLoanApplication,
  selectPreApprovalContext,
  TASK_STATUSES,
  ACTIVE_TASK_STATUSES,
  TERMINAL_TASK_STATUSES,
  TASK_VERIFICATION_STATUSES,
  TASK_PRIORITIES,
  TASK_PRIORITY_RANK,
} from "../shared/schema";
import { getStatusLabel } from "../client/src/lib/formatters";

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

  it("hand-listed <SelectItem> status pickers carry no phantoms", () => {
    // The BorrowerFile "Update Application Status" dialog survived the
    // #220–#229 sweeps because its statuses lived in JSX SelectItem values,
    // which none of the scans above anchor on — staff picking "In Review",
    // "Conditional Approval", or "Approved" always got a 400. Heuristic
    // mirrors the named-const rule: a SelectContent block whose literal
    // values include ≥2 canonical loan-app statuses is a status picker, and
    // then EVERY value in it must be canonical. Pickers for other
    // vocabularies (doc types, property types, rate-lock states, …) share at
    // most one word with LOAN_APP_STATUSES, so they never hit the threshold;
    // pickers derived from the shared list have no literals to flag.
    const SELECT_CONTENT_RE = /<SelectContent[^>]*>([\s\S]*?)<\/SelectContent>/g;
    const ITEM_RE = /<SelectItem[^>]*\bvalue=["']([a-z_]+)["']/g;
    const violations: string[] = [];
    for (const file of SOURCE_FILES) {
      if (!file.endsWith(".tsx")) continue;
      const source = readFileSync(file, "utf8");
      const rel = relative(ROOT, file);
      for (const block of source.matchAll(SELECT_CONTENT_RE)) {
        const values = [...block[1].matchAll(ITEM_RE)].map((m) => m[1]);
        if (values.length === 0) continue;
        const canonicalCount = values.filter((v) => CANONICAL.has(v)).length;
        if (canonicalCount < 2) continue; // not a loan-app status picker
        for (const v of values) {
          if (!CANONICAL.has(v)) {
            violations.push(`${rel}: status SelectItem picker contains phantom "${v}"`);
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

/**
 * tasks.priority vocabulary — the status defect's second axis, unified by
 * migration 0034. The column declared LOW/NORMAL/HIGH/CRITICAL but every
 * reader (badge maps, the lending dashboard's action-item sort) matched
 * lowercase, and the task engine's fallback kept writing "NORMAL" alongside
 * the pipeline engine's "high"/"normal". Canonical is the lowercase set;
 * "urgent", not "CRITICAL", is the top tier.
 */
describe("task priority vocabulary is canonical", () => {
  const PRIORITY_CANONICAL = new Set<string>(TASK_PRIORITIES);
  // Same task-row variable names as the status scans above.
  const TASK_VAR = "(?:task|currentTask|existingTask|updatedTask|newTask|selectedTask)";

  it("every literal compared against <task>.priority is canonical", () => {
    const RE = new RegExp(
      `${TASK_VAR}\\.priority\\s*[!=]==?\\s*["']([A-Za-z_]+)["']`,
      "g",
    );
    const violations: string[] = [];
    for (const file of SOURCE_FILES) {
      const source = readFileSync(file, "utf8");
      const rel = relative(ROOT, file);
      for (const match of source.matchAll(RE)) {
        if (!PRIORITY_CANONICAL.has(match[1])) {
          violations.push(`${rel}: compares <task>.priority to phantom "${match[1]}"`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every literal in includes() lists tested against <task>.priority is canonical", () => {
    const RE = new RegExp(
      `\\[((?:\\s*["'][A-Za-z_]+["']\\s*,?)+)\\]\\.includes\\(\\s*${TASK_VAR}\\.priority\\s*\\)`,
      "g",
    );
    const violations: string[] = [];
    for (const file of SOURCE_FILES) {
      const source = readFileSync(file, "utf8");
      const rel = relative(ROOT, file);
      for (const match of source.matchAll(RE)) {
        for (const litMatch of match[1].matchAll(/["']([A-Za-z_]+)["']/g)) {
          if (!PRIORITY_CANONICAL.has(litMatch[1])) {
            violations.push(`${rel}: includes() list contains phantom "${litMatch[1]}"`);
          }
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every priority list fed to inArray(tasks.priority, …) is canonical", () => {
    // Same Drizzle-column idiom scan as the status one: resolves inline array
    // literals, `[...NAME]`, and same-file const arrays. Lists derived from
    // TASK_PRIORITIES have no literals and are canonical by construction.
    const INARRAY_RE = /inArray\(\s*tasks\.priority\s*,\s*([^)]*)\)/g;
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
          if (!PRIORITY_CANONICAL.has(lit[1])) {
            violations.push(
              `${rel}: inArray(tasks.priority, …) list contains phantom "${lit[1]}"`,
            );
          }
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every literal in eq/ne(tasks.priority, …) is canonical", () => {
    const EQ_RE = /\b(?:eq|ne)\(\s*tasks\.priority\s*,\s*["']([A-Za-z_]+)["']\s*\)/g;
    const violations: string[] = [];
    for (const file of SOURCE_FILES) {
      const source = readFileSync(file, "utf8");
      const rel = relative(ROOT, file);
      for (const match of source.matchAll(EQ_RE)) {
        if (!PRIORITY_CANONICAL.has(match[1])) {
          violations.push(`${rel}: eq/ne(tasks.priority, "${match[1]}") uses a phantom priority`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("no raw SQL IN-list on tasks.priority (use inArray with typed values)", () => {
    const RE = /sql`[^`]*\$\{tasks\.priority\}\s+IN\s*\(/g;
    const violations: string[] = [];
    for (const file of SOURCE_FILES) {
      const source = readFileSync(file, "utf8");
      const rel = relative(ROOT, file);
      if (RE.test(source)) {
        violations.push(`${rel}: raw sql IN-list on tasks.priority`);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("TASK_PRIORITY_RANK covers the vocabulary exactly, urgent first", () => {
    expect(Object.keys(TASK_PRIORITY_RANK).sort()).toEqual([...TASK_PRIORITIES].sort());
    expect(TASK_PRIORITY_RANK.urgent).toBe(0);
    // TASK_PRIORITIES ascends in urgency, so rank must strictly descend along
    // it — no ties, or the dashboard sort silently stops distinguishing tiers.
    for (let i = 1; i < TASK_PRIORITIES.length; i++) {
      expect(
        TASK_PRIORITY_RANK[TASK_PRIORITIES[i]],
        `${TASK_PRIORITIES[i]} must outrank ${TASK_PRIORITIES[i - 1]}`,
      ).toBeLessThan(TASK_PRIORITY_RANK[TASK_PRIORITIES[i - 1]]);
    }
  });

  it("priority never shares a value with the status or verification vocabularies", () => {
    // Same disjointness doctrine as status vs verification: a literal must be
    // attributable to exactly one axis of the tasks table.
    const others = new Set<string>([...TASK_STATUSES, ...TASK_VERIFICATION_STATUSES]);
    expect(TASK_PRIORITIES.filter((p) => others.has(p))).toEqual([]);
  });
});

/**
 * Staff status-machine subsets — the shared policy behind
 * PATCH /api/loan-applications/:id/status and the staff status pickers.
 * The BorrowerFile dialog previously hand-listed its options and drifted
 * three phantoms away from the route schema; both sides now derive from
 * these lists, and these tests pin the policy so a vocabulary edit can't
 * silently widen or narrow what staff can set.
 */
describe("staff status-machine subsets", () => {
  it("staff-settable = the vocabulary minus draft/analyzing/expired", () => {
    expect([...STAFF_SETTABLE_STATUSES]).toEqual(
      LOAN_APP_STATUSES.filter((s) => s !== "draft" && s !== "analyzing" && s !== "expired"),
    );
  });

  it("protected credit decisions are staff-settable and role-gated", () => {
    for (const s of PROTECTED_CREDIT_DECISION_STATUSES) {
      expect(STAFF_SETTABLE_STATUSES, `${s} must be staff-settable`).toContain(s);
    }
    expect([...PROTECTED_CREDIT_DECISION_STATUSES].sort()).toEqual(
      ["clear_to_close", "denied", "funded", "pre_approved"],
    );
    expect([...CREDIT_DECISION_ROLES].sort()).toEqual(["admin", "underwriter"]);
  });

  it("approval outcomes = the protected set minus denial (ECOA: denial is never verification-gated)", () => {
    expect([...APPROVAL_OUTCOME_STATUSES].sort()).toEqual(
      PROTECTED_CREDIT_DECISION_STATUSES.filter((s) => s !== "denied").sort(),
    );
  });

  it("getStatusLabel maps every canonical status explicitly (no snake_case fallbacks)", () => {
    // The fallback humanizer would render these fine, but an explicit entry is
    // the contract: status pickers show curated labels, not derived ones.
    for (const s of LOAN_APP_STATUSES) {
      expect(getStatusLabel(s), `label for ${s}`).not.toBe(s);
      expect(getStatusLabel(s)).toBeTruthy();
    }
    expect(getStatusLabel("under_review")).toBe("Under Review");
    expect(getStatusLabel("conditional")).toBe("Conditional Approval");
    expect(getStatusLabel("clear_to_close")).toBe("Clear to Close");
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

  it("pickWorkableLoanApplication keeps drafts but never a closed file", () => {
    // The borrower's newest file is closed; the one they're working is older.
    // The API returns newest-created first, so a bare [0] picked the dead one.
    const apps = [
      { id: "newest-denied", status: "denied" },
      { id: "working", status: "doc_collection" },
    ];
    expect(pickWorkableLoanApplication(apps)?.id).toBe("working");

    // A draft IS workable — it's resumable and can carry documents.
    expect(pickWorkableLoanApplication([{ id: "d", status: "draft" }])?.id).toBe("d");

    // Nothing open => undefined, so callers fall back to their no-application
    // state rather than attaching work to a closed loan.
    expect(pickWorkableLoanApplication([])).toBeUndefined();
    expect(
      pickWorkableLoanApplication(LOAN_APP_TERMINAL_STATUSES.map((status) => ({ status }))),
    ).toBeUndefined();
  });

  it("workable is strictly wider than active, and both exclude closed files", () => {
    for (const status of LOAN_APP_STATUSES) {
      const apps = [{ status }];
      if (pickActiveLoanApplication(apps)) {
        expect(pickWorkableLoanApplication(apps), `${status}`).toBeDefined();
      }
      if (isTerminalLoanAppStatus(status)) {
        expect(pickWorkableLoanApplication(apps), `${status}`).toBeUndefined();
        expect(pickActiveLoanApplication(apps), `${status}`).toBeUndefined();
      }
    }
    // The one status that separates them.
    expect(pickWorkableLoanApplication([{ status: "draft" }])).toBeDefined();
    expect(pickActiveLoanApplication([{ status: "draft" }])).toBeUndefined();
  });

  it("pickApprovedGradeLoanApplication skips draft/terminal and never falls back", () => {
    expect(pickApprovedGradeLoanApplication([{ id: "d", status: "draft" }])).toBeUndefined();
    expect(pickApprovedGradeLoanApplication([{ id: "x", status: "denied" }])).toBeUndefined();
    expect(
      pickApprovedGradeLoanApplication(LOAN_APP_TERMINAL_STATUSES.map((status) => ({ status }))),
      "funded is terminal but IS approved-grade",
    ).toBeDefined();
    const apps = [
      { id: "denied", status: "denied" },
      { id: "approved", status: "pre_approved" },
    ];
    expect(pickApprovedGradeLoanApplication(apps)?.id).toBe("approved");
  });

  it("selectPreApprovalContext does not resurrect a denied file as a pre-approval", () => {
    // The regression this locks: a borrower whose only application is denied.
    // `find(approvedGrade) || apps[0]` returned the denied file, and because a
    // denied file still carries annualIncome, hasPreApproval flipped true —
    // rendering qualification math for a closed file AND suppressing the
    // Get-Pre-Approved CTA on /properties/:id and /buy.
    const ctx = selectPreApprovalContext([
      { status: "denied", annualIncome: "120000", preApprovalAmount: "400000", monthlyDebts: "500", creditScore: 700 },
    ]);
    expect(ctx.application).toBeNull();
    expect(ctx.hasPreApproval).toBe(false);
    expect(ctx.preApprovalAmount).toBe(0);
    expect(ctx.monthlyIncome).toBe(0);
    expect(ctx.creditScore).toBeUndefined();
  });

  it("selectPreApprovalContext unpacks the approved-grade file's money strings", () => {
    const ctx = selectPreApprovalContext([
      { status: "denied", annualIncome: "50000" },
      { status: "pre_approved", annualIncome: "120000", preApprovalAmount: "480000", monthlyDebts: "600", creditScore: 740 },
    ]);
    expect(ctx.hasPreApproval).toBe(true);
    expect(ctx.preApprovalAmount).toBe(480000);
    expect(ctx.monthlyIncome).toBe(10000);
    expect(ctx.monthlyDebts).toBe(600);
    expect(ctx.creditScore).toBe(740);
  });

  it("selectPreApprovalContext treats a zero-income approval as no pre-approval", () => {
    // An approved-grade file with no income can't drive qualification math —
    // the surfaces must fall back to the CTA, not divide by zero.
    const ctx = selectPreApprovalContext([{ status: "pre_approved", annualIncome: null }]);
    expect(ctx.application).not.toBeNull();
    expect(ctx.hasPreApproval).toBe(false);
    expect(ctx.monthlyIncome).toBe(0);
  });

  it("selectPreApprovalContext tolerates empty/missing input", () => {
    expect(selectPreApprovalContext([]).hasPreApproval).toBe(false);
    expect(selectPreApprovalContext([]).application).toBeNull();
    expect(selectPreApprovalContext(undefined).hasPreApproval).toBe(false);
    expect(selectPreApprovalContext(null).hasPreApproval).toBe(false);
  });
});
