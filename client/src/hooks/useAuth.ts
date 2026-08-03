import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

interface UseAuthReturn {
  user: User | undefined;
  isLoading: boolean;
  /** True when /api/auth/user failed for a reason other than 401 (e.g. network). */
  isError: boolean;
  isAuthenticated: boolean;
  /**
   * Authoritative role check. Returns true when `roles` is empty/undefined
   * (any authenticated user) or when the current user's role is in `roles`.
   * Centralizes the check so callers never re-derive it inline.
   */
  hasRole: (roles?: readonly string[]) => boolean;
}

export function useAuth(): UseAuthReturn {
  const { data: user, isLoading, isError } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

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

  return {
    user,
    isLoading,
    isError,
    isAuthenticated: !!user,
    hasRole,
  };
}
