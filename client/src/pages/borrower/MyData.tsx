import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/formatters";
import { isClientRole } from "@shared/roles";
import type {
  BorrowerSubmissionView,
  CreditConsentView,
  PlatformConsentView,
} from "@shared/myDataSharing";
import {
  Building2,
  ShieldCheck,
  FileCheck,
  Info,
  Fingerprint,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface ApplicationSharingView {
  id: string;
  status: string;
  propertyAddress: string | null;
  createdAt: string | null;
  submissions: BorrowerSubmissionView[];
}

interface MyDataResponse {
  generatedAt: string;
  applications: ApplicationSharingView[];
  consents: {
    credit: CreditConsentView[];
    platform: PlatformConsentView[];
  };
}

function SubmissionCard({ submission }: { submission: BorrowerSubmissionView }) {
  return (
    <Card data-testid={`card-submission-${submission.id}`}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            {submission.lenderName}
          </CardTitle>
          <div className="flex items-center gap-2">
            {submission.simulated && (
              <Badge variant="outline" data-testid={`badge-simulated-${submission.id}`}>
                Test submission
              </Badge>
            )}
            <Badge variant={submission.statusTone} data-testid={`badge-status-${submission.id}`}>
              {submission.statusLabel}
            </Badge>
          </div>
        </div>
        {submission.lenderSpecialty && (
          <CardDescription>{submission.lenderSpecialty}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground" data-testid={`text-status-description-${submission.id}`}>
          {submission.statusDescription}
        </p>

        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Sent on</dt>
            <dd data-testid={`text-submitted-at-${submission.id}`}>{formatDate(submission.submittedAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last status change</dt>
            <dd data-testid={`text-status-updated-${submission.id}`}>{formatDate(submission.statusUpdatedAt)}</dd>
          </div>
          {submission.confirmationId && (
            <div>
              <dt className="text-muted-foreground">Lender confirmation #</dt>
              <dd className="font-mono" data-testid={`text-confirmation-${submission.id}`}>
                {submission.confirmationId}
              </dd>
            </div>
          )}
          {submission.packageFingerprint && (
            <div>
              <dt className="flex items-center gap-1 text-muted-foreground">
                <Fingerprint className="h-3.5 w-3.5" />
                Package fingerprint
              </dt>
              <dd
                className="font-mono text-xs"
                title="A digital fingerprint (SHA-256) of the exact file package this lender received"
                data-testid={`text-fingerprint-${submission.id}`}
              >
                {submission.packageFingerprint.slice(0, 16)}…
              </dd>
            </div>
          )}
        </dl>

        <div>
          <h4 className="mb-1 text-sm font-medium">What was shared</h4>
          <ul
            className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground"
            data-testid={`list-shared-data-${submission.id}`}
          >
            {submission.sharedData.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function ConsentRow({
  id,
  label,
  detail,
  consentedAt,
  given,
  revoked,
  revokedAt,
}: {
  id: string;
  label: string;
  detail: string | null;
  consentedAt: string | null;
  given: boolean;
  revoked: boolean;
  revokedAt: string | null;
}) {
  const badge = revoked
    ? { variant: "secondary" as const, text: "Revoked" }
    : given
      ? { variant: "success" as const, text: "Active" }
      : { variant: "destructive" as const, text: "Declined" };

  return (
    <div
      className="flex flex-wrap items-start justify-between gap-2 border-b py-3 last:border-b-0"
      data-testid={`row-consent-${id}`}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium">
          {given && !revoked ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          {label}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(consentedAt)}
          {detail ? ` · ${detail}` : ""}
          {revoked && revokedAt ? ` · revoked ${formatDate(revokedAt)}` : ""}
        </p>
      </div>
      <Badge variant={badge.variant} data-testid={`badge-consent-${id}`}>
        {badge.text}
      </Badge>
    </div>
  );
}

export default function MyData() {
  const { user, isLoading: authLoading } = useAuth();

  // Client gate mirrors the server gate on /api/my-data/sharing: client roles
  // only. Don't fire the query for staff/partner accounts — the server would
  // 403 it anyway.
  const isBorrower = !!user && isClientRole(user.role);

  const { data, isLoading, isError } = useQuery<MyDataResponse>({
    queryKey: ["/api/my-data/sharing"],
    enabled: isBorrower,
  });

  const totalSubmissions =
    data?.applications.reduce((n, app) => n + app.submissions.length, 0) ?? 0;

  return (
    <PageShell
      fullHeight
      width="content"
      title="My Data & Sharing"
      subtitle="Exactly which lenders have received your information, what was shared, and the permissions you've given us."
    >
      <div className="space-y-8" data-testid="page-my-data">
        {!authLoading && user && !isBorrower && (
          <Alert data-testid="alert-my-data-staff-access">
            <Info className="h-4 w-4" />
            <AlertTitle>Borrower accounts only</AlertTitle>
            <AlertDescription>
              This page shows a borrower their own data-sharing record. Staff can review
              submissions from the pipeline views.
            </AlertDescription>
          </Alert>
        )}

        {isBorrower && isError && (
          <Alert variant="destructive" data-testid="alert-my-data-error">
            <AlertTitle>Couldn't load your data summary</AlertTitle>
            <AlertDescription>Please try again in a moment.</AlertDescription>
          </Alert>
        )}

        {isBorrower && isLoading && (
          <div className="space-y-4" data-testid="skeleton-my-data">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {isBorrower && data && (
          <>
            {/* Lender sharing section */}
            <section className="space-y-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  Who has received your file
                </h2>
                <p className="text-sm text-muted-foreground">
                  Each time we submit your loan file to a wholesale lender, it's recorded
                  here — including a fingerprint of the exact package they received.
                </p>
              </div>

              {totalSubmissions === 0 ? (
                <Card data-testid="empty-submissions">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    <FileCheck className="mx-auto mb-2 h-8 w-8" />
                    Your file hasn't been sent to any lenders yet. When it is, you'll see
                    every submission listed here.
                  </CardContent>
                </Card>
              ) : (
                data.applications
                  .filter(app => app.submissions.length > 0)
                  .map(app => (
                    <div key={app.id} className="space-y-3" data-testid={`group-application-${app.id}`}>
                      {data.applications.filter(a => a.submissions.length > 0).length > 1 && (
                        <h3 className="text-sm font-medium text-muted-foreground">
                          Application{app.propertyAddress ? ` — ${app.propertyAddress}` : ""} (started{" "}
                          {formatDate(app.createdAt)})
                        </h3>
                      )}
                      {app.submissions.map(submission => (
                        <SubmissionCard key={submission.id} submission={submission} />
                      ))}
                    </div>
                  ))
              )}
            </section>

            {/* Consents section */}
            <section className="space-y-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                  Your consents & authorizations
                </h2>
                <p className="text-sm text-muted-foreground">
                  A record of every permission you've given — credit check authorizations
                  and platform consents like electronic communications.
                </p>
              </div>

              {data.consents.credit.length === 0 && data.consents.platform.length === 0 ? (
                <Card data-testid="empty-consents">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    No consent records yet. Consents you give during your application will
                    appear here.
                  </CardContent>
                </Card>
              ) : (
                <>
                  {data.consents.credit.length > 0 && (
                    <Card data-testid="card-credit-consents">
                      <CardHeader>
                        <CardTitle className="text-base">Credit authorizations</CardTitle>
                        <CardDescription>
                          Your authorizations for credit checks under the Fair Credit
                          Reporting Act (FCRA).
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {data.consents.credit.map(consent => (
                          <ConsentRow
                            key={consent.id}
                            id={consent.id}
                            label={consent.label}
                            detail={`Disclosure ${consent.disclosureVersion}`}
                            consentedAt={consent.consentedAt}
                            given={consent.consentGiven}
                            revoked={!consent.isActive && consent.revokedAt !== null}
                            revokedAt={consent.revokedAt}
                          />
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {data.consents.platform.length > 0 && (
                    <Card data-testid="card-platform-consents">
                      <CardHeader>
                        <CardTitle className="text-base">Platform consents</CardTitle>
                        <CardDescription>
                          Communications, disclosures, and other permissions you've
                          acknowledged.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {data.consents.platform.map(consent => (
                          <ConsentRow
                            key={consent.id}
                            id={consent.id}
                            label={consent.label}
                            detail={consent.templateVersion ? `Version ${consent.templateVersion}` : null}
                            consentedAt={consent.consentedAt}
                            given={consent.consentGiven}
                            revoked={consent.isRevoked}
                            revokedAt={consent.revokedAt}
                          />
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </section>

            <p className="text-xs text-muted-foreground" data-testid="text-generated-at">
              Snapshot generated {formatDate(data.generatedAt)}. Every view of this page is
              logged for your protection.
            </p>
          </>
        )}
      </div>
    </PageShell>
  );
}
