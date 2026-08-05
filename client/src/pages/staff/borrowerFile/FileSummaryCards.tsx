import { CheckCircle2, CreditCard, DollarSign, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/formatters";
import type { LoanApplication } from "@shared/schema";
import { creditScoreBand } from "./creditScoreBand";
import type { PipelineData } from "./model";

export function FileSummaryCards({
  application,
  progress,
}: {
  application: LoanApplication;
  progress: PipelineData["progress"] | undefined;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Loan Amount</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-loan-amount">
            {formatCurrency(
              application.purchasePrice && application.downPayment
                ? Number(application.purchasePrice) - Number(application.downPayment)
                : application.purchasePrice
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {application.loanPurpose === "purchase" ? "Purchase" : "Refinance"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Credit Score</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-credit-score">
            {application.creditScore || "---"}
          </div>
          <p className="text-xs text-muted-foreground">
            {creditScoreBand(application.creditScore)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Documents</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-doc-count">
            {progress?.documentsReceived || 0}/{progress?.documentsRequired || 0}
          </div>
          <Progress
            value={progress?.documentsRequired ? (progress.documentsReceived / progress.documentsRequired) * 100 : 0}
            className="mt-2 h-2"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Conditions</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-condition-count">
            {progress?.conditionsCleared || 0}/{progress?.conditionsTotal || 0}
          </div>
          <Progress
            value={progress?.conditionsTotal ? (progress.conditionsCleared / progress.conditionsTotal) * 100 : 0}
            className="mt-2 h-2"
          />
        </CardContent>
      </Card>
    </div>
  );
}
