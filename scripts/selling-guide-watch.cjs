#!/usr/bin/env node
/**
 * Selling Guide edition & link watcher — probes the official Fannie Mae surfaces
 * for a new Guide edition or amendment, and sweeps the Guide's own 295 probeable
 * links (docs/fannie-mae/selling-guide/links.json) for rot, diffing against the
 * last-seen state committed in data/regulatory/selling-guide-watch-state.json.
 *
 *   node scripts/selling-guide-watch.cjs                 # report, exit per table below
 *   node scripts/selling-guide-watch.cjs --update-state  # also persist state + signals
 *
 * Sibling of scripts/regulatory-watch.cjs and built to its rules — a watcher this
 * repo already paid to calibrate: NEVER REPORT COVERAGE YOU DID NOT HAVE; HTTP 200
 * is not an observation (every page source carries a contentProbe and an unusable
 * fetch is never hashed); an unreachable source drops its stored hash so recovery
 * re-baselines instead of reporting the gap as a change; per-source status is
 * persisted so "this stopped working" is a fact in the state file. The two files
 * deliberately do not share state: different corpus, different seat, different
 * cadence (this one runs inside the daily selling-guide-steward). The
 * announcements page appears in both watchers' source lists — ownership of
 * GUIDE-EDITION consequences lives here; dedupe on the regulatory side is a
 * proposed ticket, not an edit to that seat's files.
 *
 * What is new here, forced by this environment:
 *
 *   PER-HOST SHORT-CIRCUIT, AND 403 IS NOT ROT. Measured in this sandbox
 *   (2026-08-23): curl gets HTTP 000 to fanniemae hosts, but Node fetch through
 *   the transparent agent proxy gets **HTTP 403 from the proxy itself** — a
 *   status indistinguishable from an origin bot wall. And even from the real
 *   origin, a 403 means access denied to THIS client, never that the resource
 *   is gone (Fannie's bot wall 403s automated UAs on links that work in any
 *   browser). So: rot is 404/410 ONLY; 401/403/429/451 are recorded as
 *   `denied` with no signal and no failure count; a connect-level failure
 *   blocks its host for the run immediately; and two denials on one host
 *   short-circuit the rest of that host's links (the first seed run burned
 *   this lesson: 293 proxy 403s came back labeled "rot" before this rule).
 *   Reachability is environment-dependent and has flipped before (CLAUDE.md's
 *   Reg Z lesson) — lastRunEnvironment records where each observation was made.
 *
 *   NEW-EDITION DETECTION IS A SHA, NOT A HASH DIFF. The Guide PDF endpoint's
 *   bytes are hashed and compared against manifest.json's pinned edition sha —
 *   a difference IS the next edition (or an in-place amendment), and the signal
 *   says so. Cutover stays human: the steward stages, the founder decides
 *   (docs/fannie-mae/selling-guide/README.md "When the next edition lands").
 *
 * Exit codes (same table as the sibling):
 *   0 = complete run, no changes        (every configured source observed)
 *   2 = changes detected                (outranks incompleteness — go look)
 *   3 = incomplete run, no changes      (>=1 source unreachable/unusable/blocked)
 *   1 = watcher error                   (the script itself failed)
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createHash } = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const STATE_PATH = path.join(ROOT, "data/regulatory/selling-guide-watch-state.json");
const SIGNALS_PATH = path.join(ROOT, "data/regulatory/selling-guide-watch-signals.json");
const LINKS_PATH = path.join(ROOT, "docs/fannie-mae/selling-guide/links.json");
const MANIFEST_PATH = path.join(ROOT, "docs/fannie-mae/selling-guide/manifest.json");
const UPDATE_STATE = process.argv.includes("--update-state");

const LINK_CONCURRENCY = 4;
const LINK_BATCH_DELAY_MS = 250;
/** Statuses that mean "access denied to this client", not "resource gone". */
const DENIED_STATUSES = new Set([401, 403, 429, 451]);
/** Statuses that are honest evidence the linked resource no longer exists. */
const ROT_STATUSES = new Set([404, 410]);
/** Consecutive denials on one host before the rest of its URLs are skipped. */
const HOST_DENY_THRESHOLD = 2;

/**
 * The edition surfaces. sg-pdf-download is the load-bearing one: its byte sha
 * against the manifest pin is the edition detector. The two HTML-edition pages
 * (landing + the founder-supplied Part B page) are content-hashed drift
 * detectors; the announcements page yields SEL-YYYY-NN amendment ids the way
 * the sibling's Federal Register source yields document numbers.
 */
const EDITION_SOURCES = [
  {
    id: "sg-pdf-download",
    label: "Selling Guide PDF endpoint",
    url: "https://singlefamily.fanniemae.com/media/document/pdf/selling-guide",
    kind: "pdf",
  },
  {
    id: "sg-html-landing",
    label: "Selling Guide HTML edition (landing)",
    url: "https://selling-guide.fanniemae.com/",
    kind: "page",
    contentProbe: /selling\s+guide/i,
  },
  {
    id: "sg-html-part-b",
    label: "Selling Guide HTML edition (Part B)",
    url: "https://selling-guide.fanniemae.com/sel/b/origination-through-closing",
    kind: "page",
    contentProbe: /origination\s+through\s+closing/i,
  },
  {
    id: "sg-announcements",
    label: "Selling Guide announcements",
    url: "https://singlefamily.fanniemae.com/selling-servicing-guide-communications",
    kind: "announcements",
    contentProbe: /announcement\s+sel-\d{4}-\d{2}/i,
  },
];

function hostOf(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

/** Connect-level failure (proxy refusal, DNS, timeout) vs a real HTTP status. */
function isConnectFailure(err) {
  return !/^HTTP \d{3}/.test(String(err && err.message));
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "HomiquityComplianceWatch/1.0 (guideline change monitoring)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchBytes(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "HomiquityComplianceWatch/1.0 (guideline change monitoring)" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Status probe for one inventory link: HEAD first (cheap for 295 URLs), GET on
 * the methods servers reject HEAD with. Returns the final HTTP status; throws
 * only on connect-level failure.
 */
async function probeUrl(url) {
  const opts = {
    headers: { "User-Agent": "HomiquityComplianceWatch/1.0 (guideline change monitoring)" },
    signal: AbortSignal.timeout(20_000),
    redirect: "follow",
  };
  let res = await fetch(url, { ...opts, method: "HEAD" });
  if ([405, 501, 403].includes(res.status)) {
    res = await fetch(url, { ...opts, method: "GET" });
    if (res.body && res.body.cancel) await res.body.cancel().catch(() => {});
  }
  return res.status;
}

function strip(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contentHash(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function emptyState() {
  return {
    $comment:
      "Last-seen state for scripts/selling-guide-watch.cjs (the Selling Guide edition & " +
      "link watcher — sibling of regulatory-watch-state.json, deliberately separate: " +
      "different corpus, different seat). Committed, so the observation history is " +
      "auditable. `sources`, `links`, `pageHashes`, `hostReachability`, " +
      "`announcementsSeen`, `lastRun*` are MACHINE-written by the watcher. " +
      "`acknowledgedBlocked` is HUMAN-authored and preserved across runs: it is the " +
      "ratchet — a blocked source or host listed there is a known procurement gap and " +
      "downgrades to WARN in scripts/selling-guide-freshness.cjs, while one missing " +
      "from it turns the checkup RED. That asymmetry is the point: a permanently-red " +
      "gate is one people learn to skip, but a NEW coverage regression must be " +
      "impossible to sit on. Keys may be a source id (sg-pdf-download) or a host " +
      "(host:selling-guide.fanniemae.com). The selling-guide-steward routine PROPOSES " +
      "entries in its report; only a human commits one. Reachability is environment-" +
      "dependent and has flipped before — lastRunEnvironment records where each " +
      "observation was made.",
    acknowledgedBlocked: {},
    announcementsSeen: [],
    pageHashes: {},
    hostReachability: {},
    links: {},
    sources: {},
    lastRun: null,
    lastRunEnvironment: null,
  };
}

function emptySignals() {
  return {
    $comment:
      "Durable queue of Selling Guide edition/amendment/link signals emitted by " +
      "scripts/selling-guide-watch.cjs. Append-only: a row is never deleted, only moved " +
      "new -> promoted | dismissed by a human (or a triage tool), so a dismissal stays " +
      "on the record. An edition-changed signal NEVER auto-cutovers the corpus: the " +
      "cutover runbook is docs/fannie-mae/selling-guide/README.md 'When the next " +
      "edition lands', and it is a founder decision.",
    signals: [],
  };
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback();
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`${path.relative(ROOT, file)} is not valid JSON: ${err.message}`);
  }
}

function recordSource(state, id, status, nowIso, error) {
  const prev = state.sources[id] ?? { lastSuccess: null, consecutiveFailures: 0 };
  state.sources[id] = {
    status,
    lastAttempt: nowIso,
    lastSuccess: status === "ok" ? nowIso : prev.lastSuccess ?? null,
    consecutiveFailures: status === "ok" ? 0 : (prev.consecutiveFailures ?? 0) + 1,
    lastError: status === "ok" ? null : error ?? null,
  };
}

/**
 * Record one link observation. host-blocked and denied are NOT failures of the
 * link — the resource was never actually observed (proxy policy, bot wall, rate
 * limit) — so neither bumps consecutiveFailures nor clears lastSuccess; they
 * stamp the attempt and, for denied, the status that denied it.
 */
function recordLink(state, url, outcome, nowIso, httpStatus) {
  const prev = state.links[url] ?? { lastSuccess: null, consecutiveFailures: 0 };
  if (outcome === "host-blocked" || outcome === "denied") {
    state.links[url] = {
      ...prev,
      status: outcome,
      lastAttempt: nowIso,
      httpStatus: httpStatus ?? null,
    };
    return;
  }
  const ok = outcome === "ok";
  state.links[url] = {
    status: outcome,
    httpStatus: httpStatus ?? null,
    lastAttempt: nowIso,
    lastSuccess: ok ? nowIso : prev.lastSuccess ?? null,
    consecutiveFailures: ok ? 0 : (prev.consecutiveFailures ?? 0) + 1,
  };
}

/**
 * The whole run, pure enough to test: every network function is injectable and
 * no file is written unless the caller persists. Returns what the CLI prints.
 */
async function runWatch({
  now,
  state,
  signals,
  links,
  manifestSha,
  fetchText: doFetchText,
  fetchBytes: doFetchBytes,
  probeUrl: doProbe,
  editionSources = EDITION_SOURCES,
  batchDelayMs = LINK_BATCH_DELAY_MS,
}) {
  const nowIso = new Date(now).toISOString();
  const changes = [];
  const newSignals = [];
  const problems = [];
  const hostBlocks = new Map(); // host -> first connect-level error message

  const addSignal = (row) => {
    if (signals.signals.some((s) => s.id === row.id)) return;
    if (newSignals.some((s) => s.id === row.id)) return;
    newSignals.push(row);
  };

  const markHostBlocked = (host, err) => {
    if (!hostBlocks.has(host)) hostBlocks.set(host, err);
  };

  // Two denials on one host and the rest of its URLs are skipped this run — a
  // proxy or bot wall denies by host, and probing 200 more URLs through it
  // proves nothing while costing minutes.
  const hostDenials = new Map();
  const noteDenial = (host, why) => {
    const n = (hostDenials.get(host) ?? 0) + 1;
    hostDenials.set(host, n);
    if (n >= HOST_DENY_THRESHOLD) markHostBlocked(host, why);
  };

  // --- Edition sources -------------------------------------------------------
  for (const source of editionSources) {
    const host = hostOf(source.url);
    if (hostBlocks.has(host)) {
      recordSource(state, source.id, "unreachable", nowIso, `host blocked this run: ${hostBlocks.get(host)}`);
      problems.push({ id: source.id, label: source.label, status: "unreachable", detail: `host ${host} blocked this run` });
      continue;
    }
    try {
      if (source.kind === "pdf") {
        const bytes = await doFetchBytes(source.url);
        if (bytes.length < 4 || bytes.subarray(0, 4).toString("latin1") !== "%PDF") {
          recordSource(state, source.id, "unusable", nowIso, `fetched ${bytes.length} bytes without a %PDF header`);
          problems.push({ id: source.id, label: source.label, status: "unusable", detail: `no %PDF header in ${bytes.length} bytes — bot wall or wrong document. NOT compared. ${source.url}` });
          continue;
        }
        const sha = createHash("sha256").update(bytes).digest("hex");
        if (manifestSha && sha !== manifestSha) {
          changes.push(`Selling Guide PDF at the official endpoint differs from the committed edition (sha ${sha.slice(0, 12)}… vs pinned ${manifestSha.slice(0, 12)}…) — a NEW EDITION or in-place amendment`);
          addSignal({
            id: `edition-pdf-${sha.slice(0, 16)}`,
            detectedAt: nowIso.slice(0, 10),
            source: source.id,
            sourceLabel: source.label,
            title: `Official Selling Guide PDF sha differs from committed edition — new edition suspected`,
            url: source.url,
            status: "new",
            observedSha256: sha,
            committedSha256: manifestSha,
            action:
              "FOUNDER: run the edition-cutover runbook (docs/fannie-mae/selling-guide/README.md " +
              "'When the next edition lands'). The watcher never cuts over.",
          });
        }
        recordSource(state, source.id, "ok", nowIso);
        continue;
      }

      const html = await doFetchText(source.url);
      const text = strip(html);
      if (source.contentProbe && !source.contentProbe.test(text)) {
        recordSource(state, source.id, "unusable", nowIso, `fetched ${text.length} chars but ${String(source.contentProbe)} did not match`);
        state.pageHashes && delete state.pageHashes[source.id];
        problems.push({ id: source.id, label: source.label, status: "unusable", detail: `HTTP 200 but the body carries no ${String(source.contentProbe)} — JS-rendered or wrong page. NOT hashed. ${source.url}` });
        continue;
      }

      if (source.kind === "announcements") {
        const ids = [...new Set([...text.matchAll(/SEL-\d{4}-\d{2}/gi)].map((m) => m[0].toUpperCase()))];
        const seen = new Set(state.announcementsSeen);
        for (const id of ids.filter((a) => !seen.has(a))) {
          if (state.announcementsSeen.length > 0) {
            // Only signal against an established baseline — the first run records,
            // it does not "detect" a backlog of history as change.
            changes.push(`New Selling Guide announcement ${id} → review ${source.url}`);
            addSignal({
              id: `announcement-${id.toLowerCase()}`,
              detectedAt: nowIso.slice(0, 10),
              source: source.id,
              sourceLabel: source.label,
              title: `Selling Guide announcement ${id} published — amendment to the committed edition`,
              url: source.url,
              status: "new",
              action:
                "Read the announcement; sections it revises are unverified in the corpus until the " +
                "next edition lands. Record affected section ids in the steward report.",
            });
          }
        }
        state.announcementsSeen = [...new Set([...ids, ...state.announcementsSeen])].slice(0, 200);
      }

      const hash = contentHash(text);
      const previous = state.pageHashes[source.id];
      if (previous && previous !== hash) {
        changes.push(`${source.label} content changed (${previous} → ${hash}) → review ${source.url}`);
        addSignal({
          id: `page-${source.id}-${hash}`,
          detectedAt: nowIso.slice(0, 10),
          source: source.id,
          sourceLabel: source.label,
          title: `${source.label} page content changed (${previous} → ${hash})`,
          url: source.url,
          status: "new",
        });
      } else if (!previous) {
        changes.push(`BASELINE ${source.label}: first verified hash ${hash} recorded (no diff possible until the next run)`);
      }
      state.pageHashes[source.id] = hash;
      recordSource(state, source.id, "ok", nowIso);
    } catch (err) {
      if (isConnectFailure(err)) {
        markHostBlocked(host, err.message);
      } else {
        const m = /^HTTP (\d{3})/.exec(err.message);
        if (m && DENIED_STATUSES.has(Number(m[1]))) noteDenial(host, err.message);
      }
      recordSource(state, source.id, "unreachable", nowIso, err.message);
      delete state.pageHashes[source.id];
      problems.push({ id: source.id, label: source.label, status: "unreachable", detail: `${err.message} — ${source.url}` });
    }
  }

  // --- Link inventory sweep --------------------------------------------------
  // Only class:ok URLs are ever probed; mailto and malformed are documented facts.
  // The canary rule: the first connect-level failure on a host blocks the host for
  // the rest of the run, so a fully-blocked network costs seconds, not hours —
  // and a blocked host is NEVER a rot observation.
  const probeable = Object.entries(links.external || {})
    .filter(([, e]) => e.class === "ok")
    .map(([url, e]) => ({ url: e.cleaned || url, original: url }));
  const linkTally = { ok: 0, rot: 0, denied: 0, hostBlocked: 0, unreachable: 0 };
  // Per-host observation ledger for the reachability verdict below: a host with
  // denials and not one real observation is blocked, whatever the threshold —
  // a single-URL host must not read "ok" because one denial is below it.
  const hostSeen = new Map(); // host -> { real: n, denied: n }
  const seeHost = (host, kind) => {
    const h = hostSeen.get(host) ?? { real: 0, denied: 0 };
    h[kind]++;
    hostSeen.set(host, h);
  };

  const probeOne = async ({ url, original }) => {
    const host = hostOf(url);
    if (hostBlocks.has(host)) {
      recordLink(state, original, "host-blocked", nowIso);
      linkTally.hostBlocked++;
      return;
    }
    try {
      const status = await doProbe(url);
      const prev = state.links[original];
      if (status >= 200 && status < 400) {
        if (prev && prev.status === "rot") {
          changes.push(`Link recovered (${status}): ${url}`);
          addSignal({
            id: `link-recovered-${contentHash(original)}-${nowIso.slice(0, 10)}`,
            detectedAt: nowIso.slice(0, 10),
            source: "link-sweep",
            sourceLabel: "Guide link inventory",
            title: `Previously-rotted Guide link answers ${status} again`,
            url: original,
            status: "new",
          });
        }
        recordLink(state, original, "ok", nowIso, status);
        linkTally.ok++;
        seeHost(host, "real");
      } else if (ROT_STATUSES.has(status)) {
        // The one honest rot evidence: the host answered and said the resource
        // is gone. Everything else is access policy or server trouble.
        const wasRot = prev && prev.status === "rot";
        recordLink(state, original, "rot", nowIso, status);
        linkTally.rot++;
        seeHost(host, "real");
        if (!wasRot) {
          changes.push(`Guide link rot (HTTP ${status}): ${url}`);
          addSignal({
            id: `link-rot-${contentHash(original)}`,
            detectedAt: nowIso.slice(0, 10),
            source: "link-sweep",
            sourceLabel: "Guide link inventory",
            title: `Guide-referenced URL answers HTTP ${status} — resource gone`,
            url: original,
            status: "new",
            httpStatus: status,
            action:
              "The Guide cites this resource; find its successor URL or record the loss. " +
              "links.json itself is regenerated from the PDF only — never hand-edited.",
          });
        }
      } else if (DENIED_STATUSES.has(status)) {
        // Denied ≠ gone: a proxy policy or origin bot wall refusing THIS client
        // says nothing about the resource. Recorded, never signaled — and it
        // counts toward the host's short-circuit threshold.
        recordLink(state, original, "denied", nowIso, status);
        linkTally.denied++;
        seeHost(host, "denied");
        noteDenial(host, `HTTP ${status} on ${url}`);
      } else {
        // 5xx and anything else transient-shaped: a failure of the attempt,
        // not evidence about the resource.
        recordLink(state, original, "unreachable", nowIso, status);
        linkTally.unreachable++;
      }
    } catch (err) {
      if (isConnectFailure(err)) {
        markHostBlocked(host, err.message);
        recordLink(state, original, "host-blocked", nowIso);
        linkTally.hostBlocked++;
      } else {
        recordLink(state, original, "unreachable", nowIso);
        linkTally.unreachable++;
      }
    }
  };

  for (let i = 0; i < probeable.length; i += LINK_CONCURRENCY) {
    await Promise.all(probeable.slice(i, i + LINK_CONCURRENCY).map(probeOne));
    if (batchDelayMs > 0 && i + LINK_CONCURRENCY < probeable.length) {
      // Polite pacing on reachable hosts only; a fully short-circuited batch
      // resolves instantly and the delay would just stretch a blocked run.
      const remaining = probeable.slice(i + LINK_CONCURRENCY);
      if (remaining.some(({ url }) => !hostBlocks.has(hostOf(url)))) {
        await new Promise((r) => setTimeout(r, batchDelayMs));
      }
    }
  }

  // --- Host reachability flips ----------------------------------------------
  const blockedVerdict = (host) => {
    if (hostBlocks.has(host)) return true;
    const seen = hostSeen.get(host);
    return Boolean(seen && seen.denied > 0 && seen.real === 0);
  };
  const hostsThisRun = new Map();
  for (const { url } of probeable) {
    const h = hostOf(url);
    hostsThisRun.set(h, blockedVerdict(h) ? "blocked" : "ok");
  }
  for (const s of editionSources) {
    const h = hostOf(s.url);
    hostsThisRun.set(h, blockedVerdict(h) ? "blocked" : hostsThisRun.get(h) ?? "ok");
  }
  for (const [host, reach] of hostsThisRun) {
    const prev = state.hostReachability[host];
    if (prev && prev !== reach) {
      changes.push(`Host reachability flipped: ${host} ${prev} → ${reach} (environment-dependent — CLAUDE.md's Reg Z lesson)`);
      addSignal({
        id: `host-flip-${host}-${nowIso.slice(0, 10)}-${reach}`,
        detectedAt: nowIso.slice(0, 10),
        source: "link-sweep",
        sourceLabel: "Guide link inventory",
        title: `Host ${host} flipped ${prev} → ${reach}`,
        url: `https://${host}/`,
        status: "new",
      });
    }
    state.hostReachability[host] = reach;
  }

  state.lastRun = nowIso;
  state.lastRunEnvironment = process.env.CLAUDE_CODE_REMOTE === "true" ? "claude-code-remote" : os.hostname();

  const configured = editionSources.length;
  const observed = configured - problems.length;
  return {
    changes,
    newSignals,
    problems,
    configured,
    observed,
    linkTally,
    probeableLinks: probeable.length,
    hostBlocks: [...hostBlocks.keys()],
    complete:
      problems.length === 0 &&
      linkTally.hostBlocked === 0 &&
      linkTally.denied === 0 &&
      linkTally.unreachable === 0,
  };
}

function exitCodeFor(result) {
  if (result.changes.length > 0) return 2;
  return result.complete ? 0 : 3;
}

async function main() {
  const state = { ...emptyState(), ...readJson(STATE_PATH, emptyState) };
  const signals = readJson(SIGNALS_PATH, emptySignals);
  signals.signals = signals.signals ?? [];
  const links = readJson(LINKS_PATH, () => {
    throw new Error("docs/fannie-mae/selling-guide/links.json missing — run python3 scripts/extract-selling-guide.py first");
  });
  const manifest = readJson(MANIFEST_PATH, () => ({}));

  const result = await runWatch({
    now: Date.now(),
    state,
    signals,
    links,
    manifestSha: manifest.source_pdf ? manifest.source_pdf.sha256 : null,
    fetchText,
    fetchBytes,
    probeUrl,
  });

  if (UPDATE_STATE) {
    signals.signals.push(...result.newSignals);
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
    fs.writeFileSync(SIGNALS_PATH, JSON.stringify(signals, null, 2) + "\n");
  }

  for (const p of result.problems) {
    console.log(`${p.status === "unusable" ? "UNUSABLE" : "UNREACHABLE"}  ${p.label}: ${p.detail}`);
  }
  if (result.hostBlocks.length > 0) {
    console.log(
      `HOST-BLOCKED  ${result.hostBlocks.join(", ")} — connect failure or repeated access ` +
        "denial; their remaining links were recorded as host-blocked, never as rot. If this " +
        "environment should reach them, the founder-side fix is the network allowlist " +
        "(*.fanniemae.com).",
    );
  }

  console.log(
    `\nObserved ${result.observed}/${result.configured} edition sources; links: ` +
      `${result.linkTally.ok} ok, ${result.linkTally.rot} rot, ${result.linkTally.denied} denied, ` +
      `${result.linkTally.hostBlocked} host-blocked, ${result.linkTally.unreachable} unreachable ` +
      `of ${result.probeableLinks} probeable.`,
  );

  if (result.changes.length > 0) {
    console.log(`${result.changes.length} Selling Guide signal(s):`);
    for (const c of result.changes) console.log(`  • ${c}`);
    if (result.newSignals.length > 0) {
      console.log(
        `\n${result.newSignals.length} signal row(s) ${UPDATE_STATE ? "written to" : "would be written to (re-run with --update-state)"} ` +
          "data/regulatory/selling-guide-watch-signals.json.",
      );
    }
  } else if (result.complete) {
    console.log("No Selling Guide changes detected across every configured source and link.");
  } else {
    console.log("No changes among what was actually observed — coverage is INCOMPLETE, so this is not an all-clear.");
  }

  process.exit(exitCodeFor(result));
}

module.exports = {
  runWatch,
  exitCodeFor,
  strip,
  contentHash,
  emptyState,
  emptySignals,
  isConnectFailure,
  recordLink,
  EDITION_SOURCES,
};

if (require.main === module) {
  main().catch((err) => {
    console.error("Watcher error:", err);
    process.exit(1);
  });
}
