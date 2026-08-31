import { describe, it, expect } from "vitest";
import { writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  detectTriggers,
  findCitations,
  resolveIds,
  hasAuthorityEvidence,
  loadSectionIndex,
  parseChangedLines,
  ATTESTATION,
  CITATION_FIXTURE_FILES,
  findChapterCitations,
} = require("../scripts/selling-guide-authority-guard.cjs");

// -----------------------------------------------------------------------------
// The Selling Guide authority gate (TEAM_PRACTICES §10).
//
// Two rules are under test. (1) A PR touching Guide-governed logic names the
// governing section, in the diff or in the PR body. (2) An id that does not resolve
// in the committed edition fails ANYWHERE in the diff — because the Guide renumbers
// and a stale cite does not announce itself: when self-employment income moved off
// B3-3.2 on 2026-03-04, six sites kept citing the old chapter and the URL still
// returned HTTP 200.
//
// What these tests deliberately do NOT assert: that a cited section says what the
// code claims. The guard cannot know that, and a test implying otherwise would sell
// a pass as sign-off.
// -----------------------------------------------------------------------------

/** Stand-in for the committed edition; the real one is section-index.tsv. */
const INDEX = new Set(["B3-6-05", "B3-5.3-09", "B2-2-03", "A2-2-04", "B3-3.5-01", "E-2-04"]);

const diffOf = (file: string, ...lines: string[]) =>
  [`+++ b/${file}`, ...lines.map((l) => `+${l}`)].join("\n");

describe("path triggers", () => {
  it("fires on a governed engine file", () => {
    const hits = detectTriggers(["server/services/decisionEngine.ts"]);
    expect(hits).toHaveLength(1);
    expect(hits[0].label).toBe("underwriting & decision engines");
  });

  it("fires on a prefix-matched directory (income paths)", () => {
    expect(detectTriggers(["server/services/income/paths/rental.ts"])).toHaveLength(1);
  });

  it("stays silent on ungoverned surfaces", () => {
    expect(detectTriggers(["client/src/pages/Landing.tsx", "README.md"])).toHaveLength(0);
  });

  it("does not fire on shared/fannieMae — job-aid-sourced, excluded on purpose", () => {
    // Dual-gating delivery formats would teach people to paste Guide ids onto
    // job-aid data, which is worse than no citation at all.
    expect(detectTriggers(["shared/fannieMae/qmThresholds.ts"])).toHaveLength(0);
  });

  it("does not fire on pricing — the LLPA Matrix is not procured", () => {
    expect(detectTriggers(["server/pricing.ts"])).toHaveLength(0);
  });
});

describe("citation detection", () => {
  it("finds an id on an added line", () => {
    const cites = findCitations(parseChangedLines(diffOf("server/underwriting.ts", "// per B3-6-05")));
    expect(cites.map((c: { id: string }) => c.id)).toEqual(["B3-6-05"]);
  });

  it("ignores removed lines", () => {
    const diff = ["+++ b/server/underwriting.ts", "-// per B3-6-05"].join("\n");
    expect(findCitations(parseChangedLines(diff))).toHaveLength(0);
  });

  it("exempts a line that marks the id as historical", () => {
    const diff = diffOf("server/underwriting.ts", "// rental income (formerly B3-3.1-08)");
    expect(findCitations(parseChangedLines(diff))).toHaveLength(0);
  });

  it("does not match an id embedded in a longer token", () => {
    const diff = diffOf("server/mismo.ts", "const v = 'MISMO-E-2-04-beta';");
    expect(findCitations(parseChangedLines(diff))).toHaveLength(0);
  });

  it("separates resolving ids from ones the edition does not contain", () => {
    const cites = findCitations(
      parseChangedLines(diffOf("server/underwriting.ts", "// B3-6-05 and B3-3.1-08")),
    );
    const { known, unknown } = resolveIds(cites, INDEX);
    expect(known.map((c: { id: string }) => c.id)).toEqual(["B3-6-05"]);
    expect(unknown.map((c: { id: string }) => c.id)).toEqual(["B3-3.1-08"]);
  });
});

describe("PR-body authority evidence", () => {
  it("accepts a section naming a resolving id", () => {
    const body = "## Selling Guide authority\nB2-2-03 — financed-property count basis.";
    expect(hasAuthorityEvidence(body, INDEX).ok).toBe(true);
  });

  it("accepts a prefixed heading, house style", () => {
    const body = "### Selling Guide authority (§10)\nB3-6-05 governs the revolving imputation.";
    expect(hasAuthorityEvidence(body, INDEX).ok).toBe(true);
  });

  it("rejects a body with no such section", () => {
    expect(hasAuthorityEvidence("## Summary\nRefactored a helper.", INDEX).ok).toBe(false);
  });

  it("rejects a section citing an id the edition does not contain", () => {
    // An evidence section pointing at a dead id is worse than none: it reads as
    // diligence while sending an auditor to text that does not exist.
    const body = "## Selling Guide authority\nB3-3.1-08 — rental offsets.";
    const r = hasAuthorityEvidence(body, INDEX);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("B3-3.1-08");
  });

  it("accepts the attestation when it carries a reason", () => {
    const body = `## Selling Guide authority\n${ATTESTATION} — renames a local variable and moves two pure helpers; no rule changes.`;
    expect(hasAuthorityEvidence(body, INDEX).ok).toBe(true);
  });

  it("rejects a bare attestation with no reason", () => {
    const body = `## Selling Guide authority\n${ATTESTATION}`;
    const r = hasAuthorityEvidence(body, INDEX);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("rationale");
  });

  it("stops the section at the next heading", () => {
    const body = "## Selling Guide authority\n\n## Summary\nB3-6-05 mentioned only down here.";
    expect(hasAuthorityEvidence(body, INDEX).ok).toBe(false);
  });
});

describe("section index loading", () => {
  it("reads leaf ids out of the TSV and ignores group rows", () => {
    const dir = mkdtempSync(join(tmpdir(), "sg-index-"));
    const file = join(dir, "section-index.tsv");
    writeFileSync(
      file,
      [
        "level\tpdf_page\tsection",
        "1\t19\tPart A, Doing Business with Fannie Mae",
        "3\t20\tChapter A1-1, Application and Approval of Seller/Servicer",
        "4\t38\tA2-2-04, Limited Waiver and Enforcement Relief (04/01/2026)",
        "4\t523\tB3-6-05, Monthly Debt Obligations (08/05/2026)",
      ].join("\n"),
    );
    const ids = loadSectionIndex(file);
    expect(ids.has("A2-2-04")).toBe(true);
    expect(ids.has("B3-6-05")).toBe(true);
    // "Chapter A1-1, ..." is a navigation node, not a citable section.
    expect(ids.has("A1-1")).toBe(false);
    expect(ids.size).toBe(2);
  });

  it("returns null when the corpus is absent, so the guard can say it is inert", () => {
    expect(loadSectionIndex(join(tmpdir(), "definitely-not-here-section-index.tsv"))).toBeNull();
  });
});

describe("the fixture exemption", () => {
  it("covers exactly the three files that name invalid ids on purpose", () => {
    // These files name invalid ids deliberately. Without the exemption the guard fails its
    // own PR — which it did, on the first run, and again in 2026-08-23 when the conformance
    // guard landed carrying a nonexistent section number as a fixture and a feature-review
    // finding id whose shape collides with a Guide section id.
    //
    // The list stays NAMED FILES. Widening it to `tests/**` or `scripts/*guard*` would let a
    // genuinely stale citation hide anywhere in those trees, which is the whole thing this
    // guard exists to prevent — so this assertion is a ratchet: adding a file here is a
    // deliberate act that turns this test red until someone writes the reason down.
    expect([...CITATION_FIXTURE_FILES]).toEqual([
      "tests/sellingGuideAuthorityGuard.test.ts",
      "scripts/selling-guide-conformance-guard.cjs",
      "tests/sellingGuideConformanceGuard.test.ts",
    ]);
  });

  it("still flags an unresolvable id in a file that is not exempt", () => {
    const diff = ["+++ b/server/underwriting.ts", "+// per B3-3.1-08"].join("\n");
    const { unknown } = resolveIds(findCitations(parseChangedLines(diff)), INDEX);
    expect(unknown).toHaveLength(1);
  });
});

describe("historical markers across wrapped comments", () => {
  it("exempts a continuation line whose marker sits on the line above", () => {
    // The real shape in preUnderwriting.ts and rental.ts: the renumbering note wraps, so the
    // id lands on the second line. A line-local check called these wrong citations.
    const diff = [
      "+++ b/server/services/preUnderwriting.ts",
      "+  // --- Multi-unit subject property rental income (Fannie B3-3.8-01, formerly",
      "+  // B3-3.1-08): 75% of appraisal market rent is ADDED to qualifying income;",
    ].join("\n");
    const { unknown } = resolveIds(findCitations(parseChangedLines(diff)), INDEX);
    expect(unknown).toHaveLength(0);
  });

  it("does NOT let a marker leak across files", () => {
    const diff = [
      "+++ b/a.ts",
      "+// formerly something",
      "+++ b/b.ts",
      "+// per B3-3.1-08",
    ].join("\n");
    const { unknown } = resolveIds(findCitations(parseChangedLines(diff)), INDEX);
    expect(unknown.map((c: { id: string }) => c.id)).toEqual(["B3-3.1-08"]);
  });

  it("does NOT exempt a stale id far below an unrelated marker", () => {
    const diff = [
      "+++ b/a.ts",
      "+// formerly B3-3.1-08 was here",
      "+const x = 1;",
      "+const y = 2;",
      "+// per B3-3.1-08",
    ].join("\n");
    const { unknown } = resolveIds(findCitations(parseChangedLines(diff)), INDEX);
    expect(unknown).toHaveLength(1);
  });
});

describe("chapter-form citations", () => {
  // The blind spot that let the 2026-03-04 renumbering survive. SG_ID requires a
  // leaf `-NN`, so `B3-3.2` is never looked up and resolves against nothing —
  // six sites cited that chapter for a rule at B3-3.5-01, through every gate,
  // for months. A chapter cannot be verified: you cannot open a container of
  // sections and check whether it says what the code claims.
  const chapters = (file: string, ...lines: string[]) =>
    findChapterCitations(parseChangedLines(diffOf(file, ...lines))).map(
      (c: { id: string }) => c.id,
    );

  it("fails an added chapter-level cite in server code", () => {
    expect(chapters("server/services/preUnderwriting.ts", '// Income seasoning (Fannie B3-3.2)')).toEqual([
      "B3-3.2",
    ]);
  });

  it("fails the exact shape the real defect had, in a citation field", () => {
    expect(chapters("server/services/autopilot/followUps.ts", '  citation: "Fannie Mae B3-3.2",')).toEqual([
      "B3-3.2",
    ]);
  });

  it("passes a leaf citation — the whole point is to push you to one", () => {
    expect(chapters("server/services/preUnderwriting.ts", '// Income seasoning (Fannie B3-3.5-01)')).toEqual([]);
  });

  it("passes when the line says it means a chapter", () => {
    expect(
      chapters("shared/incomeTypes.ts", '// Fannie Selling Guide chapter B3-3 covers income assessment'),
    ).toEqual([]);
  });

  it("passes a deliberately historical mention", () => {
    expect(
      chapters("server/x.ts", '// formerly Fannie B3-3.2, renumbered 2026-03-04 to B3-3.5-01'),
    ).toEqual([]);
  });

  it("passes a historical marker on a wrapped comment line just above", () => {
    const diff = [
      "+++ b/server/x.ts",
      "+// The Selling Guide renumbered this; it was formerly",
      "+// Fannie B3-3.2 before the move.",
    ].join("\n");
    expect(findChapterCitations(parseChangedLines(diff))).toEqual([]);
  });

  it("ignores lines with no Guide context — a bare token is not a citation", () => {
    expect(chapters("server/visa.ts", 'const status = "E-2";')).toEqual([]);
    expect(chapters("server/x.ts", 'const released = "2026-08-23";')).toEqual([]);
  });

  it("ignores docs, which legitimately narrate the renumbering", () => {
    expect(chapters("knowledge-base/governance/TEAM_PRACTICES.md", "self-employment moved off Fannie B3-3.2")).toEqual(
      [],
    );
  });

  it("does not fire on an unchanged line", () => {
    const diff = ["+++ b/server/x.ts", "-// Fannie B3-3.2", " // context"].join("\n");
    expect(findChapterCitations(parseChangedLines(diff))).toEqual([]);
  });

  it("exempts this guard's own fixture file", () => {
    for (const f of CITATION_FIXTURE_FILES) {
      expect(chapters(f as string, '// Fannie B3-3.2')).toEqual([]);
    }
  });
});
