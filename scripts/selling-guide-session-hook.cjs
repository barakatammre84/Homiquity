#!/usr/bin/env node
/**
 * SessionStart hook — the corpus-first rule made mechanical.
 *
 * CLAUDE.md's compliance block says every session starts at the Selling Guide; this
 * hook makes that true without anyone remembering it. At the start of every Claude
 * Code session (local and web) it verifies the tracked fact layer is coherent and the
 * extracted content layer is materialized, materializing it when it can (~3s — the
 * PDF recovers from this repo's own git history, no network). What it prints lands in
 * the session's context, so a broken or missing corpus greets the session as a loud
 * directive instead of being discovered mid-answer.
 *
 * THE HOOK INFORMS; THE CI GATE BLOCKS. This script always exits 0 — a session that
 * cannot materialize the corpus must still be able to open, because the session that
 * fixes the corpus is such a session. The merge-blocking enforcement lives in ci.yml's
 * three corpus steps; the hook's job is that no session does Guide-governed work
 * unaware. Registered in .claude/settings.json (SessionStart only — that file
 * deliberately carries no permissions: the untracked per-machine
 * settings.local.json permission layer must keep working unshadowed).
 *
 * Budget: coherent-and-present checkout ~milliseconds; absent content with pymupdf
 * installed ~3s; missing pymupdf, one bounded install attempt (60s cap), then extract;
 * anything else prints the directive and gets out of the session's way.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = process.env.CLAUDE_PROJECT_DIR || path.join(__dirname, "..");
const DIR = path.join(ROOT, "docs", "fannie-mae", "selling-guide");

function directive(reason) {
  return [
    "⛔ SELLING GUIDE CORPUS-FIRST — the corpus is not ready in this checkout.",
    `   ${reason}`,
    "   Fix before any Guide-governed work (underwriting, income, eligibility,",
    "   delivery, pricing policy):",
    "       pip3 install pymupdf && python3 scripts/extract-selling-guide.py",
    "   The PDF recovers from this repo's own git history — no network needed.",
    "   Do NOT answer a Fannie policy question from memory in the meantime; a",
    "   missing source is an honest gap (CLAUDE.md; TEAM_PRACTICES §10).",
  ].join("\n");
}

function run(cmd, args, timeoutMs) {
  return spawnSync(cmd, args, { cwd: ROOT, timeout: timeoutMs, encoding: "utf8" });
}

function contentPresent(guard) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(DIR, "manifest.json"), "utf8"));
    const want = manifest.structure && manifest.structure.leaf_sections;
    const sectionsDir = path.join(DIR, "extracted", "sections");
    if (!want || !fs.existsSync(sectionsDir)) return false;
    if (!fs.existsSync(path.join(DIR, "selling-guide-text.txt"))) return false;
    return fs.readdirSync(sectionsDir).filter((f) => f.endsWith(".txt")).length === want;
  } catch {
    return false;
  }
}

function pythonHasPymupdf() {
  const r = run("python3", ["-c", "import pymupdf"], 15000);
  return r.status === 0;
}

function extract() {
  return run("python3", [path.join(ROOT, "scripts", "extract-selling-guide.py")], 180000);
}

function main() {
  let guard;
  try {
    guard = require("./selling-guide-corpus-guard.cjs");
  } catch (e) {
    console.log(directive(`corpus guard unloadable: ${e.message}`));
    return;
  }

  let checks;
  try {
    checks = guard.runChecks();
  } catch (e) {
    console.log(directive(`corpus guard threw: ${e.message}`));
    return;
  }
  if (checks.inert) {
    // Corpus not on this branch at all — nothing to verify, nothing to demand.
    console.log("selling-guide corpus: not present on this branch (guard INERT).");
    return;
  }
  if (checks.errors.length) {
    console.log(directive(`tracked fact layer incoherent: ${checks.errors[0]}` +
      (checks.errors.length > 1 ? ` (+${checks.errors.length - 1} more — run pnpm guard:corpus)` : "")));
    return;
  }

  if (contentPresent(guard)) {
    console.log(
      `selling-guide corpus: ready — edition ${checks.facts.edition}, ` +
        `${checks.facts.sections} sections extracted, fact layer coherent. ` +
        `Guide-governed work starts at docs/fannie-mae/selling-guide/ (corpus-first).`,
    );
    return;
  }

  // Content layer absent (fresh clone) — materialize it if this machine can.
  if (!pythonHasPymupdf()) {
    let pin = "";
    try {
      pin = guard.parseExtractorConstants(path.join(ROOT, "scripts", "extract-selling-guide.py")).PYMUPDF_PINNED;
    } catch {
      /* directive below still stands without the pin */
    }
    const spec = pin ? `pymupdf==${pin}` : "pymupdf";
    // One bounded attempt, two flag shapes: PEP 668 machines need
    // --break-system-packages for a --user install; older pips reject the flag.
    let installed = false;
    for (const args of [
      ["-m", "pip", "install", "--user", "--break-system-packages", "-q", spec],
      ["-m", "pip", "install", "--user", "-q", spec],
    ]) {
      const r = run("python3", args, 60000);
      if (r.status === 0) {
        installed = true;
        break;
      }
    }
    if (!installed || !pythonHasPymupdf()) {
      console.log(directive("extracted content absent and pymupdf could not be installed here (60s budget)"));
      return;
    }
  }

  const r = extract();
  if (r.status === 0 && contentPresent(guard)) {
    const summary = (r.stdout || "").trim().split("\n")[0] || "";
    console.log(
      `selling-guide corpus: materialized for this session — ${summary}\n` +
        `Fact layer coherent (edition ${checks.facts.edition}). Corpus-first: Guide-governed ` +
        `work starts at docs/fannie-mae/selling-guide/.`,
    );
  } else {
    const err = ((r.stderr || r.stdout || "").trim().split("\n").pop() || "extractor failed").slice(0, 200);
    console.log(directive(`extraction failed: ${err}`));
  }
}

try {
  main();
} catch (e) {
  // Never block a session — the loudest acceptable failure is a printed directive.
  console.log(directive(`hook error: ${e.message}`));
}
process.exit(0);
