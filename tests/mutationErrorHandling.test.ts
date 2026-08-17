import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { describe, it, expect } from "vitest";

// -----------------------------------------------------------------------------
// A mutation that fails must not fail silently (the sibling of ux-01).
//
// tests/queryErrorHandling.test.ts covers the READ side: a failed query
// rendering as an empty state. This covers the WRITE side, which is worse,
// because the user believes they changed something:
//
//   const m = useMutation({ mutationFn: ..., onSuccess: ... })   // no onError
//
// On failure `onSuccess` never runs, so whatever it did — close the dialog,
// show the toast, latch the control — does not happen either. The user is left
// with a screen that looks exactly like "nothing submitted yet". Five live
// instances were fixed in the commit that added this file, and the worst of
// them was a borrower recording a savings deposit toward their down payment.
//
// TWO WAYS TO SATISFY THIS, both legitimate:
//   1. an `onError` callback in the mutation options, or
//   2. reading the mutation's own error state declaratively —
//      `{m.isError && <Alert…>}` — which is the better shape for a panel that
//      already has somewhere to put the message.
//
// (2) is why this test resolves each mutation's VARIABLE NAME and looks for
// `<name>.isError` / `<name>.error` in the file. Without that,
// loanOptions/WhatIfPanel.tsx reads as unguarded when it is not, and "fixing"
// it would stack a redundant toast on top of an existing inline alert. That was
// a real false positive found while writing this — the same class the query
// ratchet documents in its own history.
//
// This is a ratchet: the number may only go DOWN.
// -----------------------------------------------------------------------------

const REPO_ROOT = join(__dirname, "..");
const PAGES = join(REPO_ROOT, "client", "src", "pages");

/**
 * Mutations whose failure reaches the user through neither route.
 *
 * 6 → 0: the five silent writes (GapCalculator goal edit, SavingsVaultTab
 * deposit, TaskDetail document verdict, AICoach action-item toggle, FAQ
 * feedback) each gained an onError; WhatIfPanel was never in the set — it
 * already renders `runMutation.isError` as an Alert and only looked unguarded
 * to a detector that ignored the declarative route.
 *
 * Raising this number is not a fix. If a mutation genuinely does not need to
 * report failure, say why here and add it to ALLOWED below rather than moving
 * the baseline.
 */
const BASELINE_UNGUARDED = 0;

/** Mutations exempt on purpose, each with a stated reason. */
const ALLOWED: { file: string; reason: string }[] = [];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Every `useMutation({...})` block, with the const it was assigned to. */
function mutationBlocks(src: string): { name: string | null; body: string; line: number }[] {
  const out: { name: string | null; body: string; line: number }[] = [];
  const re = /(?:const\s+(\w+)\s*=\s*)?useMutation\s*(?:<[^>]*>)?\s*\(\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const open = src.indexOf("{", m.index + m[0].length - 1);
    let depth = 0;
    for (let j = open; j < src.length; j++) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") {
        depth--;
        if (depth === 0) {
          out.push({
            name: m[1] ?? null,
            body: src.slice(open, j + 1),
            line: src.slice(0, open).split("\n").length,
          });
          break;
        }
      }
    }
  }
  return out;
}

function unguardedMutations(): string[] {
  const hits: string[] = [];
  for (const file of sourceFiles(PAGES)) {
    const src = readFileSync(file, "utf8");
    if (!src.includes("useMutation")) continue;
    for (const { name, body, line } of mutationBlocks(src)) {
      if (body.includes("onError")) continue;
      // Declarative handling counts: the file reads this mutation's error state.
      if (name && new RegExp(`\\b${name}\\.(isError|error)\\b`).test(src)) continue;
      const rel = relative(REPO_ROOT, file);
      if (ALLOWED.some(a => a.file === rel)) continue;
      hits.push(`${rel}:${line} (${name ?? "anonymous"})`);
    }
  }
  return hits.sort();
}

describe("a failed mutation must reach the user", () => {
  it("has no mutation whose failure is invisible", () => {
    const hits = unguardedMutations();
    expect(
      hits.length,
      hits.length
        ? `Mutations with neither an onError nor a rendered error state:\n  ${hits.join("\n  ")}\n\n` +
          "Add an onError toast, or render <name>.isError near the control. " +
          "Do not raise BASELINE_UNGUARDED."
        : "",
    ).toBeLessThanOrEqual(BASELINE_UNGUARDED);
  });

  it("still finds the mutations it is supposed to be scanning", () => {
    // A detector that silently stops matching would pass forever. Pin that it
    // is looking at a real population.
    let total = 0;
    for (const file of sourceFiles(PAGES)) {
      const src = readFileSync(file, "utf8");
      if (src.includes("useMutation")) total += mutationBlocks(src).length;
    }
    expect(total).toBeGreaterThan(80);
  });

  it("counts a declaratively-handled mutation as guarded", () => {
    // Pins the false-positive fix: WhatIfPanel handles failure with an Alert on
    // runMutation.isError and must not be reported.
    const src = readFileSync(
      join(PAGES, "lending", "loanOptions", "WhatIfPanel.tsx"),
      "utf8",
    );
    const blocks = mutationBlocks(src);
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.every(b => b.body.includes("onError"))).toBe(false);
    expect(unguardedMutations().join("\n")).not.toContain("WhatIfPanel");
  });
});
