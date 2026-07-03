import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export interface ShellBadges {
  unreadMessages: number;
  unreadNotifications: number;
  pendingTasks: number;
}

const EMPTY: ShellBadges = { unreadMessages: 0, unreadNotifications: 0, pendingTasks: 0 };

/**
 * Single source for the app-shell badge counts (sidebar, mobile nav,
 * notifications bell). One polling query shared across every shell component
 * via the query cache, replacing three separate per-component polls. Polls at
 * 30s and, because refetchOnWindowFocus is on globally, refreshes immediately
 * when the user returns to the tab — so the badges feel live without a tight
 * interval. React Query pauses the interval while the tab is hidden.
 */
export function useShellBadges(): ShellBadges {
  const { user } = useAuth();
  const { data } = useQuery<ShellBadges>({
    queryKey: ["/api/shell/badges"],
    enabled: !!user,
    refetchInterval: 30000,
  });
  return data ?? EMPTY;
}
