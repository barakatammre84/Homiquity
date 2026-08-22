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
    expect(detectTriggers(["shared/fannieMae/loanDeliveryEdits.ts"])).toHaveLength(0);
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
  it("covers this file, and only this file", () => {
    // This test names invalid ids on purpose. Without the exemption the guard fails its own
    // PR — which it did, on the first run. The exemption is one named file: widening it to
    // `tests/**` would let a genuinely stale citation hide in any test in the repo.
    expect([...CITATION_FIXTURE_FILES]).toEqual(["tests/sellingGuideAuthorityGuard.test.ts"]);
  });

  it("still flags an unresolvable id in a file that is not exempt", () => {
    const diff = ["+++ b/server/underwriting.ts", "+// per B3-3.1-08"].join("\n");
    const { unknown } = resolveIds(findCitations(parseChangedLines(diff)), INDEX);
    expect(unknown).toHaveLength(1);
  });
});
