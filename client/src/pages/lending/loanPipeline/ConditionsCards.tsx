import { Link } from "wouter";
import {
  AlertTriangle,
  Info,
  ArrowRight,
  Circle,
  Clock,
  ClipboardList,
  CheckCheck,
  CheckCircle2,
  Upload,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { LoanCondition } from "@shared/schema";

export interface BlockersCardProps {
  blockers: string[];
}

export function BlockersCard({ blockers }: BlockersCardProps) {
  if (blockers.length === 0) return null;
  return (
    <Card className="border-destructive/50" data-testid="card-blockers">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-lg text-destructive">Action Required</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {blockers.map((blocker, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm">
              <Circle className="mt-1 h-2 w-2 flex-shrink-0 fill-destructive text-destructive" />
              <span>{blocker}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export interface NextStepsCardProps {
  nextSteps: string[];
  hasBlockers: boolean;
}

export function NextStepsCard({ nextSteps, hasBlockers }: NextStepsCardProps) {
  if (nextSteps.length === 0 || hasBlockers) return null;
  return (
    <Card className="border-primary/50" data-testid="card-next-steps">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Next Steps</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {nextSteps.map((step, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm">
              <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export interface OutstandingConditionsCardProps {
  conditions: LoanCondition[];
}

export function OutstandingConditionsCard({ conditions }: OutstandingConditionsCardProps) {
  if (conditions.length === 0) return null;
  return (
    <Card data-testid="card-outstanding-conditions">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Outstanding Items</CardTitle>
          </div>
          <Badge variant="secondary" data-testid="badge-outstanding-count">
            {conditions.length} remaining
          </Badge>
        </div>
        <CardDescription>
          Complete these items to move your loan forward
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {conditions.map((condition) => (
          <div
            key={condition.id}
            className="flex items-start gap-3 rounded-lg border p-3"
            data-testid={`condition-item-${condition.id}`}
          >
            <div className="mt-0.5">
              {condition.status === "submitted" ? (
                <Clock className="h-5 w-5 text-warning-subtle-foreground" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{condition.title}</p>
                <Badge
                  variant={condition.status === "submitted" ? "secondary" : "outline"}
                  className="text-xs"
                >
                  {condition.status === "submitted" ? "Under Review" : "Needed"}
                </Badge>
                {condition.priority === "prior_to_approval" && (
                  <Badge variant="destructive" className="text-xs">Critical</Badge>
                )}
              </div>
              {condition.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {condition.description}
                </p>
              )}
            </div>
            <Button asChild size="sm" variant="outline" data-testid={`button-upload-${condition.id}`}>
              <Link href={`/documents?condition=${condition.id}`}>
                <Upload className="mr-1 h-4 w-4" />
                Upload
              </Link>
            </Button>
          </div>
        ))}
      </CardContent>
      <CardFooter className="border-t pt-4">
        <Button asChild className="w-full" data-testid="button-view-all-documents">
          <Link href="/documents">
            <FileText className="mr-2 h-4 w-4" />
            View All Documents
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export interface ClearedConditionsCardProps {
  conditions: LoanCondition[];
}

export function ClearedConditionsCard({ conditions }: ClearedConditionsCardProps) {
  if (conditions.length === 0) return null;
  return (
    <Card data-testid="card-cleared-conditions">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CheckCheck className="h-5 w-5 text-success-subtle-foreground" />
          <CardTitle className="text-lg">Cleared Items</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {conditions.slice(0, 5).map((condition) => (
            <div
              key={condition.id}
              className="flex items-center gap-2 text-sm text-muted-foreground"
              data-testid={`cleared-item-${condition.id}`}
            >
              <CheckCircle2 className="h-4 w-4 text-success-subtle-foreground" />
              <span>{condition.title}</span>
            </div>
          ))}
          {conditions.length > 5 && (
            <p className="text-sm text-muted-foreground">
              +{conditions.length - 5} more cleared
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
