import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Shield,
  CreditCard,
  Upload,
  ArrowRight,
  Bell,
  ChevronRight,
} from "lucide-react";

interface ActionItem {
  id: string;
  type: "document" | "verification" | "consent" | "review" | "action";
  title: string;
  description?: string;
  priority: "low" | "normal" | "high" | "urgent";
  dueDate?: string;
  status: "pending" | "in_progress" | "completed";
  actionUrl?: string;
  actionLabel?: string;
}

interface ActionItemsData {
  items: ActionItem[];
  stats: {
    total: number;
    urgent: number;
    pending: number;
    completed: number;
  };
}

const getTypeIcon = (type: ActionItem["type"]) => {
  switch (type) {
    case "document":
      return <FileText className="h-4 w-4" />;
    case "verification":
      return <Shield className="h-4 w-4" />;
    case "consent":
      return <CreditCard className="h-4 w-4" />;
    case "review":
      return <Bell className="h-4 w-4" />;
    default:
      return <CheckCircle2 className="h-4 w-4" />;
  }
};

const getPriorityColor = (priority: ActionItem["priority"]) => {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800";
    case "high":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-800";
    case "normal":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800";
    case "low":
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getPriorityLabel = (priority: ActionItem["priority"]) => {
  switch (priority) {
    case "urgent":
      return "Urgent";
    case "high":
      return "High Priority";
    case "normal":
      return "Action Needed";
    case "low":
    default:
      return "When Ready";
  }
};

interface ActionItemsProps {
  applicationId: string;
  compact?: boolean;
  maxItems?: number;
}

export function ActionItems({ applicationId, compact = false, maxItems = 5 }: ActionItemsProps) {
  const { data, isLoading } = useQuery<ActionItemsData>({
    queryKey: ["/api/applications", applicationId, "action-items"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = data?.stats || { total: 0, urgent: 0, pending: 0, completed: 0 };
  const items = data?.items || [];
  const pendingItems = items.filter(item => item.status !== "completed");
  const displayItems = pendingItems.slice(0, maxItems);
  const hasMore = pendingItems.length > maxItems;

  if (pendingItems.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            <CardTitle className="text-lg">All Caught Up</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You have no pending action items. We'll notify you when there's something new.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg" data-testid="text-action-items-title">Action Items</CardTitle>
          </div>
          {stats.urgent > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {stats.urgent} Urgent
            </Badge>
          )}
        </div>
        {!compact && (
          <CardDescription>
            Complete these items to keep your loan moving forward
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {displayItems.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-lg border ${
              item.priority === "urgent" 
                ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10" 
                : "bg-card"
            } hover-elevate`}
            data-testid={`action-item-${item.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${getPriorityColor(item.priority)}`}>
                  {getTypeIcon(item.type)}
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-sm">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs h-5">
                      {getPriorityLabel(item.priority)}
                    </Badge>
                    {item.dueDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Due {formatDistanceToNow(new Date(item.dueDate), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {item.actionUrl && (
                <Link href={item.actionUrl}>
                  <Button size="sm" variant="ghost" className="shrink-0">
                    {item.actionLabel || "Complete"}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        ))}

        {hasMore && (
          <Link href="/tasks">
            <Button variant="outline" className="w-full gap-2" data-testid="button-view-all-tasks">
              View All {pendingItems.length} Items
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export default ActionItems;
