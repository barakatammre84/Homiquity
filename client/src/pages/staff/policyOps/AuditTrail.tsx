// The policy audit trail.
// Extracted verbatim from PolicyOps.tsx.
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, User, Loader2 } from "lucide-react";
import { type AuditEntry, type PolicyApprovalRecord } from "./model";

export function AuditTrail({ selectedPolicyId }: { selectedPolicyId: string | null }) {
  const { data: approvals = [], isLoading } = useQuery<PolicyApprovalRecord[]>({
    queryKey: ['/api/policy-approvals', selectedPolicyId],
    enabled: !!selectedPolicyId,
  });

  const entries: AuditEntry[] = approvals.map((a) => ({
    id: a.id,
    action: a.action,
    changedBy: a.actionBy,
    changedAt: a.createdAt || a.actionAt || "",
    changes: `${a.fromStatus} → ${a.toStatus}`,
    reason: a.justification || a.rejectionReason || "",
    policyReference: a.bulletinReference || undefined,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Change Log & Audit Trail
        </CardTitle>
        <CardDescription>
          Complete history of all policy changes. Every modification is logged.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : !selectedPolicyId ? (
            <div className="text-center text-muted-foreground py-8">
              Select a policy from the dashboard to view its audit trail
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No approval history found for this policy
            </div>
          ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="p-4 border rounded-lg space-y-3"
                data-testid={`audit-entry-${entry.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{entry.action}</Badge>
                    <span className="text-sm text-muted-foreground">{entry.changedAt}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    {entry.changedBy}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="font-medium">{entry.changes}</p>
                  <p className="text-sm text-muted-foreground">
                    <strong>Reason:</strong> {entry.reason}
                  </p>
                  {entry.policyReference && (
                    <p className="text-sm text-muted-foreground">
                      <strong>Reference:</strong> {entry.policyReference}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

