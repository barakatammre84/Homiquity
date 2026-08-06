import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join, relative } from "path";
import { describe, it, expect } from "vitest";

// -----------------------------------------------------------------------------
// `format(new Date(x), ...)` must not be called on a value that can be absent.
//
// Two failure modes, both measured against the date-fns version this repo pins:
//
//   x = null       -> new Date(null) is the epoch. Renders "Jan 1, 1970" with no
//                     error at all. This is the dangerous one: a confident,
//                     wrong date where the honest answer is "we don't have one".
//                     On an adverse-action notice date (FCRA timing) or a
//                     closing-guarantee target, that is a falsified record.
//   x = undefined  -> RangeError: Invalid time value, thrown during render, which
//   x = ""            unmounts everything up to the nearest error boundary. One
//                     missing timestamp in one table row blanks the whole card.
//
// TypeScript does not catch either. Every site this guard was written for typed
// its field as a non-optional `string` in a local interface while the backing
// column is nullable — 138 of the `created_at` columns in shared/schema are
// `.defaultNow()` WITHOUT `.notNull()` — and two silenced the compiler with `!`.
//
// The fix is client/src/lib/dates.ts: formatDateSafe / formatDistanceToNowSafe,
// which take the same pattern and return a fallback instead of lying or
// throwing. An explicit truthiness guard at the call site is equally fine and is
// what InviteTable already does.
//
// Baseline is 0 and must stay 0 — unlike the inert-button ratchet, this one has
// no residue to work down, so there is nothing to justify raising it.
// -----------------------------------------------------------------------------

const REPO_ROOT = join(__dirname, "..");
const CLIENT_SRC = join(REPO_ROOT, "client", "src");

const BASELINE_UNGUARDED_DATES = 0;

/** date-fns entry points that throw or silently accept the epoch. */
const RISKY_CALL = /\b(format|formatDistanceToNow|formatDistance|formatRelative)\(\s*new Date\(([^)]*)\)/g;

/**
 * How far back a truthiness check may sit and still cover the call. InviteTable
 * opens `{invite.expiresAt ? (` thirteen lines above the call it protects,
 * because a Tooltip/TooltipTrigger pair sits in between. Fifteen clears that
 * with room to spare; the regex is keyed to the specific expression being
 * formatted, so a check on that same expression within fifteen lines really is
 * the guard rather than a coincidence.
 */
const GUARD_WINDOW = 15;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

export function unguardedDateFormats(): string[] {
  const hits: string[] = [];
  for (const file of sourceFiles(CLIENT_SRC)) {
    const src = readFileSync(file, "utf8");
    const lines = src.split("\n");
    for (const match of src.matchAll(RISKY_CALL)) {
      const arg = match[2].trim();
      // `new Date()` is now, and a string literal is a fixed date. Neither can
      // be absent, so neither is at risk.
      if (arg === "" || /^["'`]/.test(arg)) continue;

      const lineNo = src.slice(0, match.index).split("\n").length;
      if (/^\s*(\/\/|\*|\/\*)/.test(lines[lineNo - 1])) continue;

      const root = arg.split(/[.[?!]/)[0];
      const leaf = arg.replace(/^.*\./, "").replace(/[!?]/g, "");
      // Only the source BEFORE the call can guard it, so the call's own text
      // cannot certify itself. Getting this wrong is not hypothetical: an
      // earlier draft accepted a bare ")" as evidence of a ternary, and the
      // closing paren of `new Date(x)` matched it — so every call site looked
      // guarded and the detector passed on a planted bug.
      const preceding = src.slice(0, match.index);
      const windowLines = preceding.split("\n");
      const window = windowLines.slice(Math.max(0, windowLines.length - 1 - GUARD_WINDOW)).join("\n");
      const escaped = arg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // A ternary, an && short-circuit, an optional chain, or an if() — on the
      // full expression, its leaf property, or its root object.
      const guarded = new RegExp(
        `${escaped}\\s*(\\?[^.]|&&)|\\)\\s*\\?|\\b${leaf}\\s*(\\?\\.|&&|\\?[^.])|if\\s*\\(\\s*!?\\s*${root}\\b`,
      );
      if (guarded.test(window)) continue;

      hits.push(`${relative(REPO_ROOT, file)}:${lineNo} — ${match[1]}(new Date(${arg}), …)`);
    }
  }
  return hits.sort();
}

describe("no date is formatted without a guard", () => {
  it("has no unguarded format(new Date(...)) call sites", () => {
    const unguarded = unguardedDateFormats();
    expect(
      unguarded.length,
      `${unguarded.length} date format call(s) can receive null/undefined.\n` +
        `null renders "Jan 1, 1970" silently; undefined and "" throw RangeError ` +
        `during render and unmount the subtree.\n` +
        `Use formatDateSafe / formatDistanceToNowSafe from @/lib/dates (same ` +
        `pattern argument, fallback instead of a wrong date), or guard the value ` +
        `at the call site.\n\n${unguarded.join("\n")}`,
    ).toBe(BASELINE_UNGUARDED_DATES);
  });

  it("the safe helpers are the ones actually being used", () => {
    // Guards against the guard being satisfied by deleting the dates rather
    // than by formatting them safely.
    const users = sourceFiles(CLIENT_SRC).filter((f) =>
      /from "@\/lib\/dates"/.test(readFileSync(f, "utf8")),
    );
    expect(users.length, "nothing imports @/lib/dates").toBeGreaterThanOrEqual(14);
  });

  it("the detector can actually fail", () => {
    // A green run proves nothing unless the detector is known to catch the
    // thing it exists for. This ran red first: a planted unguarded call slipped
    // through, because the guard pattern accepted a bare ")" and the closing
    // paren of `new Date(x)` supplied one. The assertion below is what caught
    // that, so it stays.
    const before = unguardedDateFormats().length;
    const target = join(CLIENT_SRC, "pages/agent-broker/AgentPipeline.tsx");
    const original = readFileSync(target, "utf8");
    try {
      writeFileSync(
        target,
        original.replace(
          `formatDateSafe(item.lastUpdatedAt, "MMM d, yyyy")`,
          `format(new Date(item.lastUpdatedAt), "MMM d, yyyy")`,
        ),
      );
      const after = unguardedDateFormats();
      expect(after.length, "planted unguarded call was not detected").toBe(before + 1);
      expect(after.join("\n")).toMatch(/AgentPipeline\.tsx:\d+ — format/);
    } finally {
      writeFileSync(target, original);
    }
  });

  it("does not flag calls that are already guarded", () => {
    // InviteTable opens `{invite.expiresAt ? (` thirteen lines above the call
    // it protects. Reporting that would train people to ignore this test.
    const flagged = unguardedDateFormats().join("\n");
    expect(flagged).not.toMatch(/InviteTable/);
  });
});
