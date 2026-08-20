#!/usr/bin/env node
/**
 * Is the pre-push gate actually armed in this clone?
 *
 * WHY THIS EXISTS. `.githooks/pre-push` is tracked, so it survives a reclone and every
 * worktree sees it — but git only runs it if `core.hooksPath` points there, and that
 * setting lives in `.git/config`, which is per-clone and NOT tracked. A fresh clone
 * therefore starts with the gate silently OFF.
 *
 * That was tolerable while CI was the real gate. It is not tolerable now: CI is down on
 * an Actions billing failure, `main` no longer requires a status check, and the pre-push
 * hook is the ONLY thing standing between a broken diff and `main`. An unarmed clone is
 * an unguarded one, and nothing would say so.
 *
 * Same failure shape as the silent skip this hook used to do, and as the routine
 * definitions that sat on disk unregistered: a control that is present but not wired is
 * not a control. Absence has to be loud.
 *
 * Offline and instant — reads git config and the filesystem, nothing else.
 */
const { execFileSync } = require("child_process");
const { existsSync } = require("fs");
const { join } = require("path");

const ROOT = join(__dirname, "..");
const FIX = "git config core.hooksPath .githooks";

function gitConfig(key) {
  try {
    return execFileSync("git", ["config", "--get", key], { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const problems = [];
const hooksPath = gitConfig("core.hooksPath");

if (hooksPath !== ".githooks") {
  problems.push(
    hooksPath
      ? `core.hooksPath is "${hooksPath}", not ".githooks" — the tracked gate is not the one git runs`
      : `core.hooksPath is unset — git is using .git/hooks, so the tracked pre-push gate never runs`,
  );
}

const hook = join(ROOT, ".githooks", "pre-push");
if (!existsSync(hook)) {
  problems.push(".githooks/pre-push is missing from this checkout");
}

if (problems.length) {
  console.error("pre-push gate is NOT armed in this clone:");
  for (const p of problems) console.error(`  - ${p}`);
  console.error("");
  console.error(`  fix:  ${FIX}`);
  console.error("");
  console.error("  This matters more than usual right now: CI is down and `main` has no");
  console.error("  required status check, so this hook is the only gate. Without it a push");
  console.error("  is checked by nothing at all, and nothing would tell you.");
  process.exit(1);
}

console.log("pre-push gate armed (core.hooksPath -> .githooks). ✅");
