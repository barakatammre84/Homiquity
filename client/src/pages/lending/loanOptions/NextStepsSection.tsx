import { Link } from "wouter";
import { ArrowRight, Rocket, Upload, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface NextStepsSectionProps {
  anyLocked: boolean;
}

export function NextStepsSection({ anyLocked }: NextStepsSectionProps) {
  return (
    <div className="mt-12 space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-next-steps-heading">What Happens Next</h2>
        <p className="text-muted-foreground mt-1">
          {anyLocked
            ? "Great, your rate is locked. Complete these steps to finalize your mortgage."
            : "Lock your preferred rate above, then complete these steps to move forward."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card data-testid="card-next-step-journey">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <Rocket className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Your Journey</h3>
                <p className="text-xs text-muted-foreground">Personalized checklist to closing</p>
              </div>
            </div>
            <Link href="/onboarding">
              <Button variant="outline" size="sm" className="w-full gap-2 mt-3" data-testid="button-next-journey">
                View Journey
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card data-testid="card-next-step-documents">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <Upload className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Upload Documents</h3>
                <p className="text-xs text-muted-foreground">Pay stubs, tax returns, bank statements</p>
              </div>
            </div>
            <Link href="/documents">
              <Button variant="outline" size="sm" className="w-full gap-2 mt-3" data-testid="button-next-documents">
                Upload Documents
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card data-testid="card-next-step-verification">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <UserCheck className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Verify Identity</h3>
                <p className="text-xs text-muted-foreground">Quick compliance check</p>
              </div>
            </div>
            <Link href="/identity-verification">
              <Button variant="outline" size="sm" className="w-full gap-2 mt-3" data-testid="button-next-verification">
                Verify Identity
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center pt-2">
        <Link href="/dashboard">
          <Button className="gap-2" data-testid="button-go-to-dashboard">
            Go to Dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
