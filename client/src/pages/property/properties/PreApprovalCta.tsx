import { Link } from "wouter";
import { ArrowRight, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Inline "know what you can afford" card, shown above the results grid. */
export function PreApprovalCtaCard() {
  return (
    <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent" data-testid="card-engagement-cta">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium" data-testid="text-cta-title">Know what you can afford before you shop</p>
            <p className="text-sm text-muted-foreground">Get pre-approved in as little as 3 minutes</p>
          </div>
        </div>
        <Button asChild className="gap-2" data-testid="button-cta-preapproval">
          <Link href="/apply">
            Get Pre-Approved
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Fixed bottom bar. The sibling spacer keeps the last result row clear of the
 * bar (and of the iOS home indicator, via the safe-area inset below).
 */
export function StickyPreApprovalBanner() {
  return (
    <>
      <div className="h-16" />
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg" data-testid="banner-sticky-preapproval">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-3 px-4">
          <p className="text-sm font-medium hidden sm:block">
            Get pre-approved to make stronger offers on these homes
          </p>
          <p className="text-sm font-medium sm:hidden">
            Get pre-approved in 3 min
          </p>
          <Button asChild size="sm" className="gap-1.5 shrink-0" data-testid="button-sticky-preapproval">
            <Link href="/apply">
              <Sparkles className="h-3.5 w-3.5" />
              Get Pre-Approved
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}
