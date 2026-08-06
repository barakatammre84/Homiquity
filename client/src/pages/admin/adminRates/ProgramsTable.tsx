import type { ReactNode } from "react";
import { Pencil, Percent, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MortgageRateProgram } from "./types";

export interface ProgramsTableProps {
  programs: MortgageRateProgram[] | undefined;
  isLoading: boolean;
  /** The Add-Program trigger and its dialog; the page owns that open state. */
  headerAction: ReactNode;
  onEdit: (program: MortgageRateProgram) => void;
  onDelete: (id: string) => void;
  deletePending: boolean;
  onAddFirst: () => void;
}

export function ProgramsTable({
  programs,
  isLoading,
  headerAction,
  onEdit,
  onDelete,
  deletePending,
  onAddFirst,
}: ProgramsTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Rate Programs</CardTitle>
          <CardDescription>
            Define loan program types (e.g., 30-yr fixed, 5/6m ARM)
          </CardDescription>
        </div>
        {headerAction}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : programs && programs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Loan Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.map((program) => (
                <TableRow key={program.id} data-testid={`row-program-${program.id}`}>
                  <TableCell className="font-medium">
                    {program.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant={program.isAdjustable ? "secondary" : "outline"}>
                      {program.isAdjustable ? "Adjustable" : "Fixed"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {program.termYears ? `${program.termYears} years` : "-"}
                    {program.adjustmentPeriod && ` (${program.adjustmentPeriod})`}
                  </TableCell>
                  <TableCell className="capitalize">
                    {program.loanType || "Conventional"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={program.isActive ? "default" : "secondary"}>
                      {program.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon" aria-label="Edit"
                        onClick={() => onEdit(program)}
                        data-testid={`button-edit-program-${program.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon" aria-label="Delete"
                        onClick={() => onDelete(program.id)}
                        disabled={deletePending}
                        data-testid={`button-delete-program-${program.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Percent className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="mb-4">No programs configured yet</p>
            <Button onClick={onAddFirst}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Program
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
