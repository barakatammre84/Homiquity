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
  consentKeys,
  consentTemplateKeys,
  taskEngineKeys,
  applicationResourceKeys,
  homeownershipGoalKeys,
  autopilotKeys,
  borrowerGraphKeys,
  predictionKeys,
  buildQueryUrl,
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


// -----------------------------------------------------------------------------
// Reachability: an invalidation prefix must ACTUALLY match its family's keys.
//
// The shape rules above stop a template-string key. They do not stop the other
// half of the same hazard: a key written as a perfectly good segment array that
// no invalidation can reach. `partialMatchKey` compares queryKey arrays ELEMENT
// BY ELEMENT — ["/api/task-engine"] does NOT match ["/api/task-engine/metrics"].
// Four families shipped with that mistake; Task Operations was the visible one
// (escalate / status-update refreshed nothing, so a changed task kept rendering
// its old status). `scripts/query-key-reachability.cjs` is the surface-wide
// guard; these are the unit-level assertions for the families it protects.
// -----------------------------------------------------------------------------

/**
 * query-core's matcher, reimplemented so these tests assert REAL behaviour
 * rather than our belief about it. Faithful to
 * node_modules/@tanstack/query-core — arrays compare element-wise over the
 * FILTER's length, which is exactly why a longer path string never matches a
 * shorter one.
 */
function partialMatchKey(queryKey: readonly unknown[], filterKey: readonly unknown[]): boolean {
  if (queryKey.length < filterKey.length) return false;
  return filterKey.every((seg, i) => seg === queryKey[i]);
}

describe("partialMatchKey is element-wise, not a string prefix", () => {
  it("does NOT match a flat path against a shorter prefix (the original bug)", () => {
    expect(partialMatchKey(["/api/task-engine/metrics"], ["/api/task-engine"])).toBe(false);
    expect(partialMatchKey(["/api/consents/me"], ["/api/consents"])).toBe(false);
  });

  it("DOES match once the path is segmented", () => {
    expect(partialMatchKey(["/api/task-engine", "metrics"], ["/api/task-engine"])).toBe(true);
    expect(partialMatchKey(["/api/consents", "me"], ["/api/consents"])).toBe(true);
  });

  it("does not match a narrower filter against a broader key", () => {
    // Invalidating one file's cockpit must not claim to refresh the whole list.
    expect(
      partialMatchKey(["/api/staff/applications"], ["/api/staff/applications", "id", "cockpit"]),
    ).toBe(false);
  });
});

describe("re-segmented families keep their URLs", () => {
  const ID = "app-1";

  // The refactor's safety property: segmenting a path changes the CACHE KEY and
  // must not change the REQUEST. If any of these drift, a page silently 404s.
  it.each([
    [consentKeys.me(), "/api/consents/me"],
    [consentKeys.check(ID, "anti_steering"), "/api/consents/check/app-1/anti_steering"],
    [taskEngineKeys.metrics(), "/api/task-engine/metrics"],
    [taskEngineKeys.slaClasses(), "/api/task-engine/sla-classes"],
    [taskEngineKeys.myTasks(), "/api/task-engine/my-tasks"],
    [taskEngineKeys.tasksByRole("underwriter"), "/api/task-engine/tasks/by-role/underwriter"],
    [taskEngineKeys.borrowerTasks(ID), "/api/task-engine/applications/app-1/borrower-tasks"],
    [applicationResourceKeys.documentChecklist(ID), "/api/applications/app-1/document-checklist"],
    [applicationResourceKeys.team(ID), "/api/applications/app-1/team"],
    [homeownershipGoalKeys.all(), "/api/homeownership-goal"],
    [homeownershipGoalKeys.gapAnalysis(), "/api/homeownership-goal/gap-analysis"],
    [homeownershipGoalKeys.creditRecommendations(), "/api/homeownership-goal/credit-recommendations"],
  ])("joins to the endpoint URL: %s", (key, url) => {
    expect(key.join("/")).toBe(url);
  });
});

// -----------------------------------------------------------------------------
// Query-string params ride in the key as a trailing OBJECT.
//
// The block above asserts `key.join("/")`, which only describes all-scalar keys.
// These four families address endpoints that read `?params`, and each of them
// SHIPPED with a bare scalar segment plus a hand-written queryFn that fetched a
// different URL — so the key was decorative and the queryFn was the only thing
// making the request work. `scripts/query-key-transport-guard.cjs` now bans the
// hand-written queryFn; this pins that the keys resolve to the real endpoints
// without one.
// -----------------------------------------------------------------------------
describe("params-object keys resolve to the endpoint they name", () => {
  const RANGE = { from: "2026-07-07T00:00:00.000Z", to: "2026-08-06T00:00:00.000Z" };

  it.each([
    [borrowerGraphKeys.all(), "/api/borrower-graph"],
    [borrowerGraphKeys.affordability(450000), "/api/borrower-graph/affordability?price=450000"],
    [predictionKeys.me("app-1"), "/api/predictions/me?applicationId=app-1"],
    [predictionKeys.benchmark(), "/api/predictions/benchmark"],
    [consentTemplateKeys.byType("tax_document_use"), "/api/consent-templates?type=tax_document_use"],
    [autopilotKeys.config(), "/api/autopilot/config"],
    [autopilotKeys.status("app-1"), "/api/autopilot/status/app-1"],
    [
      autopilotKeys.metrics(RANGE),
      `/api/autopilot/metrics?from=${encodeURIComponent(RANGE.from)}&to=${encodeURIComponent(RANGE.to)}`,
    ],
    [
      autopilotKeys.metricsTrend(RANGE),
      `/api/autopilot/metrics/trend?from=${encodeURIComponent(RANGE.from)}&to=${encodeURIComponent(RANGE.to)}`,
    ],
  ])("builds %s", (key, url) => {
    expect(buildQueryUrl(key)).toBe(url);
  });

  it("omits an absent optional param rather than sending an empty one", () => {
    // PredictionInsights renders without an application id on a fresh file.
    expect(buildQueryUrl(predictionKeys.me(undefined))).toBe("/api/predictions/me");
  });

  it("documents the shapes these replaced — every one named a path that 404s", () => {
    // Not asserting on live code: this is the defect the params-object form
    // exists to prevent. Each of these was a real shipped key whose URL the
    // server does not serve, masked by a queryFn that fetched something else.
    expect(buildQueryUrl(["/api/borrower-graph/affordability", 450000])).toBe(
      "/api/borrower-graph/affordability/450000",
    );
    expect(buildQueryUrl(["/api/predictions/me", "app-1"])).toBe("/api/predictions/me/app-1");
    expect(buildQueryUrl(["/api/consent-templates", "tax_document_use"])).toBe(
      "/api/consent-templates/tax_document_use",
    );
    expect(buildQueryUrl(["/api/autopilot/metrics", 30])).toBe("/api/autopilot/metrics/30");
  });

  it("gives one endpoint ONE identity across call sites", () => {
    // ConsentGateCard and TaxReturnInsightCard read the same endpoint two
    // different ways, so identical data occupied two entries and no single
    // invalidation could reach both. Both now build from this factory.
    expect(consentTemplateKeys.byType("tax_document_use")).toEqual(
      consentTemplateKeys.byType("tax_document_use"),
    );
    expect(partialMatchKey(consentTemplateKeys.byType("x"), consentTemplateKeys.all())).toBe(true);
  });
});

describe("every family root reaches its own children", () => {
  const ID = "app-1";

  it.each([
    ["consents", consentKeys.all(), [consentKeys.me(), consentKeys.check(ID, "anti_steering")]],
    [
      "task-engine",
      taskEngineKeys.all(),
      [
        taskEngineKeys.metrics(),
        taskEngineKeys.slaClasses(),
        taskEngineKeys.myTasks(),
        taskEngineKeys.tasksByRole("underwriter"),
        taskEngineKeys.borrowerTasks(ID),
      ],
    ],
    [
      "applications",
      applicationResourceKeys.all(),
      [applicationResourceKeys.documentChecklist(ID), applicationResourceKeys.team(ID)],
    ],
    [
      "homeownership-goal",
      homeownershipGoalKeys.all(),
      [homeownershipGoalKeys.gapAnalysis(), homeownershipGoalKeys.creditRecommendations()],
    ],
    [
      // The status entry is written by the SSE stream via setQueryData, so it is
      // a normal cache entry a mutation can invalidate — not a parallel store.
      "autopilot",
      autopilotKeys.all(),
      [
        autopilotKeys.config(),
        autopilotKeys.status(ID),
        autopilotKeys.metrics({ from: "a", to: "b" }),
        autopilotKeys.metricsTrend({ from: "a", to: "b" }),
      ],
    ],
  ])("%s: all() matches every child", (_name, root, children) => {
    for (const child of children) {
      expect(partialMatchKey(child, root)).toBe(true);
    }
  });

  it("homeownershipGoalKeys.all() reaches credit-recommendations", () => {
    // The specific miss: GapCalculator invalidated the goal and the gap analysis
    // by hand and omitted this third sibling, so saving a new target left the
    // credit advice computed against the OLD one.
    expect(
      partialMatchKey(homeownershipGoalKeys.creditRecommendations(), homeownershipGoalKeys.all()),
    ).toBe(true);
  });
});
