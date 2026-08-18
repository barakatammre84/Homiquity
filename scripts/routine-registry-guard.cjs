#!/usr/bin/env node
/**
 * Routine-registry guard (zero-dep) — `pnpm guard:routines`.
 *
 * Every other layer of this repo is machine-checked: schema↔migrations, design
 * tokens, the UI standard, query keys, the KB index, doc staleness, bundle size,
 * the §9 security review. The layer that governs the machine writing all of it —
 * the routine suite — was checked by prose alone. CHARTER §0 is what that costs:
 * five weeks of definitions describing each other as live peers while nothing ran,
 * and nothing noticed.
 *
 * §7 answers "did it run" from reports/. This guard answers the question one step
 * earlier and cheaper, at merge time:
 *
 *   1. Is every registered routine's definition readable by someone other than one
 *      laptop — or does it carry a dated waiver saying plainly that it is not?
 *   2. Is every routine SKILL.md in this repo actually registered? (A definition on
 *      disk that no scheduler runs is a fossil — CHARTER §11 — and a fossil that
 *      still reads as live is how §0 happened.)
 *   3. Do CHARTER §3's clock and the registry still agree on who exists?
 *   4. Does every report in reports/ belong to a routine anyone can name?
 *   5. Does every Claude-Code-Remote trigger that promises to invoke a repo skill
 *      point at a skill that exists?
 *
 * WHAT THIS GUARD CANNOT SEE (CHARTER §10: a guard only answers its own question).
 * It reads the repo and nothing else. It cannot see the scheduler, so it cannot
 * tell you a registered routine is really registered, that its cron is what this
 * file says, or that it ran. It cannot see list_triggers, so fleet-2 schedules here
 * are documentation, never verification — that is exactly why registry.json records
 * the fleet-2 *contract* (which skill a trigger must invoke) and not its clock.
 * Green means "the repo's own account of the suite is internally consistent".
 *
 *   pnpm guard:routines            structural checks only — safe for the merge gate
 *   pnpm guard:routines --strict   also fails on EXPIRED waivers (checkup + weekly)
 *
 * The split is deliberate, and it is the same reasoning that keeps
 * doc-freshness-guard out of `gate`: a calendar-driven failure inside the required
 * check blocks every merge in the repo on a day nobody's diff caused, with
 * enforce_admins leaving no bypass. Waiver expiry is a calendar fact. It surfaces
 * weekly and in `pnpm checkup`, where the right person sees it and no one's work
 * stops.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const REGISTRY = path.join(ROOT, "knowledge-base", "routines", "registry.json");
const CHARTER = path.join(ROOT, "knowledge-base", "routines", "CHARTER.md");
const SKILLS_DIR = path.join(ROOT, ".claude", "skills");
const REPORTS_DIR = path.join(ROOT, "knowledge-base", "routines", "reports");
const STRICT = process.argv.includes("--strict");
const TODAY = new Date().toISOString().slice(0, 10);

const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// ---------------------------------------------------------------- registry ---
if (!fs.existsSync(REGISTRY)) {
  console.error(`routine-registry-guard: ${path.relative(ROOT, REGISTRY)} is missing — the suite has no inventory.`);
  process.exit(1);
}
let registry;
try {
  registry = JSON.parse(fs.readFileSync(REGISTRY, "utf8"));
} catch (e) {
  console.error(`routine-registry-guard: registry.json does not parse: ${e.message}`);
  process.exit(1);
}
const routines = Array.isArray(registry.routines) ? registry.routines : null;
if (!routines || routines.length === 0) {
  console.error("routine-registry-guard: registry.json has no `routines` array.");
  process.exit(1);
}

const FLEETS = new Set(["local-scheduler", "claude-code-remote"]);
const seenIds = new Set();
for (const r of routines) {
  const where = `registry row ${r.id || "(no id)"}`;
  if (!r.id || !/^[a-z0-9][a-z0-9-]*$/.test(r.id)) fail(`${where}: missing or non-slug \`id\`.`);
  else if (seenIds.has(r.id)) fail(`${where}: duplicate id.`);
  else seenIds.add(r.id);
  if (!r.title) fail(`${where}: missing \`title\`.`);
  if (!FLEETS.has(r.fleet)) fail(`${where}: \`fleet\` must be one of ${[...FLEETS].join(", ")}.`);
  if (!r.definition) fail(`${where}: missing \`definition\` (a path, or laptop-only/pending/retired/trigger-prompt).`);
}

// ------------------------------------------------- definitions that exist ---
/** Skill files the registry claims, so check 2 can spot the ones it does not. */
const claimedSkillFiles = new Set();

for (const r of routines) {
  for (const key of ["definition", "invokes"]) {
    const value = r[key];
    if (!value || !value.startsWith(".claude/")) continue;
    claimedSkillFiles.add(value);
    const abs = path.join(ROOT, value);
    const exists = fs.existsSync(abs);

    if (!exists) {
      // A fleet-2 trigger may legitimately point at a skill whose founding PR has
      // not merged — it is written to say so and stop. That is a WARN with a
      // deadline, not a merge blocker. A row claiming `status: live` is a lie.
      if (r.status === "awaiting-definition" && key === "invokes") {
        const branch = r.awaiting?.branch ? ` (branch ${r.awaiting.branch})` : "";
        warn(`${r.id}: invokes ${value}, which does not exist yet${branch} — every firing is a no-op until it merges.`);
      } else {
        fail(`${r.id}: \`${key}\` points at ${value}, which does not exist.`);
      }
      continue;
    }

    // name-vs-directory: Claude Code resolves a skill by its directory; a
    // frontmatter name that disagrees is a skill that will not load where the
    // registry says it lives.
    const dir = path.basename(path.dirname(value));
    const src = fs.readFileSync(abs, "utf8");
    const fm = /^---\n([\s\S]*?)\n---/.exec(src);
    if (!fm) fail(`${value}: no YAML frontmatter block.`);
    else {
      const name = /^name:\s*(\S+)\s*$/m.exec(fm[1]);
      if (!name) fail(`${value}: frontmatter has no \`name:\`.`);
      else if (name[1] !== dir) fail(`${value}: frontmatter name \`${name[1]}\` != directory \`${dir}\`.`);
      if (!/^description:\s*\S/m.test(fm[1])) fail(`${value}: frontmatter has no \`description:\` — nothing tells Claude when to load it.`);
    }
    // CHARTER wins on conflict (its own §-preamble rule); a routine that never
    // names it cannot know that.
    if (!src.includes("CHARTER.md")) {
      fail(`${value}: never references CHARTER.md — the contract that wins over it (CHARTER preamble).`);
    }
  }

  // A definition nobody but one machine can read is allowed, but only out loud.
  if (r.definition === "laptop-only" || r.definition === "pending") {
    const w = r.waiver || r.awaiting;
    if (!w) fail(`${r.id}: definition is "${r.definition}" with no \`waiver\`/\`awaiting\` block — an undocumented invisible routine is CHARTER §0's failure mode.`);
    else {
      for (const field of ["since", "expires"]) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(w[field] || "")) fail(`${r.id}: waiver \`${field}\` must be a YYYY-MM-DD date.`);
      }
      if (!w.reason && !w.note) fail(`${r.id}: waiver states no reason.`);
      if (STRICT && /^\d{4}-\d{2}-\d{2}$/.test(w.expires || "") && w.expires < TODAY) {
        fail(`${r.id}: waiver expired ${w.expires} — commit the definition or re-date the waiver knowingly.`);
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(w.expires || "") && w.expires < TODAY) {
        warn(`${r.id}: waiver expired ${w.expires} (run with --strict to make this fatal).`);
      }
    }
  }
}

// ------------------------------------------------------- 2. no fossil skills ---
if (fs.existsSync(SKILLS_DIR)) {
  for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const rel = path.posix.join(".claude/skills", entry.name, "SKILL.md");
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const src = fs.readFileSync(abs, "utf8");
    // The routine skills self-identify with this phrase in their description; the
    // domain router skills (api-routes, ui-components, …) deliberately do not.
    if (!/scheduled autonomous routine/i.test(src)) continue;
    if (!claimedSkillFiles.has(rel)) {
      fail(`${rel} declares itself a scheduled autonomous routine but no registry.json row claims it — either register it or archive it (CHARTER §11).`);
    }
  }
}

// -------------------------------------------- 3. CHARTER §3 clock ↔ registry ---
const charter = fs.readFileSync(CHARTER, "utf8");
const clockStart = charter.indexOf("## 3. The clock");
if (clockStart === -1) {
  fail("CHARTER.md has no `## 3. The clock` section — the registry has nothing to agree with.");
} else {
  const clockEnd = charter.indexOf("\n## ", clockStart + 1);
  const clock = charter.slice(clockStart, clockEnd === -1 ? undefined : clockEnd);
  const norm = (s) => s.replace(/[-–—…]+$/g, "");
  // The wiring audit's taskId is written truncated in the clock — `…-…` — because
  // renaming it would discard its run history (CHARTER §3). Accept the ellipsis
  // and normalize it away rather than forcing a rename this guard would cause.
  const inClock = new Set(
    [...clock.matchAll(/\(`([a-z0-9][a-z0-9-…]*)`\)/g)].map((m) => norm(m[1]))
  );
  const registered = new Set(routines.filter((r) => r.fleet === "local-scheduler").map((r) => norm(r.id)));

  for (const r of routines) {
    if (r.fleet !== "local-scheduler" || r.retired) continue;
    if (!inClock.has(norm(r.id))) {
      fail(`${r.id}: registered as a scheduled routine but absent from CHARTER §3's clock — the clock is what peers read to reason about overlap.`);
    }
  }
  for (const id of inClock) {
    if (!registered.has(id)) {
      fail(`CHARTER §3 lists taskId \`${id}\`, which has no registry.json row.`);
    }
  }
}

// ------------------------------------------- 4. reports belong to a routine ---
const reportIds = new Set(routines.map((r) => r.reportId).filter(Boolean));
if (fs.existsSync(REPORTS_DIR)) {
  for (const file of fs.readdirSync(REPORTS_DIR)) {
    if (!file.endsWith(".md") || file === "README.md") continue;
    const m = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/.exec(file);
    if (!m) {
      fail(`reports/${file}: not <YYYY-MM-DD>-<routine-id>.md (CHARTER §9).`);
      continue;
    }
    if (!reportIds.has(m[2])) {
      fail(`reports/${file}: report id \`${m[2]}\` matches no routine's \`reportId\` — a report nobody can attribute is not proof of life.`);
    }
  }
}

// --------------------------------------------------- 5. cron collisions ------
const byCron = new Map();
for (const r of routines) {
  if (r.fleet !== "local-scheduler" || r.retired || !r.cron) continue;
  if (byCron.has(r.cron)) {
    fail(`${r.id} and ${byCron.get(r.cron)} share cron \`${r.cron}\` — CHARTER §3 keeps code-writing windows non-overlapping on purpose.`);
  } else byCron.set(r.cron, r.id);
}

// ------------------------------------------------------------------ output ---
const live = routines.filter((r) => !r.retired).length;
const waived = routines.filter((r) => r.definition === "laptop-only" || r.definition === "pending").length;

for (const w of warnings) console.log(`routine-registry-guard: WARN — ${w}`);
if (errors.length) {
  console.error(`\nroutine-registry-guard: ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  • ${e}`);
  console.error("\n  → CHARTER §11: adding, retiring or re-timing a routine edits registry.json, CHARTER §3 and the scheduler together.");
  process.exit(1);
}
console.log(
  `Routine registry OK: ${live} live routine(s), ${waived} with an unversioned-definition waiver, ` +
    `${warnings.length} warning(s)${STRICT ? " (strict)" : ""}. ✅`
);
