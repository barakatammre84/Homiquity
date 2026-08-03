import { useAuth } from "@/hooks/useAuth";
import { usePendingAttribution } from "@/hooks/usePendingAttribution";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { NotificationsBell } from "@/components/NotificationsPanel";
import { SkipLink } from "@/components/SkipLink";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getRoleHomeRoute } from "@/lib/roleRoutes";
import type { UserRole } from "@shared/roles";
import type { DealActivity } from "@shared/schema";

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
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  // Apply any pre-signup attribution code (LO /ref or CPA /cpa) once the user is
  // authenticated, no matter which authenticated page they first land on.
  usePendingAttribution();

  const { data: dashboardData } = useQuery<{
    activities: DealActivity[];
    unreadMessages: number;
    pendingTaskCount: number;
  }>({
    queryKey: ["/api/dashboard"],
    enabled: isAuthenticated && !isLoading,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && requiredRoles && requiredRoles.length > 0) {
      const hasRequiredRole = requiredRoles.some(role => user?.role === role);
      if (!hasRequiredRole && user?.role) {
        navigate(getRoleHomeRoute(user.role));
      }
    }
  }, [isLoading, isAuthenticated, user, requiredRoles, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some(role => user?.role === role);
    if (!hasRequiredRole) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Access denied. Redirecting...</p>
          </div>
        </div>
      );
    }
  }

  const totalUnread = (dashboardData?.unreadMessages || 0) + (dashboardData?.pendingTaskCount || 0);
  const activities = dashboardData?.activities || [];

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
              <NotificationsBell unreadCount={totalUnread} activities={activities} />
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
              stay on the white canvas. See design_guidelines.md → Layers. */}
          <main
            id="main"
            tabIndex={-1}
            className="app-surface flex-1 overflow-y-auto bg-surface pb-16 md:pb-0 focus:outline-none"
          >
            {children}
          </main>
          <MobileBottomNav />
        </div>
      </div>
    </SidebarProvider>
  );
}
