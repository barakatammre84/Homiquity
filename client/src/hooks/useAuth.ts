import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

interface UseAuthReturn {
  user: User | undefined;
  isLoading: boolean;
  /** True when /api/auth/user failed for a reason other than 401 (e.g. network). */
  isError: boolean;
  isAuthenticated: boolean;
  /** Re-run the session probe. Feeds the "degraded" retry affordance. */
  refetch: () => void;
  /**
   * Authoritative role check. Returns true when `roles` is empty/undefined
   * (any authenticated user) or when the current user's role is in `roles`.
   * Centralizes the check so callers never re-derive it inline.
   */
  hasRole: (roles?: readonly string[]) => boolean;
}

/**
 * Retry policy for the session probe. Exported so it can be tested directly —
 * the behaviour it encodes is the difference between "your session ended" and
 * "the server blinked", and nothing else in the app can tell them apart.
 *
 * A 401 is a real answer: the session is gone, retrying just delays the
 * redirect. Anything else (500, 502, a dropped connection, a cold start) is a
 * transport failure, and `data` coming back undefined from one of those is NOT
 * evidence the user is signed out. Global `retry: false` (queryClient.ts) meant
 * a single blip produced exactly that evidence, and useAuthGuard acted on it.
 * Two attempts absorb the common case; what survives them surfaces as isError.
 */
export function shouldRetryAuth(failureCount: number, error: unknown): boolean {
  if (isUnauthorized(error)) return false;
  return failureCount < 2;
}

/**
 * Is this error the server saying "no session", as opposed to the request not
 * getting an answer at all?
 *
 * Structural check, not `instanceof ApiError`: importing @/lib/queryClient here
 * would drag the QueryClient singleton into every consumer's module graph for
 * one type test. ApiError always carries a numeric `status`.
 */
function isUnauthorized(error: unknown): boolean {
  return (error as { status?: unknown } | null | undefined)?.status === 401;
}

export function useAuth(): UseAuthReturn {
  const { data: user, status, error, refetch } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: shouldRetryAuth,
    // Never PAUSE this query. Under the default networkMode ("online"),
    // react-query parks a retry in `fetchStatus: "paused"` when it thinks the
    // browser is offline — leaving `status: "pending"` with no data and no
    // error, possibly forever. This is the one request that must always be
    // attempted: a real offline state should fail fast and land in `degraded`
    // (whose copy already says "check your connection"), not hang on a spinner.
    networkMode: "always",
  });

  // Both of these are derived from `status`, NOT from react-query's `isLoading`
  // / `isError` — each of those is wrong here in a way that logs users out:
  //
  // `isLoading` is `isPending && isFetching`, so it goes FALSE in the gap
  // between retry attempts while the query is still pending. The guard read
  // that gap as "not loading, no user" → unauthenticated → hard reload to
  // /login. Verified in the browser: a 502 bounced a signed-in user to the
  // login page mid-retry. `status === "pending"` covers the whole unsettled
  // period, fetching and paused alike.
  const isLoading = status === "pending";

  // `isError` would be true for a signed-out visitor too: the default queryFn
  // is getQueryFn({ on401: "throw" }), so a 401 lands in the error state like
  // any other failure. Treating that as "we couldn't find out" would show a
  // "can't reach the server" panel to someone who just needs to sign in, and
  // never send them to /login at all. A 401 is a definitive answer; everything
  // else means the question went unanswered.
  const isError = status === "error" && !isUnauthorized(error);

  // Fail closed on the user first: an empty/undefined `roles` means "any
  // AUTHENTICATED user", never "anyone". Without the leading !!user, a future
  // caller using hasRole() standalone as an auth check would get `true` for a
  // signed-out visitor. useAuthGuard checks isAuthenticated before ever calling
  // this, so today it is belt-and-braces — but the trap is one careless caller away.
  const hasRole = useCallback(
    (roles?: readonly string[]) =>
      !!user && (!roles || roles.length === 0 || roles.some((r) => r === user.role)),
    [user],
  );

  const retry = useCallback(() => {
    void refetch?.();
  }, [refetch]);

  return {
    user,
    isLoading,
    isError,
    isAuthenticated: !!user,
    refetch: retry,
    hasRole,
  };
}
