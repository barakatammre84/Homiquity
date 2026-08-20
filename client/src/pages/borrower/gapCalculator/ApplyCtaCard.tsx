import { Link } from "wouter";
import { ArrowRight, Bot, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ApplyCtaCard() {
  return (
    <Card className="mt-6" data-testid="card-gap-apply-cta">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Ready to take the next step?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Based on your numbers, see what you qualify for with a 3-minute pre-approval.
            </p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Button asChild size="sm" className="touch-target gap-1" data-testid="button-gap-apply">
                <Link href="/apply">
                  Start Pre-Approval
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="touch-target gap-1" data-testid="button-gap-coach">
                <Link href="/ai-coach">
                  <Bot className="h-3 w-3" />
                  Ask Homi
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
