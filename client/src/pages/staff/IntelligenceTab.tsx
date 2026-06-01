import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  Brain,
  BarChart3,
  FileCheck,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Target,
} from "lucide-react";

interface FunnelData {
  stage: string;
  count: number;
  conversionRate: number;
}

interface AutomationMetrics {
  totalEvents: number;
  automatedEvents: number;
  automationRate: number;
  topAutomations: { name: string; count: number }[];
  byDomain: Record<string, { total: number; automated: number }>;
}

interface DocAccuracy {
  documentType: string;
  avgConfidence: number;
  totalExtractions: number;
  humanReviewedCount: number;
  needsReviewCount: number;
  avgAccuracyAfterReview: number | null;
}

interface OutcomeSegment {
  segment: string;
  totalLoans: number;
  funded: number;
  denied: number;
  withdrawn: number;
  avgDaysToClose: number | null;
  conversionRate: number;
}

export default function IntelligenceTab() {
  const { data: funnel, isLoading: funnelLoading } = useQuery<FunnelData[]>({
    queryKey: ["/api/outcomes/funnel"],
  });

  const { data: automation, isLoading: automationLoading } = useQuery<AutomationMetrics>({
    queryKey: ["/api/analytics/automation-metrics"],
  });

  const { data: docAccuracy, isLoading: docLoading } = useQuery<DocAccuracy[]>({
    queryKey: ["/api/documents/confidence/accuracy"],
  });

  const { data: creditSegments, isLoading: segmentsLoading } = useQuery<OutcomeSegment[]>({
    queryKey: ["/api/outcomes/segments/creditScoreBucket"],
  });

  const isLoading = funnelLoading || automationLoading || docLoading || segmentsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-48 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  const totalAutomated = automation?.automatedEvents || 0;
  const automationRate = automation?.automationRate || 0;
  const totalEvents = automation?.totalEvents || 0;
  const avgDocConfidence = docAccuracy && docAccuracy.length > 0
    ? docAccuracy.reduce((s, d) => s + d.avgConfidence, 0) / docAccuracy.length
    : 0;
  const pendingReviews = docAccuracy?.reduce((s, d) => s + d.needsReviewCount, 0) || 0;

  const funnelStages = funnel || [];
  const topConversion = funnelStages.length > 0 ? funnelStages[0].count : 0;
  const bottomConversion = funnelStages.length > 0 ? funnelStages[funnelStages.length - 1].count : 0;
  const overallConversionRate = topConversion > 0 ? ((bottomConversion / topConversion) * 100) : 0;

  return (
    <div className="space-y-6" data-testid="intelligence-tab">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="kpi-automation-rate">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <p className="text-sm text-muted-foreground">Automation Rate</p>
            </div>
            <p className="text-2xl font-bold">{automationRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">{totalAutomated} of {totalEvents} tasks automated</p>
          </CardContent>
        </Card>
        <Card data-testid="kpi-conversion-rate">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-emerald-500" />
              <p className="text-sm text-muted-foreground">Pipeline Conversion</p>
            </div>
            <p className="text-2xl font-bold">{overallConversionRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Submitted to funded</p>
          </CardContent>
        </Card>
        <Card data-testid="kpi-doc-confidence">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-blue-500" />
              <p className="text-sm text-muted-foreground">Doc Intelligence</p>
            </div>
            <p className="text-2xl font-bold">{(avgDocConfidence * 100).toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Avg extraction confidence</p>
          </CardContent>
        </Card>
        <Card data-testid="kpi-pending-reviews">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileCheck className="h-4 w-4 text-orange-500" />
              <p className="text-sm text-muted-foreground">Needs Review</p>
            </div>
            <p className="text-2xl font-bold">{pendingReviews}</p>
            <p className="text-xs text-muted-foreground">Low-confidence extractions</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="funnel">
        <TabsList>
          <TabsTrigger value="funnel" data-testid="tab-funnel">
            <BarChart3 className="h-4 w-4 mr-1" />
            Conversion Funnel
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            <FileCheck className="h-4 w-4 mr-1" />
            Document Intelligence
          </TabsTrigger>
          <TabsTrigger value="automation" data-testid="tab-automation">
            <Zap className="h-4 w-4 mr-1" />
            Automation Activity
          </TabsTrigger>
          <TabsTrigger value="segments" data-testid="tab-segments">
            <TrendingUp className="h-4 w-4 mr-1" />
            Outcome Segments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="funnel" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Pipeline Conversion Funnel (Last 90 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {funnelStages.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No outcome data yet. Conversion metrics will appear as loans progress through the pipeline.
                </p>
              ) : (
                <div className="space-y-3">
                  {funnelStages.map((stage, idx) => {
                    const maxCount = funnelStages[0]?.count || 1;
                    const pct = (stage.count / maxCount) * 100;
                    return (
                      <div key={stage.stage} className="space-y-1" data-testid={`funnel-stage-${stage.stage}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium capitalize">
                            {stage.stage.replace(/_/g, " ")}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{stage.count}</span>
                            {idx > 0 && (
                              <Badge variant="secondary">
                                {stage.conversionRate.toFixed(0)}% from previous
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Extraction Accuracy by Document Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!docAccuracy || docAccuracy.length === 0) ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No document extractions recorded yet. Metrics will populate as documents are processed.
                </p>
              ) : (
                <div className="space-y-4">
                  {docAccuracy.map(doc => (
                    <div key={doc.documentType} className="flex items-center gap-4" data-testid={`doc-accuracy-${doc.documentType}`}>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium capitalize">{doc.documentType.replace(/_/g, " ")}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{(doc.avgConfidence * 100).toFixed(0)}%</span>
                            <Badge variant={doc.needsReviewCount > 0 ? "destructive" : "secondary"}>
                              {doc.totalExtractions} extractions
                            </Badge>
                          </div>
                        </div>
                        <Progress value={doc.avgConfidence * 100} className="h-2" />
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {doc.humanReviewedCount} reviewed
                          </span>
                          {doc.needsReviewCount > 0 && (
                            <span className="flex items-center gap-1 text-orange-500">
                              <AlertTriangle className="h-3 w-3" />
                              {doc.needsReviewCount} need review
                            </span>
                          )}
                          {doc.avgAccuracyAfterReview !== null && (
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              {(doc.avgAccuracyAfterReview * 100).toFixed(0)}% post-review accuracy
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Automation by Domain
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(!automation?.byDomain || Object.keys(automation.byDomain).length === 0) ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No automation events recorded yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(automation.byDomain).map(([domain, stats]) => {
                      const rate = stats.total > 0 ? (stats.automated / stats.total) * 100 : 0;
                      return (
                        <div key={domain} className="space-y-1" data-testid={`automation-domain-${domain}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium capitalize">{domain}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{stats.automated}/{stats.total}</span>
                              <Badge variant="secondary">{rate.toFixed(0)}%</Badge>
                            </div>
                          </div>
                          <Progress value={rate} className="h-1.5" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Top Automated Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(!automation?.topAutomations || automation.topAutomations.length === 0) ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No automated tasks recorded yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {automation.topAutomations.slice(0, 8).map((item, idx) => (
                      <div key={item.name} className="flex items-center justify-between py-1" data-testid={`top-automation-${idx}`}>
                        <span className="text-sm">{item.name.replace(/_/g, " ")}</span>
                        <Badge variant="outline">{item.count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="segments" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Outcomes by Credit Score Segment
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!creditSegments || creditSegments.length === 0) ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No outcome segments available yet. Data will appear as loans reach resolution.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium">Segment</th>
                        <th className="text-right py-2 font-medium">Total</th>
                        <th className="text-right py-2 font-medium">Funded</th>
                        <th className="text-right py-2 font-medium">Denied</th>
                        <th className="text-right py-2 font-medium">Conversion</th>
                        <th className="text-right py-2 font-medium">Avg Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditSegments.map(seg => (
                        <tr key={seg.segment} className="border-b last:border-0" data-testid={`segment-row-${seg.segment}`}>
                          <td className="py-2 font-medium">{seg.segment}</td>
                          <td className="text-right py-2">{seg.totalLoans}</td>
                          <td className="text-right py-2 text-emerald-600">{seg.funded}</td>
                          <td className="text-right py-2 text-red-500">{seg.denied}</td>
                          <td className="text-right py-2">
                            <Badge variant={seg.conversionRate > 0.5 ? "default" : "secondary"}>
                              {(seg.conversionRate * 100).toFixed(0)}%
                            </Badge>
                          </td>
                          <td className="text-right py-2">
                            {seg.avgDaysToClose ? `${seg.avgDaysToClose}d` : "--"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
