/**
 * seat-roster-guard — proves the FAILING directions.
 *
 * A guard only ever asserted in its passing state is a guard nobody has tested
 * (LESSONS.md 2026-08-12), and the specific trap that lesson names is the one this guard is
 * most exposed to: it measures an artifact, so a missing or unparseable artifact is the one
 * state it cannot judge and would otherwise report green. Every case below is a red the guard
 * must produce.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createRequire } from "module";

const require_ = createRequire(import.meta.url);
const guard = require_("../scripts/seat-roster-guard.cjs");
const { runRoster, renderFleet, renderTeam, parseSeats, cronKey, BEGIN_LOCAL, BEGIN_CCR, BEGIN_TEAM, END } = guard;

const NOW = Date.parse("2026-08-24T12:00:00Z");
const HEADER =
  "seatId\tdisplayName\tfleet\ttaskId\tcron\tfires\tcadence\twritesCode\tdefinitionPath\tstatus\tstatusReason\treviewBy\tproduces";

type Row = Partial<Record<string, string>>;

function row(over: Row = {}): string {
  const base: Record<string, string> = {
    seatId: "doc-accuracy",
    displayName: "Doc Accuracy",
    fleet: "local",
    taskId: "doc-accuracy-daily",
    cron: "30 19 * * *",
    fires: "19:33",
    cadence: "daily",
    writesCode: "docs only",
    definitionPath: "skills/doc-accuracy.md",
    status: "active",
    statusReason: "",
    reviewBy: "",
    produces: "one docs PR",
    ...over,
  };
  return HEADER.split("\t").map((c) => base[c] ?? "").join("\t");
}

/** Builds a self-consistent fixture repo, then lets a test corrupt exactly one thing. */
function fixture(rows: string[], opts: { freshness?: string; skipBlocks?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), "seat-roster-"));
  mkdirSync(join(root, "knowledge-base", "routines"), { recursive: true });
  mkdirSync(join(root, "skills"), { recursive: true });
  writeFileSync(join(root, "skills", "doc-accuracy.md"), "# def\n");

  const freshness = opts.freshness ?? "2026-08-24";
  const seats = join(root, "knowledge-base", "routines", "SEATS.tsv");
  writeFileSync(
    seats,
    `# > **Registry read:** last verified ${freshness} · review every 7 days\n\n${HEADER}\n${rows.join("\n")}\n`,
  );

  const parsed = parseSeats([HEADER, ...rows].join("\n")).rows;
  const charter = join(root, "knowledge-base", "routines", "CHARTER.md");
  const team = join(root, "knowledge-base", "routines", "TEAM.md");
  const block = (begin: string, body: string) => `${begin}\n\n${body}\n\n${END}\n`;
  writeFileSync(
    charter,
    opts.skipBlocks
      ? "# charter with no generated blocks\n"
      : block(BEGIN_LOCAL, renderFleet(parsed, "local", "Fires")) +
          "\n" +
          block(BEGIN_CCR, renderFleet(parsed, "ccr", "Fires (UTC)")),
  );
  writeFileSync(team, opts.skipBlocks ? "# team\n" : block(BEGIN_TEAM, renderTeam(parsed)));

  return {
    root,
    paths: { seats, charter, team, root, extensionDocs: [] as string[] },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

const run = (f: ReturnType<typeof fixture>, now = NOW) => runRoster(now, f.paths);
const msgs = (r: { failures: string[]; warnings: string[] }) => [...r.failures, ...r.warnings].join("\n");

describe("seat-roster-guard", () => {
  it("passes on a self-consistent roster", () => {
    const f = fixture([row()]);
    try {
      const r = run(f);
      expect(r.failures, msgs(r)).toEqual([]);
      expect(r.summary).toContain("1 seats");
    } finally {
      f.cleanup();
    }
  });

  // --- the no-input case must be loud, not green -------------------------------------

  it("FAILS when the manifest is absent entirely", () => {
    const f = fixture([row()]);
    try {
      rmSync(f.paths.seats);
      const r = run(f);
      expect(r.failures.join()).toMatch(/does not exist/);
    } finally {
      f.cleanup();
    }
  });

  it("FAILS on a manifest with a header and zero seats, rather than reporting a clean zero", () => {
    const f = fixture([]);
    try {
      const r = run(f);
      expect(r.failures.join()).toMatch(/parsed 0 seats/);
      expect(r.failures.join()).toMatch(/do not lower the bar/);
    } finally {
      f.cleanup();
    }
  });

  it("FAILS when a column is missing, instead of silently reading undefined", () => {
    const f = fixture([row()]);
    try {
      writeFileSync(f.paths.seats, "seatId\tdisplayName\nfoo\tFoo\n");
      const r = run(f);
      expect(r.failures.join()).toMatch(/missing column/);
    } finally {
      f.cleanup();
    }
  });

  // --- the four deliberate reds from the plan ----------------------------------------

  it("FAILS when a generated table is hand-edited away from the roster", () => {
    const f = fixture([row()]);
    try {
      const doc = require_("fs").readFileSync(f.paths.charter, "utf8");
      writeFileSync(f.paths.charter, doc.replace("Doc Accuracy", "Doc Accuracy (hand-edited)"));
      const r = run(f);
      expect(r.failures.join()).toMatch(/STALE/);
      expect(r.failures.join()).toMatch(/--write-table/);
    } finally {
      f.cleanup();
    }
  });

  it("FAILS when the generated block is missing from the document", () => {
    const f = fixture([row()], { skipBlocks: true });
    try {
      const r = run(f);
      expect(r.failures.join()).toMatch(/no generated block/);
    } finally {
      f.cleanup();
    }
  });

  it("FAILS when an active seat's definitionPath does not resolve", () => {
    const f = fixture([row({ definitionPath: "skills/does-not-exist.md" })]);
    try {
      const r = run(f);
      expect(r.failures.join()).toMatch(/does not exist/);
      expect(r.failures.join()).toMatch(/silent no-op/);
    } finally {
      f.cleanup();
    }
  });

  it("FAILS when the registry snapshot is past its review interval", () => {
    const f = fixture([row()], { freshness: "2026-08-01" });
    try {
      const r = run(f);
      expect(r.failures.join()).toMatch(/OVERDUE/);
      expect(r.failures.join()).toMatch(/list_scheduled_tasks/);
    } finally {
      f.cleanup();
    }
  });

  it("does NOT check freshness when --no-freshness is passed (the gate's mode)", () => {
    const f = fixture([row()], { freshness: "2026-01-01" });
    try {
      const r = runRoster(NOW, f.paths, { noFreshness: true });
      expect(r.failures, msgs(r)).toEqual([]);
    } finally {
      f.cleanup();
    }
  });

  it("FAILS when a living doc names a scheduled task the roster does not know", () => {
    const f = fixture([row()]);
    try {
      const orphan = join(f.root, "ORPHAN.md");
      writeFileSync(orphan, "see `~/.claude/scheduled-tasks/ghost-seat/SKILL.md` for details\n");
      const r = runRoster(NOW, { ...f.paths, extensionDocs: ["ORPHAN.md"] });
      expect(r.failures.join()).toMatch(/ghost-seat/);
      expect(r.failures.join()).toMatch(/absent from/);
    } finally {
      f.cleanup();
    }
  });

  it("ignores the _archive directory when sweeping for orphan seat names", () => {
    const f = fixture([row()]);
    try {
      const doc = join(f.root, "OK.md");
      writeFileSync(doc, "archived under `~/.claude/scheduled-tasks/_archive/` per §11\n");
      const r = runRoster(NOW, { ...f.paths, extensionDocs: ["OK.md"] });
      expect(r.failures, msgs(r)).toEqual([]);
    } finally {
      f.cleanup();
    }
  });

  // --- a pause must justify itself and expire ----------------------------------------

  it("FAILS a paused seat with no reason and no reviewBy", () => {
    const f = fixture([row({ status: "paused" })]);
    try {
      const r = run(f);
      expect(r.failures.join()).toMatch(/no statusReason/);
      expect(r.failures.join()).toMatch(/no reviewBy/);
    } finally {
      f.cleanup();
    }
  });

  it("WARNS once a pause is past its reviewBy — a premise that expired and nobody re-checked", () => {
    const f = fixture([row({ status: "paused", statusReason: "laptop capacity", reviewBy: "2026-08-10" })]);
    try {
      const r = run(f);
      expect(r.failures, msgs(r)).toEqual([]);
      expect(r.warnings.join()).toMatch(/reviewBy 2026-08-10 has passed/);
    } finally {
      f.cleanup();
    }
  });

  it("FAILS an unknown status rather than passing it through", () => {
    const f = fixture([row({ status: "sortof" })]);
    try {
      const r = run(f);
      expect(r.failures.join()).toMatch(/is not one of/);
    } finally {
      f.cleanup();
    }
  });

  it("FAILS a duplicate seatId", () => {
    const f = fixture([row(), row()]);
    try {
      const r = run(f);
      expect(r.failures.join()).toMatch(/duplicate seatId/);
    } finally {
      f.cleanup();
    }
  });

  // --- rendering ---------------------------------------------------------------------

  it("groups unregistered seats under their own heading, so a fossil cannot read as staffed", () => {
    const parsed = parseSeats(
      [HEADER, row(), row({ seatId: "evening-triage", displayName: "Evening Triage", taskId: "evening-triage", status: "unregistered", statusReason: "x", reviewBy: "2026-12-01" })].join("\n"),
    ).rows;
    const table = renderFleet(parsed, "local", "Fires");
    expect(table).toMatch(/Not registered — 1 definition\(s\) on disk/);
    expect(table).toMatch(/Evening Triage.*⛔ \*\*NO\*\*/s);
  });

  it("sorts daily before weekly before monthly, then by clock", () => {
    expect(cronKey("30 19 * * *")[0]).toBe(0);
    expect(cronKey("30 15 * * 6")[0]).toBe(1);
    expect(cronKey("35 9 1 * *")[0]).toBe(2);
    expect(cronKey("15 7 * * *")[2]).toBeLessThan(cronKey("30 19 * * *")[2]);
  });

  it("renders a TEAM chart whose Registered? column comes from the roster", () => {
    const parsed = parseSeats([HEADER, row({ status: "unregistered", statusReason: "x", reviewBy: "2026-12-01" })].join("\n")).rows;
    expect(renderTeam(parsed)).toMatch(/⛔ \*\*NO\*\*/);
  });
});
