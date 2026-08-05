import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, CreditCard } from "lucide-react";
import { format } from "date-fns";
import type { CreditSummary } from "./types";

/**
 * Shown once an active FCRA authorization exists: who authorized it and when,
 * plus the bureau scores from the latest pull.
 */
export function ActiveConsentCard({
  consent,
  latestPull,
}: {
  // Both stay optional: the card renders off creditSummary?.x, so the summary
  // query being in flight is a legitimate undefined, not a missing prop.
  consent?: CreditSummary["consent"];
  latestPull?: CreditSummary["latestPull"];
}) {
  return (
    <Card className="border-border bg-success-subtle">
      <CardContent className="py-6">
        <div className="flex items-start gap-4">
          <CheckCircle2 className="h-6 w-6 text-success-subtle-foreground mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-success-subtle-foreground" data-testid="text-consent-active">
              Consent Already Provided
            </h3>
            <p className="text-sm text-success-subtle-foreground mt-1">
              {consent?.borrowerFullName} authorized a credit check on{" "}
              {consent?.consentTimestamp && format(new Date(consent.consentTimestamp), "MMMM d, yyyy 'at' h:mm a")}
            </p>
            {latestPull && (
              <div className="mt-4 p-4 bg-card rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="h-4 w-4" />
                  <span className="font-medium">Credit Report Summary</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Representative</span>
                    <p className="text-xl font-bold" data-testid="text-credit-score-representative">
                      {latestPull.representativeScore || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Experian</span>
                    <p className="font-semibold" data-testid="text-credit-score-experian">{latestPull.experianScore || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Equifax</span>
                    <p className="font-semibold" data-testid="text-credit-score-equifax">{latestPull.equifaxScore || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">TransUnion</span>
                    <p className="font-semibold" data-testid="text-credit-score-transunion">{latestPull.transunionScore || "—"}</p>
                  </div>
                </div>
                {latestPull.expiresAt && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Valid until {format(new Date(latestPull.expiresAt), "MMMM d, yyyy")}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
