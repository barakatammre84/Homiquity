// Policy profile detail: thresholds + approval workflow.
// Extracted verbatim from PolicyOps.tsx.
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Edit,
  FileText,
  History,
  Info,
  RefreshCw,
  Shield,
  Loader2,
} from "lucide-react";
import { type PolicyProfile, type PolicyProfileDetail, StatusBadge } from "./model";

export function PolicyProfileView({
  policy,
  onBack,
  onEditRules,
}: {
  policy: PolicyProfile | null;
  onBack: () => void;
  onEditRules: () => void;
}) {
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishReason, setPublishReason] = useState("");
  const { toast } = useToast();

  const { data: policyDetail, isLoading: detailLoading } = useQuery<PolicyProfileDetail>({
    queryKey: ['/api/policy-profiles', policy?.id],
    enabled: !!policy?.id,
  });

  const submitMutation = useMutation({
    mutationFn: async ({ id, justification }: { id: string; justification: string }) => {
      await apiRequest("POST", `/api/policy-profiles/${id}/submit`, { justification });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/policy-profiles'] });
      toast({
        title: "Policy Submitted",
        description: `${policy?.profileId} has been submitted for approval.`,
      });
      setPublishDialogOpen(false);
      setPublishReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!policy) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Select a policy from the dashboard to view details</p>
        </CardContent>
      </Card>
    );
  }

  const handlePublish = () => {
    submitMutation.mutate({ id: policy.id, justification: publishReason });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack} data-testid="button-back-to-dashboard">
          Back to Dashboard
        </Button>
        <div className="flex-1" />
        {policy.status === "DRAFT" && (
          <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-publish-policy">
                Publish Policy
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Publish Policy Version</DialogTitle>
                <DialogDescription>
                  This will create an immutable policy version. Existing loans will remain on their current version.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Impact Summary</AlertTitle>
                  <AlertDescription>
                    23 active pre-approvals will remain on the previous version. New applications will use this policy.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason for Publication (Required)</Label>
                  <Textarea
                    id="reason"
                    placeholder="e.g., Q1 2026 policy update per SEL-2026-01"
                    value={publishReason}
                    onChange={(e) => setPublishReason(e.target.value)}
                    data-testid="input-publish-reason"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handlePublish}
                  disabled={!publishReason || submitMutation.isPending}
                  data-testid="button-confirm-publish"
                >
                  {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Confirm & Publish
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">{policy.profileId}</CardTitle>
              <CardDescription>
                {policy.authority} • {policy.productType}
              </CardDescription>
            </div>
            <StatusBadge status={policy.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Version</p>
              <p className="font-medium">{policy.version}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Effective Date</p>
              <p className="font-medium">{policy.effectiveDate}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Created By</p>
              <p className="font-medium">{policy.createdBy || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Approved By</p>
              <p className="font-medium">{policy.approvedBy || "—"}</p>
            </div>
            <div className="space-y-1 md:col-span-2">
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="font-medium">{policy.description || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Policy Thresholds</CardTitle>
            <CardDescription>Key parameters for this policy</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parameter</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : policyDetail?.thresholds && policyDetail.thresholds.length > 0 ? (
                  policyDetail.thresholds.map((threshold) => (
                    <TableRow key={threshold.id}>
                      <TableCell>{threshold.displayName || threshold.thresholdKey}</TableCell>
                      <TableCell>
                        {threshold.valuePercent != null
                          ? `${(parseFloat(threshold.valuePercent) * 100).toFixed(0)}%`
                          : threshold.valueNumeric != null
                          ? threshold.valueNumeric
                          : threshold.valueBool != null
                          ? (threshold.valueBool ? "Yes" : "No")
                          : threshold.valueEnum || "—"}
                      </TableCell>
                      <TableCell><Badge variant="outline">{threshold.category}</Badge></TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                      No thresholds defined
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Manage this policy profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={onEditRules}
              data-testid="button-edit-rules"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Rule Parameters
            </Button>
            <Button variant="outline" className="w-full justify-start" data-testid="button-view-coc">
              <RefreshCw className="h-4 w-4 mr-2" />
              View COC Rules
            </Button>
            <Button variant="outline" className="w-full justify-start" data-testid="button-clone-policy">
              <FileText className="h-4 w-4 mr-2" />
              Clone as Draft
            </Button>
            <Button variant="outline" className="w-full justify-start" data-testid="button-view-history">
              <History className="h-4 w-4 mr-2" />
              View Version History
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

