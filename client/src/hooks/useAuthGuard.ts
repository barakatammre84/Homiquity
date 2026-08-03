import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { getRoleHomeRoute } from "@/lib/roleRoutes";

export type AuthGuardStatus = "loading" | "unauthenticated" | "forbidden" | "authorized";

/**
 * Single source of truth for route authorization. Computes ONE status from the
 * auth state + required roles and performs the matching redirect exactly once.
 * Callers render off the returned status and MUST NOT re-derive the decision —
 * this replaces the previous split-brain gate (an array in App.tsx + a useEffect
 * + an inline render guard, each re-checking the role separately).
 *
 * Two navigation models are used, on purpose and documented here so the choice
 * is intentional rather than accidental:
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
  const { user, isAuthenticated, isLoading, hasRole } = useAuth();
  const [, navigate] = useLocation();

  const status: AuthGuardStatus = isLoading
    ? "loading"
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
  }, [status, user?.role, navigate]);

  return status;
}
