import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { describe, it, expect } from "vitest";
import {
  loanApplicationKeys,
  dashboardKeys,
  taskKeys,
  calculatorResultKeys,
  coachConversationKeys,
  onboardingStatusKeys,
} from "../client/src/lib/queryClient";

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
      // A query-string key ("?input=x") cannot be expressed as path segments and
      // is never invalidated by prefix — allowed as a leaf. Mirrors the semantic
      // rule in scripts/query-key-guard.cjs (keep the two in step).
      if (url.includes("?")) return;
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
  it("writes path-style keys as segments, not interpolated template strings (surface-wide)", () => {
    // Surface-wide, not limited to the migrated families: any `${...}` in a
    // path-style /api key is the drift hazard. Query-string keys are excluded in
    // templateKeySites() above. Same rule the gate runs via guard:querykeys.
    const offenders = templateKeySites();

    expect(
      offenders.map((o) => `${o.file}:${o.line}  ${o.text}`),
      "A template-string queryKey is invisible to array-prefix invalidateQueries, " +
        "so mutations elsewhere will not refresh it. Write it as segments " +
        '(["/api/x", id, "y"]) — from a factory in client/src/lib/queryClient.ts ' +
        "where the resource has one.",
    ).toEqual([]);
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
    [loanApplicationKeys.offers(ID), "/api/loan-applications/app-123/offers"],
    [loanApplicationKeys.properties(ID), "/api/loan-applications/app-123/properties"],
    [loanApplicationKeys.prequalStatus(ID), "/api/loan-applications/app-123/prequal-status"],
    [loanApplicationKeys.letterStatus(ID), "/api/loan-applications/app-123/letter-status"],
    [loanApplicationKeys.loanEstimate(ID), "/api/loan-applications/app-123/loan-estimate"],
    [loanApplicationKeys.hmda(ID), "/api/loan-applications/app-123/hmda"],
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
    [loanApplicationKeys.credit.root(ID), "/api/loan-applications/app-123/credit"],
    [loanApplicationKeys.credit.summary(ID), "/api/loan-applications/app-123/credit/summary"],
    [loanApplicationKeys.credit.auditLog(ID), "/api/loan-applications/app-123/credit/audit-log"],
    [loanApplicationKeys.credit.draft(ID), "/api/loan-applications/app-123/credit/draft"],
    [
      loanApplicationKeys.credit.adverseActions(ID),
      "/api/loan-applications/app-123/credit/adverse-actions",
    ],
    [loanApplicationKeys.draftLatest(), "/api/loan-applications/draft/latest"],
  ])("joins to the same URL the template string produced: %s", (key, url) => {
    expect(key.join("/")).toBe(url);
  });

  it("nests every child under the detail prefix so invalidation reaches it", () => {
    const prefix = loanApplicationKeys.detail(ID);
    const children = [
      loanApplicationKeys.pipeline(ID),
      loanApplicationKeys.options(ID),
      loanApplicationKeys.offers(ID),
      loanApplicationKeys.properties(ID),
      loanApplicationKeys.prequalStatus(ID),
      loanApplicationKeys.letterStatus(ID),
      loanApplicationKeys.loanEstimate(ID),
      loanApplicationKeys.hmda(ID),
      loanApplicationKeys.submissionReadiness(ID),
      loanApplicationKeys.lenderSubmissions(ID),
      loanApplicationKeys.changeOfCircumstances(ID),
      // The whole credit sub-tree must also be reachable from the detail prefix.
      loanApplicationKeys.credit.root(ID),
      loanApplicationKeys.credit.summary(ID),
      loanApplicationKeys.credit.auditLog(ID),
      loanApplicationKeys.credit.draft(ID),
      loanApplicationKeys.credit.adverseActions(ID),
    ];
    for (const child of children) {
      // This slice comparison is exactly what TanStack Query's partial matching
      // does — if it holds, invalidating `prefix` refetches `child`.
      expect(child.slice(0, prefix.length)).toEqual([...prefix]);
    }
  });

  it("nests the credit leaves under the credit prefix too", () => {
    // Panels that touch only credit invalidate `credit.root`; that must reach
    // every credit leaf without also invalidating unrelated application queries.
    const creditPrefix = loanApplicationKeys.credit.root(ID);
    const leaves = [
      loanApplicationKeys.credit.summary(ID),
      loanApplicationKeys.credit.auditLog(ID),
      loanApplicationKeys.credit.draft(ID),
      loanApplicationKeys.credit.adverseActions(ID),
    ];
    for (const leaf of leaves) {
      expect(leaf.slice(0, creditPrefix.length)).toEqual([...creditPrefix]);
    }
    // ...but a non-credit sibling is NOT under the credit prefix.
    expect(
      loanApplicationKeys.pipeline(ID).slice(0, creditPrefix.length),
    ).not.toEqual([...creditPrefix]);
  });

  it("draftLatest is a fixed path, not nested under a detail id", () => {
    // It is its own resource; invalidating a specific file must not touch it.
    const someFile = loanApplicationKeys.detail(ID);
    const draft = loanApplicationKeys.draftLatest();
    expect(draft.slice(0, someFile.length)).not.toEqual([...someFile]);
  });

  it("scopes to one application — a sibling file is not invalidated", () => {
    const prefix = loanApplicationKeys.detail("app-A");
    const other = loanApplicationKeys.pipeline("app-B");
    expect(other.slice(0, prefix.length)).not.toEqual([...prefix]);
  });
});

describe("sibling resource key factories (batch 1)", () => {
  const ID = "id-1";

  // Each factory must join to the exact URL the hand-typed literal produced, so
  // swapping a call site to the factory is a pure refactor with no URL change.
  it.each([
    [dashboardKeys.root(), "/api/dashboard"],
    [taskKeys.all(), "/api/tasks"],
    [taskKeys.detail(ID), "/api/tasks/id-1"],
    [calculatorResultKeys.all(), "/api/calculator-results"],
    [coachConversationKeys.all(), "/api/coach/conversations"],
    [coachConversationKeys.detail(ID), "/api/coach/conversations/id-1"],
    [onboardingStatusKeys.root(), "/api/onboarding/status"],
  ])("joins to the endpoint URL: %s", (key, url) => {
    expect(key.join("/")).toBe(url);
  });

  it("nests a task detail under the task-list prefix (invalidation reaches it)", () => {
    const prefix = taskKeys.all();
    expect(taskKeys.detail(ID).slice(0, prefix.length)).toEqual([...prefix]);
  });

  it("nests a coach conversation under the conversations prefix", () => {
    const prefix = coachConversationKeys.all();
    expect(coachConversationKeys.detail(ID).slice(0, prefix.length)).toEqual([...prefix]);
  });
});
