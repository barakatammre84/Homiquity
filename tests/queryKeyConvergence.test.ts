import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { describe, it, expect } from "vitest";
import { loanApplicationKeys } from "../client/src/lib/queryClient";

// -----------------------------------------------------------------------------
// Nested resource query keys must be written as SEGMENTS, not as one template
// string.
//
// The default queryFn builds the URL with `queryKey.join("/")`, so
//   [`/api/loan-applications/${id}/options`]        (one string)
//   ["/api/loan-applications", id, "options"]       (segments)
// fetch the *same URL* — but they are two different cache entries, and
// invalidateQueries matches by ARRAY PREFIX. A broad, correct-looking
// `invalidateQueries({ queryKey: ["/api/loan-applications", id] })` therefore
// refreshes every segmented child and silently misses every template-string
// one.
//
// That was a real defect: the submission-readiness and lender-submission panels
// kept rendering pre-change data after a staff status/condition change, because
// the six call sites that invalidate the `["/api/loan-applications", id]`
// prefix could not match their single-string keys.
//
// Build loan-application keys from `loanApplicationKeys` in
// client/src/lib/queryClient.ts.
// -----------------------------------------------------------------------------

const REPO_ROOT = join(__dirname, "..");
const CLIENT_SRC = join(REPO_ROOT, "client", "src");

/**
 * Template-string query keys that are correct as they are.
 * Key = "path:line-content-substring", value = why it must stay one string.
 */
const ALLOWED_TEMPLATE_KEYS: Record<string, string> = {
  // A query string cannot be expressed as path segments — join("/") would turn
  // "?input=x" into a path. These are leaf keys with no prefix invalidation.
  "client/src/components/ScenarioSimulatorDialog.tsx":
    "query-string URLs (/api/properties/auto-complete?input=, /detail-live?propertyId=) — not path segments, and nothing invalidates them by prefix",
  // Self-consistent: both sites use the identical template, so they share one
  // cache entry, and no code invalidates the /api/staff/applications prefix.
  "client/src/pages/staff/LoCommandCenter.tsx":
    "/api/staff/applications/:id/cockpit — both call sites use the identical template (one cache entry) and no prefix invalidation targets this family",
};

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** `queryKey: [` whose first element is a backtick template literal. */
const TEMPLATE_KEY = /queryKey:\s*\[\s*`([^`]*)`/;

function templateKeySites(): Array<{ file: string; line: number; text: string }> {
  const hits: Array<{ file: string; line: number; text: string }> = [];
  for (const file of sourceFiles(CLIENT_SRC)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      const match = TEMPLATE_KEY.exec(line);
      if (!match) return;
      const url = match[1];
      // Only interpolated keys can fragment a resource family; a constant
      // template string is just a plain key.
      if (!url.includes("${")) return;
      hits.push({
        file: relative(REPO_ROOT, file),
        line: i + 1,
        text: line.trim(),
      });
    });
  }
  return hits;
}

describe("query-key convergence", () => {
  it("writes nested resource keys as segments, not template strings", () => {
    const offenders = templateKeySites().filter(
      (h) => !(h.file in ALLOWED_TEMPLATE_KEYS),
    );

    expect(
      offenders.map((o) => `${o.file}:${o.line}  ${o.text}`),
      "A template-string queryKey is invisible to array-prefix invalidateQueries, " +
        "so mutations elsewhere will not refresh it. Use a key factory such as " +
        "loanApplicationKeys in client/src/lib/queryClient.ts, or add the file to " +
        "ALLOWED_TEMPLATE_KEYS in this test with the reason it must stay one string.",
    ).toEqual([]);
  });

  it("keeps the allowlist honest — every entry still has a template key", () => {
    const filesWithTemplateKeys = new Set(templateKeySites().map((h) => h.file));
    const stale = Object.keys(ALLOWED_TEMPLATE_KEYS).filter(
      (f) => !filesWithTemplateKeys.has(f),
    );
    expect(stale, "these allowlist entries no longer contain a template query key").toEqual([]);
  });

  it("no loan-application key is written as a template string", () => {
    // The specific family the prefix invalidations depend on. Stricter than the
    // general rule above: this one has no allowlist at all.
    const offenders = templateKeySites().filter((h) =>
      h.text.includes("/api/loan-applications"),
    );
    expect(offenders.map((o) => `${o.file}:${o.line}  ${o.text}`)).toEqual([]);
  });
});

describe("loanApplicationKeys", () => {
  const ID = "app-123";

  // The refactor is only safe if the segmented key produces the byte-identical
  // URL the template string used to produce — the default queryFn joins on "/".
  it.each([
    [loanApplicationKeys.detail(ID), "/api/loan-applications/app-123"],
    [loanApplicationKeys.pipeline(ID), "/api/loan-applications/app-123/pipeline"],
    [loanApplicationKeys.options(ID), "/api/loan-applications/app-123/options"],
    [
      loanApplicationKeys.submissionReadiness(ID),
      "/api/loan-applications/app-123/submission-readiness",
    ],
    [
      loanApplicationKeys.lenderSubmissions(ID),
      "/api/loan-applications/app-123/lender-submissions",
    ],
    [
      loanApplicationKeys.changeOfCircumstances(ID),
      "/api/loan-applications/app-123/change-of-circumstances",
    ],
  ])("joins to the same URL the template string produced: %s", (key, url) => {
    expect(key.join("/")).toBe(url);
  });

  it("nests every child under the detail prefix so invalidation reaches it", () => {
    const prefix = loanApplicationKeys.detail(ID);
    const children = [
      loanApplicationKeys.pipeline(ID),
      loanApplicationKeys.options(ID),
      loanApplicationKeys.submissionReadiness(ID),
      loanApplicationKeys.lenderSubmissions(ID),
      loanApplicationKeys.changeOfCircumstances(ID),
    ];
    for (const child of children) {
      // This slice comparison is exactly what TanStack Query's partial matching
      // does — if it holds, invalidating `prefix` refetches `child`.
      expect(child.slice(0, prefix.length)).toEqual([...prefix]);
    }
  });

  it("scopes to one application — a sibling file is not invalidated", () => {
    const prefix = loanApplicationKeys.detail("app-A");
    const other = loanApplicationKeys.pipeline("app-B");
    expect(other.slice(0, prefix.length)).not.toEqual([...prefix]);
  });
});
