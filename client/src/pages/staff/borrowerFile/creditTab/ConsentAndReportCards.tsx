import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle2, CreditCard, RefreshCw, Shield } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/formatters";
import type { CreditSummary } from "../model";

/**
 * FCRA consent state. When no consent is on file the card says so plainly and
 * links to the borrower-facing authorization page — a pull is not offered as
 * an option the staff member could take anyway.
 */
export function ConsentStatusCard({
  creditData,
  creditLoading,
  applicationId,
}: {
  creditData: CreditSummary | undefined;
  creditLoading: boolean;
  applicationId: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Consent Status
          </CardTitle>
          {creditLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
        </div>
      </CardHeader>
      <CardContent>
        {creditData?.hasActiveConsent ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success-subtle-foreground" />
              <span className="font-medium text-success-subtle-foreground" data-testid="text-consent-status">
                Consent Active
              </span>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Signed by: {creditData.consent?.borrowerFullName}</p>
              <p>Date: {creditData.consent?.consentTimestamp && format(new Date(creditData.consent.consentTimestamp), "MMM d, yyyy 'at' h:mm a")}</p>
              <p>Version: {creditData.consent?.disclosureVersion}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning-subtle-foreground" />
              <span className="font-medium text-warning-subtle-foreground" data-testid="text-consent-status">
                No Active Consent
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Borrower must provide credit authorization before a credit pull can be performed.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/credit-consent/${applicationId}`}>
                Request Consent
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Tri-merge results. The Pull Credit button is disabled without an active
 * consent — the server enforces the same gate, this only stops the staff
 * member reaching for an action FCRA forbids.
 *
 * A simulated pull is banner-flagged as unfit for a binding decision; that
 * banner is the only thing distinguishing adapter output from a live bureau
 * response on screen.
 */
export function CreditReportCard({
  creditData,
  isPulling,
  onPull,
}: {
  creditData: CreditSummary | undefined;
  isPulling: boolean;
  onPull: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Credit Report
          </CardTitle>
          <Button
            size="sm"
            disabled={!creditData?.hasActiveConsent || isPulling}
            onClick={onPull}
            data-testid="button-pull-credit"
          >
            {isPulling ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Pulling...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Pull Credit
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {creditData?.latestPull ? (
          <div className="space-y-4">
            {creditData.latestPull.isSimulated && (
              <div
                className="rounded-md border bg-warning-subtle px-3 py-2 text-xs font-medium text-warning-subtle-foreground"
                data-testid="badge-simulated-pull"
              >
                Simulated credit data — no live bureau pull. Not for a binding decision.
              </div>
            )}
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Representative</p>
                <p className="text-2xl font-bold" data-testid="text-rep-score">
                  {creditData.latestPull.representativeScore || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Experian</p>
                <p className="text-lg font-semibold" data-testid="text-exp-score">
                  {creditData.latestPull.experianScore || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Equifax</p>
                <p className="text-lg font-semibold" data-testid="text-eqf-score">
                  {creditData.latestPull.equifaxScore || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">TransUnion</p>
                <p className="text-lg font-semibold" data-testid="text-tu-score">
                  {creditData.latestPull.transunionScore || "—"}
                </p>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Tradelines:</span>
                <span className="ml-2 font-medium">
                  {creditData.latestPull.openTradelines}/{creditData.latestPull.totalTradelines}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Derogatory:</span>
                <span className="ml-2 font-medium">
                  {creditData.latestPull.derogatoryCount || 0}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Total Debt:</span>
                <span className="ml-2 font-medium">
                  {formatCurrency(creditData.latestPull.totalDebt)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Monthly Payments:</span>
                <span className="ml-2 font-medium">
                  {formatCurrency(creditData.latestPull.monthlyPayments)}
                </span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Pulled: {creditData.latestPull.completedAt && format(new Date(creditData.latestPull.completedAt), "MMM d, yyyy")}
              {creditData.latestPull.expiresAt && ` • Expires: ${format(new Date(creditData.latestPull.expiresAt), "MMM d, yyyy")}`}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No credit report on file
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {creditData?.pullCount || 0} previous pull(s)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
