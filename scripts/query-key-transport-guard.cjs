#!/usr/bin/env node
/**
 * Query TRANSPORT guard — the third control run by `pnpm guard:querykeys`.
 * Siblings, three different questions:
 *
 *   query-key-guard.cjs        "is this key written in a shape that can be matched?"
 *   query-key-reachability.cjs "does this invalidation actually match anything?"
 *   query-key-transport.cjs    "does this key describe the request it performs?"
 *
 * WHY THIS EXISTS
 *
 * `buildQueryUrl` (client/src/lib/queryClient.ts) derives the request URL FROM
 * the query key. That is the property the whole cache rests on: the key is
 * already how the cache identifies a request, so deriving the URL from it means
 * the two can never disagree.
 *
 * A hand-written `queryFn` breaks that property silently. It writes a SECOND,
 * independent spelling of the URL, and nothing checks the two against each
 * other — so the key becomes decorative and the queryFn becomes the only thing
 * making the request work. Six shipped that way, and four of them named a URL
 * that does not exist:
 *
 *   key ["/api/borrower-graph/affordability", 450000]
 *     → buildQueryUrl → /api/borrower-graph/affordability/450000   (404)
 *     → queryFn actually fetched  ?price=450000
 *
 *   key ["/api/predictions/me", applicationId]   → /api/predictions/me/<id>  (404)
 *     → queryFn actually fetched  ?applicationId=<id>
 *
 *   key ["/api/consent-templates", "tax_document_use"]              (404)
 *     → queryFn actually fetched  ?type=tax_document_use
 *     …and ConsentGateCard read the SAME endpoint through the params-object
 *     form, so one endpoint occupied two cache entries that no single
 *     invalidation could reach.
 *
 *   key ["/api/autopilot/metrics", rangeDays]                       (404)
 *     → queryFn computed `new Date()` at FETCH time, so the time window was a
 *       request input that never appeared in the key: one entry silently meant
 *       a different window on every refetch.
 *
 * Deleting a "redundant" queryFn is a routine cleanup — this repo has already
 * done it once (ConsentGateCard). Do it to one of the above and the query 404s.
 *
 * THE RULE
 *
 * No hand-written `queryFn` in client/src. The default transport
 * (`getQueryFn({ on401: "throw" })`, wired as the QueryClient default) already
 * covers every authenticated read, and `getPublicQueryFn()` covers the reads
 * that serve signed-out visitors. With no inline queryFn anywhere, the key IS
 * the URL by construction and this entire failure class cannot be expressed.
 *
 * ALLOWED:
 *   - `queryFn: getPublicQueryFn<T>()` / `queryFn: getQueryFn(...)` — the two
 *     sanctioned factories, which both route through buildQueryUrl.
 *   - client/src/lib/queryClient.ts itself, where they are defined.
 *   - *.test.ts / *.test.tsx, where a stub queryFn IS the fixture.
 *
 * NEED A PARAM THAT ISN'T A PATH SEGMENT? That is what the params-object form is
 * for: `["/api/x", { price }]` → `/api/x?price=…`. Put it in a factory in
 * client/src/lib/queryClient.ts so every call site addresses it identically.
 *
 * Runs in the `gate` job of .github/workflows/ci.yml. Zero-dependency; no
 * network. `tests/queryKeyConvergence.test.ts` is the companion check.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_SRC = path.join(ROOT, "client", "src");
const FACTORY_FILE = path.join(CLIENT_SRC, "lib", "queryClient.ts");

/** A `queryFn:` property in an object literal. */
const QUERY_FN = /(^|[\s,{(])queryFn\s*:/;

/**
 * The sanctioned right-hand sides. Both are factories exported from
 * queryClient.ts that build their URL with `buildQueryUrl`, so they preserve
 * the key⇄URL identity rather than restating it.
 */
const SANCTIONED = /queryFn\s*:\s*(getPublicQueryFn|getQueryFn)\b/;

function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      // Test files are exempt: a stub queryFn is how a component test supplies
      // its fixture without a server, and that stub is never shipped.
      out.push(full);
    }
  }
  return out;
}

function findOffenders() {
  const offenders = [];
  for (const file of sourceFiles(CLIENT_SRC)) {
    if (file === FACTORY_FILE) continue; // the factories' own home
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      // Strip comment lines. Several files (and this guard's own siblings)
      // legitimately write "No queryFn: the key IS the request" in prose.
      const code = line.replace(/^\s*(\/\/|\*|\/\*).*$/, "");
      if (!QUERY_FN.test(code)) return;
      if (SANCTIONED.test(code)) return;
      offenders.push({
        file: path.relative(ROOT, file),
        line: i + 1,
        text: line.trim(),
      });
    });
  }
  return offenders;
}

const offenders = findOffenders();

if (offenders.length === 0) {
  console.log(
    "guard:transport — OK (no hand-written queryFn; every key derives its own URL)",
  );
  process.exit(0);
}

console.log(
  `❌ guard:transport — ${offenders.length} hand-written queryFn(s) in client/src. ` +
    `A queryFn is a SECOND spelling of the URL that nothing checks against the ` +
    `key, so the key stops describing the request. Delete it and let ` +
    `buildQueryUrl derive the URL from the key; for query-string params use the ` +
    `params-object form ["/api/x", { param }] from a factory in ` +
    `client/src/lib/queryClient.ts. Public endpoints use ` +
    `queryFn: getPublicQueryFn<T>():`,
);
for (const o of offenders) console.log(`   ${o.file}:${o.line}  ${o.text}`);
process.exit(1);
