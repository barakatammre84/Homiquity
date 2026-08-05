import { describe, it, expect } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { checkLedger } = require("../scripts/migration-ledger-guard.cjs");

// -----------------------------------------------------------------------------
// The migration ledger's integrity check.
//
// The headline fixture is the real 2026-08-04 near-miss recorded in
// TEAM_PRACTICES.md §4: two branches independently authored migration `0038`.
// prod applies migrations/ automatically on merge in journal `idx` order, so a
// duplicated slot means production DDL runs in an undefined order. That case had
// to be caught by hand; the first test below is it, caught by the gate instead.
// -----------------------------------------------------------------------------

/** A well-formed ledger of `n` migrations: idx 0..n-1, files named to match. */
function healthy(n: number) {
  const entries = Array.from({ length: n }, (_, i) => ({
    idx: i,
    tag: `${String(i).padStart(4, "0")}_m${i}`,
  }));
  return { entries, files: entries.map((e) => `${e.tag}.sql`) };
}

describe("checkLedger", () => {
  it("passes a well-formed ledger", () => {
    const { entries, files } = healthy(5);
    expect(checkLedger(entries, files)).toEqual([]);
  });

  it("fails two branches that both claimed 0038 — the §4 near-miss", () => {
    const { entries, files } = healthy(39); // 0..38
    // Branch B lands its own 0038 alongside branch A's.
    entries.push({ idx: 38, tag: "0038_beta" });
    files.push("0038_beta.sql");

    const problems = checkLedger(entries, files);
    expect(problems.join("\n")).toMatch(/duplicate idx 38/);
    expect(problems.length).toBeGreaterThan(0);
  });

  it("fails two journal entries naming the same migration", () => {
    const { entries, files } = healthy(3);
    entries.push({ idx: 3, tag: "0002_m2" });
    expect(checkLedger(entries, files).join("\n")).toMatch(/duplicate tag "0002_m2"/);
  });

  it("fails a gap in the idx run — the tail would apply out of sequence", () => {
    const { entries, files } = healthy(4);
    entries[2] = { idx: 7, tag: "0002_m2" }; // 0,1,7,3
    expect(checkLedger(entries, files).join("\n")).toMatch(/idx sequence breaks/);
  });

  it("fails a journal entry whose .sql is missing — migrate aborts on it", () => {
    const { entries, files } = healthy(3);
    expect(checkLedger(entries, files.slice(0, 2)).join("\n")).toMatch(
      /idx 2 \("0002_m2"\) has no migrations\/0002_m2\.sql/,
    );
  });

  it("fails an un-journalled .sql — it would silently never reach prod", () => {
    const { entries, files } = healthy(3);
    files.push("0003_forgot_to_journal.sql");
    expect(checkLedger(entries, files).join("\n")).toMatch(
      /0003_forgot_to_journal\.sql has no journal entry/,
    );
  });

  it("fails a file renumbered without its entry — the half-resolved collision", () => {
    // Branch B renamed 0038 -> 0039 to dodge the clash but left idx at 38.
    const { entries, files } = healthy(39);
    entries[38] = { idx: 38, tag: "0039_beta" };
    files[38] = "0039_beta.sql";
    expect(checkLedger(entries, files).join("\n")).toMatch(
      /0039_beta\.sql is numbered 0039 but journalled at idx 38/,
    );
  });

  it("fails two files sharing a number even when both are journalled distinctly", () => {
    // Apply order is technically defined here, but the next author reads the
    // filenames and picks the wrong next number.
    const entries = [
      { idx: 0, tag: "0000_a" },
      { idx: 1, tag: "0038_alpha" },
      { idx: 2, tag: "0038_beta" },
    ];
    const files = ["0000_a.sql", "0038_alpha.sql", "0038_beta.sql"];
    expect(checkLedger(entries, files).join("\n")).toMatch(/share the number 0038/);
  });

  it("tolerates a tag with no numeric prefix (the baseline convention)", () => {
    const entries = [{ idx: 0, tag: "baseline" }];
    expect(checkLedger(entries, ["baseline.sql"])).toEqual([]);
  });
});
