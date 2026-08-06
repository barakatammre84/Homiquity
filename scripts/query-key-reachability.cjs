#!/usr/bin/env node
/**
 * Query-key REACHABILITY guard — run by `pnpm guard:querykeys` alongside
 * scripts/query-key-guard.cjs. Sibling controls, different questions:
 *
 *   query-key-guard.cjs      "is this key written in a shape that can be matched?"
 *   query-key-reachability   "does this invalidation actually match anything?"
 *
 * WHY THIS EXISTS
 *
 * `invalidateQueries` is the ONLY write→read feedback mechanism in this client:
 * a mutation succeeds, it invalidates a key, the matching queries refetch. There
 * is no action layer and no store — if the key matches nothing, the mutation
 * silently refreshes nothing.
 *
 * And "matches" is narrower than it looks. `partialMatchKey` (query-core)
 * compares queryKey arrays ELEMENT BY ELEMENT — it is NOT a string-prefix test:
 *
 *     if (Array.isArray(a) && Array.isArray(b)) {
 *       for (let i = 0; i < b.length; i++)
 *         if (!partialMatchKey(a[i], b[i])) return false;
 *
 * So ["/api/task-engine"] does NOT match ["/api/task-engine/metrics"]. It reads
 * like a prefix and behaves like a string equality test on segment 0. Four such
 * keys shipped and went unnoticed for months, the worst being Task Operations:
 * escalate / status-update / run-escalation all fired ["/api/task-engine"] at
 * queries keyed ["/api/task-engine/metrics"] et al, so an underwriter changed a
 * task's status and the row kept showing the old one.
 *
 * A dead invalidation is invisible in dev: the mutation returns 200, nothing
 * throws, no test fails, and `refetchOnWindowFocus: true` hides it the moment
 * the developer alt-tabs to check. Only a static reachability check finds it.
 *
 * THE RULE
 *
 * Every invalidateQueries / removeQueries / refetchQueries / resetQueries key
 * whose first segment is a literal "/api/..." must element-wise prefix-match at
 * least one queryKey that some useQuery in client/src actually fetches.
 *
 * It also reports the INVERSE — a fetched /api key that no invalidation can ever
 * reach — as a warning, not a failure. That is the "written, cleaned up, never
 * read" shape (the ApplyInvite prefillEmail/prefillName half-wire), and it is
 * legitimately fine for read-only surfaces, so it must not fail the build.
 *
 * WHAT IT RESOLVES
 *   - factory calls        taskEngineKeys.all(), loanApplicationKeys.credit.summary(id)
 *   - inline arrays        ["/api/x", id, "y"]
 *   - one hop of variable  const locksKey = [...]; queryKey: locksKey
 *     (that hop is not cosmetic — hoisting a template key into a const is how
 *     RateLockDialog slipped past query-key-guard.cjs, whose regex only fires on
 *     an INLINE `queryKey: [`...`]`.)
 *
 * A non-literal segment (an identifier, a member expression, a template string)
 * becomes a WILDCARD that matches anything, so the guard never fails on a key it
 * cannot fully see. Unresolvable keys are skipped, not guessed at — this reports
 * what it can prove, which is the only way a guard stays trustworthy enough to
 * be a required check.
 *
 * WHAT IT DOES NOT CATCH (know the edge of the net)
 *
 * SIBLING OMISSION. If a mutation invalidates ["/api/goal", "gap-analysis"] and
 * the page also queries ["/api/goal", "credit-recommendations"], nothing here
 * fires: neither key is an ancestor of the other, and whether saving a goal
 * OUGHT to refresh the credit recommendations is a semantic question about the
 * domain, not a structural one. (The original GapCalculator bug was caught only
 * because its invalidation was the ANCESTOR ["/api/goal"].) The structural
 * defence against sibling omission is to invalidate the shared prefix rather
 * than enumerate siblings by hand — which is what every factory here is for.
 *
 * CROSS-FILE misses are reported as warnings, never failures. See the
 * same-file rationale at the `orphaned` computation.
 *
 * Zero-dependency, no network, no TypeScript parse. Runs in the `gate` job of
 * .github/workflows/ci.yml.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_SRC = path.join(ROOT, "client", "src");
const FACTORY_FILE = path.join(CLIENT_SRC, "lib", "queryClient.ts");

/** Any segment we could not statically resolve. Matches anything. */
const WILDCARD = Symbol.for("queryKeyWildcard");

const INVALIDATOR = /\b(?:invalidate|remove|refetch|reset|cancel)Queries\s*\(/g;

function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Walk forward from `start` (index of an opening bracket) to its match,
 * skipping over strings, template literals and comments so a bracket inside
 * `"]"` or `// ]` never closes the span early.
 */
function matchBracket(src, start) {
  const open = src[start];
  const close = { "(": ")", "[": "]", "{": "}" }[open];
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < src.length) {
        if (src[i] === "\\") i += 2;
        else if (src[i] === quote) break;
        else i++;
      }
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i = src.indexOf("*/", i + 2);
      if (i < 0) return -1;
      i++;
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Split an array/args body on top-level commas. */
function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let buf = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      let chunk = c;
      i++;
      while (i < body.length) {
        chunk += body[i];
        if (body[i] === "\\") {
          chunk += body[i + 1] ?? "";
          i += 2;
          continue;
        }
        if (body[i] === quote) break;
        i++;
      }
      buf += chunk;
      continue;
    }
    if ("([{".includes(c)) depth++;
    if (")]}".includes(c)) depth--;
    if (c === "," && depth === 0) {
      parts.push(buf);
      buf = "";
      continue;
    }
    buf += c;
  }
  if (buf.trim()) parts.push(buf);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** One array element → a literal string, or WILDCARD. */
function segment(expr) {
  const e = expr.replace(/\s+as\s+const\s*$/, "").trim();
  const lit = /^(["'])(.*)\1$/.exec(e);
  if (lit) return lit[2];
  // A template literal with no interpolation is just a string.
  const tpl = /^`([^`${]*)`$/.exec(e);
  if (tpl) return tpl[1];
  return WILDCARD;
}

/** `[a, b, c]` source → segment list, or null if it isn't an array literal. */
function parseArrayLiteral(expr) {
  const e = expr.replace(/\s+as\s+const\s*$/, "").trim();
  if (!e.startsWith("[")) return null;
  const end = matchBracket(e, 0);
  if (end < 0) return null;
  return splitTopLevel(e.slice(1, end)).map(segment);
}

// ---------------------------------------------------------------------------
// Factory table: queryClient.ts's exported key objects → segment lists.
// ---------------------------------------------------------------------------
function buildFactoryTable() {
  const src = fs.readFileSync(FACTORY_FILE, "utf8");
  const table = new Map();
  const exportRe = /export const (\w+Keys)\s*=\s*\{/g;
  let m;
  while ((m = exportRe.exec(src))) {
    const factory = m[1];
    const braceStart = src.indexOf("{", m.index + m[0].length - 1);
    const braceEnd = matchBracket(src, braceStart);
    if (braceEnd < 0) continue;
    collectMethods(src.slice(braceStart + 1, braceEnd), factory, table);
  }
  return table;
}

function collectMethods(body, prefix, table) {
  // `name: (args) => [ ... ]`  and nested `name: { ... }`
  const re = /(\w+)\s*:\s*(\{|\([^)]*\)\s*=>)/g;
  let m;
  while ((m = re.exec(body))) {
    const name = m[1];
    if (m[2] === "{") {
      const start = body.indexOf("{", m.index + m[0].length - 1);
      const end = matchBracket(body, start);
      if (end < 0) continue;
      collectMethods(body.slice(start + 1, end), `${prefix}.${name}`, table);
      re.lastIndex = end;
      continue;
    }
    const arrowEnd = m.index + m[0].length;
    const bracket = body.indexOf("[", arrowEnd);
    if (bracket < 0) continue;
    const close = matchBracket(body, bracket);
    if (close < 0) continue;
    const segs = splitTopLevel(body.slice(bracket + 1, close)).map(segment);
    table.set(`${prefix}.${name}`, segs);
  }
}

// ---------------------------------------------------------------------------
// Per-file key extraction.
// ---------------------------------------------------------------------------
function resolve(expr, factories, locals, depth = 0) {
  const e = expr.trim();
  const arr = parseArrayLiteral(e);
  if (arr) return arr;
  const call = /^([A-Za-z_$][\w$]*(?:\.[\w$]+)+)\s*\(/.exec(e);
  if (call && factories.has(call[1])) return factories.get(call[1]);
  if (call) return null; // a factory we don't know — don't guess
  const ident = /^([A-Za-z_$][\w$]*)$/.exec(e);
  if (ident && depth < 1 && locals.has(ident[1])) {
    return resolve(locals.get(ident[1]), factories, locals, depth + 1);
  }
  return null;
}

function scanFile(file, factories) {
  const src = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file);
  const lineAt = (i) => src.slice(0, i).split("\n").length;

  // `const foo = [...]` / `const foo = someKeys.bar(x)` — the one-hop table.
  const locals = new Map();
  const localRe = /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(\[|[A-Za-z_$][\w$]*\.[\w$]+\s*\()/g;
  let lm;
  while ((lm = localRe.exec(src))) {
    const start = lm.index + lm[0].length - 1;
    const end = matchBracket(src, start);
    if (end < 0) continue;
    locals.set(lm[1], src.slice(lm.index + lm[0].indexOf(lm[2]), end + 1));
  }

  // Spans of every invalidate/remove/refetch/reset call's argument list.
  const invalidatorSpans = [];
  INVALIDATOR.lastIndex = 0;
  let im;
  while ((im = INVALIDATOR.exec(src))) {
    const paren = im.index + im[0].length - 1;
    const end = matchBracket(src, paren);
    if (end > 0) invalidatorSpans.push([paren, end]);
  }

  const fetches = [];
  const invalidations = [];
  const keyRe = /queryKey:\s*/g;
  let km;
  while ((km = keyRe.exec(src))) {
    const exprStart = km.index + km[0].length;
    // Grab the expression: an array/call literal, or a bare identifier.
    let exprText;
    if (src[exprStart] === "[") {
      const end = matchBracket(src, exprStart);
      if (end < 0) continue;
      exprText = src.slice(exprStart, end + 1);
    } else {
      const rest = src.slice(exprStart, exprStart + 400);
      const stop = /^[^,\n}]*/.exec(rest)[0];
      exprText = stop.trim().replace(/,$/, "");
      const openParen = exprText.indexOf("(");
      if (openParen >= 0) {
        const abs = exprStart + openParen;
        const end = matchBracket(src, abs);
        if (end > 0) exprText = src.slice(exprStart, end + 1);
      }
    }
    const segs = resolve(exprText, factories, locals);
    const inInvalidator = invalidatorSpans.some(([a, b]) => km.index > a && km.index < b);
    const record = {
      file: rel,
      line: lineAt(km.index),
      text: exprText.replace(/\s+/g, " ").slice(0, 100),
      segs,
    };
    (inInvalidator ? invalidations : fetches).push(record);
  }
  return { fetches, invalidations };
}

/** Does fetch key F satisfy `partialMatchKey(F, I)` for invalidation key I? */
function reaches(fetchSegs, invSegs) {
  if (fetchSegs.length < invSegs.length) return false;
  for (let i = 0; i < invSegs.length; i++) {
    const a = fetchSegs[i];
    const b = invSegs[i];
    if (a === WILDCARD || b === WILDCARD) continue;
    if (a !== b) return false;
  }
  return true;
}

const isApiKey = (segs) =>
  Array.isArray(segs) && typeof segs[0] === "string" && segs[0].startsWith("/api/");

/**
 * The URL path a key addresses, using only its LEADING LITERAL segments —
 * `buildQueryUrl` joins with "/", so this is the real request path up to the
 * first thing we can't see statically.
 *
 *   ["/api/task-engine", "metrics"]            → "/api/task-engine/metrics"
 *   ["/api/task-engine/metrics"]               → "/api/task-engine/metrics"
 *   ["/api/staff/applications", id, "cockpit"] → "/api/staff/applications"
 *
 * The first two are spelled differently and address the same URL — which is the
 * whole point. Comparing PATHS instead of key arrays is what lets the guard see
 * that a flat-spelled key lives inside the subtree a segmented prefix targets.
 */
function urlPath(segs) {
  const out = [];
  for (const s of segs) {
    if (s === WILDCARD) break;
    out.push(String(s));
  }
  return out.join("/").replace(/\/+$/, "");
}

/** Is `child` at or below `parent` in the URL tree? */
const inSubtree = (child, parent) => child === parent || child.startsWith(parent + "/");

function main() {
  const factories = buildFactoryTable();
  const allFetches = [];
  const allInvalidations = [];
  for (const file of sourceFiles(CLIENT_SRC)) {
    if (file === FACTORY_FILE) continue; // definitions, not call sites
    const { fetches, invalidations } = scanFile(file, factories);
    allFetches.push(...fetches);
    allInvalidations.push(...invalidations);
  }

  const fetchKeys = allFetches.filter((f) => isApiKey(f.segs));
  const dead = allInvalidations
    .filter((inv) => isApiKey(inv.segs))
    .filter((inv) => !fetchKeys.some((f) => reaches(f.segs, inv.segs)));

  const invKeys = allInvalidations.filter((inv) => isApiKey(inv.segs));
  const unreachable = fetchKeys.filter(
    (f) => !invKeys.some((inv) => reaches(f.segs, inv.segs)),
  );

  // A fetch key is a FAILURE only when an invalidation IN THE SAME FILE targets
  // the URL subtree it lives in, yet is spelled so it misses this key.
  //
  // Same-file is the conservative proxy for "this mutation is meant to refresh
  // this query". Without a render graph we cannot know whether two surfaces are
  // ever mounted together, and the cross-file cases are dominated by legitimate
  // ones: /api/application-invites/validate is a public invite landing that has
  // nothing to do with the staff invite list, and loanApplicationKeys.draftLatest
  // is a documented fixed-path leaf that `all()` deliberately does not reach.
  // Flagging those would train people to ignore the guard, which is how a
  // required check dies. Same-file misses are unambiguous — the Task Operations
  // and GapCalculator bugs were both a mutation and its own queries in one file.
  //
  // Two further exclusions:
  //   - the invalidation must be at or ABOVE the fetch in the URL tree
  //     (inv.segs.length <= fetch.segs.length): a narrower invalidation such as
  //     [".../applications", id, "cockpit"] legitimately does not refresh the
  //     broader [".../applications"] list.
  const orphaned = unreachable
    .map((f) => {
      const fp = urlPath(f.segs);
      const target = invKeys.find(
        (inv) =>
          inv.file === f.file &&
          inv.segs.length <= f.segs.length &&
          inSubtree(fp, urlPath(inv.segs)),
      );
      return target ? { ...f, target } : null;
    })
    .filter(Boolean);

  const total = fetchKeys.length + allInvalidations.filter((i) => isApiKey(i.segs)).length;
  console.log(
    `guard:reachability — ${factories.size} factory keys, ${fetchKeys.length} fetch keys, ` +
      `${allInvalidations.filter((i) => isApiKey(i.segs)).length} invalidation keys resolved ` +
      `(${total} /api sites).`,
  );

  if (unreachable.length) {
    console.log(
      `\n⚠️  ${unreachable.length} fetched /api key(s) that no invalidation can reach. ` +
        `Fine for read-only surfaces — a warning, not a failure:`,
    );
    for (const f of unreachable.slice(0, 40)) {
      console.log(`   ${f.file}:${f.line}  ${f.text}`);
    }
    if (unreachable.length > 40) console.log(`   … and ${unreachable.length - 40} more`);
  }

  if (orphaned.length) {
    console.log(
      `\n❌ guard:reachability — ${orphaned.length} fetch key(s) that NO invalidation reaches,\n` +
        `   in a family that IS invalidated elsewhere. Something writes this resource and\n` +
        `   believes it refreshes these queries; it does not. Usually a flat-spelled key\n` +
        `   ("/api/x/y") sitting in a family invalidated by a segmented prefix ["/api/x"]:`,
    );
    for (const f of orphaned) {
      const shown = f.segs.map((s) => (s === WILDCARD ? "<var>" : JSON.stringify(s))).join(", ");
      console.log(`   ${f.file}:${f.line}  [${shown}]`);
      console.log(
        `      ↳ targeted by ${f.target.file}:${f.target.line} ` +
          `(invalidates ${urlPath(f.target.segs)}) — but this key never matches it`,
      );
    }
  }

  if (!dead.length && !orphaned.length) {
    console.log("\n✅ guard:reachability — OK (every /api invalidation matches a real fetch key)");
    return 0;
  }

  if (!dead.length) return 1;

  console.log(
    `\n❌ guard:reachability — ${dead.length} invalidation key(s) that match NO fetch key.\n` +
      `   partialMatchKey compares queryKey arrays ELEMENT BY ELEMENT — it is not a\n` +
      `   string-prefix test. ["/api/x"] does NOT match ["/api/x/y"]; it matches\n` +
      `   ["/api/x", "y"]. These mutations refresh nothing, silently:`,
  );
  for (const d of dead) {
    const shown = d.segs.map((s) => (s === WILDCARD ? "<var>" : JSON.stringify(s))).join(", ");
    console.log(`   ${d.file}:${d.line}  [${shown}]`);
  }
  console.log(
    `\n   Fix: invalidate a key the queries actually share a prefix with, or\n` +
      `   re-segment the fetch keys under that prefix (buildQueryUrl joins with "/",\n` +
      `   so segmenting a path leaves the fetched URL unchanged). Add a factory in\n` +
      `   client/src/lib/queryClient.ts so both halves are built from one place.`,
  );
  return 1;
}

process.exit(main());
