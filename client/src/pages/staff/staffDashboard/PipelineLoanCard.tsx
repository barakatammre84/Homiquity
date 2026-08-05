import { Link } from "wouter";
import {
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  Eye,
  FileText,
  Inbox,
  Scale,
  Shield,
  ShieldAlert,
  Timer,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, getStatusLabel } from "@/lib/formatters";
import { ComplianceChecklistInline } from "./badges";
import { coApplicantNames, type ComplianceData, type PipelineSummary, type QueueTask } from "./model";

type ComplianceApp = NonNullable<ComplianceData["applications"]>[number];

export interface PipelineLoanCardProps {
  item: PipelineSummary;
  /** This loan's row from the compliance dashboard, if it has one. */
  compApp: ComplianceApp | undefined;
  openTasks: QueueTask[];
  checklistOpen: boolean;
  onToggleChecklist: () => void;
  onView: () => void;
}

export function PipelineLoanCard({
  item,
  compApp,
  openTasks,
  checklistOpen,
  onToggleChecklist,
  onView,
}: PipelineLoanCardProps) {
  return (
    <Card
      className={`${checklistOpen ? "ring-2 ring-primary" : ""}`}
      data-testid={`card-loan-${item.applicationId}`}
    >
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start gap-4">
          <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
            item.priority === "urgent" ? "bg-destructive" : item.priority === "high" ? "bg-warning" : "bg-info"
          }`} />

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/borrower-file/${item.applicationId}`}>
                <span className="font-medium hover:underline cursor-pointer" data-testid={`link-loan-${item.applicationId}`}>
                  {item.borrowerName || `Loan #${item.applicationId.slice(0, 8)}`}
                </span>
              </Link>
              <Badge variant="outline">{getStatusLabel(item.currentStage)}</Badge>
              {compApp?.gseReady && (
                <Badge variant="secondary" className="gap-1 text-xs bg-success-subtle text-success-subtle-foreground" data-testid={`badge-gse-${item.applicationId}`}>
                  <CheckCircle2 className="h-3 w-3" />
                  GSE Ready
                </Badge>
              )}
              {compApp?.gseGatingFailed && (
                <Badge variant="destructive" className="gap-1 text-xs" data-testid={`badge-gating-${item.applicationId}`}>
                  <ShieldAlert className="h-3 w-3" />
                  Gating Failed
                </Badge>
              )}
              {compApp?.qmStatus === "Non-QM" && (
                <Badge variant="destructive" className="gap-1 text-xs" data-testid={`badge-qm-${item.applicationId}`}>
                  <Scale className="h-3 w-3" />
                  Non-QM
                </Badge>
              )}
              {compApp?.qmStatus === "QM" && (
                <Badge variant="secondary" className="gap-1 text-xs bg-info-subtle text-info" data-testid={`badge-qm-${item.applicationId}`}>
                  <Scale className="h-3 w-3" />
                  QM
                </Badge>
              )}
              {(compApp?.coApplicantCount || 0) > 0 &&
                coApplicantNames(compApp?.coApplicants).map((name, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="gap-1 text-xs"
                    data-testid={`badge-coapplicant-${item.applicationId}-${i}`}
                  >
                    <Users className="h-3 w-3" />
                    {name}
                  </Badge>
                ))}
              {(compApp?.criticalCount || 0) > 0 && (
                <Badge variant="destructive" className="text-xs" data-testid={`badge-critical-${item.applicationId}`}>
                  {compApp?.criticalCount} critical
                </Badge>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {item.loanAmount ? formatCurrency(item.loanAmount) : "N/A"}
              </span>
              <span className="flex items-center gap-1">
                <Timer className="h-3 w-3" />
                Day {item.daysInPipeline}
              </span>
              <span className="flex items-center gap-1">
                <ClipboardCheck className="h-3 w-3" />
                {item.conditionsCleared}/{item.conditionsTotal} conditions
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {item.documentsReceived}/{item.documentsRequired} docs
              </span>
              {openTasks.length > 0 && (
                <span className="flex items-center gap-1">
                  <Inbox className="h-3 w-3" />
                  {openTasks.length} open task{openTasks.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="mt-2.5">
              <Progress value={item.completionPercentage} className="h-1.5" />
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">{item.completionPercentage}% complete</p>
                {compApp && (
                  <p className="text-xs text-muted-foreground">ULAD: {compApp.score}%</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={onView}
              data-testid={`button-view-file-${item.applicationId}`}
            >
              <Eye className="mr-1 h-4 w-4" />
              View
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onToggleChecklist}
              data-testid={`button-compliance-${item.applicationId}`}
            >
              <Shield className="mr-1 h-4 w-4" />
              Checklist
            </Button>
          </div>
        </div>

        {checklistOpen && (
          <div className="mt-4 pt-4 border-t">
            <ComplianceChecklistInline
              stage={item.currentStage}
              completionPct={item.completionPercentage}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
