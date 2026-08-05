import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import type { Verification } from "@shared/schema";
import { PlaidLinkButton } from "./PlaidLinkButton";
import { statusBadgeSpec, type VerificationTypeDescriptor } from "./verificationTypes";

function StatusBadge({ status }: { status: string }) {
  const c = statusBadgeSpec(status);
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

export function VerificationTypeCard({
  vType,
  status,
  verification,
  applicationId,
  onVerified,
}: {
  vType: VerificationTypeDescriptor;
  status: string;
  verification: Verification | undefined;
  applicationId: string;
  onVerified: () => void;
}) {
  const Icon = vType.icon;
  const isVerified = status === "verified";

  return (
    <Card
      className={isVerified ? "border-border" : ""}
      data-testid={`card-verification-${vType.type}`}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              isVerified
                ? "bg-success-subtle"
                : "bg-muted"
            }`}>
              {isVerified ? (
                <CheckCircle2 className="h-5 w-5 text-success-subtle-foreground" />
              ) : (
                <Icon className="h-5 w-5" />
              )}
            </div>
            <div>
              <CardTitle className="text-base">{vType.title}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                {vType.required && (
                  <Badge variant="outline" className="text-xs">Required</Badge>
                )}
                <StatusBadge status={status} />
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          {vType.description}
        </p>

        {verification && verification.verifiedAt && (
          <p className="text-xs text-muted-foreground mb-4">
            Verified on {format(new Date(verification.verifiedAt), "MMM d, yyyy")}
          </p>
        )}

        {verification && vType.type === "employment" && verification.employerName && (
          <div className="rounded-lg bg-muted p-3 mb-4">
            <p className="text-sm font-medium">{verification.employerName}</p>
            {verification.jobTitle && (
              <p className="text-xs text-muted-foreground">{verification.jobTitle}</p>
            )}
          </div>
        )}

        {!isVerified && (
          <PlaidLinkButton
            applicationId={applicationId}
            verificationType={vType.type}
            onSuccess={onVerified}
            disabled={status === "in_progress"}
          />
        )}

        {status === "in_progress" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Processing verification...
          </div>
        )}

        {status === "failed" && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">
              Verification failed. Please try again.
            </p>
            <PlaidLinkButton
              applicationId={applicationId}
              verificationType={vType.type}
              onSuccess={onVerified}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
