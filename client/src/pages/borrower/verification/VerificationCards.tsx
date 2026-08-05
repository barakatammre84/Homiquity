import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowRight, CheckCircle2, Clock, Shield } from "lucide-react";
import type { VerificationProgress } from "./verificationTypes";

export function NoApplicationCard() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold">No Active Application</h3>
        <p className="text-center text-muted-foreground mb-4">
          Start a loan application to begin the verification process.
        </p>
        <Link href="/apply">
          <Button data-testid="button-start-application">Start Application</Button>
        </Link>
      </CardContent>
    </Card>
  );
}

/**
 * Shown when the server reports Plaid is not configured. It routes the
 * borrower to the manual document path rather than leaving them at a dead end
 * — automated verification being unavailable must never look like a blocked
 * application.
 */
export function PlaidUnconfiguredCard() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="mb-4 h-12 w-12 text-warning-subtle-foreground" />
        <h3 className="mb-2 text-lg font-semibold">Verification Service Setup Required</h3>
        <p className="text-center text-muted-foreground mb-4">
          The automated verification service requires configuration. Please contact support or your loan officer will verify your documents manually.
        </p>
        <Link href="/tasks">
          <Button variant="outline" data-testid="button-view-tasks">
            View Manual Tasks
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export function ProgressCard({ completedCount, totalRequired, allRequiredComplete }: VerificationProgress) {
  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold">Verification Progress</h3>
            <p className="text-sm text-muted-foreground">
              {completedCount} of {totalRequired} required verifications complete
            </p>
          </div>
          <div className="flex items-center gap-2">
            {allRequiredComplete ? (
              <Badge className="bg-success-subtle text-success-subtle-foreground">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                All Required Complete
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Clock className="mr-1 h-3 w-3" />
                In Progress
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function WhyVerifyCard() {
  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="text-base">Why Verify?</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-success-subtle-foreground mt-0.5 flex-shrink-0" />
            <span>Faster loan processing - skip manual document review</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-success-subtle-foreground mt-0.5 flex-shrink-0" />
            <span>Secure connection through Plaid - we never see your login credentials</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-success-subtle-foreground mt-0.5 flex-shrink-0" />
            <span>Industry-standard encryption protects your data</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-success-subtle-foreground mt-0.5 flex-shrink-0" />
            <span>Compliant with GSE (Fannie Mae/Freddie Mac) requirements</span>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * This page's "Identity Verification" is the Plaid institution check; KBA and
 * KYC live on /identity-verification. The two are easy to confuse, so the
 * cross-link is always rendered.
 */
export function IdentityCrossLinkCard() {
  return (
    <Card className="mb-6" data-testid="card-cross-link-identity">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Looking for identity verification?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Knowledge-based authentication (KBA) and KYC checks are handled on a separate page.
            </p>
            <Link href="/identity-verification">
              <Button variant="outline" size="sm" className="mt-2 gap-1" data-testid="button-goto-identity">
                Go to Identity Verification
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
