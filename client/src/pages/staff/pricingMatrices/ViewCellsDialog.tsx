import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { num, type LookupMatrixDetail, type LookupMatrixListItem } from "./types";

export function ViewCellsDialog({
  matrix,
  onClose,
}: {
  matrix: LookupMatrixListItem | null;
  onClose: () => void;
}) {
  const { data: detail, isLoading } = useQuery<LookupMatrixDetail>({
    queryKey: ["/api/lookup-matrices", matrix?.id],
    enabled: !!matrix?.id,
  });

  return (
    <Dialog open={!!matrix} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-view-cells-title">
            {matrix?.matrixCode} v{matrix?.version} — Cells
          </DialogTitle>
          <DialogDescription>
            The range bounds and output values resolved by the pricing/underwriting engine
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dim1 Min</TableHead>
                <TableHead>Dim1 Max</TableHead>
                <TableHead>Dim2 Min</TableHead>
                <TableHead>Dim2 Max</TableHead>
                <TableHead>Dim3 ID</TableHead>
                <TableHead className="text-right">Output</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail?.cells && detail.cells.length > 0 ? (
                detail.cells.map((c) => (
                  <TableRow key={c.id} data-testid={`row-cell-${c.id}`}>
                    <TableCell>{num(c.dim1Min)}</TableCell>
                    <TableCell>{num(c.dim1Max)}</TableCell>
                    <TableCell>{num(c.dim2Min)}</TableCell>
                    <TableCell>{num(c.dim2Max)}</TableCell>
                    <TableCell>{c.dim3Identifier || "—"}</TableCell>
                    <TableCell className="text-right font-medium">{num(c.outputValue)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                    No cells defined
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
