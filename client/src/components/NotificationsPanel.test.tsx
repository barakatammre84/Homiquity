import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ShellBadges } from "@/hooks/useShellBadges";

// The notification-bell badge count. Pins the M1/M2 consolidation: the count is
// sourced ENTIRELY from the shared shell-badges poll (unreadMessages +
// unreadNotifications + pendingTasks), no longer a sum of a second /api/dashboard
// poll drilled through props. Staff have no borrower task queue, so pendingTasks
// is suppressed for them — matching the sidebar and mobile nav exactly.

let badges: ShellBadges;
let role: string;

vi.mock("@/hooks/useShellBadges", () => ({
  useShellBadges: () => badges,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { role }, isAuthenticated: true, isLoading: false, isError: false, hasRole: () => true }),
}));

import { NotificationsBell } from "./NotificationsPanel";

// Popover is closed by default, so the on-open /api/notifications and
// /api/dashboard queries stay disabled and never fetch — the provider only
// needs to satisfy useQuery's context requirement.
function renderBell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NotificationsBell />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  badges = { unreadMessages: 0, unreadNotifications: 0, pendingTasks: 0 };
  role = "aspiring_owner";
});

describe("NotificationsBell badge count", () => {
  it("sums all three shell-badge axes for a borrower", () => {
    badges = { unreadMessages: 2, unreadNotifications: 1, pendingTasks: 3 };
    role = "active_buyer";
    renderBell();
    expect(screen.getByTestId("badge-notification-count").textContent).toBe("6");
  });

  it("suppresses pendingTasks for staff (matches sidebar/mobile-nav)", () => {
    badges = { unreadMessages: 2, unreadNotifications: 1, pendingTasks: 3 };
    role = "lo";
    renderBell();
    // 2 + 1, pendingTasks dropped.
    expect(screen.getByTestId("badge-notification-count").textContent).toBe("3");
  });

  it("caps the display at 9+", () => {
    badges = { unreadMessages: 8, unreadNotifications: 5, pendingTasks: 0 };
    role = "active_buyer";
    renderBell();
    expect(screen.getByTestId("badge-notification-count").textContent).toBe("9+");
  });

  it("renders no badge when every count is zero", () => {
    renderBell();
    expect(screen.queryByTestId("badge-notification-count")).toBeNull();
  });
});
