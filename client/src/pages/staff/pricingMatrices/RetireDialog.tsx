import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type { LookupMatrixListItem } from "./types";

export function RetireDialog({
  matrix,
  onClose,
}: {
  matrix: LookupMatrixListItem | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: async (m: LookupMatrixListItem) => {
      await apiRequest("POST", `/api/lookup-matrices/${m.id}/retire`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lookup-matrices"] });
      toast({ title: "Matrix retired", description: "The engine will no longer quote this version." });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Retire failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={!!matrix} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retire Matrix</DialogTitle>
          <DialogDescription>
            Retire {matrix?.matrixCode} v{matrix?.version}? This expires it immediately and cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>
            If no other active version of this code exists, the engine will have no matrix to resolve.
          </AlertDescription>
        </Alert>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-retire">
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => matrix && mutation.mutate(matrix)}
            disabled={mutation.isPending}
            data-testid="button-confirm-retire"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Retire
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
