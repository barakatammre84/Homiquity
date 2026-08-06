import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { getRoleHomeRoute } from "@/lib/roleRoutes";

export type AuthGuardStatus =
  | "loading"
  | "degraded"
  | "unauthenticated"
  | "forbidden"
  | "authorized";

/**
 * Single source of truth for route authorization. Computes ONE status from the
 * auth state + required roles and performs the matching redirect exactly once.
 * Callers render off the returned status and MUST NOT re-derive the decision —
 * this replaces the previous split-brain gate (an array in App.tsx + a useEffect
 * + an inline render guard, each re-checking the role separately).
 *
 * Three navigation models are used, on purpose and documented here so the choice
 * is intentional rather than accidental:
 *   - degraded → NO navigation. `/api/auth/user` failed for a reason that is not
 *     a 401, so the session state is UNKNOWN, not ended. This case used to fall
 *     through to "unauthenticated" and hard-reload the user to /login: a 502, a
 *     cold start, or a dropped connection signed people out and took every
 *     unsaved form on the page with it (URLAForm, HmdaDemographics and
 *     GapCalculator are all long forms behind this gate). The transport already
 *     refuses to redirect on an /api/auth/user failure (queryClient.ts's
 *     isBackgroundPoll allowlist) — deciding "unauthenticated" here reintroduced
 *     from the render side exactly what that allowlist prevents. The caller
 *     renders a retry affordance instead, and useAuth's shouldRetryAuth has
 *     already absorbed two attempts before anything reaches this branch.
 *   - unauthenticated → hard load to /login. The user is leaving the app at the
 *     auth boundary, so we do a full reload to reset all client/query state
 *     (matches queryClient's 401 handler and the pre-refactor behavior).
 *   - forbidden → soft in-app nav to the user's role home. The user is signed
 *     in, just on the wrong surface, so we keep the SPA mounted.
 *
 * `getRoleHomeRoute` is total over roles and every role's home is a route that
 * role is allowed on, so the forbidden→home hop cannot loop.
 */
export function useAuthGuard(requiredRoles?: readonly string[]): AuthGuardStatus {
  const { user, isAuthenticated, isLoading, isError, hasRole } = useAuth();
  const [, navigate] = useLocation();

  const status: AuthGuardStatus = isLoading
    ? "loading"
    : // Order matters: isError is tested BEFORE !isAuthenticated. A failed probe
      // leaves `user` undefined, so isAuthenticated is false in both cases and
      // the unauthenticated branch would otherwise swallow this one.
      isError
      ? "degraded"
      : !isAuthenticated
        ? "unauthenticated"
        : !hasRole(requiredRoles)
          ? "forbidden"
          : "authorized";

  useEffect(() => {
    if (status === "unauthenticated") {
      window.location.href = "/login";
    } else if (status === "forbidden" && user?.role) {
      navigate(getRoleHomeRoute(user.role), { replace: true });
    }
    // "degraded" deliberately navigates nowhere — see the header.
  }, [status, user?.role, navigate]);

  return status;
}
