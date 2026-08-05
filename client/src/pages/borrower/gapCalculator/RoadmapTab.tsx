import { Calendar, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GapAnalysis } from "./types";

function RoadmapPhase({
  title,
  description,
  tasks,
  isActive,
  isComplete,
}: {
  title: string;
  description: string;
  tasks: { label: string; done: boolean }[];
  isActive: boolean;
  isComplete: boolean;
}) {
  return (
    <div className={`relative pl-8 pb-6 border-l-2 last:border-l-0 last:pb-0 ${
      isComplete
        ? "border-border"
        : isActive
        ? "border-primary"
        : "border-muted"
    }`}>
      <div className={`absolute -left-2.5 top-0 w-5 h-5 rounded-full ${
        isComplete
          ? "bg-success"
          : isActive
          ? "bg-primary"
          : "bg-muted"
      } flex items-center justify-center`}>
        {isComplete && <CheckCircle2 className="h-3 w-3 text-white" />}
      </div>
      <div>
        <h4 className="font-medium">{title}</h4>
        <p className="text-sm text-muted-foreground mb-2">{description}</p>
        <div className="space-y-1">
          {tasks.map((task, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {task.done ? (
                <CheckCircle2 className="h-4 w-4 text-success-subtle-foreground" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-muted" />
              )}
              <span className={task.done ? "line-through text-muted-foreground" : ""}>
                {task.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface RoadmapTabProps {
  analysis: GapAnalysis["analysis"];
  milestonesCount: number;
}

export function RoadmapTab({ analysis, milestonesCount }: RoadmapTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          30-Day Roadmap
        </CardTitle>
        <CardDescription>
          Your personalized path to mortgage readiness
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <RoadmapPhase
            title="Days 1-3: Truth & Transparency"
            description="Get your baseline financial snapshot"
            tasks={[
              { label: "Complete financial profile", done: true },
              { label: "Review credit score", done: (analysis?.credit.current || 0) > 0 },
              { label: "Set savings goal", done: (analysis?.savings.target || 0) > 0 },
            ]}
            isActive={(analysis?.overall.journeyDay || 1) <= 3}
            isComplete={(analysis?.overall.journeyDay || 1) > 3}
          />

          <RoadmapPhase
            title="Days 4-14: Credit Cleanup Sprint"
            description="Quick wins to boost your credit score"
            tasks={[
              { label: "Review credit recommendations", done: (analysis?.overall.journeyDay || 1) > 4 },
              { label: "Pay down high-utilization cards", done: false },
              { label: "Dispute any errors", done: false },
            ]}
            isActive={(analysis?.overall.journeyDay || 1) >= 4 && (analysis?.overall.journeyDay || 1) <= 14}
            isComplete={(analysis?.overall.journeyDay || 1) > 14}
          />

          <RoadmapPhase
            title="Days 15-25: Save-to-Own Habit"
            description="Build your savings momentum"
            tasks={[
              { label: "Set up automatic savings", done: false },
              { label: "Track round-up savings", done: false },
              { label: "Reach first milestone", done: milestonesCount > 1 },
            ]}
            isActive={(analysis?.overall.journeyDay || 1) >= 15 && (analysis?.overall.journeyDay || 1) <= 25}
            isComplete={(analysis?.overall.journeyDay || 1) > 25}
          />

          <RoadmapPhase
            title="Day 30: Progress Report"
            description="Review your progress and next steps"
            tasks={[
              { label: "Check updated credit score", done: false },
              { label: "Review savings progress", done: false },
              { label: "Connect with a loan officer", done: false },
            ]}
            isActive={(analysis?.overall.journeyDay || 1) >= 26}
            isComplete={false}
          />
        </div>
      </CardContent>
    </Card>
  );
}
