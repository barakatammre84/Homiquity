import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Latches while a redirect to /login is already in flight, so a burst of
// concurrent 401s doesn't queue N navigations.
let sessionExpiredHandled = false;

/** Pre-auth surfaces: a 401 here is a *failed sign-in*, not an expired session. */
const PRE_AUTH_PATHS = ["/", "/login", "/signup"];

function handleSessionExpired() {
  // Order matters. The path check MUST come before the latch is consumed:
  // POST /api/auth/login answers 401 on a wrong password (server/auth.ts:155),
  // so setting the latch first meant one typo on /login burned it for the whole
  // tab — and the real session expiry, hours later, then redirected nowhere.
  const currentPath = window.location.pathname;
  if (PRE_AUTH_PATHS.includes(currentPath)) return;

  if (sessionExpiredHandled) return;
  sessionExpiredHandled = true;

  setTimeout(() => {
    window.location.href = "/login";
  }, 100);
}

/**
 * What `apiRequest` throws on a non-2xx. The `message` keeps the historical
 * `"<status>: <body>"` shape that `friendlyApiError` parses, so nothing that
 * only reads the message needs to change; `status` is added so a caller can
 * branch on it (e.g. 403 → "restricted to internal staff") without parsing the
 * string back out.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function throwIfResNotOk(
  res: Response,
  /**
   * Set false for endpoints that serve signed-out visitors. A 401 there is not
   * an expired session (there was never a session), so bouncing to /login would
   * throw a browsing visitor out of a public page.
   */
  { sessionRedirect = true }: { sessionRedirect?: boolean } = {},
) {
  // Any 2xx proves the session is alive again, so the latch must not outlive it
  // (re-login in the same tab, or a 401 that turned out to be transient).
  if (res.ok) {
    sessionExpiredHandled = false;
    return;
  }
  if (res.status === 401 && sessionRedirect) {
    const url = typeof res.url === "string" ? res.url : "";
    // Background shell polls should not trigger a login redirect on their own;
    // /api/shell/badges is the consolidated badge poll that replaced the
    // per-count polls.
    const isBackgroundPoll =
      url.includes("/api/auth/user") ||
      url.includes("/api/notifications/unread-count") ||
      url.includes("/api/shell/badges");
    if (!isBackgroundPoll) {
      handleSessionExpired();
    }
  }
  const text = (await res.text()) || res.statusText;
  throw new ApiError(res.status, `${res.status}: ${text}`);
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

/**
 * Build a request URL from a query key.
 *
 * Scalar segments join with "/" (the historical behaviour); a trailing plain
 * object becomes the query string. That makes `["/api/faqs", { search, category }]`
 * a complete description of the request — which matters because the key is
 * *already* how the cache identifies it, so the two can never disagree.
 *
 * Empty, null and undefined params are dropped, so an unset filter produces
 * `/api/faqs` rather than `/api/faqs?search=&category=`.
 */
export function buildQueryUrl(queryKey: readonly unknown[]): string {
  const last = queryKey[queryKey.length - 1];
  const hasParams =
    typeof last === "object" && last !== null && !Array.isArray(last);

  const segments = (hasParams ? queryKey.slice(0, -1) : queryKey).filter(
    (s) => s !== undefined && s !== null && s !== "",
  );
  const path = segments.join("/");
  if (!hasParams) return path;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(last as Record<string, unknown>)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Query function for endpoints that serve signed-out visitors (rates, articles,
 * FAQs, agent search, invite validation).
 *
 * Public pages used to hand-roll `fetch` + `if (!res.ok) throw new Error(...)`
 * inside every `queryFn`. That produced a second, quieter transport contract:
 * a bare `Error` instead of `ApiError`, so `friendlyApiError` could not read the
 * server's own message envelope and a deliberate 503 (INTAKE_PAUSED) surfaced as
 * "Failed to fetch rates". It was also copy-paste bait — the pattern carries no
 * signal that it drops 401 handling, so an authed page cloned from a rates page
 * would silently lose the session-expiry redirect.
 *
 * This keeps the one thing those hand-rolled fetches got right — no redirect on
 * 401 — but makes it an explicit, documented mode of the shared transport rather
 * than a side effect of bypassing it. Errors are `ApiError`, so public and
 * authed surfaces report failures identically.
 *
 * Use `getQueryFn` (the default) for anything behind the session.
 */
export const getPublicQueryFn =
  <T>(): QueryFunction<T> =>
  async ({ queryKey }) => {
    // No `credentials: "include"` — these endpoints are public, so there is no
    // reason to attach the session cookie.
    const res = await fetch(buildQueryUrl(queryKey));
    await throwIfResNotOk(res, { sessionRedirect: false });
    return (await res.json()) as T;
  };

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * THE query keys for the loan-application resource family.
 *
 * The default `getQueryFn` above builds the URL with `queryKey.join("/")`, so a
 * key written as one template string (`` [`/api/loan-applications/${id}/options`] ``)
 * and one written as segments (`["/api/loan-applications", id, "options"]`)
 * fetch the *same URL* — but they are two different cache entries, and only the
 * segmented form participates in prefix invalidation.
 *
 * That distinction was silently breaking refreshes: `invalidateQueries({
 * queryKey: ["/api/loan-applications", id] })` — fired from BorrowerFile,
 * StatusUpdateDialog, CreditTab, ConditionsTab, DocumentReviewPanel and
 * LoanPipeline — matches every segmented child but *cannot* match a
 * single-string key, so the submission-readiness and lender-submission panels
 * kept rendering pre-change data until a hard reload.
 *
 * Always build loan-application keys from here. Never hand-write a
 * `` [`/api/loan-applications/${id}/...`] `` template key — `pnpm guard:querykeys`
 * fails the build on one.
 */
export const loanApplicationKeys = {
  /** The whole family — invalidates every application query, list included. */
  all: () => ["/api/loan-applications"] as const,
  /** One file and everything nested under it (the common invalidation prefix). */
  detail: (id: string) => ["/api/loan-applications", id] as const,
  pipeline: (id: string) => ["/api/loan-applications", id, "pipeline"] as const,
  options: (id: string) => ["/api/loan-applications", id, "options"] as const,
  offers: (id: string) => ["/api/loan-applications", id, "offers"] as const,
  properties: (id: string) => ["/api/loan-applications", id, "properties"] as const,
  prequalStatus: (id: string) => ["/api/loan-applications", id, "prequal-status"] as const,
  letterStatus: (id: string) => ["/api/loan-applications", id, "letter-status"] as const,
  loanEstimate: (id: string) => ["/api/loan-applications", id, "loan-estimate"] as const,
  hmda: (id: string) => ["/api/loan-applications", id, "hmda"] as const,
  incomeSummary: (id: string) => ["/api/loan-applications", id, "income-summary"] as const,
  submissionReadiness: (id: string) =>
    ["/api/loan-applications", id, "submission-readiness"] as const,
  lenderSubmissions: (id: string) =>
    ["/api/loan-applications", id, "lender-submissions"] as const,
  changeOfCircumstances: (id: string) =>
    ["/api/loan-applications", id, "change-of-circumstances"] as const,
  /**
   * Credit sub-tree. Kept fully SEGMENTED on purpose: the codebase currently
   * mixes `[id, "credit", "summary"]` with `[id, "credit/adverse-actions"]`,
   * which join to the same URL but are *different* cache keys — an invalidation
   * written one way never matches a fetch written the other. These are the one
   * canonical form; the migration rewrites both spellings to them.
   */
  credit: {
    root: (id: string) => ["/api/loan-applications", id, "credit"] as const,
    summary: (id: string) => ["/api/loan-applications", id, "credit", "summary"] as const,
    auditLog: (id: string) => ["/api/loan-applications", id, "credit", "audit-log"] as const,
    draft: (id: string) => ["/api/loan-applications", id, "credit", "draft"] as const,
    adverseActions: (id: string) =>
      ["/api/loan-applications", id, "credit", "adverse-actions"] as const,
  },
  /** Fixed-path resource: the borrower's latest in-progress draft. */
  draftLatest: () => ["/api/loan-applications/draft/latest"] as const,
};

/**
 * Sibling key factories for the other high-churn resources (batch 1 of the
 * migration: dashboard, tasks, calculator-results, coach/conversations,
 * onboarding/status). Same rule as above — build keys here, never hand-type the
 * `/api/...` literal at the call site, so fetch and invalidation cannot drift.
 *
 * NOTE: `/api/auth/user` is intentionally absent — it lives behind useAuth,
 * which is the pattern these factories generalise. `/api/applications`
 * (document-checklist / team) is a DIFFERENT endpoint from
 * `/api/loan-applications` and is deferred to a later batch; it is not modelled
 * here so nobody conflates the two.
 */
export const dashboardKeys = {
  root: () => ["/api/dashboard"] as const,
};

export const taskKeys = {
  all: () => ["/api/tasks"] as const,
  detail: (id: string) => ["/api/tasks", id] as const,
};

export const calculatorResultKeys = {
  all: () => ["/api/calculator-results"] as const,
};

export const coachConversationKeys = {
  all: () => ["/api/coach/conversations"] as const,
  detail: (id: string) => ["/api/coach/conversations", id] as const,
};

export const onboardingStatusKeys = {
  root: () => ["/api/onboarding/status"] as const,
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
