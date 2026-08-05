import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Briefcase, CheckCircle2, ChevronRight, Circle } from "lucide-react";

/**
 * Static guidance shown alongside the timeline, one card per borrower type.
 *
 * These are educational, not offers: no rate, payment, term or down-payment
 * figure appears, so Reg Z §1026.24 trigger terms are not in play. The credit
 * score line names program floors ("620+ for conventional, 580+ for FHA")
 * without stating or implying approval, keeping clear of Reg N §1014.3(i).
 */
export function FirstTimeBuyerTips() {
  return (
    <Card className="mb-6" data-testid="card-buyer-tips">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">First-Time Buyer Tips</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[
            { title: "Check your credit score", desc: "Aim for 620+ for conventional loans, 580+ for FHA" },
            { title: "Save for closing costs", desc: "Typically 2-5% of the purchase price" },
            { title: "Get pre-approved first", desc: "Sellers prefer buyers with pre-approval letters" },
            { title: "Explore down payment assistance", desc: "Many state and local programs help first-time buyers" },
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-success-subtle-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{tip.title}</p>
                <p className="text-xs text-muted-foreground">{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link href="/learn">
            Browse Learning Center
            <ChevronRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function SelfEmployedChecklist() {
  return (
    <Card className="mb-6" data-testid="card-se-checklist">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Self-Employed Document Checklist</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[
            { title: "2 years personal tax returns", desc: "Complete 1040s with all schedules" },
            { title: "2 years business tax returns", desc: "1120, 1120S, or 1065 as applicable" },
            { title: "Year-to-date P&L statement", desc: "Signed and dated within 60 days" },
            { title: "Business license or registration", desc: "Proof of ongoing business operation" },
            { title: "12-24 months bank statements", desc: "Personal and business accounts" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
