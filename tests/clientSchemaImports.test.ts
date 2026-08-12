import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

/**
 * The client may take TYPES from @shared/schema, never VALUES.
 *
 * WHY THIS FILE EXISTS
 *
 * `shared/schema/*.ts` declares Drizzle tables with `pgTable(...)`, which is a
 * side-effecting call. A single value import anywhere under client/src defeats
 * tree-shaking for the whole barrel, so the browser bundle shipped **174 table
 * definitions with their column names** — `adverse_actions`,
 * `borrower_declarations`, `audit_logs`, `broker_commissions`, … — to every
 * visitor of a public site. No data was exposed; the map of the database was.
 *
 * Type imports are fine: `import type` is erased at build (there is no
 * `verbatimModuleSyntax` in tsconfig.json, so an elided import emits nothing).
 * The distinction this guard enforces is exactly the one the bundler acts on.
 *
 * It is all-or-nothing, which is why a guard is worth having rather than a
 * one-time cleanup: ONE reintroduced value import pulls all 174 tables back in,
 * and nothing else in the build would say so. If you need a runtime constant,
 * helper or Zod schema on the client, put it in a table-free module —
 * shared/loanApplicationStatus.ts, shared/statusVocabularies.ts,
 * shared/preApprovalForm.ts and shared/roles.ts are the existing homes — and
 * re-export it from the schema module so server callers are unaffected.
 */

const ROOT = join(__dirname, "..");

function lsFiles(dir: string): string[] {
  return execSync(`git ls-files ${dir}`, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  })
    .split("\n")
    .filter(Boolean);
}

function clientSourceFiles(): string[] {
  // git ls-files, so generated/ignored output is never scanned.
  // Plain `git ls-files <dir>` then filter by extension. A "dir/**/*.ts"
  // pathspec silently misses files at the TOP level of the directory — which is
  // where the two shared/ leaks that this guard exists to catch actually live.
  return lsFiles("client/src").filter((f) => /\.tsx?$/.test(f));
}

/**
 * Value imports of the schema barrel. Matches `import { X } from "@shared/schema"`
 * and its subpaths, but NOT `import type { … }`. An inline `{ type X }` specifier
 * inside an otherwise value-free import still emits nothing, so a clause whose
 * every specifier is `type`-prefixed is treated as type-only — the same rule the
 * compiler applies.
 */
const IMPORT_RE = /import\s+(type\s+)?(\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+["']@shared\/schema[^"']*["']/g;

function valueImportsIn(source: string): string[] {
  const offenders: string[] = [];
  for (const m of source.matchAll(IMPORT_RE)) {
    const [full, typeKeyword, clause] = m;
    if (typeKeyword) continue; // `import type { … }` — fully erased
    if (clause.startsWith("{")) {
      const specifiers = clause
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (specifiers.length > 0 && specifiers.every((s) => s.startsWith("type "))) continue;
    }
    offenders.push(full.replace(/\s+/g, " "));
  }
  return offenders;
}

describe("client must not value-import the Drizzle schema barrel", () => {
  it("finds client source files to scan", () => {
    // Guards the guard: a broken glob would make this suite vacuously green.
    expect(clientSourceFiles().length).toBeGreaterThan(200);
  });

  it("has no value import of @shared/schema anywhere under client/src", () => {
    const offenders: string[] = [];
    for (const file of clientSourceFiles()) {
      for (const imp of valueImportsIn(readFileSync(join(ROOT, file), "utf8"))) {
        offenders.push(`${file}: ${imp}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * The indirect path — and the reason the client-only check above is not enough.
 *
 * With every client value import removed, the bundle STILL carried 105 table
 * definitions. The leak ran through `shared/`: costLedger.ts and
 * cycleTimeReport.ts each value-imported the schema for one constant, and a
 * client page importing those helpers pulled the barrel in behind them. The
 * client-side scan is green in exactly that state, so it would have declared
 * the job done.
 *
 * A non-schema `shared/` module is importable by the client by definition
 * (that is what shared/ is for), so it is held to the same rule.
 */
function sharedNonSchemaFiles(): string[] {
  return lsFiles("shared")
    .filter((f) => f.endsWith(".ts"))
    .filter((f) => !f.startsWith("shared/schema/"));
}

/** Same rule, but for `./schema` / `../schema` specifiers used inside shared/. */
const RELATIVE_RE =
  /import\s+(type\s+)?(\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+["'](\.{1,2}\/schema(?:\/[^"']*)?)["']/g;

function relativeSchemaValueImports(source: string, file: string): string[] {
  const offenders: string[] = [];
  for (const m of source.matchAll(RELATIVE_RE)) {
    const [full, typeKeyword, clause, spec] = m;
    // shared/seo/routeMeta.ts imports "./schema" meaning shared/seo/schema.ts —
    // the JSON-LD helper, not the Drizzle barrel. Resolve before accusing.
    const dir = file.split("/").slice(0, -1).join("/");
    const resolved = spec.startsWith("./")
      ? `${dir}/${spec.slice(2)}`
      : `${dir.split("/").slice(0, -1).join("/")}/${spec.slice(3)}`;
    if (!resolved.startsWith("shared/schema")) continue;
    if (typeKeyword) continue;
    if (clause.startsWith("{")) {
      const specs = clause
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (specs.length > 0 && specs.every((s) => s.startsWith("type "))) continue;
    }
    offenders.push(full.replace(/\s+/g, " "));
  }
  return offenders;
}

describe("shared/ helpers must not value-import the schema either", () => {
  it("finds shared files to scan", () => {
    expect(sharedNonSchemaFiles().length).toBeGreaterThan(20);
  });

  it("has no value import of shared/schema from any non-schema shared module", () => {
    const offenders: string[] = [];
    for (const file of sharedNonSchemaFiles()) {
      const source = readFileSync(join(ROOT, file), "utf8");
      for (const imp of relativeSchemaValueImports(source, file)) {
        offenders.push(`${file}: ${imp}`);
      }
      for (const imp of valueImportsIn(source)) {
        offenders.push(`${file}: ${imp}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("the detector itself", () => {
  it("flags a plain value import", () => {
    expect(valueImportsIn('import { loanApplications } from "@shared/schema";')).toHaveLength(1);
  });

  it("flags a mixed import that carries even one value", () => {
    expect(
      valueImportsIn('import { LOAN_APP_STATUSES, type LoanApplication } from "@shared/schema";'),
    ).toHaveLength(1);
  });

  it("flags a namespace import", () => {
    expect(valueImportsIn('import * as schema from "@shared/schema";')).toHaveLength(1);
  });

  it("allows `import type`", () => {
    expect(valueImportsIn('import type { LoanApplication } from "@shared/schema";')).toEqual([]);
  });

  it("allows an all-inline-type clause, which also emits nothing", () => {
    expect(
      valueImportsIn('import { type LoanApplication, type Document } from "@shared/schema";'),
    ).toEqual([]);
  });

  it("ignores imports from other modules", () => {
    expect(valueImportsIn('import { isStaffRole } from "@shared/roles";')).toEqual([]);
  });
});
