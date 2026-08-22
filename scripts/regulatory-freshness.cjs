#!/usr/bin/env node
/**
 * Regulatory ledger freshness check — run by `pnpm checkup`. Reads data/regulatory/regulatory-ledger.json and FAILS (exit 1) when any
 * statutory constant has not been re-verified against its official source
 * within its review interval. Going stale is invisible by default; this makes
 * it a loud, actionable failure with the source URL to check.
 *
 * Also verifies the codeRef file for each entry still exists, so the ledger
 * can't silently drift from the codebase it documents.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, "data/regulatory/regulatory-ledger.json"), "utf8"));

const now = Date.now();
const DAY = 24 * 3600 * 1000;
let failures = 0;
let dueSoon = 0;

for (const entry of ledger.entries) {
  const verified = new Date(entry.lastVerified + "T00:00:00Z").getTime();
  if (isNaN(verified)) {
    console.log(`FAIL  ${entry.id}: invalid lastVerified date "${entry.lastVerified}"`);
    failures += 1;
    continue;
  }

  const ageDays = Math.floor((now - verified) / DAY);
  const overdueBy = ageDays - entry.reviewIntervalDays;

  // codeRef may list several "path CONSTANT" pairs separated by , or ;
  const codeFiles = entry.codeRef
    .split(/[;,]/)
    .map((part) => part.trim().split(" ")[0])
    .filter((p) => p.includes("/"));
  const missing = codeFiles.filter((f) => !fs.existsSync(path.join(ROOT, f)));
  if (missing.length > 0) {
    console.log(`FAIL  ${entry.id}: codeRef file missing (${missing.join(", ")}) — ledger drifted from codebase`);
    failures += 1;
    continue;
  }

  if (overdueBy > 0) {
    console.log(
      `FAIL  ${entry.id}: OVERDUE ${overdueBy}d (last verified ${entry.lastVerified}, interval ${entry.reviewIntervalDays}d)\n` +
        `      → verify "${entry.rule}" against ${entry.sourceUrl}\n` +
        `      → then update lastVerified in data/regulatory/regulatory-ledger.json`,
    );
    failures += 1;
  } else if (overdueBy > -14) {
    console.log(`SOON  ${entry.id}: due in ${-overdueBy}d — ${entry.citation}`);
    dueSoon += 1;
  }
}

// --- The watcher itself ----------------------------------------------------
// A ledger entry going stale was already loud. The WATCHER going silent was
// not: scripts/regulatory-watch.cjs last ran 2026-07-04 and nothing noticed for
// 47 days, because a monitor that stops running produces no output to be wrong.
// These two checks are deliberately OFFLINE — they read the committed state
// file, so they belong in `pnpm checkup` while the network-touching watcher
// itself does not (a gate that needs the internet fails on a plane).
// Path is overridable so tests can prove the FAILING direction — a guard only
// ever asserted in its passing state is a guard nobody has tested.
const WATCH_STATE = process.env.REGULATORY_WATCH_STATE_PATH || path.join(ROOT, "data/regulatory/regulatory-watch-state.json");
const WATCH_SILENT_AFTER_DAYS = 10;
const SOURCE_BLOCKED_AFTER_DAYS = 14;

if (!fs.existsSync(WATCH_STATE)) {
  console.log("FAIL  regulatory-watch: no state file — the change watcher has never run (`pnpm reg:watch:save`)");
  failures += 1;
} else {
  const watch = JSON.parse(fs.readFileSync(WATCH_STATE, "utf8"));
  const lastRun = watch.lastRun ? Date.parse(watch.lastRun) : NaN;
  if (isNaN(lastRun)) {
    console.log("FAIL  regulatory-watch: state file has no usable lastRun — cannot prove the watcher runs");
    failures += 1;
  } else {
    const silentFor = Math.floor((now - lastRun) / DAY);
    if (silentFor > WATCH_SILENT_AFTER_DAYS) {
      console.log(
        `FAIL  regulatory-watch: last ran ${silentFor}d ago (limit ${WATCH_SILENT_AFTER_DAYS}d)\n` +
          "      → run `pnpm reg:watch:save`, then `pnpm reg:triage` for anything it finds",
      );
      failures += 1;
    }
  }

  // A source that stopped producing evidence is a coverage hole, and coverage
  // holes are why the watcher could report a clean run it never had. But three
  // of the five are bot-walled or JS-rendered and only a subscription fixes
  // them — failing on those forever would make this gate noise, and a gate
  // people learn to skip stops catching the case that IS actionable. So it
  // ratchets: an acknowledged gap WARNs, a NEW one FAILs.
  const acknowledged = watch.acknowledgedBlocked ?? {};
  for (const [id, s] of Object.entries(watch.sources ?? {})) {
    if (s.status === "ok") continue;
    const blockedFor = s.lastSuccess ? Math.floor((now - Date.parse(s.lastSuccess)) / DAY) : null;
    if (blockedFor !== null && blockedFor < SOURCE_BLOCKED_AFTER_DAYS) continue;

    const evidence = blockedFor === null ? "has never produced evidence" : `no evidence for ${blockedFor}d`;
    const ack = acknowledged[id];
    if (ack) {
      console.log(`WARN  regulatory-watch/${id}: ${s.status}, ${evidence} — acknowledged ${ack.since}: ${ack.procurement}`);
      continue;
    }
    console.log(
      `FAIL  regulatory-watch/${id}: ${s.status} — ${evidence} (${s.lastError ?? "no error recorded"})\n` +
        "      → NEW coverage regression. Fix the source, or record it under acknowledgedBlocked in\n" +
        "        data/regulatory/regulatory-watch-state.json with the procurement path that replaces it.",
    );
    failures += 1;
  }
}

if (failures === 0) {
  console.log(
    `Regulatory ledger fresh: ${ledger.entries.length} entries verified within interval; change watcher live` +
      (dueSoon > 0 ? ` (${dueSoon} due for review within 14 days)` : ""),
  );
  process.exit(0);
}
console.log(`\n${failures} regulatory ledger entr${failures === 1 ? "y" : "ies"} need verification.`);
process.exit(1);
