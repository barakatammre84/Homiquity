#!/usr/bin/env node
/**
 * The same §8 rail as charter-rails.cjs, one layer over: the GitHub MCP tools that
 * merge a PR or arm auto-merge without ever forming a shell command.
 *
 * charter-rails.cjs reads `tool_input.command`, so it is blind to these by
 * construction — a session with no `gh` CLI (every cloud session) reaches exactly
 * these tools instead. Blocking one path and not the other would be a rail that
 * depends on which machine the session happens to be running on.
 *
 * Registered against a tool-NAME matcher in settings.json, so it needs no argument
 * inspection: if it was invoked at all, the tool was one of the forbidden three.
 */
const reason = [
  "Blocked by CHARTER §8 (.claude/hooks/deny-merge-tools.cjs).",
  "",
  "Merging a PR — or arming auto-merge — is a production deploy on this repo, and CHARTER",
  "§1b grades it L3: the machine does everything except the click. Auto-merge is called out",
  "by name because an `--auto` armed in one session fires the moment Actions recovers.",
  "",
  "Instead: leave the PR green, reviewable and claimed, and say in your report that it is",
  "ready. The report plus its notification IS the page.",
].join("\n");

process.stdin.resume();
process.stdin.on("data", () => {});
process.stdin.on("end", () => {
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
