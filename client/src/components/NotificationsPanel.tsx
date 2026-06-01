import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell,
  MessageCircle,
  FileText,
  CheckCircle2,
  Clock,
  Upload,
  AlertCircle,
  ArrowRight,
  CheckCheck,
} from "lucide-react";
import type { DealActivity } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";

interface NotificationItem {
  id: string;
  icon: typeof Bell;
  iconColor: string;
  title: string;
  description: string;
  time: string;
  href: string;
  isUnread: boolean;
  isReal?: boolean;
  realId?: number;
}

function formatTimeAgo(timestamp: string | Date): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function activityToNotification(activity: DealActivity, index: number): NotificationItem {
  const type = activity.activityType || "";
  let icon = Clock;
  let iconColor = "text-muted-foreground";
  let href = "/dashboard";

  if (type.includes("document")) {
    icon = FileText;
    iconColor = "text-blue-500";
    href = "/documents";
  } else if (type.includes("message")) {
    icon = MessageCircle;
    iconColor = "text-primary";
    href = "/messages";
  } else if (type.includes("approved") || type.includes("verified")) {
    icon = CheckCircle2;
    iconColor = "text-emerald-500";
    href = "/dashboard";
  } else if (type.includes("task")) {
    icon = Upload;
    iconColor = "text-amber-500";
    href = "/tasks";
  } else if (type.includes("denied") || type.includes("rejected")) {
    icon = AlertCircle;
    iconColor = "text-destructive";
    href = "/dashboard";
  }

  return {
    id: activity.id,
    icon,
    iconColor,
    title: activity.title || "Update",
    description: activity.description || "",
    time: formatTimeAgo(activity.createdAt!),
    href,
    isUnread: index < 3,
  };
}

interface RealNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  status: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  readAt: string | null;
}

function realNotificationToItem(n: RealNotification): NotificationItem {
  let icon = Bell;
  let iconColor = "text-muted-foreground";
  let href = "/dashboard";

  const type = n.type || "";
  if (type.includes("document")) {
    icon = FileText;
    iconColor = "text-blue-500";
    href = "/documents";
  } else if (type.includes("message")) {
    icon = MessageCircle;
    iconColor = "text-primary";
    href = "/messages";
  } else if (type.includes("approved") || type.includes("verified")) {
    icon = CheckCircle2;
    iconColor = "text-emerald-500";
  } else if (type.includes("task")) {
    icon = Upload;
    iconColor = "text-amber-500";
    href = "/tasks";
  } else if (type.includes("denied") || type.includes("rejected") || type.includes("alert")) {
    icon = AlertCircle;
    iconColor = "text-destructive";
  }

  if (n.entityType && n.entityId) {
    if (n.entityType === "deal") href = `/deals/${n.entityId}`;
    else if (n.entityType === "document") href = "/documents";
    else if (n.entityType === "task") href = "/tasks";
  }

  return {
    id: `real-${n.id}`,
    icon,
    iconColor,
    title: n.title,
    description: n.body || "",
    time: formatTimeAgo(n.createdAt),
    href,
    isUnread: !n.readAt,
    isReal: true,
    realId: n.id,
  };
}

interface NotificationsBellProps {
  unreadCount: number;
  activities: DealActivity[];
}

export function NotificationsBell({ unreadCount, activities }: NotificationsBellProps) {
  const [open, setOpen] = useState(false);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 15000,
  });

  const { data: notifData } = useQuery<{ notifications: RealNotification[] }>({
    queryKey: ["/api/notifications"],
    enabled: open,
  });

  const realNotifications = (notifData?.notifications || []).map(realNotificationToItem);
  const activityNotifications = activities
    .slice(0, 10)
    .map((a, i) => activityToNotification(a, i));

  const realUnread = unreadData?.count ?? 0;
  const totalUnread = Math.max(realUnread + unreadCount, 0);

  const allNotifications = [...realNotifications, ...activityNotifications];

  async function handleMarkAllRead() {
    await fetch("/api/notifications/read-all", {
      method: "PATCH",
      credentials: "include",
    });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  }

  async function handleNotificationClick(notif: NotificationItem) {
    if (notif.isReal && notif.realId) {
      await fetch(`/api/notifications/${notif.realId}/read`, {
        method: "PATCH",
        credentials: "include",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
          <Bell className="h-5 w-5" />
          {totalUnread > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground"
              data-testid="badge-notification-count"
            >
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between gap-4 border-b p-3">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {totalUnread > 0 && (
              <Badge variant="secondary" className="text-xs">
                {totalUnread} new
              </Badge>
            )}
            {realUnread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-auto py-1 px-2"
                onClick={handleMarkAllRead}
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-80">
          {allNotifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground" data-testid="text-no-notifications">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No notifications yet
            </div>
          ) : (
            <div className="divide-y">
              {allNotifications.map((notif) => {
                const Icon = notif.icon;
                return (
                  <Link key={notif.id} href={notif.href} onClick={() => handleNotificationClick(notif)}>
                    <div
                      className={`flex items-start gap-3 p-3 hover-elevate cursor-pointer ${
                        notif.isUnread ? "bg-primary/5" : ""
                      }`}
                      data-testid={`notification-${notif.id}`}
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${notif.iconColor}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-tight ${notif.isUnread ? "font-medium" : ""}`}>
                          {notif.title}
                        </p>
                        {notif.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {notif.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{notif.time}</p>
                      </div>
                      {notif.isUnread && (
                        <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <div className="border-t p-2">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="w-full text-xs" data-testid="button-view-all-notifications">
              View all activity
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
