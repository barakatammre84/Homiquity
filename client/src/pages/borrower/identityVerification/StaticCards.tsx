import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ChevronRight, FileCheck, Lock, UserCheck } from "lucide-react";
import { getStatusBadge } from "./statusPresentation";

export function DocumentVerificationCard({ docsVerified }: { docsVerified: boolean }) {
  return (
    <Card data-testid="card-doc-verification">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Document Verification</CardTitle>
          </div>
          {docsVerified ? getStatusBadge("verified") : getStatusBadge("pending")}
        </div>
        <CardDescription>Government ID and financial document verification</CardDescription>
      </CardHeader>
      <CardContent>
        {docsVerified ? (
          <div className="text-center py-6" data-testid="docs-verified">
            <CheckCircle2 className="h-12 w-12 text-success-subtle-foreground mx-auto mb-3" />
            <p className="font-semibold text-foreground">Documents Verified</p>
            <p className="text-sm text-muted-foreground mt-1">Your identity documents have been verified.</p>
          </div>
        ) : (
          <div className="text-center py-6">
            <FileCheck className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-foreground mb-2">Verify Your Documents</p>
            <p className="text-sm text-muted-foreground mb-4">Connect your financial institution to verify your identity documents automatically.</p>
            <Button variant="outline" asChild data-testid="button-go-verification">
              <a href="/verification">
                Go to Verification Center
                <ChevronRight className="h-4 w-4 ml-1" />
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Placeholder for a capability that does not exist yet. It carries a "Coming
 * Soon" badge and no action, and it is deliberately left out of the progress
 * count in summariseVerification — counting a step nobody can complete would
 * cap the borrower's progress below 100% forever.
 */
export function BiometricCard() {
  return (
    <Card data-testid="card-biometric">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Biometric Authentication</CardTitle>
          </div>
          <Badge variant="secondary">Coming Soon</Badge>
        </div>
        <CardDescription>Advanced identity confirmation via facial recognition</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-6">
          <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-foreground mb-2">Enhanced Security</p>
          <p className="text-sm text-muted-foreground">
            Biometric verification adds an extra layer of protection. This feature uses facial recognition technology to ensure only you can access your mortgage application.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function SecurityNoticeCard() {
  return (
    <Card className="mt-4" data-testid="card-security-notice">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Your data is protected</p>
            <p className="text-xs text-muted-foreground mt-1">
              All verification data is encrypted end-to-end and stored securely. We comply with GLBA, FCRA, and SOC 2 Type II standards. Your information is never shared with third parties beyond what is necessary for the verification process.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
