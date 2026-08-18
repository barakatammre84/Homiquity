import { useQuery } from "@tanstack/react-query";
import { loanApplicationKeys } from "@/lib/queryClient";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { FileText, AlertTriangle, Printer, ArrowLeft, Sprout } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { titleCaseFromSnake } from "@/lib/formatters";
import { RECOVERY_CARD } from "./adverseActionRecoveryCopy";

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

export default function AdverseActionNotice() {
  const params = useParams();
  const applicationId = params.id;

  const { data, isLoading, isError } = useQuery<{ adverseActions: AdverseAction[] }>({
    queryKey: loanApplicationKeys.credit.adverseActions(applicationId!),
    enabled: !!applicationId,
  });

  const notices = data?.adverseActions ?? [];

  return (
    <PageShell
      width="content"
      icon={<FileText className="h-6 w-6 text-primary" />}
      title="Adverse Action Notice"
      subtitle="Issued under the Fair Credit Reporting Act (FCRA) and the Equal Credit Opportunity Act (ECOA)."
      titleTestId="text-page-title"
      headerLead={
        <div className="flex items-center justify-between print:hidden">
          <Button asChild variant="ghost" size="sm" data-testid="button-back-dashboard">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to dashboard
            </Link>
          </Button>
          {notices.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print-notice">
              <Printer className="h-4 w-4 mr-2" />
              Print / Save PDF
            </Button>
          )}
        </div>
      }
    >

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
                <span>{titleCaseFromSnake(notice.actionType)}</span>
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
                      {notice.creditScoreSource ? ` (${titleCaseFromSnake(notice.creditScoreSource)})` : ""}
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

      {/* Path forward — subordinate to the notice (rendered after it, never in
          print). Copy is compliance-pinned in adverseActionRecoveryCopy.ts. */}
      {notices.length > 0 && (
        <Card className="mt-6 print:hidden" data-testid="card-recovery">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                <Sprout className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{RECOVERY_CARD.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{RECOVERY_CARD.body}</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Button asChild size="sm" data-testid="button-recovery-readiness">
                    <Link href={RECOVERY_CARD.primaryCta.href}>{RECOVERY_CARD.primaryCta.label}</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" data-testid="button-recovery-gap">
                    <Link href={RECOVERY_CARD.secondaryCta.href}>{RECOVERY_CARD.secondaryCta.label}</Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
