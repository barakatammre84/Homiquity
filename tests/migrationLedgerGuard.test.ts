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

// -----------------------------------------------------------------------------
// Check 7 — duplicate `when` (HO-0822-24).
//
// Drizzle orders pending migrations by `when`, so two entries sharing one are applied
// in an order the journal does not specify, and `migrate-prod` can report success having
// skipped one. Unlike a duplicate idx, nothing about it is loud.
//
// It is the easy mistake, not an exotic one: two branches each add a migration, each takes
// "the next timestamp", and they collide on merge. Both of #650's migrations carried main's
// `when` on 2026-08-22 — the index collision was caught by check 1 and this one would have
// sailed through.
// -----------------------------------------------------------------------------

/** A well-formed ledger whose entries also carry distinct, increasing `when` stamps. */
function healthyTimed(n: number) {
  const entries = Array.from({ length: n }, (_, i) => ({
    idx: i,
    tag: `${String(i).padStart(4, "0")}_m${i}`,
    when: 1786147200000 + i,
  }));
  return { entries, files: entries.map((e) => `${e.tag}.sql`) };
}

describe("checkLedger — duplicate `when`", () => {
  it("passes when every entry has its own timestamp", () => {
    const { entries, files } = healthyTimed(5);
    expect(checkLedger(entries, files)).toEqual([]);
  });

  it("fails two migrations that share a timestamp — the defect, reintroduced", () => {
    const { entries, files } = healthyTimed(5);
    entries.push({ idx: 5, tag: "0005_beta", when: entries[4].when }); // collides with 0004
    files.push("0005_beta.sql");

    const problems = checkLedger(entries, files);
    expect(problems.join("\n")).toMatch(/duplicate when/);
    expect(problems.join("\n")).toMatch(/0004_m4/);
    expect(problems.join("\n")).toMatch(/0005_beta/);
  });

  it("says why it matters, so the reader does not treat it as cosmetic", () => {
    const { entries, files } = healthyTimed(3);
    entries.push({ idx: 3, tag: "0003_beta", when: entries[2].when });
    files.push("0003_beta.sql");
    expect(checkLedger(entries, files).join("\n")).toMatch(/unspecified order|skip/i);
  });

  it("does NOT fire on a journal that omits `when` entirely", () => {
    // The regression this nearly shipped with: comparing undefined to undefined reports
    // every entry in a journal without the field. A missing `when` is a different defect.
    const { entries, files } = healthy(4);
    expect(checkLedger(entries, files)).toEqual([]);
  });
});
