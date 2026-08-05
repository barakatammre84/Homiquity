import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Info, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { formatDate, type LookupMatrixListItem } from "./types";

export function ActivateDialog({
  matrix,
  onClose,
}: {
  matrix: LookupMatrixListItem | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [effectiveDate, setEffectiveDate] = useState("");

  const mutation = useMutation({
    mutationFn: async (m: LookupMatrixListItem) => {
      if (effectiveDate) {
        const chosen = new Date(effectiveDate).toISOString();
        if (chosen !== new Date(m.effectiveDate).toISOString()) {
          await apiRequest("PATCH", `/api/lookup-matrices/${m.id}/schedule`, {
            effectiveDate: chosen,
          });
        }
      }
      await apiRequest("POST", `/api/lookup-matrices/${m.id}/activate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lookup-matrices"] });
      toast({ title: "Matrix activated", description: "This version is now live (or scheduled)." });
      handleClose();
    },
    onError: (error: Error) => {
      toast({ title: "Activation failed", description: error.message, variant: "destructive" });
    },
  });

  const handleClose = () => {
    setEffectiveDate("");
    onClose();
  };

  return (
    <Dialog open={!!matrix} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Activate Matrix</DialogTitle>
          <DialogDescription>
            Activating {matrix?.matrixCode} v{matrix?.version} retires the currently active version of this code.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Effective date</AlertTitle>
            <AlertDescription>
              Leave blank to use the published date ({formatDate(matrix?.effectiveDate ?? null)}). Set a future
              date to schedule it — it stays dormant until then.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label htmlFor="activate-effective">Effective date (optional)</Label>
            <Input
              id="activate-effective"
              type="datetime-local"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              data-testid="input-activate-effective"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-activate">
            Cancel
          </Button>
          <Button
            onClick={() => matrix && mutation.mutate(matrix)}
            disabled={mutation.isPending}
            data-testid="button-confirm-activate"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Activate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
