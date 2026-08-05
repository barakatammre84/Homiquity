import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { describe, it, expect } from "vitest";

// -----------------------------------------------------------------------------
// A query that fails must not render as an empty state (finding ux-01).
//
// The pattern this catches:
//
//   const { data: items = [], isLoading } = useQuery(...)
//   ...
//   items.length === 0 ? <EmptyState title="No referred clients yet" /> : ...
//
// On an API failure `data` stays at its `= []` default, so the page confidently
// tells the user they have nothing — no deals, no sessions, zero active pricing
// matrices — when in fact nothing loaded. On a mortgage product that is not a
// cosmetic problem: an empty escalation desk reads as an all-clear, and a "0
// active matrices" tile reads as a published state rather than an outage.
//
// The fix is already built: `QueryErrorState` (early-return banner + retry) and
// `QueryBoundary` (render-prop wrapper) in client/src/components/ui/query-boundary.tsx.
//
// This is a RATCHET, not a clean-slate rule. Plenty of surfaces still swallow
// errors and converting them all at once would be a large, risky diff; the count
// below may only go DOWN. Fix a page, lower the number.
// -----------------------------------------------------------------------------

const REPO_ROOT = join(__dirname, "..");
const PAGES = join(REPO_ROOT, "client", "src", "pages");

/**
 * Pages that both (a) render an empty/zero state derived from query data and
 * (b) have no error branch. Lower this as pages are converted — never raise it.
 */
const BASELINE_UNGUARDED = 8;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

/** Does the file react to a query failing at all? */
const HANDLES_ERROR = /isError|QueryErrorState|QueryBoundary|\.error\b/;
/** Does it default query data to an empty container? */
const EMPTY_DEFAULT = /=\s*\[\]|=\s*\{\}/;
/** Does it render something that asserts emptiness to the user? */
const CLAIMS_EMPTY =
  /No [A-Za-z' ]*(yet|found|available)|isEmpty|length === 0|length > 0 \?/;

function unguardedPages(): string[] {
  const hits: string[] = [];
  for (const file of sourceFiles(PAGES)) {
    const src = readFileSync(file, "utf8");
    if (!src.includes("useQuery")) continue;
    if (HANDLES_ERROR.test(src)) continue;
    if (!EMPTY_DEFAULT.test(src)) continue;
    if (!CLAIMS_EMPTY.test(src)) continue;
    hits.push(relative(REPO_ROOT, file));
  }
  return hits.sort();
}

describe("query failure never renders as an empty state (ux-01)", () => {
  it("does not grow the set of pages that show an empty state on error", () => {
    const unguarded = unguardedPages();
    expect(
      unguarded.length,
      `${unguarded.length} pages render an empty/zero state with no error branch ` +
        `(baseline ${BASELINE_UNGUARDED}). A new one means a failed load will tell ` +
        `the user they have nothing instead of that it broke. Use QueryErrorState ` +
        `from @/components/ui/query-boundary, or lower BASELINE_UNGUARDED if you ` +
        `fixed one.\n\n${unguarded.join("\n")}`,
    ).toBeLessThanOrEqual(BASELINE_UNGUARDED);
  });

  it("keeps the baseline honest — tighten it once pages are fixed", () => {
    // Stops the number from rotting upward-of-reality: if the real count drops
    // below the baseline, the baseline must come down with it.
    const unguarded = unguardedPages();
    expect(
      unguarded.length,
      `Only ${unguarded.length} pages are unguarded but BASELINE_UNGUARDED is ` +
        `${BASELINE_UNGUARDED}. Lower the baseline to ${unguarded.length} to lock the gain in.`,
    ).toBe(BASELINE_UNGUARDED);
  });

  it("the surfaces converted in this pass stay converted", () => {
    // Named explicitly so a later refactor can't quietly drop the error branch
    // on the pages whose zeros were most misleading.
    const converted = [
      "client/src/pages/realtor-engine/DealRescue.tsx",
      "client/src/pages/realtor-engine/StrategySessions.tsx",
      "client/src/pages/agent-broker/AgentPipeline.tsx",
      "client/src/pages/staff/PricingMatrices.tsx",
    ];
    for (const rel of converted) {
      const src = readFileSync(join(REPO_ROOT, rel), "utf8");
      expect(src, `${rel} lost its QueryErrorState`).toMatch(/QueryErrorState/);
    }
  });
});
