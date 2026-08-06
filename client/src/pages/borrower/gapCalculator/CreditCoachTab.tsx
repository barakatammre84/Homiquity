import { AlertCircle, CheckCircle2, CreditCard, Sparkles, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CreditRecommendation } from "./types";

export interface CreditCoachTabProps {
  recommendations: CreditRecommendation[] | undefined;
}

export function CreditCoachTab({ recommendations }: CreditCoachTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Credit Coach
        </CardTitle>
        <CardDescription>
          Personalized actions to improve your credit score
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {recommendations?.map((rec, index) => (
          <div
            key={index}
            className="flex items-start gap-4 p-4 rounded-lg border bg-card"
          >
            <div className={`p-2 rounded-full ${
              rec.priority === "high"
                ? "bg-destructive-subtle"
                : rec.priority === "medium"
                ? "bg-warning-subtle"
                : "bg-info-subtle"
            }`}>
              {rec.priority === "high" && <AlertCircle className="h-4 w-4 text-destructive" />}
              {rec.priority === "medium" && <TrendingUp className="h-4 w-4 text-warning-subtle-foreground" />}
              {rec.priority === "low" && <Sparkles className="h-4 w-4 text-info" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium">{rec.title}</h4>
                <Badge variant="outline" className="text-xs">
                  +{rec.estimatedPointsGain} pts
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{rec.description}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Timeframe: {rec.timeframe}
              </p>
            </div>
          </div>
        ))}

        {(!recommendations || recommendations.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-success-subtle-foreground" />
            <p>Your credit is in great shape! Keep up the good work.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
