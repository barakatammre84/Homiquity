import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  Archive,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  Database,
  FileCheck,
  Mail,
  RefreshCw,
  Scale,
  ScanLine,
  Shield,
  ShieldAlert,
  Users,
  Zap,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import {
  type ComplianceData,
  type RetentionPolicy,
  type RetentionReport,
  coApplicantNames,
} from "./model";
import { KycReviewQueue } from "./KycReviewQueue";
import { AuditChainStatusTiles } from "./AuditChainStatusTiles";

/**
 * Compliance tab (extracted from StaffDashboard.tsx): GSE/ULDD/QM readiness
 * per loan, the ECOA §1002.9 adverse-action delivery counters, the FCRA/ECOA/
 * GLBA data-retention report (owns those queries — they fire when the tab
 * first mounts), the hash-chained audit-log summary, and the automation
 * activity panel. `complianceData` arrives as a prop because the page's KPI
 * cards read the same query.
 */
export function ComplianceTab({ complianceData }: { complianceData: ComplianceData | undefined }) {
  const { data: retentionReport, isLoading: retentionLoading, refetch: refetchRetention } = useQuery<RetentionReport>({
    queryKey: ["/api/credit/retention-report"],
  });

  const { data: retentionPoliciesData } = useQuery<{ policies: Record<string, RetentionPolicy> }>({
    queryKey: ["/api/credit/retention-policies"],
  });

  const aaUndelivered = complianceData?.adverseActionDelivery?.undelivered ?? 0;
  const aaWarning = complianceData?.adverseActionDelivery?.warning ?? 0;
  const aaBreach = complianceData?.adverseActionDelivery?.breach ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">GSE Ready</p>
                <p className="text-2xl font-bold text-success-subtle-foreground" data-testid="text-gse-ready">{complianceData?.gseReady || 0}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-success-subtle-foreground/30" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ready for Fannie/Freddie</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ULDD Compliant</p>
                <p className="text-2xl font-bold text-info" data-testid="text-uldd-compliant">{complianceData?.ulddCompliant || 0}</p>
              </div>
              <FileCheck className="h-8 w-8 text-info/30" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Minimum data met</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Needs Attention</p>
                <p className="text-2xl font-bold text-warning-subtle-foreground" data-testid="text-needs-attention">{complianceData?.needsAttention || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-warning-subtle-foreground/30" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Missing critical data</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Undelivered Notices</p>
                <p
                  className={`text-2xl font-bold ${aaBreach > 0 ? "text-destructive" : aaWarning > 0 ? "text-warning-subtle-foreground" : ""}`}
                  data-testid="text-aa-undelivered"
                >
                  {aaUndelivered}
                </p>
              </div>
              <Mail className="h-8 w-8 text-muted-foreground/30" />
            </div>
            {aaBreach > 0 ? (
              <p className="text-xs text-destructive mt-1" data-testid="text-aa-delivery-status">{aaBreach} past 30-day ECOA window</p>
            ) : aaWarning > 0 ? (
              <p className="text-xs text-warning-subtle-foreground mt-1" data-testid="text-aa-delivery-status">{aaWarning} nearing 30-day deadline</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1" data-testid="text-aa-delivery-status">Adverse actions — ECOA §1002.9</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sits above the per-loan overview because it is the only blocking queue on
          this tab: a borrower parked at pending_review cannot progress at all. */}
      <KycReviewQueue />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Regulatory Compliance Overview
          </CardTitle>
          <CardDescription>TRID timing, MISMO validation, and document compliance per loan</CardDescription>
        </CardHeader>
        <CardContent>
          {(complianceData?.applications || []).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="mx-auto h-12 w-12 mb-4" />
              <p>No active loans to validate</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(complianceData?.applications || []).map(app => (
                <div key={app.applicationId} className="rounded-lg border p-4" data-testid={`compliance-app-${app.applicationId}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">{app.borrowerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {app.status?.toUpperCase().replace(/_/g, " ")} {app.loanAmount ? `- ${formatCurrency(app.loanAmount)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {app.gseGatingFailed ? (
                        <Badge variant="destructive" className="gap-1" data-testid={`badge-gating-${app.applicationId}`}>
                          <ShieldAlert className="h-3 w-3" />
                          Gating Failed
                        </Badge>
                      ) : app.gseReady ? (
                        <Badge data-testid={`badge-gse-${app.applicationId}`}>GSE Ready</Badge>
                      ) : app.ulddCompliant ? (
                        <Badge variant="secondary">ULDD Compliant</Badge>
                      ) : (
                        <Badge variant="destructive">Incomplete</Badge>
                      )}
                      {app.qmStatus === "Non-QM" && (
                        <Badge variant="destructive" className="gap-1" data-testid={`badge-qm-${app.applicationId}`}>
                          <Scale className="h-3 w-3" />
                          Non-QM
                        </Badge>
                      )}
                      {app.qmStatus === "QM" && (
                        <Badge variant="secondary" className="gap-1 bg-info-subtle text-info" data-testid={`badge-qm-${app.applicationId}`}>
                          <Scale className="h-3 w-3" />
                          QM
                        </Badge>
                      )}
                      {(app.coApplicantCount || 0) > 0 &&
                        coApplicantNames(app.coApplicants).map((name, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="gap-1"
                            data-testid={`badge-coapplicant-${app.applicationId}-${i}`}
                          >
                            <Users className="h-3 w-3" />
                            {name}
                          </Badge>
                        ))}
                      <Button size="sm" className="touch-target" variant="outline" asChild>
                        <Link href={`/borrower-file/${app.applicationId}`}>View</Link>
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>ULAD Completeness</span>
                      <span>{app.score}%</span>
                    </div>
                    <Progress value={app.score} className="h-1.5" />
                  </div>
                  {(app.criticalCount > 0 || app.missingDocsCount > 0) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {app.criticalCount > 0 && (
                        <Badge variant="outline" className="text-xs text-destructive">{app.criticalCount} critical errors</Badge>
                      )}
                      {app.missingDocsCount > 0 && (
                        <Badge variant="outline" className="text-xs">{app.missingDocsCount} missing docs</Badge>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Retention & Archival
              </CardTitle>
              <CardDescription>FCRA, ECOA, and GLBA compliance tracking</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm" className="touch-target"
              onClick={() => refetchRetention()}
              data-testid="button-refresh-retention"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {retentionLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-muted-foreground">Total Records</p>
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-total-records">
                    {Object.values(retentionReport?.recordCounts || {}).reduce((a, b) => a + b, 0)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-muted-foreground">Archive Eligible</p>
                    <Archive className="h-4 w-4 text-warning-subtle-foreground" />
                  </div>
                  <p className="text-2xl font-bold text-warning-subtle-foreground" data-testid="text-archive-eligible">
                    {Object.values(retentionReport?.archiveEligibleCounts || {}).reduce((a, b) => a + b, 0)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-muted-foreground">Retention Review</p>
                    <Clock className="h-4 w-4 text-info" />
                  </div>
                  <p className="text-2xl font-bold text-info" data-testid="text-retention-review">
                    {Object.values(retentionReport?.retentionReviewCounts || {}).reduce((a, b) => a + b, 0)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-muted-foreground">Delete Eligible</p>
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                  <p className="text-2xl font-bold text-destructive" data-testid="text-delete-eligible">
                    {Object.values(retentionReport?.deleteEligibleCounts || {}).reduce((a, b) => a + b, 0)}
                  </p>
                </div>
              </div>

              {retentionReport?.recommendations && retentionReport.recommendations.length > 0 && (
                <div className="space-y-2">
                  {retentionReport.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                      data-testid={`alert-recommendation-${idx}`}
                    >
                      {rec.includes("No action") ? (
                        <CheckCircle2 className="h-5 w-5 text-success-subtle-foreground mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-warning-subtle-foreground mt-0.5 flex-shrink-0" />
                      )}
                      <span className="text-sm">{rec}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium mb-2">Record Counts by Type</p>
                  <div className="space-y-2">
                    {Object.entries(retentionReport?.recordCounts || {}).map(([type, count]) => (
                      <div
                        key={type}
                        className="flex items-center justify-between p-2 rounded-lg border"
                        data-testid={`row-record-${type}`}
                      >
                        <div>
                          <p className="text-sm font-medium capitalize">{type.replace(/_/g, " ")}</p>
                          <p className="text-xs text-muted-foreground">
                            {retentionPoliciesData?.policies?.[type]?.regulatoryReference || "N/A"}
                          </p>
                        </div>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Retention Policies</p>
                  <ScrollArea className="h-[250px]">
                    <div className="space-y-2">
                      {Object.entries(retentionPoliciesData?.policies || {}).map(([type, policy]) => (
                        <div
                          key={type}
                          className="p-2 rounded-lg border"
                          data-testid={`row-policy-${type}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium capitalize">{type.replace(/_/g, " ")}</p>
                            <Badge variant="outline">
                              {Math.round(policy.retentionPeriodDays / 365)} years
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">{policy.legalBasis}</p>
                          <div className="flex gap-2 text-xs">
                            <span className="text-muted-foreground">Archive: {policy.archiveAfterDays} days</span>
                            <span className="text-muted-foreground">Delete: {policy.deleteAfterDays ? `${policy.deleteAfterDays} days` : "Never"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance Audit Log
          </CardTitle>
          <CardDescription>Track all compliance-related activities with cryptographic verification</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Was three hardcoded green tiles that could never turn red (F-039).
              Now driven by an actual chain sweep and the retention report. */}
          <AuditChainStatusTiles report={retentionReport} />
          <div className="text-center text-muted-foreground py-4">
            <p className="text-sm">Access individual loan audit logs from the Borrower File page.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Automation Activity
          </CardTitle>
          <CardDescription>Tasks and checks handled automatically by the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <ScanLine className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Document Classification</p>
                <p className="text-xs text-muted-foreground">
                  Incoming documents are automatically classified (W-2, pay stub, bank statement) using AI. Up to 40% of manual document processing is eliminated.
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 bg-secondary text-primary">Active</Badge>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Brain className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Income Verification</p>
                <p className="text-xs text-muted-foreground">
                  AI extracts income data from uploaded documents, cross-references with application data, and flags discrepancies automatically.
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 bg-secondary text-primary">Active</Badge>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Zap className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Compliance Rule Engine</p>
                <p className="text-xs text-muted-foreground">
                  TRID timelines, disclosure deadlines, and regulatory checklists are auto-tracked. Tasks are auto-generated when deadlines approach.
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 bg-secondary text-primary">Active</Badge>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Bot className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Form Pre-fill</p>
                <p className="text-xs text-muted-foreground">
                  Borrower data from verified documents automatically pre-fills application fields, reducing data entry and errors across the lifecycle.
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 bg-secondary text-primary">Active</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
