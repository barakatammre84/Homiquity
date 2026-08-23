import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const watch = require("../scripts/regulatory-watch.cjs");
const { runWatch, exitCodeFor, citationTokens, matchByTitle, emptyState, emptySignals } = watch;

/**
 * The regulatory change watcher, pinned at the four ways it lied on 2026-08-20.
 *
 * WHY THIS FILE EXISTS
 *
 * scripts/regulatory-watch.cjs is the Research state of the guideline loop: it
 * is the only thing watching whether the constants baked into the underwriting
 * engine still match the guidelines they came from. It had been silent since
 * 2026-07-04 and every gate stayed green, because a monitor that stops running
 * emits nothing to be wrong about.
 *
 * Each case below states what deleting it would let back through. They are all
 * the same shape — the repo's dominant defect class, an operation that did not
 * happen while the output says it did — and none of them touch the network:
 * fetch is injected, so this runs on a plane and cannot flake.
 */

const NOW = Date.parse("2026-08-20T12:00:00Z");

const LEDGER = [
  { id: "va-residual", citation: "VA Pamphlet 26-7, Chapter 4", codeRef: "server/services/underwritingNuance.ts", host: "benefits.va.gov" },
  { id: "regz-anti-steering", citation: "12 CFR 1026.36(e) (anti-steering)", codeRef: "server/services/antiSteeringOptions.ts", host: "consumerfinance.gov" },
  { id: "fnma-seasoning", citation: "Fannie Mae Selling Guide B3-3.5-01", codeRef: "server/services/underwritingNuance.ts", host: "selling-guide.fanniemae.com" },
];

const VA_SOURCE = {
  id: "va-circulars",
  label: "VA Home Loans circulars",
  url: "https://example.test/va",
  contentProbe: /circular\s+26-\d{2}-\d{1,2}/i,
};

const EMPTY_FR = JSON.stringify({ results: [] });

function baseArgs(overrides: Record<string, unknown> = {}) {
  return {
    now: NOW,
    state: emptyState(),
    signals: emptySignals(),
    ledgerIndex: LEDGER,
    sources: [VA_SOURCE],
    frUrl: "https://example.test/fr",
    fetchText: async () => EMPTY_FR,
    ...overrides,
  };
}

describe("a run that did not observe a source cannot report a clean one", () => {
  // WITHOUT THIS: the shipped bug returns — an unreachable source printed one
  // WARN line and the process exited 0 with "No regulatory changes detected
  // (4 pages + Federal Register)" while two of the four had been 403 for weeks.
  it("exits 3 and reports observed-of-configured when a page source is unreachable", async () => {
    const result = await runWatch(
      baseArgs({
        fetchText: async (url: string) => {
          if (url.includes("/fr")) return EMPTY_FR;
          throw new Error("HTTP 403");
        },
      }),
    );

    expect(result.complete).toBe(false);
    expect(result.observed).toBe(1);
    expect(result.configured).toBe(2);
    expect(exitCodeFor(result)).toBe(3);
    expect(result.problems[0]).toMatchObject({ id: "va-circulars", status: "unreachable" });
  });

  it("still exits 2 when a run is both incomplete and found a change — changes outrank", async () => {
    const state = emptyState();
    state.federalRegisterSeen = [];
    const result = await runWatch(
      baseArgs({
        state,
        fetchText: async (url: string) => {
          if (url.includes("/fr")) {
            return JSON.stringify({
              results: [{ document_number: "2026-1", title: "Regulation Z amendments", agencies: [{ name: "Consumer Financial Protection Bureau" }], publication_date: "2026-08-19", html_url: "https://example.test/doc" }],
            });
          }
          throw new Error("HTTP 403");
        },
      }),
    );

    expect(result.complete).toBe(false);
    expect(exitCodeFor(result)).toBe(2);
  });

  it("exits 0 only when every configured source was observed and nothing changed", async () => {
    const body = "<p>Circular 26-24-19</p>";
    const state = emptyState();
    // Seed the digest this body actually produces, so the run is genuinely quiet.
    state.pageHashes["va-circulars"] = watch.contentHash(watch.strip(body));

    const result = await runWatch(
      baseArgs({ state, fetchText: async (url: string) => (url.includes("/fr") ? EMPTY_FR : body) }),
    );

    expect(result.changes).toHaveLength(0);
    expect(result.complete).toBe(true);
    expect(result.observed).toBe(result.configured);
    expect(exitCodeFor(result)).toBe(0);
  });
});

describe("HTTP 200 is not an observation", () => {
  // WITHOUT THIS: the Freddie failure returns. guide.freddiemac.com answers 200
  // with an Oracle RightNow SPA shell; the bulletins are rendered by JS and
  // appear nowhere in the body. Hashing that shell yields the same digest
  // forever, so the watcher reported "no change" through every bulletin Freddie
  // published. A reachable source that proves nothing is WORSE than an
  // unreachable one, because it reports success.
  it("marks a body that cannot show its own evidence unusable, and refuses to hash it", async () => {
    const result = await runWatch(
      baseArgs({
        fetchText: async (url: string) =>
          url.includes("/fr") ? EMPTY_FR : "<html><body><nav>Guide Home</nav><script>renderEverything()</script></body></html>",
      }),
    );

    expect(result.problems[0]).toMatchObject({ id: "va-circulars", status: "unusable" });
    expect(result.complete).toBe(false);
    expect(exitCodeFor(result)).toBe(3);
  });

  it("drops a stored digest it can no longer attest to, so recovery re-baselines instead of faking a change", async () => {
    const state = emptyState();
    state.pageHashes["va-circulars"] = "hash-from-when-it-worked";

    await runWatch(
      baseArgs({
        state,
        fetchText: async (url: string) => {
          if (url.includes("/fr")) return EMPTY_FR;
          throw new Error("HTTP 403");
        },
      }),
    );

    expect(state.pageHashes["va-circulars"]).toBeUndefined();
    expect(state.sources["va-circulars"]).toMatchObject({ status: "unreachable", lastSuccess: null, consecutiveFailures: 1 });
  });
});

describe("signals are durable and are not re-emitted", () => {
  // WITHOUT THIS: a change becomes a stdout line again — printed once, lost when
  // the terminal scrolls, never reaching the intake queue. Or worse, re-emitted
  // every run so the queue fills with the same row and reviewers learn to skip it.
  it("does not re-emit a Federal Register document already in the signal file", async () => {
    const signals = emptySignals();
    signals.signals.push({ id: "fr-2026-1", status: "dismissed", dismissedReason: "not our product" });

    const result = await runWatch(
      baseArgs({
        signals,
        fetchText: async (url: string) =>
          url.includes("/fr")
            ? JSON.stringify({
                results: [{ document_number: "2026-1", title: "Regulation Z amendments", agencies: [{ name: "Consumer Financial Protection Bureau" }], publication_date: "2026-08-19", html_url: "https://example.test/doc" }],
              })
            : "<p>Circular 26-24-19</p>",
      }),
    );

    // The change is still reported to the operator...
    expect(result.changes.some((c: string) => c.includes("Regulation Z"))).toBe(true);
    // ...but a dismissed row is never resurrected as a new signal.
    expect(result.newSignals.find((s: { id: string }) => s.id === "fr-2026-1")).toBeUndefined();
  });
});

describe("ledger candidates are matched, never guessed", () => {
  // WITHOUT THIS: the field degrades in one of two directions, both useless — an
  // agency-wide dump (the first run emitted 24 ids for a CFPB Request for
  // Information that named no section), or an inferred match that sends someone
  // to re-verify a constant the notice never touched.
  it("resolves a Federal Register title that names a CFR section to that ledger entry", () => {
    const rule = { authority: /12\s*CFR|Regulation\s*[BVZX]/i, hosts: ["consumerfinance.gov"] };
    const { ids } = matchByTitle(LEDGER, rule, "Amendments to 1026.36 anti-steering provisions");
    expect(ids).toEqual(["regz-anti-steering"]);
  });

  it("returns nothing for a broad notice rather than every entry under the agency", () => {
    const rule = { authority: /12\s*CFR|Regulation\s*[BVZX]/i, hosts: ["consumerfinance.gov"] };
    const { ids, tokens } = matchByTitle(LEDGER, rule, "Request for Information Regarding Promoting Access to Mortgage Credit");
    expect(tokens).toEqual([]);
    expect(ids).toEqual([]);
  });

  it("emits [] plus a blast radius for a broad notice — asserted on the SIGNAL, not just the matcher", async () => {
    // Testing matchByTitle alone let a mutation survive: swapping the emitted
    // field back to the agency-wide match kept every other case green. The
    // contract is what lands in the signal row, so assert there.
    const result = await runWatch(
      baseArgs({
        fetchText: async (url: string) =>
          url.includes("/fr")
            ? JSON.stringify({
                results: [{ document_number: "2026-99", title: "Request for Information Regarding Promoting Access to Mortgage Credit", agencies: [{ name: "Consumer Financial Protection Bureau" }], publication_date: "2026-08-19", html_url: "https://example.test/doc" }],
              })
            : "<p>Circular 26-24-19</p>",
      }),
    );

    const signal = result.newSignals.find((s: { id: string }) => s.id === "fr-2026-99");
    expect(signal.ledgerCandidates).toEqual([]);
    expect(signal.authorityScope).toMatchObject({ entriesUnderThisAuthority: 1 });
    expect(signal.authorityScope.note).toContain("names no CFR section");
  });

  it("matches a publication page to every entry under that authority — the page IS the channel", async () => {
    const state = emptyState();
    state.pageHashes["va-circulars"] = "stale";
    const result = await runWatch(
      baseArgs({
        state,
        fetchText: async (url: string) => (url.includes("/fr") ? EMPTY_FR : "<p>Circular 26-24-19</p>"),
      }),
    );
    const signal = result.newSignals.find((s: { source: string }) => s.source === "va-circulars");
    expect(signal.ledgerCandidates).toEqual(["va-residual"]);
  });

  it("extracts only citations a title states explicitly", () => {
    expect(citationTokens("Amendments to Regulation Z and 1026.43 ability-to-repay")).toEqual(["1026.43", "Regulation Z"]);
    expect(citationTokens("Promoting Access to Mortgage Credit")).toEqual([]);
  });
});

describe("the watcher going silent is itself detected", () => {
  // WITHOUT THIS: the original failure returns in full. The watcher stopped on
  // 2026-07-04 and nothing noticed for 47 days. This is the check that would
  // have caught it, and it runs offline inside `pnpm checkup`.
  const runFreshness = (state: unknown) => {
    const dir = mkdtempSync(join(tmpdir(), "regwatch-"));
    const file = join(dir, "state.json");
    writeFileSync(file, JSON.stringify(state));
    const opts = { env: { ...process.env, REGULATORY_WATCH_STATE_PATH: file }, encoding: "utf8" as const };
    try {
      return { code: 0, out: execFileSync("node", ["scripts/regulatory-freshness.cjs"], opts) };
    } catch (err) {
      const e = err as { status: number; stdout: string };
      return { code: e.status, out: e.stdout };
    }
  };

  // Assert on the watcher lines, not the exit code: the real ledger shares this
  // process and an unrelated overdue entry would make every code check pass for
  // the wrong reason.
  // Keeps each FAIL line WITH its indented continuation — the remediation text
  // lives on the second line, and dropping it hid a real assertion.
  const watcherFails = (out: string) => {
    const lines = out.split("\n");
    const blocks: string[] = [];
    lines.forEach((line, i) => {
      if (!line.startsWith("FAIL  regulatory-watch")) return;
      const cont: string[] = [];
      for (let j = i + 1; j < lines.length && lines[j].startsWith("    "); j += 1) cont.push(lines[j]);
      blocks.push([line, ...cont].join("\n"));
    });
    return blocks;
  };
  const watcherWarns = (out: string) => out.split("\n").filter((l) => l.startsWith("WARN  regulatory-watch"));

  it("fails when the watcher has not run inside the limit", () => {
    const { out } = runFreshness({
      lastRun: "2026-07-04T07:12:30.608Z",
      sources: {},
      pageHashes: {},
      federalRegisterSeen: [],
    });
    expect(watcherFails(out).join("\n")).toContain("last ran");
  });

  it("fails on a NEW blocked source — a coverage regression must be impossible to sit on", () => {
    const { out } = runFreshness({
      lastRun: "2026-08-20T12:00:00.000Z",
      sources: {
        "va-circulars": { status: "unreachable", lastSuccess: null, consecutiveFailures: 9, lastError: "HTTP 403" },
      },
      pageHashes: {},
      federalRegisterSeen: [],
    });
    const fails = watcherFails(out).join("\n");
    expect(fails).toContain("regulatory-watch/va-circulars");
    expect(fails).toContain("NEW coverage regression");
  });

  it("only warns on an acknowledged gap — a permanently-red gate is one people learn to skip", () => {
    // Fannie, Freddie and FHA are bot-walled or JS-rendered; only a subscription
    // fixes them. Failing forever would bury the case that IS actionable.
    const { out } = runFreshness({
      lastRun: "2026-08-20T12:00:00.000Z",
      acknowledgedBlocked: {
        "fha-mortgagee-letters": { since: "2026-08-20", reason: "HTTP 403 bot wall", procurement: "FHA INFO emails" },
      },
      sources: {
        "fha-mortgagee-letters": { status: "unreachable", lastSuccess: null, consecutiveFailures: 9, lastError: "HTTP 403" },
      },
      pageHashes: {},
      federalRegisterSeen: [],
    });
    expect(watcherFails(out)).toHaveLength(0);
    expect(watcherWarns(out).join("\n")).toContain("acknowledged 2026-08-20: FHA INFO emails");
  });
});
