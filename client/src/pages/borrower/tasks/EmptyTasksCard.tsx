import { Link } from "wouter";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyTasksCard({ hasActiveApplication }: { hasActiveApplication: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <CheckCircle2 className="mb-4 h-12 w-12 text-status-success" />
        <h3 className="mb-2 text-lg font-semibold">No Tasks Yet</h3>
        <p className="text-center text-muted-foreground">
          {hasActiveApplication
            ? "Your loan officer will assign tasks as your application progresses."
            : "Start a loan application to receive your first tasks."}
        </p>
        {!hasActiveApplication && (
          <Link href="/apply">
            <Button className="mt-4" data-testid="button-start-application">
              Start Application
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
