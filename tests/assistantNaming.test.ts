import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

/**
 * The assistant has ONE name in user-visible copy: Homi.
 *
 * This exists because the name drifted mid-journey and nothing noticed. The home
 * page was rebuilt around "Homi", while the page it links to still said "Your AI
 * Homebuyer Coach", the sidebar said "AI Coach", and the footer said "Homiquity
 * Coach" — four names for one assistant, on the path a visitor walks in a single
 * session. The full suite stayed green through all of it, because no test asserted
 * the product's own name anywhere.
 *
 * Scope is every line that is not a route, a testid, or an import — comments
 * included, deliberately. A comment still pointing at "the AI coach" is a stale
 * reference to a thing that no longer has that name, and letting those rot is how
 * the next author learns the wrong name and puts it back on a screen.
 *
 * What is NOT renamed: the `/ai-coach` route, the `AICoach.tsx` module,
 * `data-testid`s and the `coach*` identifiers. Those are contracts and internal
 * names; churning them costs links and tests for no user-visible gain.
 */

/**
 * Names the assistant has actually been called in shipped copy. This is a
 * VOCABULARY list, not a semantic check — it can only catch spellings someone
 * has already thought of, exactly like the §9 security guard's PII vocabulary.
 * "readiness assistant" was invisible to the first version of this list and
 * greeted every first-time chatter with a fifth name; a journey walker found it,
 * the suite could not. When a new one turns up, add it here.
 */
const BANNED = [
  "AI Coach",
  "AI Homebuyer Coach",
  "Homiquity Coach",
  "AI coach",
  "readiness assistant",
];

/**
 * Source files that can render user-visible strings.
 *
 * 🚨 The pathspec is a DIRECTORY list, not a `**` glob, and that is load-bearing.
 * `git ls-files "client/src/**\/*.tsx"` matches **zero top-level files** — verify
 * with `git ls-files "client/src/**\/*.tsx" | grep -c '^client/src/[^/]*\.tsx$'`,
 * which returns 0 while `git ls-files client/src/App.tsx` returns 1. The first
 * version of this guard used that glob, so `App.tsx` and `main.tsx` sat outside a
 * check that claimed to cover the client. A journey walker found it, not the suite.
 *
 * `shared/` is in scope for the same reason `server/` is: the assistant is named
 * in comments and copy there too, and the first version omitted it entirely while
 * four stale references sat in `shared/readinessMapping.ts`, `shared/intakeClearable.ts`,
 * `shared/schema/lendingCore.ts` and `shared/schema/ai.ts`.
 */
function userVisibleSourceFiles(): string[] {
  return execFileSync("git", ["ls-files", "client/src", "shared", "server"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."));
}

describe("assistant naming", () => {
  it("uses one name for the assistant in every user-visible string", () => {
    const offenders: string[] = [];

    for (const file of userVisibleSourceFiles()) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        // Routes, testids and imports are contracts, not copy.
        if (/href=|data-testid|from ["']|import /.test(line)) return;
        for (const banned of BANNED) {
          if (line.includes(banned)) offenders.push(`${file}:${i + 1}  ${line.trim().slice(0, 90)}`);
        }
      });
    }

    expect(offenders, `The assistant is called Homi. Found other names:\n${offenders.join("\n")}`)
      .toEqual([]);
  });

  it("actually calls the assistant Homi on the surfaces that introduce it", () => {
    // A guard that only forbids the old name would pass on copy that names the
    // assistant nothing at all.
    for (const file of [
      "client/src/pages/public/Landing.tsx",
      "client/src/components/CoachPromptBar.tsx",
      "client/src/components/coach/WelcomeState.tsx",
    ]) {
      expect(readFileSync(file, "utf8")).toContain("Homi");
    }
  });
});
