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

import { NotificationsBell, realNotificationToItem, type RealNotification } from "./NotificationsPanel";

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

describe("realNotificationToItem entity routing", () => {
  const notif = (over: Partial<RealNotification>): RealNotification => ({
    id: 1,
    type: "generic",
    title: "t",
    body: "b",
    status: "unread",
    entityType: null,
    entityId: null,
    createdAt: new Date().toISOString(),
    readAt: null,
    ...over,
  });

  it("routes an adverse-action notification to its notice page (ECOA reachability)", () => {
    const item = realNotificationToItem(
      notif({ type: "adverse_action", entityType: "loan_application", entityId: "app-42" }),
    );
    expect(item.href).toBe("/adverse-action/app-42");
  });

  it("keeps the existing entity mappings and the dashboard fallback", () => {
    expect(realNotificationToItem(notif({ entityType: "deal", entityId: "d-1" })).href).toBe("/deals/d-1");
    expect(realNotificationToItem(notif({ entityType: "document", entityId: "x" })).href).toBe("/documents");
    expect(realNotificationToItem(notif({ entityType: "task", entityId: "x" })).href).toBe("/tasks");
    // A loan_application entity with a non-adverse-action type still falls back.
    expect(realNotificationToItem(notif({ type: "status_change", entityType: "loan_application", entityId: "x" })).href).toBe("/dashboard");
  });
});
