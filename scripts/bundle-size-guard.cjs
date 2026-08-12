#!/usr/bin/env node
/**
 * Client bundle-size ratchet — run by `pnpm guard:bundle` in ci.yml's gate job,
 * AFTER `pnpm build` (it measures the artifact, so it needs one to exist).
 *
 * WHY THIS EXISTS
 *
 * PR #482 found the public client bundle shipping 174 Drizzle table definitions —
 * the map of the database, readable from devtools on a public site. One value
 * import of the `@shared/schema` barrel defeated tree-shaking for all of it, and
 * the main chunk was 989,724 bytes. Nothing in the build said so; the number is
 * printed by Vite and scrolls past.
 *
 * `tests/clientSchemaImports.test.ts` (also from #482) closes that exact hole at
 * the SOURCE level: no value import of `@shared/schema` from client code. This
 * guard is the ARTIFACT-level complement and is deliberately not redundant with
 * it — the source rule is blind to every other way the entry bundle grows: a fat
 * dependency, a barrel re-export from some other module, a lazy route becoming
 * eager, an icon set imported whole. #482's own commit message records that
 * removing every client value import was NOT enough, because two non-schema
 * `shared/` helpers pulled 105 tables back in. A byte count catches the class;
 * an import rule catches one member of it.
 *
 * WHAT IS MEASURED, AND WHY THIS METRIC
 *
 * The **eager entry graph**: the entry script plus every `modulepreload` chunk,
 * read out of the built `index.html`. That is precisely what a first-time
 * visitor downloads before anything renders, and it is the number a user feels.
 *
 * It is parsed from the HTML rather than hardcoded, so it tracks whatever Vite
 * decides to preload — a chunking change in vite.config.ts cannot silently move
 * weight out of view of this guard.
 *
 * Lazy route chunks are deliberately OUTSIDE the gate. Adding a page should not
 * fail CI; that would train everyone to bump the baseline reflexively, which is
 * how a ratchet dies. Their total is reported for trend only.
 *
 * gzip is measured at a fixed level so the number is deterministic across
 * machines. It is a faithful proxy for what is transferred, not a promise about
 * the exact bytes a given server emits at its own compression level.
 *
 * RATCHET (the design-token-guard idiom, deliberately identical):
 *   • gzip > baseline -> FAIL, with the per-chunk breakdown
 *   • gzip < baseline -> tighten the baseline to the new low and PASS
 *   • gzip == baseline -> PASS
 *
 * A shrink rewrites the baseline, so an improvement is locked in and cannot
 * silently erode later.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist", "public");
const INDEX_HTML = path.join(DIST, "index.html");
const BASELINE_FILE = path.join(__dirname, "bundle-size-baseline.json");

/** Fixed so two machines agree. Not a claim about any server's own level. */
const GZIP_LEVEL = 9;

function gzipSize(buf) {
  return zlib.gzipSync(buf, { level: GZIP_LEVEL }).length;
}

function fmt(n) {
  return n.toLocaleString("en-US");
}

function kb(n) {
  return `${(n / 1024).toFixed(1)} kB`;
}

// ---------------------------------------------------------------------------
// The artifact must exist. A guard that passes when there is nothing to measure
// is worse than no guard: it reports green for the one state it cannot judge.
// (CHARTER.md §10 — "a guard only answers its own question".)
// ---------------------------------------------------------------------------
if (!fs.existsSync(INDEX_HTML)) {
  console.error(
    "bundle-size-guard: FAIL — no build to measure.\n" +
      `  Expected ${path.relative(ROOT, INDEX_HTML)}.\n` +
      "  Run `pnpm build` first. In CI this guard runs AFTER the Production build step;\n" +
      "  if it ran before, the step order is the bug, not the bundle."
  );
  process.exit(1);
}

const html = fs.readFileSync(INDEX_HTML, "utf8");

/**
 * The eager set: the entry <script src> plus every <link rel="modulepreload">.
 * Both spellings of the attribute order appear across Vite versions, so match
 * the asset path itself rather than a rigid tag shape.
 */
function eagerAssets(source) {
  const found = new Set();
  const scriptRe = /<script[^>]*\ssrc="(\/assets\/[^"]+\.js)"/g;
  const preloadRe = /<link[^>]*\srel="modulepreload"[^>]*\shref="(\/assets\/[^"]+\.js)"/g;
  const preloadAltRe = /<link[^>]*\shref="(\/assets\/[^"]+\.js)"[^>]*\srel="modulepreload"/g;
  for (const re of [scriptRe, preloadRe, preloadAltRe]) {
    let m;
    while ((m = re.exec(source)) !== null) found.add(m[1]);
  }
  return [...found].sort();
}

const eagerPaths = eagerAssets(html);

// ---------------------------------------------------------------------------
// "Did the parser find anything?" — the assertion #482's own guard credits with
// exposing its blind spot. A regex that silently matches nothing would report a
// 0-byte bundle and pass forever, which is the most dangerous possible pass.
// ---------------------------------------------------------------------------
if (eagerPaths.length === 0) {
  console.error(
    "bundle-size-guard: FAIL — parsed the built index.html and found NO entry chunks.\n" +
      "  That is a parser failure, not a 0-byte bundle. Vite's HTML output shape\n" +
      "  probably changed; fix eagerAssets() rather than deleting this check."
  );
  process.exit(1);
}

const eager = eagerPaths.map((rel) => {
  const abs = path.join(DIST, rel.replace(/^\//, ""));
  if (!fs.existsSync(abs)) {
    console.error(
      `bundle-size-guard: FAIL — index.html references ${rel}, which does not exist.\n` +
        "  The build is incomplete or the output moved."
    );
    process.exit(1);
  }
  const buf = fs.readFileSync(abs);
  return { rel, raw: buf.length, gzip: gzipSize(buf) };
});

const eagerGzip = eager.reduce((s, c) => s + c.gzip, 0);
const eagerRaw = eager.reduce((s, c) => s + c.raw, 0);

// Everything else — reported, never gated. See the header for why.
const allChunks = fs
  .readdirSync(path.join(DIST, "assets"))
  .filter((f) => f.endsWith(".js"));
const eagerNames = new Set(eager.map((c) => path.basename(c.rel)));
let lazyGzip = 0;
for (const f of allChunks) {
  if (eagerNames.has(f)) continue;
  lazyGzip += gzipSize(fs.readFileSync(path.join(DIST, "assets", f)));
}

const baseline = fs.existsSync(BASELINE_FILE)
  ? JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"))
  : {};
const base = typeof baseline.eagerGzipBytes === "number" ? baseline.eagerGzipBytes : null;

const summary =
  `eager entry graph: ${eager.length} chunk(s), ` +
  `${fmt(eagerRaw)} raw / ${fmt(eagerGzip)} gzip (${kb(eagerGzip)} over the wire)`;
const lazyLine = `lazy chunks (not gated): ${allChunks.length - eager.length} file(s), ${fmt(lazyGzip)} gzip`;

if (base === null) {
  fs.writeFileSync(
    BASELINE_FILE,
    JSON.stringify({ eagerGzipBytes: eagerGzip, gzipLevel: GZIP_LEVEL }, null, 2) + "\n"
  );
  console.log(`bundle-size-guard: bootstrapped baseline at ${fmt(eagerGzip)} gzip bytes.`);
  console.log(`  ${summary}`);
  console.log(`  ${lazyLine}`);
  process.exit(0);
}

if (eagerGzip > base) {
  const over = eagerGzip - base;
  const pct = ((over / base) * 100).toFixed(1);
  console.error(
    `bundle-size-guard: FAIL — the eager entry bundle grew ${fmt(over)} gzip bytes (+${pct}%).\n` +
      `  baseline ${fmt(base)}  ->  now ${fmt(eagerGzip)}\n\n` +
      "  Every visitor downloads this before anything renders. Per-chunk:\n" +
      eager.map((c) => `    ${c.rel}  ${fmt(c.raw)} raw / ${fmt(c.gzip)} gzip`).join("\n") +
      "\n\n" +
      "  Usual causes, cheapest check first:\n" +
      "    • a VALUE import of a barrel that has side effects (`pgTable(...)` in\n" +
      "      shared/schema is the one that already shipped — see #482 and\n" +
      "      tests/clientSchemaImports.test.ts). `import type` is free; a value\n" +
      "      import of one symbol drags the whole module in.\n" +
      "    • a route that stopped being lazily imported in client/src/App.tsx.\n" +
      "    • a dependency imported whole where a submodule would do.\n\n" +
      "  If the growth is genuinely required, raise eagerGzipBytes in\n" +
      "  scripts/bundle-size-baseline.json IN THE SAME PR and say in the PR body what\n" +
      "  the bytes bought. Never bump it to make a red build green without reading why."
  );
  process.exit(1);
}

if (eagerGzip < base) {
  fs.writeFileSync(
    BASELINE_FILE,
    JSON.stringify({ eagerGzipBytes: eagerGzip, gzipLevel: GZIP_LEVEL }, null, 2) + "\n"
  );
  console.log(
    `bundle-size-guard: improved by ${fmt(base - eagerGzip)} gzip bytes — ` +
      `baseline tightened to ${fmt(eagerGzip)}. ✅`
  );
} else {
  console.log(`bundle-size-guard: ${fmt(eagerGzip)} gzip bytes (at baseline, no regression). ✅`);
}
console.log(`  ${summary}`);
console.log(`  ${lazyLine}`);
