import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { toDateTimeLocal, type LookupMatrixListItem } from "./types";

export function ScheduleDialog({
  matrix,
  onClose,
}: {
  matrix: LookupMatrixListItem | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");

  const mutation = useMutation({
    mutationFn: async (m: LookupMatrixListItem) => {
      const body: { effectiveDate?: string; expirationDate?: string | null } = {};
      if (effectiveDate) body.effectiveDate = new Date(effectiveDate).toISOString();
      if (expirationDate) body.expirationDate = new Date(expirationDate).toISOString();
      await apiRequest("PATCH", `/api/lookup-matrices/${m.id}/schedule`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lookup-matrices"] });
      toast({ title: "Schedule updated", description: "Effective window adjusted." });
      handleClose();
    },
    onError: (error: Error) => {
      toast({ title: "Reschedule failed", description: error.message, variant: "destructive" });
    },
  });

  const open = () => {
    if (matrix) {
      setEffectiveDate(toDateTimeLocal(matrix.effectiveDate));
      setExpirationDate(toDateTimeLocal(matrix.expirationDate));
    }
  };

  const handleClose = () => {
    setEffectiveDate("");
    setExpirationDate("");
    onClose();
  };

  return (
    <Dialog
      open={!!matrix}
      onOpenChange={(o) => {
        if (o) open();
        else handleClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule Matrix</DialogTitle>
          <DialogDescription>
            Adjust the effective window for {matrix?.matrixCode} v{matrix?.version}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="schedule-effective">Effective date</Label>
            <Input
              id="schedule-effective"
              type="datetime-local"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              data-testid="input-schedule-effective"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-expiration">Expiration date (optional)</Label>
            <Input
              id="schedule-expiration"
              type="datetime-local"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              data-testid="input-schedule-expiration"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-schedule">
            Cancel
          </Button>
          <Button
            onClick={() => matrix && mutation.mutate(matrix)}
            disabled={mutation.isPending}
            data-testid="button-confirm-schedule"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
