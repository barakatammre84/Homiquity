import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, MessageSquare, Shield, Upload, Brain } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { type ActivityItem } from "./model";

/** Activity timeline tab (extracted from BorrowerFile.tsx). Pure render. */
export function TimelineTab({ activities }: { activities: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {activities.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No activity recorded yet.
            </p>
          ) : (
            <div className="space-y-4">
              {activities.map((activity: ActivityItem, index: number) => (
                <div
                  key={activity.id || index}
                  className="relative flex gap-4 pb-4 last:pb-0"
                >
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      {activity.activityType === "status_change" ? (
                        <Shield className="h-4 w-4 text-primary" />
                      ) : activity.activityType === "document_uploaded" ? (
                        <Upload className="h-4 w-4 text-primary" />
                      ) : activity.activityType === "autopilot_review" ? (
                        <Brain className="h-4 w-4 text-primary" />
                      ) : (
                        <MessageSquare className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    {index < activities.length - 1 && (
                      <div className="flex-1 w-px bg-border" />
                    )}
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="font-medium">{activity.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(activity.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
