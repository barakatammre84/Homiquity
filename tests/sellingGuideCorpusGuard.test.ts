import { describe, it, expect } from "vitest";
import { writeFileSync, mkdtempSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseExtractorConstants, runChecks, defaultPaths } = require("../scripts/selling-guide-corpus-guard.cjs");

// -----------------------------------------------------------------------------
// The corpus coherence guard (pnpm guard:corpus).
//
// The Selling Guide fact layer is ONE derivation from one PDF: section-index.tsv,
// toc.json, links.json, manifest.json, INDEX.md must agree with each other and
// with the constants pinned in scripts/extract-selling-guide.py. The guard parses
// those constants out of the extractor's source (derive, never duplicate) — so the
// hardest thing to test is not the happy path but the two silent-failure shapes:
// a constant rename that would leave the guard checking nothing, and a fixture
// drift the guard must actually catch. Both directions are pinned here.
// -----------------------------------------------------------------------------

const EDITION = "08-05-2026";
const SHA = "a".repeat(64);
const BLOB = "b".repeat(40);

function extractorSource(overrides: Partial<Record<string, string>> = {}) {
  return [
    `EDITION = "${overrides.EDITION ?? EDITION}"`,
    `PDF_SHA256 = "${overrides.PDF_SHA256 ?? SHA}"`,
    `PDF_BYTES = ${overrides.PDF_BYTES ?? "1234"}`,
    `PDF_GIT_BLOB = "${overrides.PDF_GIT_BLOB ?? BLOB}"`,
    `PYMUPDF_PINNED = "${overrides.PYMUPDF_PINNED ?? "1.28.2"}"`,
    "",
  ].join("\n");
}

type Fix = {
  manifest?: (m: any) => void;
  toc?: (t: any) => void;
  links?: (l: any) => void;
  coverageEdition?: string;
  extractor?: string;
  skipIndex?: boolean;
};

/** A tiny but fully coherent corpus: one group node, two sections, one URL. */
function writeCorpus(fix: Fix = {}) {
  const root = mkdtempSync(join(tmpdir(), "sg-corpus-"));
  const dir = join(root, "selling-guide");
  mkdirSync(dir, { recursive: true });

  const extractor = join(root, "extract.py");
  writeFileSync(extractor, fix.extractor ?? extractorSource());

  if (!fix.skipIndex) {
    writeFileSync(
      join(dir, "section-index.tsv"),
      "level\tpdf_page\tsection\n" +
        "1\t1\tPart A, Doing Business with Fannie Mae\n" +
        "4\t2\tA1-1-01, Application and Approval of Seller/Servicer (09/04/2018)\n" +
        "4\t3\tB3-6-05, Monthly Debt Obligations (08/05/2026)\n",
    );
  }

  const toc: any = {
    edition: EDITION,
    entries: [
      { level: 1, kind: "group", title: "Part A, Doing Business with Fannie Mae", pdf_page: 1, page_end: 1 },
      { level: 4, kind: "section", id: "A1-1-01", title: "A1-1-01, …", pdf_page: 2, page_end: 2 },
      { level: 4, kind: "section", id: "B3-6-05", title: "B3-6-05, …", pdf_page: 3, page_end: 3 },
    ],
  };
  fix.toc?.(toc);
  writeFileSync(join(dir, "toc.json"), JSON.stringify(toc));

  const links: any = {
    edition: EDITION,
    summary: {
      external_annotations: 1,
      unique_urls: 1,
      ok_urls: 1,
      mailto_urls: 0,
      malformed_urls: 0,
      internal_links: 1,
      internal_unresolved: 0,
      xref_edges: 1,
    },
    external: {
      "https://singlefamily.fanniemae.com/x": {
        class: "ok",
        domain: "singlefamily.fanniemae.com",
        pages: [2],
        count: 1,
      },
    },
    internal_xrefs: { "A1-1-01": ["B3-6-05"] },
    canonical_html: {
      "A1-1-01": "https://selling-guide.fanniemae.com/sel/a1-1-01/x",
      "B3-6-05": "https://selling-guide.fanniemae.com/sel/b3-6-05/monthly-debt-obligations",
    },
  };
  fix.links?.(links);
  writeFileSync(join(dir, "links.json"), JSON.stringify(links));

  const manifest: any = {
    edition: EDITION,
    source_pdf: { filename: `Selling-Guide_${EDITION}.pdf`, sha256: SHA, bytes: 1234, git_blob: BLOB },
    pdf: { pages: 3, toc_entries: 3, highlight_annotations: 1 },
    structure: { leaf_sections: 2, group_nodes: 1, front_matter_nodes: 0 },
    links: { unique_urls: 1 },
    tracked: ["section-index.tsv", "toc.json", "links.json", "manifest.json", "INDEX.md", "revised-sections.tsv"],
  };
  fix.manifest?.(manifest);
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest));

  writeFileSync(
    join(dir, "INDEX.md"),
    `# index — edition ${EDITION}\n` +
      "- [`A1-1-01`](extracted/sections/A1-1-01.txt)\n" +
      "- [`B3-6-05`](extracted/sections/B3-6-05.txt)\n",
  );
  writeFileSync(
    join(dir, "revised-sections.tsv"),
    "pdf_page\tsection\n3\tB3-6-05, Monthly Debt Obligations (08/05/2026)\n",
  );

  const coverage = join(root, "coverage.json");
  writeFileSync(coverage, JSON.stringify({ edition: fix.coverageEdition ?? EDITION, sections: {} }));

  return { paths: { dir, extractor, coverage }, root };
}

describe("constant parsing (derive, never duplicate)", () => {
  it("parses all five constants out of the REAL extractor and they match the REAL manifest", () => {
    const real = defaultPaths();
    const constants = parseExtractorConstants(real.extractor);
    expect(constants.EDITION).toMatch(/^\d{2}-\d{2}-\d{4}$/);
    expect(constants.PDF_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(constants.PYMUPDF_PINNED).toMatch(/^\d+\.\d+/);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const manifest = require("../docs/fannie-mae/selling-guide/manifest.json");
    expect(manifest.source_pdf.sha256).toBe(constants.PDF_SHA256);
    expect(manifest.edition).toBe(constants.EDITION);
  });

  it("FAILS loudly (never silently passes) when an anchor cannot be found", () => {
    const { paths, root } = writeCorpus({ extractor: "# constants renamed away\n" });
    const res = runChecks(paths);
    expect(res.errors.length).toBe(1);
    expect(res.errors[0]).toContain("cannot parse");
    rmSync(root, { recursive: true, force: true });
  });
});

describe("coherence on the real tree", () => {
  it("the committed corpus fact layer is internally coherent", () => {
    const res = runChecks();
    expect(res.inert).toBe(false);
    expect(res.errors).toEqual([]);
    expect(res.facts.sections).toBeGreaterThan(400);
  });
});

describe("failing directions", () => {
  it("a coherent fixture passes", () => {
    const { paths, root } = writeCorpus();
    expect(runChecks(paths).errors).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  it("manifest sha256 drift from the extractor pin fails", () => {
    const { paths, root } = writeCorpus({ manifest: (m) => (m.source_pdf.sha256 = "f".repeat(64)) });
    expect(runChecks(paths).errors.join("\n")).toContain("sha256");
    rmSync(root, { recursive: true, force: true });
  });

  it("a toc entry-count mismatch against section-index fails", () => {
    const { paths, root } = writeCorpus({ toc: (t) => t.entries.pop() });
    expect(runChecks(paths).errors.join("\n")).toContain("entries");
    rmSync(root, { recursive: true, force: true });
  });

  it("an xref naming a section the toc does not know fails", () => {
    const { paths, root } = writeCorpus({ links: (l) => (l.internal_xrefs["A1-1-01"] = ["Z9-9-99"]) });
    expect(runChecks(paths).errors.join("\n")).toContain("Z9-9-99");
    rmSync(root, { recursive: true, force: true });
  });

  it("unsorted external keys (hand-edit tripwire) fail", () => {
    const { paths, root } = writeCorpus({
      links: (l) => {
        l.external = {
          "https://z.fanniemae.com/z": { class: "ok", domain: "z.fanniemae.com", pages: [2], count: 1 },
          "https://a.fanniemae.com/a": { class: "ok", domain: "a.fanniemae.com", pages: [2], count: 1 },
        };
        l.summary.unique_urls = 2;
        l.summary.ok_urls = 2;
        l.summary.external_annotations = 2;
      },
      manifest: (m) => (m.links.unique_urls = 2),
    });
    expect(runChecks(paths).errors.join("\n")).toContain("not sorted");
    rmSync(root, { recursive: true, force: true });
  });

  it("a coverage-map edition behind the corpus fails (the renumbering trap)", () => {
    const { paths, root } = writeCorpus({ coverageEdition: "2025-12-10" });
    expect(runChecks(paths).errors.join("\n")).toContain("coverage");
    rmSync(root, { recursive: true, force: true });
  });

  it("is INERT (not failing) when the corpus is absent from the branch", () => {
    const { paths, root } = writeCorpus({ skipIndex: true });
    const res = runChecks(paths);
    expect(res.inert).toBe(true);
    expect(res.errors).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });
});
