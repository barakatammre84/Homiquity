import { Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { JourneyMilestone } from "@shared/schema";

export interface MilestonesTabProps {
  milestones: JourneyMilestone[] | undefined;
}

export function MilestonesTab({ milestones }: MilestonesTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Your Achievements
        </CardTitle>
        <CardDescription>
          Celebrate every step toward your goal
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {milestones?.map((milestone) => (
            <div
              key={milestone.id}
              className="flex items-start gap-4 p-4 rounded-lg border bg-gradient-to-r from-warning-subtle to-warning-subtle"
            >
              <div className="p-2 rounded-full bg-warning-subtle">
                <Trophy className="h-5 w-5 text-warning-subtle-foreground" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium">{milestone.title}</h4>
                <p className="text-sm text-muted-foreground">{milestone.description}</p>
                {milestone.celebrationMessage && (
                  <p className="text-sm mt-2 italic text-muted-foreground">
                    "{milestone.celebrationMessage}"
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Achieved {new Date(milestone.achievedAt!).toLocaleDateString()}
                </p>
              </div>
              {milestone.pointsAwarded && milestone.pointsAwarded > 0 && (
                <Badge variant="secondary">+{milestone.pointsAwarded} pts</Badge>
              )}
            </div>
          ))}

          {(!milestones || milestones.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Complete actions to earn achievements!</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
