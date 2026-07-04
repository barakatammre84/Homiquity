import { type ComponentType, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { getPresenceColor } from "@/lib/formatters";
import { isStaffRole, ROLE_DISPLAY_NAMES } from "@shared/roles";
import { useShellBadges } from "@/hooks/useShellBadges";
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  Upload,
  Users,
  LogOut,
  Shield,
  Home,
  DollarSign,
  Percent,
  PenSquare,
  Star,
  Calculator,
  Link2,
  Scale,
  Grid3x3,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Circle,
  ListTodo,
  HelpCircle,
  GraduationCap,
  Rocket,
  PiggyBank,
  ClipboardList,
  Palette,
} from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  initials: string;
  email: string | null;
  profileImageUrl: string | null;
  presenceStatus: 'online' | 'away' | 'offline';
}

interface NavItem {
  title: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  testId: string;
  showBadge?: boolean;
  showMessageBadge?: boolean;
  roles?: string[];
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const aspiringOwnerNavigation: NavSection[] = [
  {
    section: "Explore",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, testId: "link-borrower-dashboard" },
      { title: "Messages", href: "/messages", icon: MessageCircle, testId: "link-messages", showMessageBadge: true },
    ],
  },
  {
    section: "Get Ready",
    items: [
      { title: "Get Pre-Approved", href: "/apply", icon: Star, testId: "link-pre-approval" },
      { title: "My Journey", href: "/onboarding", icon: Rocket, testId: "link-onboarding" },
      { title: "Gap Calculator", href: "/gap-calculator", icon: Calculator, testId: "link-gap-calculator" },
      { title: "Down Payment Help", href: "/down-payment-wizard", icon: PiggyBank, testId: "link-dpa-wizard" },
    ],
  },
];

const activeBuyerNavigation: NavSection[] = [
  {
    section: "My Mortgage",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, testId: "link-borrower-dashboard" },
      { title: "To-Do", href: "/tasks", icon: CheckSquare, testId: "link-tasks", showBadge: true },
      { title: "Documents", href: "/documents", icon: Upload, testId: "link-documents" },
      { title: "Messages", href: "/messages", icon: MessageCircle, testId: "link-messages", showMessageBadge: true },
    ],
  },
  {
    section: "Progress",
    items: [
      { title: "My Journey", href: "/onboarding", icon: Rocket, testId: "link-onboarding" },
      { title: "Application Details", href: "/application-summary", icon: FileText, testId: "link-application-summary" },
      { title: "Verification", href: "/verification", icon: Shield, testId: "link-verification" },
    ],
  },
];

const staffNavigation: NavSection[] = [
  {
    section: "Operations",
    items: [
      { title: "Dashboard", href: "/staff-dashboard", icon: LayoutDashboard, testId: "link-staff-overview" },
      { title: "Task Operations", href: "/task-operations", icon: ListTodo, testId: "link-task-operations" },
      { title: "Policy Operations", href: "/policy-ops", icon: Scale, testId: "link-policy-ops" },
      { title: "Pricing Matrices", href: "/pricing-matrices", icon: Grid3x3, testId: "link-pricing-matrices", roles: ["admin", "underwriter"] },
      { title: "Messages", href: "/messages", icon: MessageCircle, testId: "link-messages", showMessageBadge: true },
    ],
  },
  {
    section: "Partners",
    items: [
      { title: "Broker Dashboard", href: "/broker-dashboard", icon: DollarSign, testId: "link-broker-dashboard" },
      { title: "Client Pipeline", href: "/agent-pipeline", icon: ClipboardList, testId: "link-agent-pipeline" },
      { title: "Invite Clients", href: "/invite-clients", icon: Link2, testId: "link-invite-clients" },
      { title: "Co-Branding", href: "/co-branding", icon: Palette, testId: "link-co-branding" },
    ],
  },
];

const adminNavigation: NavSection[] = [
  {
    section: "Administration",
    items: [
      { title: "Admin Dashboard", href: "/admin", icon: LayoutDashboard, testId: "link-admin" },
      { title: "Manage Users", href: "/admin/users", icon: Users, testId: "link-admin-users" },
      { title: "Manage Rates", href: "/admin/rates", icon: Percent, testId: "link-admin-rates" },
      { title: "Manage Content", href: "/admin/content", icon: PenSquare, testId: "link-admin-content" },
      { title: "Policy Operations", href: "/admin/policy-ops", icon: Scale, testId: "link-admin-policy-ops" },
      { title: "Pricing Matrices", href: "/admin/pricing-matrices", icon: Grid3x3, testId: "link-admin-pricing-matrices" },
    ],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [isHelpExpanded, setIsHelpExpanded] = useState(false);

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Message/task badge counts come from the shared shell-badges poll so the
  // sidebar, mobile nav, and notifications bell make one request between them.
  const badges = useShellBadges();
  const unreadCount = badges.unreadMessages;

  const isActive = (href: string) => {
    if (href === "/messages") return location === href || location.startsWith("/messages/");
    return location === href;
  };

  const userRole = user?.role || "";
  const isStaff = isStaffRole(userRole);
  const isAdmin = userRole === "admin";
  const isAspiringOwner = userRole === "aspiring_owner";

  const pendingTaskCount = isStaff ? 0 : badges.pendingTasks;

  let navigation: NavSection[];
  if (isStaff) {
    navigation = staffNavigation;
  } else if (isAspiringOwner) {
    navigation = aspiringOwnerNavigation;
  } else {
    navigation = activeBuyerNavigation;
  }

  const isBroker = userRole === "broker";
  const isLender = userRole === "lender";

  const portalLabel = isAdmin
    ? "Admin Portal"
    : isBroker
      ? "Broker Portal"
      : isLender
        ? "Lender Portal"
        : isStaff
          ? "Staff Portal"
          : isAspiringOwner
            ? "Aspiring Owner"
            : "Active Buyer";

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-2 py-4">
          <p className="text-sm font-semibold tracking-tight">homiquity</p>
          <p className="text-xs text-muted-foreground">
            {portalLabel}
          </p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {navigation.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !item.roles || item.roles.includes(userRole),
          );
          if (visibleItems.length === 0) return null;
          return (
          <SidebarGroup key={section.section}>
            <SidebarGroupLabel>{section.section}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.map((item) => (
                  <SidebarMenuItem key={`${section.section}-${item.title}`}>
                    <SidebarMenuButton asChild isActive={isActive(item.href)}>
                      <Link href={item.href} className="cursor-pointer" data-testid={item.testId}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                        {item.showBadge && pendingTaskCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-xs font-medium text-warning-foreground" data-testid="badge-pending-tasks">
                            {pendingTaskCount > 99 ? '99+' : pendingTaskCount}
                          </span>
                        )}
                        {item.showMessageBadge && unreadCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground" data-testid="badge-unread-count">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          );
        })}

        {isAdmin && adminNavigation.map((section) => (
          <SidebarGroup key={section.section}>
            <SidebarGroupLabel>{section.section}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={`${section.section}-${item.title}`}>
                    <SidebarMenuButton asChild isActive={isActive(item.href)}>
                      <Link href={item.href} className="cursor-pointer" data-testid={item.testId}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        {!isStaff && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setIsHelpExpanded(!isHelpExpanded)}
                    data-testid="button-help-toggle"
                  >
                    <HelpCircle className="h-4 w-4" />
                    <span>Your Team</span>
                    <div className="ml-auto">
                      {isHelpExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </SidebarMenuButton>
                  {isHelpExpanded && (
                    <SidebarMenuSub>
                      {teamMembers.length > 0 ? (
                        teamMembers.map((member) => (
                          <SidebarMenuSubItem key={member.id}>
                            <SidebarMenuSubButton asChild>
                              <Link
                                href={`/messages/${member.id}`}
                                className="cursor-pointer flex items-center gap-2"
                                data-testid={`link-help-team-${member.id}`}
                              >
                                <div className="relative">
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                      {member.initials}
                                    </AvatarFallback>
                                  </Avatar>
                                  <Circle
                                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 fill-current ${getPresenceColor(member.presenceStatus)}`}
                                  />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm truncate">{member.name}</span>
                                  <span className="text-xs text-muted-foreground truncate">{ROLE_DISPLAY_NAMES[member.role as keyof typeof ROLE_DISPLAY_NAMES] || member.role}</span>
                                </div>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))
                      ) : (
                        <SidebarMenuSubItem>
                          <div className="px-2 py-2 text-sm text-muted-foreground">
                            No team assigned yet
                          </div>
                        </SidebarMenuSubItem>
                      )}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/resources")}>
                    <Link href="/resources" className="cursor-pointer" data-testid="link-learn">
                      <GraduationCap className="h-4 w-4" />
                      <span>Learn</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="cursor-pointer"
              data-testid="link-logout"
              onClick={async () => {
                try {
                  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                } catch {}
                window.location.href = "/";
              }}
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
