import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Session-expiry redirect wiring.
 *
 * The regression these pin: `handleSessionExpired` used to set its latch BEFORE
 * checking the path. POST /api/auth/login answers 401 on a wrong password
 * (server/auth.ts:155), so a single typo on /login consumed the latch — and the
 * real session expiry hours later then redirected nowhere, leaving the user on a
 * dead shell throwing raw "401: Unauthorized" on every surface.
 *
 * The module keeps latch state at module scope, so every test re-imports it
 * fresh via vi.resetModules().
 */

/** Point window.location at `pathname` and capture any href assignment. */
function stubLocation(pathname: string) {
  const assigned: string[] = [];
  Object.defineProperty(window, "location", {
    value: {
      pathname,
      set href(value: string) {
        assigned.push(value);
      },
    },
    writable: true,
    configurable: true,
  });
  return assigned;
}

function stubFetchStatus(status: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(status === 200 ? "{}" : "nope", { status })),
  );
}

/** Outlast the 100ms setTimeout the redirect is scheduled behind. */
const afterRedirectWindow = () => new Promise((r) => setTimeout(r, 200));

describe("session expiry redirect", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("does not redirect for a failed sign-in on /login", async () => {
    const assigned = stubLocation("/login");
    const { apiRequest } = await import("./queryClient");

    stubFetchStatus(401);
    await expect(
      apiRequest("POST", "/api/auth/login", { email: "a@b.com", password: "wrong" }),
    ).rejects.toThrow(/401/);
    await afterRedirectWindow();

    expect(assigned).toEqual([]);
  });

  it("still redirects on a real expiry after a failed sign-in burned the old latch", async () => {
    stubLocation("/login");
    const { apiRequest } = await import("./queryClient");

    // 1. Wrong password on /login.
    stubFetchStatus(401);
    await expect(
      apiRequest("POST", "/api/auth/login", { email: "a@b.com", password: "wrong" }),
    ).rejects.toThrow(/401/);

    // 2. Correct password, then work for a while, then the session expires.
    const assigned = stubLocation("/dashboard");
    stubFetchStatus(401);
    await expect(apiRequest("GET", "/api/loan-applications")).rejects.toThrow(/401/);
    await afterRedirectWindow();

    expect(assigned).toEqual(["/login"]);
  });

  it("collapses a burst of concurrent 401s into one redirect", async () => {
    const assigned = stubLocation("/dashboard");
    const { apiRequest } = await import("./queryClient");

    stubFetchStatus(401);
    await Promise.allSettled([
      apiRequest("GET", "/api/loan-applications"),
      apiRequest("GET", "/api/dashboard"),
      apiRequest("GET", "/api/tasks"),
    ]);
    await afterRedirectWindow();

    expect(assigned).toEqual(["/login"]);
  });

  it("re-arms after a successful request, so a second expiry still redirects", async () => {
    let assigned = stubLocation("/dashboard");
    const { apiRequest } = await import("./queryClient");

    stubFetchStatus(401);
    await expect(apiRequest("GET", "/api/dashboard")).rejects.toThrow(/401/);
    await afterRedirectWindow();
    expect(assigned).toEqual(["/login"]);

    // User signs back in — a 2xx proves the session is alive again.
    stubFetchStatus(200);
    await apiRequest("GET", "/api/auth/user");

    // Later, that new session expires too.
    assigned = stubLocation("/dashboard");
    stubFetchStatus(401);
    await expect(apiRequest("GET", "/api/dashboard")).rejects.toThrow(/401/);
    await afterRedirectWindow();
    expect(assigned).toEqual(["/login"]);
  });
});

/**
 * The public transport path.
 *
 * Public pages (rates, FAQ, articles, agent search) used to hand-roll
 * `fetch` + `if (!res.ok) throw new Error(...)` inside every queryFn. That was a
 * second, quieter transport contract — a bare Error instead of ApiError, so
 * friendlyApiError could not read the server's message envelope — and it carried
 * no signal that it drops 401 handling, making it copy-paste bait for an authed
 * page cloned from a rates page.
 */
describe("buildQueryUrl", () => {
  it("joins scalar segments into a path", async () => {
    const { buildQueryUrl } = await import("./queryClient");
    expect(buildQueryUrl(["/api/articles", "first-time-buyer"])).toBe(
      "/api/articles/first-time-buyer",
    );
  });

  it("turns a trailing object into the query string", async () => {
    const { buildQueryUrl } = await import("./queryClient");
    expect(buildQueryUrl(["/api/faqs", { search: "rate", category: "basics" }])).toBe(
      "/api/faqs?search=rate&category=basics",
    );
  });

  it("drops empty, null and undefined params so an unset filter isn't sent", async () => {
    const { buildQueryUrl } = await import("./queryClient");
    // This is what an untouched rates page sends: no zipcode typed yet, so
    // getStateFromZip returns undefined.
    expect(
      buildQueryUrl([
        "/api/mortgage-rates",
        { loanType: "conventional", zipcode: "", state: undefined },
      ]),
    ).toBe("/api/mortgage-rates?loanType=conventional");
  });

  it("omits the '?' entirely when every param is empty", async () => {
    const { buildQueryUrl } = await import("./queryClient");
    expect(buildQueryUrl(["/api/mortgage-rates", { zipcode: "", state: undefined }])).toBe(
      "/api/mortgage-rates",
    );
  });

  it("encodes values that need it", async () => {
    const { buildQueryUrl } = await import("./queryClient");
    expect(buildQueryUrl(["/api/agents/search", { location: "San Diego, CA" }])).toBe(
      "/api/agents/search?location=San+Diego%2C+CA",
    );
  });

  it("keeps a bare key unchanged", async () => {
    const { buildQueryUrl } = await import("./queryClient");
    expect(buildQueryUrl(["/api/faqs"])).toBe("/api/faqs");
  });
});

/**
 * The authenticated default and the public queryFn must build URLs the SAME way.
 *
 * They did not. `getQueryFn` used a bare `queryKey.join("/")`, so the trailing
 * params-object form that buildQueryUrl documents worked only on public
 * surfaces; behind the session it produced "/api/x/[object Object]".
 * ConsentGateCard hit that and papered over it with a hand-written queryFn whose
 * URL was a second spelling of its own key — exactly the fetch/invalidate drift
 * the key factories in this module exist to prevent.
 */
describe("getQueryFn (authenticated) URL building", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  async function captureUrl(queryKey: readonly unknown[]) {
    stubLocation("/dashboard");
    const { getQueryFn } = await import("./queryClient");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await getQueryFn({ on401: "throw" })({ queryKey } as never);
    return fetchMock.mock.calls[0] as [string, RequestInit];
  }

  it("turns a trailing params object into a query string, not '[object Object]'", async () => {
    const [url] = await captureUrl(["/api/consent-templates", { type: "credit_report" }]);
    expect(url).toBe("/api/consent-templates?type=credit_report");
  });

  it("still joins segmented keys into a path (the loanApplicationKeys shape)", async () => {
    const [url] = await captureUrl(["/api/loan-applications", "abc-123", "credit", "summary"]);
    expect(url).toBe("/api/loan-applications/abc-123/credit/summary");
  });

  it("keeps sending the session cookie", async () => {
    const [, init] = await captureUrl(["/api/auth/user"]);
    expect(init.credentials).toBe("include");
  });
});

describe("getPublicQueryFn", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("never redirects on 401 — a public page has no session to expire", async () => {
    const assigned = stubLocation("/rates/purchase");
    const { getPublicQueryFn } = await import("./queryClient");

    stubFetchStatus(401);
    await expect(
      getPublicQueryFn()({ queryKey: ["/api/mortgage-rates"] } as never),
    ).rejects.toThrow(/401/);
    await afterRedirectWindow();

    expect(assigned).toEqual([]);
  });

  it("throws ApiError, so friendlyApiError can read the server's message", async () => {
    stubLocation("/rates/purchase");
    const { getPublicQueryFn, ApiError } = await import("./queryClient");
    const { friendlyApiError } = await import("./errorMessage");

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Rates are paused for maintenance" }), {
            status: 503,
          }),
      ),
    );

    const err = await getPublicQueryFn()({ queryKey: ["/api/mortgage-rates"] } as never).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(503);
    // The whole point: the server's own copy survives to the toast, instead of
    // being replaced by a generic "Failed to fetch rates".
    expect(friendlyApiError(err)).toBe("Rates are paused for maintenance");
  });

  it("requests the URL its query key describes", async () => {
    stubLocation("/faq");
    const { getPublicQueryFn } = await import("./queryClient");

    const fetchMock = vi.fn(async () => new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await getPublicQueryFn()({
      queryKey: ["/api/faqs", { search: "escrow", category: "" }],
    } as never);

    expect(fetchMock).toHaveBeenCalledWith("/api/faqs?search=escrow");
  });

  it("does not attach the session cookie to a public endpoint", async () => {
    stubLocation("/faq");
    const { getPublicQueryFn } = await import("./queryClient");

    const fetchMock = vi.fn(async () => new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await getPublicQueryFn()({ queryKey: ["/api/faqs"] } as never);

    // One argument only — no { credentials: "include" }.
    expect(fetchMock.mock.calls[0]).toHaveLength(1);
  });

  it("still lets an authed 401 redirect after a public 401 (no shared latch damage)", async () => {
    stubLocation("/rates/purchase");
    const { getPublicQueryFn, apiRequest } = await import("./queryClient");

    stubFetchStatus(401);
    await expect(
      getPublicQueryFn()({ queryKey: ["/api/mortgage-rates"] } as never),
    ).rejects.toThrow(/401/);

    const assigned = stubLocation("/dashboard");
    stubFetchStatus(401);
    await expect(apiRequest("GET", "/api/dashboard")).rejects.toThrow(/401/);
    await afterRedirectWindow();

    expect(assigned).toEqual(["/login"]);
  });
});
