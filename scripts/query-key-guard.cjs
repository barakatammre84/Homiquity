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
 * This guard FLAGS any interpolated template-string queryKey whose path belongs
 * to one of the batch-1 factory families below, outside the factory itself. The
 * fix is always: build the key from the factory in client/src/lib/queryClient.ts.
 *
 * MODE: warn-only for now (always exits 0) — batch 1 introduces the factories
 * but has not yet migrated the call sites, so a hard failure would red the build
 * on pre-existing keys. A later batch migrates the sites and flips this to
 * blocking (exit 1) by removing the `WARN_ONLY` guard. Pass --strict to preview
 * the blocking behaviour locally.
 *
 * Zero-dependency; no network. The vitest `queryKeyConvergence.test.ts` is the
 * companion check that verifies the factory outputs themselves.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_SRC = path.join(ROOT, "client", "src");
const FACTORY_FILE = path.join(CLIENT_SRC, "lib", "queryClient.ts");

// The resource path prefixes owned by a batch-1 key factory. A template-string
// queryKey that interpolates within one of these families is drift.
const GUARDED_PREFIXES = [
  "/api/loan-applications",
  "/api/dashboard",
  "/api/tasks",
  "/api/calculator-results",
  "/api/coach/conversations",
  "/api/onboarding/status",
];

const WARN_ONLY = !process.argv.includes("--strict");

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
      if (!GUARDED_PREFIXES.some((p) => url.startsWith(p))) return;
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
  console.log("guard:querykeys — OK (no template-string keys in guarded families)");
  process.exit(0);
}

const header =
  `guard:querykeys — ${offenders.length} template-string queryKey(s) in a ` +
  `factory-owned family. Build these from the factories in ` +
  `client/src/lib/queryClient.ts (loanApplicationKeys, taskKeys, …) so array-` +
  `prefix invalidation can reach them:`;
console.log((WARN_ONLY ? "⚠️  " : "❌ ") + header);
for (const o of offenders) console.log(`   ${o.file}:${o.line}  ${o.text}`);

if (WARN_ONLY) {
  console.log(
    "\n(warn-only: batch 1 has not migrated call sites yet — not failing the build)",
  );
  process.exit(0);
}
process.exit(1);
