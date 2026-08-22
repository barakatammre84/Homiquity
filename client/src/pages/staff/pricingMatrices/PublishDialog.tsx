import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { emptyCell, type DraftCell } from "./types";

export function PublishDialog({
  open,
  onClose,
  knownCodes,
}: {
  open: boolean;
  onClose: () => void;
  knownCodes: string[];
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [matrixCode, setMatrixCode] = useState("");
  const [description, setDescription] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [cells, setCells] = useState<DraftCell[]>([emptyCell()]);

  const reset = () => {
    setMatrixCode("");
    setDescription("");
    setEffectiveDate("");
    setExpirationDate("");
    setCells([emptyCell()]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const updateCell = (idx: number, field: keyof DraftCell, value: string) => {
    setCells((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const parsedCells = cells.map((c) => ({
        dim1Min: c.dim1Min === "" ? null : Number(c.dim1Min),
        dim1Max: c.dim1Max === "" ? null : Number(c.dim1Max),
        dim2Min: c.dim2Min === "" ? null : Number(c.dim2Min),
        dim2Max: c.dim2Max === "" ? null : Number(c.dim2Max),
        dim3Identifier: c.dim3Identifier === "" ? null : c.dim3Identifier,
        outputValue: Number(c.outputValue),
      }));
      await apiRequest("POST", "/api/lookup-matrices", {
        matrixCode,
        description: description || undefined,
        effectiveDate: new Date(effectiveDate).toISOString(),
        expirationDate: expirationDate ? new Date(expirationDate).toISOString() : null,
        cells: parsedCells,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lookup-matrices"] });
      toast({ title: "Draft published", description: "New version saved as DRAFT. Activate it when ready." });
      handleClose();
    },
    onError: (error: Error) => {
      toast({ title: "Publish failed", description: error.message, variant: "destructive" });
    },
  });

  const cellsValid = cells.every((c) => c.outputValue !== "" && !Number.isNaN(Number(c.outputValue)));
  const canSubmit = matrixCode.trim() !== "" && effectiveDate !== "" && cells.length > 0 && cellsValid;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publish New Matrix Version</DialogTitle>
          <DialogDescription>
            Saved as a DRAFT — it is never quoted until you activate it. Version auto-increments per code.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="publish-code">Matrix Code</Label>
              <Input
                id="publish-code"
                placeholder="e.g. CONVENTIONAL_PMI"
                value={matrixCode}
                onChange={(e) => setMatrixCode(e.target.value)}
                list="known-codes"
                data-testid="input-publish-code"
              />
              <datalist id="known-codes">
                {knownCodes.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="publish-effective">Effective Date</Label>
              <Input
                id="publish-effective"
                type="datetime-local"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                data-testid="input-publish-effective"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publish-expiration">Expiration Date (optional)</Label>
              <Input
                id="publish-expiration"
                type="datetime-local"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                data-testid="input-publish-expiration"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publish-description">Description (optional)</Label>
              <Input
                id="publish-description"
                placeholder="What this version changes"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                data-testid="input-publish-description"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label>Cells</Label>
              <Button
                size="sm" className="touch-target"
                variant="outline"
                onClick={() => setCells((prev) => [...prev, emptyCell()])}
                data-testid="button-add-cell"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Cell
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave a dimension blank for null (unbounded / not applicable). Output value is required.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dim1 Min</TableHead>
                  <TableHead>Dim1 Max</TableHead>
                  <TableHead>Dim2 Min</TableHead>
                  <TableHead>Dim2 Max</TableHead>
                  <TableHead>Dim3 ID</TableHead>
                  <TableHead>Output</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cells.map((cell, idx) => (
                  <TableRow key={idx} data-testid={`row-draft-cell-${idx}`}>
                    {(["dim1Min", "dim1Max", "dim2Min", "dim2Max"] as const).map((field) => (
                      <TableCell key={field}>
                        <Input
                          type="number"
                          step="any"
                          value={cell[field]}
                          onChange={(e) => updateCell(idx, field, e.target.value)}
                          className="w-24"
                          data-testid={`input-cell-${field}-${idx}`}
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      <Input
                        value={cell.dim3Identifier}
                        onChange={(e) => updateCell(idx, "dim3Identifier", e.target.value)}
                        className="w-28"
                        data-testid={`input-cell-dim3-${idx}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="any"
                        value={cell.outputValue}
                        onChange={(e) => updateCell(idx, "outputValue", e.target.value)}
                        className="w-28"
                        data-testid={`input-cell-output-${idx}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon" aria-label="Delete"
                        variant="ghost"
                        onClick={() => setCells((prev) => prev.filter((_, i) => i !== idx))}
                        disabled={cells.length === 1}
                        data-testid={`button-remove-cell-${idx}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-publish">
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending} data-testid="button-confirm-publish">
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Publish Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
