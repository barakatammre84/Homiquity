import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { describe, it, expect } from "vitest";

// -----------------------------------------------------------------------------
// `useActiveApplication` resolves "which loan file is the borrower working on"
// and mirrors the answer into sessionStorage, so the choice follows them across
// every borrower surface. It deliberately takes the list as an ARGUMENT rather
// than fetching one — and its callers do not all pass the same list:
//
//   Dashboard / Tasks / Verification / URLAForm / ApplicationSummary
//        → /api/dashboard  .applications
//   Documents
//        → /api/loan-applications
//
// Today those agree, because both handlers call the SAME storage method. But
// nothing held them together: if either endpoint ever filters, paginates, or
// re-sorts, the two surfaces resolve DIFFERENT files — and because the hook
// writes whatever it resolved back to the shared per-tab mirror, merely
// visiting /documents would silently repoint every other page at another loan.
// That failure is invisible in code review on either side alone.
//
// These pin the invariant on both halves: one server source of truth, and no
// third list feeding the selector on the client.
// -----------------------------------------------------------------------------

const REPO_ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(REPO_ROOT, p), "utf8");

/** The one storage method both list endpoints must source from. */
const LIST_SOURCE = "getLoanApplicationsByUser";

/** Query keys that name a list the selector is allowed to be fed from. */
const SANCTIONED_LIST_KEYS = ["dashboardKeys.root()", "loanApplicationKeys.all()"];

function clientSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...clientSources(full));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** The handler body registered for `route` in `src`. */
function handlerFor(src: string, route: string): string {
  const at = src.indexOf(`app.get("${route}"`);
  expect(at, `route ${route} not found`).toBeGreaterThan(-1);
  return src.slice(at, at + 900);
}

describe("borrower application list — one server source", () => {
  it("GET /api/dashboard builds .applications from getLoanApplicationsByUser", () => {
    const handler = handlerFor(read("server/routes/lending/dashboard.ts"), "/api/dashboard");
    expect(handler).toContain(LIST_SOURCE);
  });

  it("GET /api/loan-applications returns getLoanApplicationsByUser", () => {
    const handler = handlerFor(
      read("server/routes/lending/applications.ts"),
      "/api/loan-applications",
    );
    expect(handler).toContain(LIST_SOURCE);
  });

  it("neither endpoint filters or re-sorts the list it serves", () => {
    // A WHERE/ORDER BY added on top of the shared call is exactly how the two
    // lists would diverge. Ordering belongs in the storage method, where both
    // endpoints inherit it.
    for (const [file, route] of [
      ["server/routes/lending/dashboard.ts", "/api/dashboard"],
      ["server/routes/lending/applications.ts", "/api/loan-applications"],
    ] as const) {
      const handler = handlerFor(read(file), route);
      const afterCall = handler.slice(handler.indexOf(LIST_SOURCE));
      // Look only at what happens to `applications` before it is sent.
      const reshaped = /applications\s*[.=]\s*(?:sort|filter|slice\(0)/.test(afterCall);
      expect(reshaped, `${route} reshapes the shared list before serving it`).toBe(false);
    }
  });
});

/**
 * Follow the list argument back to the query that produced it.
 *
 * "Does the file MENTION a sanctioned key" is not enough — Documents.tsx
 * mentions both (it invalidates the dashboard after an upload) while feeding
 * the selector from only one. So resolve the actual expression:
 *
 *   useActiveApplication(applications)
 *     → const applications = dashboardData?.applications || []
 *       → const { data: dashboardData } = useQuery({ queryKey: dashboardKeys.root() })
 *
 * Up to three hops, which covers every shape in use. Returns the sanctioned key
 * that ultimately feeds it, or null if the trail leaves the sanctioned set —
 * including when it simply cannot be followed, because an unreadable feed is
 * exactly the review signal this test exists to raise.
 */
function resolveListSource(src: string, argExpr: string): string | null {
  let root = argExpr.match(/[A-Za-z_$][\w$]*/)?.[0];
  for (let hop = 0; hop < 3 && root; hop++) {
    // `const <root> = ...` or `const { ..., data: <root>, ... } = ...`
    const decl = new RegExp(
      String.raw`const\s+(?:${root}\s*=|\{[^}]*\b(?:data\s*:\s*)?${root}\b[^}]*\}\s*=)`,
    ).exec(src);
    if (!decl) return null;
    const body = src.slice(decl.index, decl.index + 400);
    const key = SANCTIONED_LIST_KEYS.find((k) => body.includes(k));
    if (key) return key;
    // Not a query yet — hop to whatever this was derived from.
    const next = body.slice(decl[0].length).match(/[A-Za-z_$][\w$]*/)?.[0];
    if (!next || next === root) return null;
    root = next;
  }
  return null;
}

describe("useActiveApplication — no third list", () => {
  const callers = clientSources(join(REPO_ROOT, "client", "src"))
    .filter((f) => /useActiveApplication\s*\(/.test(readFileSync(f, "utf8")))
    .filter((f) => !f.endsWith(join("hooks", "useActiveApplication.ts")))
    .map((f) => relative(REPO_ROOT, f));

  it("has callers to check", () => {
    // A zero-caller run would make every assertion below vacuously true.
    expect(callers.length).toBeGreaterThanOrEqual(5);
  });

  it("every caller's list traces back to a sanctioned query", () => {
    for (const file of callers) {
      const src = read(file);
      const argExpr = /useActiveApplication\s*(?:<[^>]*>)?\s*\(([^)]*)\)/.exec(src)?.[1] ?? "";
      const source = resolveListSource(src, argExpr);
      expect(
        source,
        `${file} feeds useActiveApplication from \`${argExpr.trim()}\`, which does not ` +
          `trace back to ${SANCTIONED_LIST_KEYS.join(" or ")}. A third list means this ` +
          `surface can resolve a DIFFERENT active file than the rest of the app — and ` +
          `the hook writes whatever it resolved to the shared per-tab mirror, so ` +
          `visiting this page silently repoints every other borrower surface too.`,
      ).not.toBeNull();
    }
  });

  it("both sanctioned lists are actually in use (the parity above is load-bearing)", () => {
    const used = new Set(
      callers.map((file) => {
        const src = read(file);
        const argExpr = /useActiveApplication\s*(?:<[^>]*>)?\s*\(([^)]*)\)/.exec(src)?.[1] ?? "";
        return resolveListSource(src, argExpr);
      }),
    );
    // If this ever drops to one, the server-side parity test above becomes
    // decoration and can be retired along with this one.
    expect([...used].filter(Boolean).sort()).toEqual([...SANCTIONED_LIST_KEYS].sort());
  });
});
