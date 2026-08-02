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

async function throwIfResNotOk(res: Response) {
  // Any 2xx proves the session is alive again, so the latch must not outlive it
  // (re-login in the same tab, or a 401 that turned out to be transient).
  if (res.ok) {
    sessionExpiredHandled = false;
    return;
  }
  if (res.status === 401) {
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
