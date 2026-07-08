#!/usr/bin/env node
/**
 * Regulatory ledger freshness check — run by `npm run checkup` and the daily
 * guardian. Reads data/regulatory/regulatory-ledger.json and FAILS (exit 1) when any
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

if (failures === 0) {
  console.log(
    `Regulatory ledger fresh: ${ledger.entries.length} entries verified within interval` +
      (dueSoon > 0 ? ` (${dueSoon} due for review within 14 days)` : ""),
  );
  process.exit(0);
}
console.log(`\n${failures} regulatory ledger entr${failures === 1 ? "y" : "ies"} need verification.`);
process.exit(1);
