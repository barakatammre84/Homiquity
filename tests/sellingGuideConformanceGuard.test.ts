import { describe, it, expect } from "vitest";
import { writeFileSync, mkdtempSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { runChecks, defaultPaths } = require("../scripts/selling-guide-conformance-guard.cjs");

// -----------------------------------------------------------------------------
// The conformance register guard (pnpm guard:conformance).
//
// SELLING_GUIDE_CONFORMANCE.md records what our code agrees and disagrees with in
// the Guide, and six code comments cite its gap ids as stable keys — while nothing
// checked it. On 2026-08-22 two sessions each added a pair of findings and each
// numbered them C-9/C-10: four findings, two ids, suite green throughout.
//
// So the happy path is the least interesting assertion here. What matters is that
// each failing direction actually fails, and that the two known false-positive
// shapes (the feature-review `C-9-04` namespace, Reg B's `Form C-1`) stay quiet —
// an over-firing guard on an always-run gate trains route-arounds.
// -----------------------------------------------------------------------------

const EDITION = "08-05-2026";

function extractorSource(edition = EDITION) {
  return [
    `EDITION = "${edition}"`,
    `PDF_SHA256 = "${"a".repeat(64)}"`,
    "PDF_BYTES = 1234",
    `PDF_GIT_BLOB = "${"b".repeat(40)}"`,
    'PYMUPDF_PINNED = "1.28.2"',
    "",
  ].join("\n");
}

const REGISTER_BODY = [
  "# Selling Guide conformance ledger",
  "",
  `**Source of truth:** Fannie Mae *Selling Guide*, edition **${EDITION}**.`,
  "",
  "## Corrected",
  "",
  "### C-1 — A revolving line contributed nothing",
  "",
  "**B3-6-05, Monthly Debt Obligations.** Fixed.",
  "",
  "### C-2 — Rental income cited its pre-reorg chapter",
  "",
  "Now cites B3-3.8-01 (formerly B3-3.1-08).",
  "",
  "## Open gaps",
  "",
  "### G-1 — No remaining-term column",
  "",
  "Recorded rather than assumed.",
  "",
].join("\n");

type Fix = {
  register?: string;
  edition?: string;
  skipIndex?: boolean;
  skipRegister?: boolean;
  code?: string;
};

/** A minimal but coherent register + corpus index + one code file. */
function writeFixture(fix: Fix = {}) {
  const root = mkdtempSync(join(tmpdir(), "sg-conformance-"));
  const dir = join(root, "selling-guide");
  const codeRoot = join(root, "server");
  mkdirSync(dir, { recursive: true });
  mkdirSync(codeRoot, { recursive: true });

  const extractor = join(root, "extract.py");
  writeFileSync(extractor, extractorSource(fix.edition));

  if (!fix.skipIndex) {
    writeFileSync(
      join(dir, "section-index.tsv"),
      "level\tpdf_page\tsection\n" +
        "1\t1\tPart B, Origination Through Closing\n" +
        "4\t2\tB3-6-05, Monthly Debt Obligations (08/05/2026)\n" +
        "5\t3\tB3-3.8-01, Rental Income (08/07/2024)\n",
    );
  }

  const registerPath = join(root, "REGISTER.md");
  if (!fix.skipRegister) writeFileSync(registerPath, fix.register ?? REGISTER_BODY);

  writeFileSync(join(codeRoot, "engine.ts"), fix.code ?? "// nothing cited here\n");

  return {
    dir,
    register: registerPath,
    extractor,
    codeRoots: [codeRoot],
  };
}

describe("selling-guide conformance guard", () => {
  it("passes on the real tree, and finds entries and code references there", () => {
    const { inert, errors, facts } = runChecks(defaultPaths());
    expect(inert).toBe(false);
    expect(errors).toEqual([]);
    // If these ever read zero the guard has gone inert without saying so.
    expect(facts.corrections).toBeGreaterThan(0);
    expect(facts.gaps).toBeGreaterThan(0);
    expect(facts.codeRefs).toBeGreaterThan(0);
    expect(facts.edition).toBe(EDITION);
  });

  it("FAILS on a duplicate entry id, naming both headings", () => {
    // The 2026-08-22 collision, reproduced: two different findings, one id.
    const register = REGISTER_BODY.replace(
      "### C-2 — Rental income cited its pre-reorg chapter",
      "### C-1 — A different finding entirely",
    );
    const { errors } = runChecks(writeFixture({ register }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/duplicate entry id C-1/);
    // Both line numbers, so the fix does not require re-finding them.
    expect(errors[0]).toMatch(/lines 7 and 11/);
  });

  it("FAILS on a section id that does not exist in the committed edition", () => {
    const register = REGISTER_BODY.replace("**B3-6-05, Monthly", "**B3-6-99, Monthly");
    const { errors } = runChecks(writeFixture({ register }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/cites B3-6-99/);
    expect(errors[0]).toMatch(/not a section in the committed edition/);
  });

  it("allows a superseded id when the mention is marked historical", () => {
    // `B3-3.1-08` is not in the fixture index; `formerly` is what makes it legible
    // as history rather than as a stale pointer. This is the register's own line 13.
    const { errors } = runChecks(writeFixture());
    expect(errors).toEqual([]);
  });

  it("FAILS when the register's edition stamp does not match the extractor", () => {
    const { errors } = runChecks(writeFixture({ edition: "09-02-2026" }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/register names edition 08-05-2026, extractor EDITION is 09-02-2026/);
  });

  it("FAILS LOUDLY when the edition stamp cannot be parsed at all", () => {
    // A guard whose anchor moved and which silently checks nothing is the
    // silent-success class this repo names — it must fail, not skip.
    const register = REGISTER_BODY.replace(`edition **${EDITION}**`, "the current edition");
    const { errors } = runChecks(writeFixture({ register }));
    expect(errors.some((e: string) => /cannot find the register's edition stamp/.test(e))).toBe(true);
  });

  it("FAILS when code cites a register id that does not exist", () => {
    const code = "// Conservative branch. See SELLING_GUIDE_CONFORMANCE.md (gap G-99).\n";
    const { errors } = runChecks(writeFixture({ code }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/engine\.ts:1 cites G-99, which is not an entry in the register/);
  });

  it("accepts a code reference to an id that does exist", () => {
    const code = "// Imputed rather than assumed — see gap G-1.\n";
    const { errors, facts } = runChecks(writeFixture({ code }));
    expect(errors).toEqual([]);
    expect(facts.codeRefs).toBe(1);
  });

  it("does not read Reg B's Form C-1 as a register reference", () => {
    // server/services/creditCatalogs.ts cites the ECOA model notice by name. The
    // adverse-action forms are literally C-1…C-5, a different namespace; resolving
    // them against correction ids would be coincidence, not a check.
    const code = "// Non-bureau denial reasons from the Reg B model notice (Form C-99).\n";
    const { errors, facts } = runChecks(writeFixture({ code }));
    expect(errors).toEqual([]);
    expect(facts.codeRefs).toBe(0);
  });

  it("does not read a feature-review finding id (C-9-04) as a register reference", () => {
    const code = "// Raised as C-9-04 in the qa sweep.\n";
    const { errors, facts } = runChecks(writeFixture({ code }));
    expect(errors).toEqual([]);
    expect(facts.codeRefs).toBe(0);
  });

  it("is INERT when the corpus has not landed on this branch", () => {
    const { inert, errors } = runChecks(writeFixture({ skipIndex: true }));
    expect(inert).toBe(true);
    expect(errors).toEqual([]);
  });

  it("FAILS when the register is missing while the corpus IS present", () => {
    const { inert, errors } = runChecks(writeFixture({ skipRegister: true }));
    expect(inert).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/is missing while the corpus is present/);
  });
});
