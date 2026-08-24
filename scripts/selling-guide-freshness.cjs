#!/usr/bin/env node
/**
 * Selling Guide watch liveness — run by `pnpm checkup`. Reads the COMMITTED
 * watch state (data/regulatory/selling-guide-watch-state.json) and FAILS when
 * the watcher has gone silent, a source or host is blocked without a recorded
 * acknowledgment, or the link ledger no longer covers the inventory.
 *
 * Deliberately OFFLINE, like scripts/regulatory-freshness.cjs whose rules this
 * mirrors: a monitor that stops running produces no output to be wrong about
 * (the sibling watcher went silent 47 days with every gate green), so liveness
 * is checked from the committed state file — a gate that needs the internet
 * fails on a plane. Thresholds are the sibling's (10d silent / 14d blocked),
 * and deliberately not tighter: this state only advances on `main` when
 * steward PRs merge, so tighter numbers would measure founder review latency,
 * not watcher health.
 *
 * The acknowledgedBlocked ratchet, verbatim from the sibling's doctrine: an
 * acknowledged gap WARNs (known procurement ask — for the fanniemae hosts the
 * recorded path is the founder allowlisting *.fanniemae.com in the environment
 * network settings), while a NEW one FAILs. A permanently-red gate is one
 * people learn to skip; a new coverage regression must be impossible to sit on.
 *
 * Paths env-overridable so tests can prove the FAILING directions — a guard
 * only ever asserted in its passing state is a guard nobody has tested.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const WATCH_SILENT_AFTER_DAYS = 10;
const SOURCE_BLOCKED_AFTER_DAYS = 14;
/**
 * The steward's own liveness, which is a DIFFERENT question from the watcher's.
 *
 * `lastRun` in the watch state proves the WATCHER ran. Nothing proved the STEWARD
 * ran — and on 2026-08-24 that gap bit on the seat's very first firing: the CCR
 * scheduler advanced `next_run_at` from 08-24 to 08-25 without ever dispatching a
 * session. No session, no branch, no report, no PR, and every gate still green.
 * Manually firing the same trigger minutes later spawned a session immediately, so
 * the seat and its skill were fine; only the scheduled path failed, silently.
 *
 * Two facts from that morning are why this check reads the REPORT and not an API:
 *   - `list_triggers` never populates `last_run` (empty for all 25 triggers, including
 *     ones that provably ran), so its absence is not evidence of anything.
 *   - A consumed cron slot is indistinguishable from a completed one from the outside.
 * The artifact is the only honest proof, which is CHARTER §7: a routine that cannot be
 * shown to have run is not a control.
 *
 * ⚠️ BE HONEST ABOUT WHAT THIS MEASURES. It is offline (it reads the committed tree), so
 * it cannot see a draft PR — it sees a report only once that PR MERGES. So it measures
 * "landed steward evidence", which folds the seat's health together with review latency.
 * That is deliberate rather than sloppy: a report nobody merged for a week is also a
 * control nobody can point at. But it is why the numbers are NOT the aggressive 2/4 the
 * first draft of this check used — 2 days fails across any ordinary weekend, and a guard
 * that cries wolf on Saturdays is one people learn to skip, which is the exact failure
 * the sibling watcher's ratchet exists to avoid. 3 warns; 7 — a full week with nothing
 * landed from a daily seat — fails.
 */
const STEWARD_REPORT_WARN_DAYS = 3;
const STEWARD_REPORT_FAIL_DAYS = 7;
const DAY = 24 * 3600 * 1000;

function defaultPaths() {
  return {
    state:
      process.env.SELLING_GUIDE_WATCH_STATE_PATH ||
      path.join(ROOT, "data/regulatory/selling-guide-watch-state.json"),
    links: process.env.SG_LINKS_PATH || path.join(ROOT, "docs/fannie-mae/selling-guide/links.json"),
    reports:
      process.env.SG_REPORTS_DIR || path.join(ROOT, "knowledge-base/routines/reports"),
  };
}

/**
 * Newest `<date>-selling-guide-steward.md`, by the date IN THE FILENAME rather than
 * mtime — a fresh clone rewrites every mtime, and this must answer the same way on any
 * machine. Returns { name, date } or null.
 */
function newestStewardReport(reportsDir) {
  if (!fs.existsSync(reportsDir)) return null;
  const rows = fs
    .readdirSync(reportsDir)
    .map((n) => /^(\d{4}-\d{2}-\d{2})-selling-guide-steward\.md$/.exec(n))
    .filter(Boolean)
    .map((m) => ({ name: m[0], date: Date.parse(`${m[1]}T00:00:00Z`) }))
    .filter((r) => !isNaN(r.date))
    .sort((a, b) => b.date - a.date);
  return rows[0] ?? null;
}

/** Returns { failures: string[], warnings: string[], summary: string } */
function runFreshness(now = Date.now(), paths = defaultPaths()) {
  const failures = [];
  const warnings = [];

  if (!fs.existsSync(paths.state)) {
    return {
      failures: [
        "selling-guide-watch: no state file — the edition/link watcher has never run (`pnpm sg:watch:save`)",
      ],
      warnings,
      summary: "",
    };
  }
  let state;
  try {
    state = JSON.parse(fs.readFileSync(paths.state, "utf8"));
  } catch (e) {
    return { failures: [`selling-guide-watch: state file unreadable — ${e.message}`], warnings, summary: "" };
  }

  const lastRun = state.lastRun ? Date.parse(state.lastRun) : NaN;
  if (isNaN(lastRun)) {
    failures.push("selling-guide-watch: state has no usable lastRun — cannot prove the watcher runs");
  } else {
    const silentFor = Math.floor((now - lastRun) / DAY);
    if (silentFor > WATCH_SILENT_AFTER_DAYS) {
      failures.push(
        `selling-guide-watch: last ran ${silentFor}d ago (limit ${WATCH_SILENT_AFTER_DAYS}d) — ` +
          "run `pnpm sg:watch:save` (the selling-guide-steward routine does this daily)",
      );
    }
  }

  const acknowledged = state.acknowledgedBlocked ?? {};
  const ackFor = (id, host) => acknowledged[id] || (host ? acknowledged[`host:${host}`] : undefined);

  // Edition sources: blocked long enough becomes WARN (acknowledged) or FAIL (new).
  for (const [id, s] of Object.entries(state.sources ?? {})) {
    if (s.status === "ok") continue;
    const blockedFor = s.lastSuccess ? Math.floor((now - Date.parse(s.lastSuccess)) / DAY) : null;
    if (blockedFor !== null && blockedFor < SOURCE_BLOCKED_AFTER_DAYS) continue;
    const evidence = blockedFor === null ? "has never produced evidence" : `no evidence for ${blockedFor}d`;
    const ack = ackFor(id);
    if (ack) {
      warnings.push(`selling-guide-watch/${id}: ${s.status}, ${evidence} — acknowledged ${ack.since}: ${ack.procurement}`);
    } else {
      failures.push(
        `selling-guide-watch/${id}: ${s.status} — ${evidence} (${s.lastError ?? "no error recorded"})\n` +
          "      → NEW coverage regression. Fix the source, or record it under acknowledgedBlocked in\n" +
          "        data/regulatory/selling-guide-watch-state.json with the procurement path that replaces it.",
      );
    }
  }

  // Blocked hosts: same ratchet, keyed host:<host>.
  for (const [host, reach] of Object.entries(state.hostReachability ?? {})) {
    if (reach !== "blocked") continue;
    const ack = ackFor(`host:${host}`, null) || acknowledged[`host:${host}`];
    if (ack) {
      warnings.push(`selling-guide-watch host ${host}: blocked — acknowledged ${ack.since}: ${ack.procurement}`);
    } else {
      failures.push(
        `selling-guide-watch host ${host}: blocked with no acknowledgedBlocked["host:${host}"] entry — ` +
          "NEW coverage regression; record it with its procurement path (for fanniemae hosts: the " +
          "founder network allowlist).",
      );
    }
  }

  // Ledger completeness: every probeable URL in links.json has an observation row.
  // A URL with no row was never even attempted — that is silent coverage loss, not
  // a blocked host (blocked hosts still get host-blocked rows).
  if (fs.existsSync(paths.links)) {
    try {
      const links = JSON.parse(fs.readFileSync(paths.links, "utf8"));
      const probeable = Object.entries(links.external ?? {}).filter(([, e]) => e.class === "ok");
      const missing = probeable.filter(([url]) => !(state.links ?? {})[url]);
      if (missing.length > 0) {
        failures.push(
          `selling-guide-watch: ${missing.length} of ${probeable.length} probeable Guide links have no ` +
            `observation row (first: ${missing[0][0].slice(0, 80)}) — the sweep is not covering the inventory`,
        );
      }
    } catch (e) {
      failures.push(`selling-guide-watch: links.json unreadable — ${e.message}`);
    }
  }

  // The steward's own liveness — see the constants' header for the 2026-08-24 incident
  // this exists for. Honours the same acknowledgedBlocked ratchet as everything else, so
  // a deliberate pause is recordable under `steward` rather than sitting permanently red.
  const stewardAck = acknowledged.steward;
  const report = newestStewardReport(paths.reports);
  if (!report) {
    const msg =
      "selling-guide-steward: NO run report has ever landed " +
      "(knowledge-base/routines/reports/<date>-selling-guide-steward.md) — the seat has never " +
      "been shown to run. A scheduled slot that advances without dispatching looks identical to " +
      "a healthy one from the outside; the report is the only proof (CHARTER §7).";
    if (stewardAck) warnings.push(`${msg} — acknowledged ${stewardAck.since}: ${stewardAck.procurement}`);
    else failures.push(msg);
  } else {
    const ageDays = Math.floor((now - report.date) / DAY);
    if (ageDays > STEWARD_REPORT_FAIL_DAYS || ageDays > STEWARD_REPORT_WARN_DAYS) {
      const msg =
        `selling-guide-steward: newest LANDED run report is ${report.name} (${ageDays}d old) — ` +
        `the seat runs daily, so either it stopped or its PRs are not being merged. Check the ` +
        `trigger actually fired: on 2026-08-24 the scheduler advanced next_run_at without ` +
        `dispatching a session, and no gate anywhere went red.`;
      if (stewardAck) warnings.push(`${msg} — acknowledged ${stewardAck.since}: ${stewardAck.procurement}`);
      else if (ageDays > STEWARD_REPORT_FAIL_DAYS) failures.push(msg);
      else warnings.push(msg);
    }
  }

  const linkStates = Object.values(state.links ?? {});
  const summary =
    `steward report ${report ? `${report.name} (${Math.floor((now - report.date) / DAY)}d)` : "NONE"}, ` +
    `edition sources ${Object.keys(state.sources ?? {}).length}, link rows ${linkStates.length} ` +
    `(${linkStates.filter((l) => l.status === "ok").length} ok, ` +
    `${linkStates.filter((l) => l.status === "rot").length} rot, ` +
    `${linkStates.filter((l) => l.status === "denied").length} denied, ` +
    `${linkStates.filter((l) => l.status === "host-blocked").length} host-blocked), ` +
    `last run ${state.lastRun ?? "never"} on ${state.lastRunEnvironment ?? "unknown"}`;
  return { failures, warnings, summary };
}

function main() {
  const { failures, warnings, summary } = runFreshness();
  for (const w of warnings) console.log(`WARN  ${w}`);
  for (const f of failures) console.log(`FAIL  ${f}`);
  if (failures.length === 0) {
    console.log(`Selling Guide watch live: ${summary}` + (warnings.length ? ` — ${warnings.length} acknowledged gap(s)` : ""));
    process.exit(0);
  }
  console.log(`\n${failures.length} Selling Guide watch problem(s).`);
  process.exit(1);
}

module.exports = {
  runFreshness,
  defaultPaths,
  newestStewardReport,
  WATCH_SILENT_AFTER_DAYS,
  SOURCE_BLOCKED_AFTER_DAYS,
  STEWARD_REPORT_WARN_DAYS,
  STEWARD_REPORT_FAIL_DAYS,
};

if (require.main === module) main();
