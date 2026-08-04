// "Why we need these" — borrower-facing rendering of the SituationProfile's
// document requests (Borrower Clarity PR 3, kb log 2026-08-04 §4).
//
// Renders ONLY profile.documentRequests: each request's description, the
// tie-out-driven reason, the tax year, and the entity it belongs to. It must
// NEVER surface profile.incomePaths or profile.summary to a borrower — path
// candidacy reads as product steering, and the SituationProfile is documented
// "NEVER an underwriting input, a prequalification, or a product offer"
// (Reg N; see shared/situationProfile.ts). Supplementary card: it renders
// nothing while loading, on error, or when the file has no requests.
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HelpCircle } from "lucide-react";
import type { SituationProfile } from "@shared/situationProfile";

interface SituationResponse {
  profile: SituationProfile;
}

export function DocumentRequestReasons() {
  // Fixed-path owner resource — the endpoint defaults to the signed-in user.
  // Deliberately NOT in the loanApplicationKeys family: the profile is
  // per-borrower, not per-application.
  const { data } = useQuery<SituationResponse | null>({
    queryKey: ["/api/tax-intelligence/situation"],
  });

  const requests = data?.profile?.documentRequests ?? [];
  if (requests.length === 0) return null;

  return (
    <Card data-testid="card-document-request-reasons">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HelpCircle className="h-4 w-4 text-primary" />
          Why we need these documents
        </CardTitle>
        <CardDescription>
          Generated from your file — each request says exactly what it confirms.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((request) => (
          <div
            key={request.id}
            className="rounded-lg bg-muted/30 p-3"
            data-testid={`row-request-reason-${request.id}`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{request.description}</span>
              {request.taxYear !== null && (
                <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                  {request.taxYear}
                </Badge>
              )}
              {request.entityName && (
                <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                  {request.entityName}
                </Badge>
              )}
            </div>
            <p
              className="text-xs text-muted-foreground mt-1"
              data-testid={`text-request-reason-${request.id}`}
            >
              {request.reason}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
