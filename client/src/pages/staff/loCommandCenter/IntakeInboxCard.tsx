import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { QueueData } from "./types";

// Intake inbox — applications that arrived without a loan officer (self-serve
// applicants with no referral). Shown to LO/LOA at the top of the attention
// rail; claiming a file puts it on their desk (server-side assignLoanOfficer
// grants file access + queue visibility in one step) so no applicant sits
// stranded waiting on an admin assignment.
export function IntakeInboxCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<QueueData>({
    queryKey: ["/api/pipeline/unassigned"],
  });

  const claim = useMutation({
    mutationFn: async (applicationId: string) => {
      const res = await apiRequest("POST", `/api/loan-applications/${applicationId}/claim`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/unassigned"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/queue"] });
      toast({ title: "File claimed", description: "It's on your desk and in your pipeline now." });
    },
    onError: (error) => {
      toast({
        title: "Couldn't claim this file",
        description: error instanceof Error ? error.message : "Unexpected error.",
        variant: "destructive",
      });
    },
  });

  const pool = data?.queue ?? [];
  if (isLoading || pool.length === 0) return null;

  return (
    <div
      className="mb-3 rounded-lg border border-info-subtle-foreground/25 bg-info-subtle p-3 text-info-subtle-foreground"
      data-testid="intake-inbox"
    >
      <div className="mb-2 flex items-center gap-2">
        <Inbox className="h-4 w-4 shrink-0" aria-hidden="true" />
        <h2 className="text-sm font-semibold">
          Intake inbox — {pool.length} waiting
        </h2>
      </div>
      <ul className="space-y-1.5">
        {pool.map((file) => (
          <li
            key={file.applicationId}
            className="flex items-center justify-between gap-2"
            data-testid={`intake-${file.applicationId}`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{file.borrowerName}</p>
              <p className="text-xs opacity-80">waiting {file.daysInPipeline}d</p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 shrink-0 px-2 text-xs"
              onClick={() => claim.mutate(file.applicationId)}
              disabled={claim.isPending}
              data-testid={`claim-${file.applicationId}`}
            >
              {claim.isPending && claim.variables === file.applicationId ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                "Claim"
              )}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
