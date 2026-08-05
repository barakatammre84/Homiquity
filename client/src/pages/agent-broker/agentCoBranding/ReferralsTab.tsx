import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { Users } from "lucide-react";
import { format } from "date-fns";
import { StatusBadge } from "./StatusBadge";
import type { ReferralStatus } from "./types";

export function ReferralsTab() {
  const { data: referrals = [], isLoading, isError, error, refetch } = useQuery<ReferralStatus[]>({
    queryKey: ["/api/co-brand/referrals"],
  });

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>;
  }

  // A failed load used to render "No referrals yet" — telling a partner none of
  // their clients were referred, when in fact nothing loaded. That reads as a
  // statement about their business, so show the failure instead (ux-01).
  if (isError) {
    return (
      <QueryErrorState
        error={error}
        onRetry={() => refetch()}
        title="We couldn't load your referrals"
        data-testid="referrals-error"
      />
    );
  }

  if (referrals.length === 0) {
    return (
      <Card data-testid="card-no-referrals">
        <CardContent className="py-8 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium text-foreground">No referrals yet</p>
          <p className="text-sm text-muted-foreground mt-1">Share your co-branded link with clients to start tracking referrals.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-referrals">
      <CardHeader>
        <CardTitle className="text-base">Client Referral Status</CardTitle>
        <CardDescription>Track your referred clients through the mortgage process.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Link Status</TableHead>
              <TableHead>Application</TableHead>
              <TableHead>Referred</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {referrals.map((ref) => (
              <TableRow key={ref.id} data-testid={`row-referral-${ref.id}`}>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{ref.clientName || "Anonymous"}</p>
                    {ref.clientEmail && <p className="text-xs text-muted-foreground">{ref.clientEmail}</p>}
                  </div>
                </TableCell>
                <TableCell><StatusBadge status={ref.status} /></TableCell>
                <TableCell>
                  {ref.applicationStatus ? (
                    <StatusBadge status={ref.applicationStatus} />
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {ref.createdAt ? format(new Date(ref.createdAt), "MMM d, yyyy") : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
