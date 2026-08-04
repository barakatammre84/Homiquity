#!/usr/bin/env node
/**
 * Query-key drift guard — run by `pnpm guard:querykeys`.
 *
 * The default queryFn in client/src/lib/queryClient.ts builds the request URL
 * with `queryKey.join("/")`, so a nested resource can be written two ways:
 *   [`/api/loan-applications/${id}/options`]      (one interpolated string)
 *   ["/api/loan-applications", id, "options"]     (segments)
 * They fetch the SAME URL but are DIFFERENT cache entries, and invalidateQueries
 * matches by array prefix. A broad `["/api/loan-applications", id]` invalidation
 * therefore refreshes every segmented child and silently misses every
 * template-string one — the #297 stale-panel class of bug.
 *
 * This guard FAILS (exit 1) on any INTERPOLATED template-string queryKey for an
 * `/api/` endpoint, anywhere under client/src outside the factory itself. It is
 * surface-wide, not limited to the migrated families: a `${...}` in a path-style
 * key is the drift hazard regardless of which resource it names. The fix is to
 * write the key as segments — ["/api/x", id, "y"] — building it from a factory in
 * client/src/lib/queryClient.ts when the resource has one.
 *
 * ALLOWED — a template key whose URL contains "?" (a query string). "?input=x"
 * cannot be expressed as path segments (join("/") would turn it into a path), so
 * these are necessarily single-string leaf keys, and nothing invalidates them by
 * prefix. This is a semantic rule, not a hand-maintained file allowlist: a new
 * query-string key is auto-allowed, a new path-style `${...}` key is caught.
 *
 * Runs in the `gate` job of .github/workflows/ci.yml alongside guard:schema and
 * guard:tokens. Zero-dependency; no network. The vitest
 * `queryKeyConvergence.test.ts` is the companion check — it verifies the factory
 * outputs themselves and re-asserts this same rule.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_SRC = path.join(ROOT, "client", "src");
const FACTORY_FILE = path.join(CLIENT_SRC, "lib", "queryClient.ts");

/** `queryKey: [` whose first element is a backtick template literal. */
const TEMPLATE_KEY = /queryKey:\s*\[\s*`([^`]*)`/;

function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function findOffenders() {
  const offenders = [];
  for (const file of sourceFiles(CLIENT_SRC)) {
    if (file === FACTORY_FILE) continue; // the factory is the sanctioned home
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      const match = TEMPLATE_KEY.exec(line);
      if (!match) return;
      const url = match[1];
      if (!url.includes("${")) return; // a constant template is just a plain key
      if (!url.startsWith("/api/")) return; // only our own endpoints
      if (url.includes("?")) return; // query-string leaf keys can't be segmented
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
  console.log("guard:querykeys — OK (no path-style template queryKeys for /api endpoints)");
  process.exit(0);
}

const header =
  `guard:querykeys — ${offenders.length} interpolated template-string queryKey(s) ` +
  `for an /api endpoint. A \`${"$"}{...}\` path key is invisible to array-prefix ` +
  `invalidateQueries. Write it as segments — ["/api/x", id, "y"] — from a factory ` +
  `in client/src/lib/queryClient.ts where one exists:`;
console.log("❌ " + header);
for (const o of offenders) console.log(`   ${o.file}:${o.line}  ${o.text}`);
process.exit(1);
