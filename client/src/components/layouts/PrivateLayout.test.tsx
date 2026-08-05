import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * What PrivateLayout does with each guard status — specifically that a DEGRADED
 * session probe keeps the user where they are.
 *
 * The failure this pins: `/api/auth/user` failing for a reason that is not a 401
 * (a 502, a cold start, a dropped connection) used to be indistinguishable from
 * "signed out", so the guard hard-reloaded the user to /login. Every private
 * route sits behind this layout, including the long forms — URLAForm,
 * HmdaDemographics, GapCalculator — so a single server hiccup discarded whatever
 * the borrower had typed.
 *
 * Verified live too (502 injected at the route, worktree server): the page stays
 * put and renders this panel. These keep it that way without a browser.
 */

let guardStatus = "authorized";
vi.mock("@/hooks/useAuthGuard", () => ({
  useAuthGuard: () => guardStatus,
}));

const refetchMock = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "Ada", role: "aspiring_owner" }, refetch: refetchMock }),
}));

vi.mock("@/hooks/usePendingAttribution", () => ({ usePendingAttribution: () => {} }));
// The authorized branch mounts the whole app shell (sidebar, bottom nav, bell),
// none of which this test is about — stub them to keep the assertions honest.
vi.mock("@/components/app-sidebar", () => ({ AppSidebar: () => null }));
vi.mock("@/components/MobileBottomNav", () => ({ MobileBottomNav: () => null }));
vi.mock("@/components/NotificationsPanel", () => ({ NotificationsBell: () => null }));

import { PrivateLayout } from "./PrivateLayout";

const hrefSetter = vi.fn<(value: string) => void>();
let originalLocation: Location;

beforeEach(() => {
  refetchMock.mockReset();
  hrefSetter.mockReset();
  originalLocation = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { pathname: "/urla-form", set href(v: string) { hrefSetter(v); } },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
});

const child = <div data-testid="page-content">the borrower's half-filled form</div>;

describe("PrivateLayout — degraded session probe", () => {
  it("renders a retry panel instead of the page, and navigates nowhere", () => {
    guardStatus = "degraded";
    render(<PrivateLayout>{child}</PrivateLayout>);

    expect(screen.getByTestId("auth-degraded")).toBeTruthy();
    expect(screen.getByTestId("button-retry-auth")).toBeTruthy();
    expect(hrefSetter).not.toHaveBeenCalled();
  });

  it("says the session is still open — never implies the user was signed out", () => {
    guardStatus = "degraded";
    render(<PrivateLayout>{child}</PrivateLayout>);

    const copy = screen.getByTestId("auth-degraded").textContent ?? "";
    expect(copy).toMatch(/still open/i);
    expect(copy).not.toMatch(/sign(ed)? in|log(ged)? in|session expired/i);
  });

  it("re-runs the session probe when the user retries", async () => {
    guardStatus = "degraded";
    const user = userEvent.setup();
    render(<PrivateLayout>{child}</PrivateLayout>);

    await user.click(screen.getByTestId("button-retry-auth"));
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not leak page content while the session is unconfirmed", () => {
    guardStatus = "degraded";
    render(<PrivateLayout>{child}</PrivateLayout>);
    expect(screen.queryByTestId("page-content")).toBeNull();
  });

  it("still renders the page when authorized", () => {
    guardStatus = "authorized";
    render(<PrivateLayout>{child}</PrivateLayout>);
    expect(screen.getByTestId("page-content")).toBeTruthy();
    expect(screen.queryByTestId("auth-degraded")).toBeNull();
  });

  it("shows a redirecting state — not the retry panel — when truly unauthenticated", () => {
    guardStatus = "unauthenticated";
    render(<PrivateLayout>{child}</PrivateLayout>);
    expect(screen.queryByTestId("auth-degraded")).toBeNull();
    expect(screen.queryByTestId("page-content")).toBeNull();
  });
});
