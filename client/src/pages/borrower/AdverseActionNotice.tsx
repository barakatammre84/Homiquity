import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { FileText, AlertTriangle, Printer, ArrowLeft } from "lucide-react";

interface AdverseAction {
  id: string;
  actionType: string;
  primaryReason: string;
  secondaryReasons?: string[] | null;
  creditScoreUsed?: number | null;
  creditScoreSource?: string | null;
  scoreRangeLow?: number | null;
  scoreRangeHigh?: number | null;
  bureauName?: string | null;
  bureauAddress?: string | null;
  bureauPhone?: string | null;
  bureauWebsite?: string | null;
  noticeText: string;
  noticeDate: string;
  deliveredAt?: string | null;
}

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdverseActionNotice() {
  const params = useParams();
  const applicationId = params.id;

  const { data, isLoading, isError } = useQuery<{ adverseActions: AdverseAction[] }>({
    queryKey: ["/api/loan-applications", applicationId, "credit/adverse-actions"],
    enabled: !!applicationId,
  });

  const notices = data?.adverseActions ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" data-testid="button-back-dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to dashboard
          </Button>
        </Link>
        {notices.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print-notice">
            <Printer className="h-4 w-4 mr-2" />
            Print / Save PDF
          </Button>
        )}
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
          <FileText className="h-6 w-6 text-primary" />
          Adverse Action Notice
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Issued under the Fair Credit Reporting Act (FCRA) and the Equal Credit Opportunity Act (ECOA).
        </p>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground" data-testid="text-error">
            We couldn't load this notice. Please contact your loan team for assistance.
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && notices.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center" data-testid="empty-state">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              There are no adverse action notices on this application.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {notices.map((notice) => (
          <Card key={notice.id} data-testid={`notice-${notice.id}`}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>{titleCase(notice.actionType)}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {notice.noticeDate ? format(new Date(notice.noticeDate), "PPP") : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 text-sm leading-relaxed">
              {/* The authoritative, staff-generated FCRA notice text. */}
              <div className="whitespace-pre-wrap text-foreground" data-testid="notice-text">
                {notice.noticeText}
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Principal reason</p>
                  <p className="font-medium">{notice.primaryReason}</p>
                  {notice.secondaryReasons && notice.secondaryReasons.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                      {notice.secondaryReasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {notice.creditScoreUsed != null && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Credit score used</p>
                    <p className="font-medium">
                      {notice.creditScoreUsed}
                      {notice.creditScoreSource ? ` (${titleCase(notice.creditScoreSource)})` : ""}
                    </p>
                    {notice.scoreRangeLow != null && notice.scoreRangeHigh != null && (
                      <p className="text-muted-foreground">
                        Score range: {notice.scoreRangeLow}–{notice.scoreRangeHigh}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {(notice.bureauName || notice.bureauPhone || notice.bureauWebsite) && (
                <div className="rounded-md bg-muted/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Consumer reporting agency
                  </p>
                  {notice.bureauName && <p className="font-medium">{notice.bureauName}</p>}
                  {notice.bureauAddress && <p className="text-muted-foreground whitespace-pre-line">{notice.bureauAddress}</p>}
                  {notice.bureauPhone && <p className="text-muted-foreground">{notice.bureauPhone}</p>}
                  {notice.bureauWebsite && <p className="text-muted-foreground">{notice.bureauWebsite}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">
                    The consumer reporting agency did not make the credit decision and cannot explain why the
                    decision was made. You have the right to obtain a free copy of your report from this agency
                    within 60 days, and to dispute any inaccurate or incomplete information.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
