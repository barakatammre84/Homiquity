import { useAuth } from "@/hooks/useAuth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { usePendingAttribution } from "@/hooks/usePendingAttribution";
import { Loader2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { HomiLauncher } from "@/components/homi/HomiLauncher";
import { NotificationsBell } from "@/components/NotificationsPanel";
import { SkipLink } from "@/components/SkipLink";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { UserRole } from "@shared/roles";

interface PrivateLayoutProps {
  children: React.ReactNode;
  /**
   * Roles allowed on this route. Typed as `UserRole` (not `string`) so a typo
   * or a retired role is a build error rather than a gate that silently admits
   * nobody — `requiredRoles.some(r => user.role === r)` can never match a
   * misspelled role, so the page would just bounce every user to their home
   * route with no error anywhere.
   */
  requiredRoles?: readonly UserRole[];
}

export function PrivateLayout({ children, requiredRoles }: PrivateLayoutProps) {
  const { user, refetch: refetchAuth } = useAuth();
  // Single authorization decision + redirect. All gating lives in the guard;
  // this component only renders off the resulting status.
  const status = useAuthGuard(requiredRoles);

  // Apply any pre-signup attribution code (LO /ref or CPA /cpa) once the user is
  // authenticated, no matter which authenticated page they first land on.
  usePendingAttribution();

  // Badge counts and the notification feed are owned by NotificationsBell (via
  // the shared useShellBadges poll + a lazy on-open activities fetch). The
  // layout no longer runs its own /api/dashboard poll — that removed the
  // second badge poll and the double-count it fed the bell.

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // The session probe failed for a reason that is NOT a 401, so we do not know
  // whether the session is alive. Stay put and offer a retry: navigating to
  // /login here would be a hard reload that discards whatever the user has
  // typed into the page, on no better evidence than a server hiccup.
  if (status === "degraded") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm text-center" data-testid="auth-degraded">
          <WifiOff className="mx-auto mb-4 h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h1 className="mb-2 text-lg font-semibold">Can&apos;t reach the server</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Your session is still open — we just couldn&apos;t confirm it. Check your connection
            and try again.
          </p>
          <Button onClick={refetchAuth} data-testid="button-retry-auth">
            Try again
          </Button>
        </div>
      </div>
    );
  }

  // Not authorized: the guard is already navigating away. Show a neutral
  // redirecting state until the navigation lands.
  if (status !== "authorized") {
    const label = status === "unauthenticated" ? "Redirecting to login..." : "Redirecting...";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{label}</p>
        </div>
      </div>
    );
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <SkipLink />
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-background shrink-0 md:px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="hidden md:flex" />
              <span className="text-sm font-semibold tracking-tight text-primary md:hidden" data-testid="text-mobile-brand">homiquity</span>
            </div>
            <div className="flex items-center gap-2">
              <NotificationsBell />
              {user && (
                <Avatar className="h-8 w-8 md:hidden">
                  <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                    {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          </header>
          {/* The authed app ground is the light-gray surface (Layer 0-surface), so
              white cards read with their shadow-card depth. The `app-surface` hook
              is what elevates cards inside it (see index.css). Public/bare layouts
              stay on the white canvas. See DESIGN_SYSTEM.md → Colour system. */}
          <main
            id="main"
            tabIndex={-1}
            className="app-surface flex-1 overflow-y-auto bg-surface pb-16 md:pb-0 focus:outline-none"
          >
            {children}
          </main>
          <MobileBottomNav />
          {/*
            Homi, reachable from wherever the borrower is stuck rather than only
            from its own page. HomiLauncher is deliberately TINY and eager — this
            layout is imported non-lazily by App.tsx, so anything it reaches ships
            in the entry chunk every first-time visitor downloads. The chat lives
            behind lazy() inside it; see the header comment on HomiLauncher.
          */}
          <HomiLauncher />
        </div>
      </div>
    </SidebarProvider>
  );
}
