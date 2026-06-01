import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { isStaffRole } from "@shared/schema";
import {
  LayoutDashboard,
  CheckSquare,
  Upload,
  MessageCircle,
  FileText,
  ListTodo,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
  badge?: number;
}

export function MobileBottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { toggleSidebar } = useSidebar();

  const userRole = user?.role || "";
  const isStaff = isStaffRole(userRole);

  const { data: pendingTasksData } = useQuery<{ pendingCount: number }>({
    queryKey: ["/api/task-engine/my-tasks/pending-count"],
    enabled: !!user && !isStaff,
    refetchInterval: 30000,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread/count"],
    enabled: !!user,
    refetchInterval: 10000,
  });

  const pendingTaskCount = pendingTasksData?.pendingCount || 0;
  const unreadCount = unreadData?.count || 0;

  const borrowerItems: NavItem[] = [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard, testId: "mobile-nav-dashboard" },
    { href: "/tasks", label: "Tasks", icon: CheckSquare, testId: "mobile-nav-tasks", badge: pendingTaskCount },
    { href: "/apply", label: "Apply", icon: FileText, testId: "mobile-nav-apply" },
    { href: "/documents", label: "Docs", icon: Upload, testId: "mobile-nav-documents" },
    { href: "/messages", label: "Chat", icon: MessageCircle, testId: "mobile-nav-messages", badge: unreadCount },
  ];

  const staffItems: NavItem[] = [
    { href: "/staff-dashboard", label: "Home", icon: LayoutDashboard, testId: "mobile-nav-staff-dashboard" },
    { href: "/task-operations", label: "Tasks", icon: ListTodo, testId: "mobile-nav-task-ops" },
    { href: "/messages", label: "Messages", icon: MessageCircle, testId: "mobile-nav-messages", badge: unreadCount },
  ];

  const items = isStaff ? staffItems : borrowerItems;

  const isActive = (href: string) => {
    if (href === "/dashboard" && location === "/dashboard") return true;
    if (href === "/staff-dashboard" && location === "/staff-dashboard") return true;
    if (href !== "/dashboard" && href !== "/staff-dashboard" && location.startsWith(href)) return true;
    return false;
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-lg supports-[backdrop-filter]:bg-background/80 md:hidden"
      data-testid="mobile-bottom-nav"
    >
      <div className="safe-area-bottom" />
      <div className="flex items-center justify-around px-1 py-1">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <button
                className={cn(
                  "relative flex min-w-[56px] flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-[10px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
                data-testid={item.testId}
              >
                <div className="relative">
                  <item.icon className={cn("h-5 w-5", active && "text-primary")} />
                  {item.badge && item.badge > 0 ? (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  ) : null}
                </div>
                <span>{item.label}</span>
              </button>
            </Link>
          );
        })}
        <button
          onClick={toggleSidebar}
          className="flex min-w-[56px] flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-[10px] font-medium text-muted-foreground transition-colors"
          data-testid="mobile-nav-more"
        >
          <Menu className="h-5 w-5" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
