#!/usr/bin/env node
/**
 * Living-doc freshness guard — run by `npm run checkup`.
 *
 * The regulatory ledger already refuses to let a statutory constant go stale
 * (scripts/regulatory-freshness.cjs). Prose had no such rule, and it showed:
 * ASSUMPTIONS.md — the file whose entire job is separating fact from
 * assumption — went a month without a verification pass while the code moved
 * hundreds of commits. A register of facts that nobody re-checks stops being a
 * register of facts.
 *
 * So the same discipline applies to the docs that make CLAIMS ABOUT THE
 * PRESENT: L1/L2, the governance registers, the open decisions. Each carries
 *
 *   > **Freshness:** last verified YYYY-MM-DD · review every N days
 *
 * and this guard FAILS (exit 1) when one is overdue, naming what to re-check.
 *
 * Deliberately NOT covered: knowledge-base/logs/, research/ and archive/.
 * Those are dated, immutable snapshots (TEAM_PRACTICES §2) — a log is not
 * stale, it is history. Only living docs are tracked, and a doc is opted in by
 * adding the line, so this never becomes a tax on writing one.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const KB = path.join(ROOT, "knowledge-base");

/**
 * Docs REQUIRED to carry a freshness line. These make present-tense claims
 * that decisions get made on; going stale is a correctness problem, not
 * untidiness. Adding a doc here without the line fails the guard.
 */
const REQUIRED = [
  "L1_VISION_AND_SCOPE.md",
  "L2_COMPLIANCE_AND_LOGIC.md",
  "governance/ASSUMPTIONS.md",
  "governance/CHANNEL_DECISION.md",
  "governance/CONTINGENT_LIABILITY_REGISTER.md",
  "governance/UNCONSUMED_CAPABILITIES.md",
  // Added 2026-08-18. Its two predecessors were adopted 2026-07-14 and never re-read: by
  // 2026-08-18 the PageShell adoption figure had drifted 57% -> 82%, three primitives were
  // described as future work five weeks after they shipped, and the elevation rule was still
  // justified by Tailwind v3 semantics on a v4 project. The merged standard is opted in so that
  // cannot happen silently again.
  "handbook/design/DESIGN_SYSTEM.md",
  // Added 2026-08-18 with the doc. It makes present-tense claims that money gets spent on —
  // comp ranges, hire order, which roles are deferred, which founder decisions are still open.
  "governance/HIRING_PLAN.md",
  // Added 2026-08-23. The handoff corpus shipped (#692/#696) with a freshness line on all 28
  // of its files and NOTHING enforcing any of them — the README's own rule 1 says "every
  // file carries" the line, and this guard had never heard of the directory. FACTS.md is the
  // one that bites: its 44 rows are command-derived numbers re-stamped against `main`, on a
  // 14-day interval, and `--check` was already red on 6377727e (F-13, F-31, F-36 moved). The
  // README (60 days) is the corpus's front door and names the refresh loop.
  "handoff/README.md",
  "handoff/FACTS.md",
];

const LINE = /\*\*Freshness:\*\*\s*last verified\s*(\d{4}-\d{2}-\d{2})\s*·\s*review every\s*(\d+)\s*days/;

const DAY = 24 * 3600 * 1000;
const now = Date.now();

let failures = 0;
let dueSoon = 0;
const checked = [];

for (const rel of REQUIRED) {
  const abs = path.join(KB, rel);
  if (!fs.existsSync(abs)) {
    console.log(`FAIL  ${rel}: listed as a living doc but the file is missing.`);
    failures += 1;
    continue;
  }

  const match = fs.readFileSync(abs, "utf8").match(LINE);
  if (!match) {
    console.log(
      `FAIL  ${rel}: no freshness line. Add:\n` +
        `      > **Freshness:** last verified YYYY-MM-DD · review every N days`,
    );
    failures += 1;
    continue;
  }

  const verified = new Date(`${match[1]}T00:00:00Z`).getTime();
  const interval = Number(match[2]);
  if (isNaN(verified) || !Number.isFinite(interval) || interval <= 0) {
    console.log(`FAIL  ${rel}: unparseable freshness line ("${match[0]}").`);
    failures += 1;
    continue;
  }

  const ageDays = Math.floor((now - verified) / DAY);
  const overdueBy = ageDays - interval;
  checked.push(rel);

  if (overdueBy > 0) {
    console.log(
      `FAIL  ${rel}: OVERDUE ${overdueBy}d (last verified ${match[1]}, review every ${interval}d)\n` +
        `      → re-read it against the code, correct what drifted, then bump the date.`,
    );
    failures += 1;
  } else if (overdueBy > -7) {
    console.log(`SOON  ${rel}: due in ${-overdueBy}d`);
    dueSoon += 1;
  }
}

if (failures === 0) {
  console.log(
    `doc-freshness-guard: ${checked.length} living docs verified within interval` +
      (dueSoon > 0 ? ` (${dueSoon} due within 7 days)` : "") + ". ✅",
  );
  process.exit(0);
}

console.log(
  `\n${failures} living doc(s) need a verification pass. A doc that asserts present-tense ` +
    `facts and has not been re-read is a doc people trust wrongly.`,
);
process.exit(1);
