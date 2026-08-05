import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronRight } from "lucide-react";
import type { JourneyStep } from "./journeySteps";

/** The vertical step rail: connector line, per-step state, and its CTA. */
export function JourneyTimeline({ steps }: { steps: JourneyStep[] }) {
  return (
    <div className="space-y-1 mb-6" data-testid="journey-steps-list">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <div key={step.id} className="flex gap-3" data-testid={`journey-step-${step.id}`}>
            <div className="flex flex-col items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${
                step.complete ? "bg-success text-success-foreground" : step.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {step.complete ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              {index < steps.length - 1 && (
                <div className={`w-0.5 flex-1 min-h-[24px] ${step.complete ? "bg-success" : "bg-muted"}`} />
              )}
            </div>
            <div className={`flex-1 pb-4 ${!step.active && !step.complete ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${step.complete ? "text-success-subtle-foreground" : "text-foreground"}`}>
                    {step.title}
                  </span>
                  {!step.required && <Badge variant="secondary" className="text-[10px]">Optional</Badge>}
                </div>
                {step.complete && <Badge variant="default">Complete</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
              {step.active && !step.complete && step.href && (
                <Button variant="outline" size="sm" className="mt-2" asChild data-testid={`button-step-${step.id}`}>
                  <Link href={step.href}>
                    Get Started
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
