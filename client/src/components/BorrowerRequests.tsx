import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  FileText,
  Clock,
  ArrowRight
} from "lucide-react";
import { Link } from "wouter";

interface BorrowerTask {
  id: string;
  applicationId: string;
  title: string;
  description?: string;
  taskType: string;
  taskTypeCode?: string;
  ownerRole?: string;
  slaClass?: string;
  status: string;
  createdAt?: string;
  slaStatus: "green" | "amber" | "red";
  timeRemaining: number | null;
  percentageElapsed: number | null;
}

const FRIENDLY_TASK_NAMES: Record<string, string> = {
  DOC_PAYSTUB_REQUEST: "Upload April Pay Stub",
  DOC_BANK_STATEMENT_REQUEST: "Upload Bank Statements",
  DOC_TAX_RETURN_REQUEST: "Upload Tax Returns",
  DOC_PURCHASE_CONTRACT: "Upload Purchase Contract",
  DOC_GIFT_LETTER: "Upload Gift Letter",
  DOC_W2_REQUEST: "Upload W-2 Forms",
  INTAKE_CONSENT_CREDIT: "Authorize Credit Check",
  INTAKE_INITIAL_DISCLOSURES: "Review Loan Disclosures",
  CRD_CREDIT_PULL: "Authorize Credit Check",
  CRD_INQUIRY_LOE: "Explain Credit Inquiries",
  INC_EMP_GAP: "Verify Employment History",
  AST_LARGE_DEPOSIT: "Explain Large Deposit",
  CMP_ADVERSE_ACTION: "Review Important Notice",
};

function formatDueDate(minutes: number | null): string {
  if (minutes === null) return "";
  if (minutes <= 0) return "Due today";
  
  if (minutes < 60) return "Due in 1 hour";
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    return `Due in ${hours} hour${hours > 1 ? "s" : ""}`;
  }
  const days = Math.floor(minutes / 1440);
  return `Due in ${days} day${days > 1 ? "s" : ""}`;
}

interface BorrowerRequestsProps {
  applicationId?: string;
  "data-testid"?: string;
}

export function BorrowerRequests({ applicationId, "data-testid": testId }: BorrowerRequestsProps) {
  const { data: tasks, isLoading } = useQuery<BorrowerTask[]>({
    queryKey: ["/api/task-engine/applications", applicationId, "borrower-tasks"],
    enabled: !!applicationId,
  });

  const pendingTasks = tasks?.filter(t => t.status === "OPEN" && t.ownerRole === "BORROWER") || [];

  if (isLoading) {
    return (
      <Card data-testid={testId || "card-what-we-need"}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-16">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingTasks.length === 0) {
    return null;
  }

  const displayTasks = pendingTasks.slice(0, 3);

  return (
    <Card className="shadow-md" data-testid={testId || "card-what-we-need"}>
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15">
            <FileText className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          </div>
          What We Need From You
          <Badge variant="secondary" className="text-[10px] ml-auto">{pendingTasks.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {displayTasks.map((task) => {
          const friendlyName = FRIENDLY_TASK_NAMES[task.taskTypeCode || ""] || task.title;
          const dueText = formatDueDate(task.timeRemaining);
          const isUrgent = task.slaStatus === "red" || task.slaStatus === "amber";
          
          return (
            <div 
              key={task.id}
              className="flex items-center justify-between gap-3 p-3 rounded-md border"
              data-testid={`row-request-${task.id}`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-wrap">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${
                  isUrgent ? "border-amber-500 text-amber-600 dark:text-amber-400" : "border-primary/50 text-primary"
                }`}>
                  {isUrgent ? (
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <Upload className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" data-testid={`text-request-title-${task.id}`}>
                    {friendlyName}
                  </p>
                  {dueText && (
                    <p className={`text-xs ${
                      isUrgent ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                    }`} data-testid={`text-request-due-${task.id}`}>
                      {dueText}
                    </p>
                  )}
                </div>
              </div>
              <Link href="/documents">
                <Button size="sm" variant="outline" className="shrink-0" data-testid={`button-upload-${task.id}`}>
                  Upload
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          );
        })}
        
        {pendingTasks.length > 3 && (
          <Link href="/documents" className="block">
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" data-testid="button-view-all-requests">
              View all {pendingTasks.length} requests
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export default BorrowerRequests;
