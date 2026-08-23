#!/usr/bin/env node
/**
 * CHARTER §8 as enforcement, not prose. PreToolUse hook — see .claude/settings.json.
 *
 * knowledge-base/routines/CHARTER.md §8 ends with a list of things no routine and no
 * session may ever do: push to `main`, merge a PR, enable auto-merge, flip a
 * production variable, apply a migration to prod. §1b explains why they are graded
 * L3 — "a rail the machine can relax for itself is not a rail" — and then the whole
 * list was enforced by asking nicely. Every one of them is one mistyped command from
 * a production deploy, because every merge to `main` deploys (CLAUDE.md).
 *
 * This hook is the difference between a rule and a control. It blocks the command
 * and prints the reason and the sanctioned alternative, so the block teaches rather
 * than just refusing.
 *
 * WHAT IT IS NOT. It is a string check on a shell command. A determined session can
 * write the same action a way this does not match, and it never sees the GitHub MCP
 * tools' equivalents (those are blocked by a second matcher in settings.json, by tool
 * name). It is a floor under §8, not a replacement for reading it — and it is
 * deliberately narrow: a rail that fires on innocent commands gets switched off, and
 * a switched-off rail protects nothing.
 *
 * THE ESCAPE HATCH IS A HUMAN, ON PURPOSE. There is no flag, no env var and no
 * "--i-really-mean-it". The founder merges in the GitHub UI or their own terminal;
 * neither goes through this hook. If a session believes it needs one of these, the
 * answer §8 already gives is: the report plus its notification IS the page.
 */
const RULES = [
  {
    // A bare `git push` from main, or any push naming main as its destination.
    test: (cmd, branch) =>
      /\bgit\s+push\b/.test(cmd) &&
      (/\borigin\s+(HEAD:)?main\b/.test(cmd) ||
        /:main\b/.test(cmd) ||
        (branch === "main" && !/\borigin\s+\S/.test(cmd))),
    why: "CHARTER §8: no session pushes to `main`. Every merge to main is a production deploy.",
    instead: "Push your branch (`git push -u origin <branch>`) and open a PR. The founder merges.",
  },
  {
    test: (cmd) => /\bgh\s+pr\s+merge\b/.test(cmd) || /enablePullRequestAutoMerge/.test(cmd),
    why: "CHARTER §1b (L3) + §8: merging a PR is a production deploy, and it is the founder's click.",
    instead: "Leave the PR green and reviewable, and say in your report that it is ready.",
  },
  {
    test: (cmd) => /\bgh\s+pr\b[^\n]*--auto\b/.test(cmd),
    why: "CHARTER §8: auto-merge is especially forbidden — an `--auto` armed in one session fires the moment Actions recovers, turning 'just get CI to run' into a deploy.",
    instead: "Nothing. Wait for CI; report the result.",
  },
  {
    test: (cmd) => /\bdb:push\b/.test(cmd) || /\bdrizzle-kit\s+push\b/.test(cmd),
    why: "CLAUDE.md + CHARTER §10: `db:push` against the shared dev database drops columns belonging to other branches.",
    instead: "Hand-author `migrations/NNNN_*.sql` + a `migrations/meta/_journal.json` entry in the same PR, then `pnpm db:migrate`.",
  },
  {
    test: (cmd) => /\bdb:migrate:prod\b/.test(cmd) || /migrate-prod\.cjs/.test(cmd),
    why: "CHARTER §8: no session applies a migration to prod. The `migrate-prod` CI job does it on merge.",
    instead: "Land the migration in the PR; CI applies it. To pre-flight, run the workflow with `dry_run: true` — and read what that proves (CLAUDE.md).",
  },
  {
    test: (cmd) => /\bgit\s+add\s+(-A\b|--all\b|\.(\s|$))/.test(cmd) || /\bgit\s+commit\s+-[a-z]*a/.test(cmd),
    why: "CHARTER §8 / radar R3: `git add` explicit paths only. This repo is worked by concurrent sessions; `-A` sweeps up a peer's uncommitted work.",
    instead: "`git add <each file explicitly>`.",
  },
  {
    test: (cmd) => /\bgit\s+push\b[^\n]*(--force(?!-with-lease)|\s-f\b)/.test(cmd),
    why: "CHARTER §5: never force-push a branch. On someone else's branch it destroys their checkout.",
    instead: "Merge the base in additively. If history really must be rewritten on a branch only you own, `--force-with-lease` and say so.",
  },
  {
    // `git checkout <ref> -- .` overwrites the entire working tree, not the file
    // you meant to read. LESSONS.md 2026-08-12: it cost a working tree.
    test: (cmd) => /\bgit\s+(checkout|restore)\b[^\n]*\s--\s+\.(\s|$)/.test(cmd),
    why: "LESSONS.md 2026-08-12: a pathspec checkout of `.` overwrites the whole working tree, including peers' uncommitted work.",
    instead: "`git show <ref>:<path>` to read a file at a ref.",
  },
  {
    test: (cmd) => /\brailway\b[^\n]*\bvariables\b[^\n]*(--set|--kv)\b/.test(cmd),
    why: "CHARTER §8: no session flips a production variable. That includes INTAKE_PAUSED — the report plus its notification IS the page.",
    instead: "Hand the founder §8's verbatim runbook block.",
  },
];

/**
 * Commands that cannot DO any of the above, only talk about them. Without this the
 * hook blocks `grep -n db:push package.json` — and it did exactly that on its own
 * first test run, on the harness that was testing it. A rail that fires while you
 * read the repo is a rail someone turns off by the end of the day.
 */
const READ_ONLY = new Set([
  "grep", "rg", "egrep", "fgrep", "cat", "bat", "echo", "printf", "head", "tail",
  "less", "more", "wc", "sort", "uniq", "comm", "diff", "cut", "tr", "jq", "ls",
  "find", "which", "man",
]);

/**
 * Split into simple commands and drop quoted text before matching, so a blocked
 * string inside a commit message, a heredoc body, a `node -e` program or a search
 * pattern is what it is — text — while `node scripts/migrate-prod.cjs` (unquoted,
 * and `node` deliberately NOT read-only) still trips.
 */
function executableSegments(command) {
  // Strip quotes BEFORE splitting, never after: a quoted string may itself contain
  // `&&` or `|`, and splitting first cuts it in half, leaving an unbalanced fragment
  // that no longer looks quoted. (That is not hypothetical — it is why this hook's
  // own test matrix was blocked by the rule it was testing.) The trade: something
  // like `bash -c "git push origin main"` reads as text and is not caught. Accepted
  // — see the header. This is a floor, not a sandbox.
  return command
    .replace(/'[^']*'/g, " ")
    .replace(/"[^"]*"/g, " ")
    .split(/\n|&&|\|\||;|\|/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => {
      const first = /^([A-Za-z0-9_.\/-]+)/.exec(s.replace(/^\S+=\S+\s+/g, ""));
      return !first || !READ_ONLY.has(first[1].split("/").pop());
    });
}

/**
 * The whole decision, as a pure function: which §8 rail (if any) a command trips.
 * Exported so tests/routineGovernance.test.ts can pin every rule and — the half
 * that actually rots — every innocent command that must still get through.
 */
function decide(command, branch) {
  if (typeof command !== "string" || !command.trim()) return null;
  for (const segment of executableSegments(command)) {
    const hit = RULES.find((r) => r.test(segment, branch));
    if (hit) return hit;
  }
  return null;
}

module.exports = { RULES, executableSegments, decide };

if (require.main !== module) return;

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0); // Never block on our own parse failure.
  }
  const cmd = input?.tool_input?.command;
  if (typeof cmd !== "string" || !cmd.trim()) process.exit(0);

  let branch = "";
  try {
    branch = require("child_process")
      .execSync("git rev-parse --abbrev-ref HEAD", {
        cwd: input.cwd || process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      })
      .trim();
  } catch {
    /* not a repo, or git unavailable — the branch-sensitive rule just won't fire */
  }

  const hit = decide(cmd, branch);
  if (!hit) process.exit(0);

  const reason = `Blocked by CHARTER §8 (.claude/hooks/charter-rails.cjs).\n\n${hit.why}\n\nInstead: ${hit.instead}`;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    })
  );
  process.stderr.write(reason + "\n");
  process.exit(2);
});
