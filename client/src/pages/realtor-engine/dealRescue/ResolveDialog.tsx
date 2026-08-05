import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { DealRescueEscalation } from "./escalations";

export function ResolveDialog({ escalation, open, onOpenChange }: { escalation: DealRescueEscalation; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [resolution, setResolution] = useState("");

  const resolveMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/deal-rescue/${escalation.id}`, {
      status: "resolved",
      resolution,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deal-rescue"] });
      toast({ title: "Escalation resolved", description: "The issue has been marked as resolved." });
      onOpenChange(false);
      setResolution("");
    },
    onError: () => toast({ title: "Error", description: "Failed to resolve escalation", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve Escalation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">Resolving: <span className="font-medium text-foreground">{escalation.subject}</span></p>
          <div>
            <label className="text-sm font-medium">Resolution Notes</label>
            <Textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Describe how this issue was resolved..."
              className="mt-1"
              rows={4}
              data-testid="input-resolution-notes"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => resolveMutation.mutate()}
              disabled={!resolution || resolveMutation.isPending}
              data-testid="button-submit-resolution"
            >
              {resolveMutation.isPending ? "Resolving..." : "Mark as Resolved"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
