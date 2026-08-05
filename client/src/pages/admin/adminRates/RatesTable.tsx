import type { ReactNode } from "react";
import { MapPin, Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
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
import type { MortgageRate } from "./types";

export interface RatesTableProps {
  rates: MortgageRate[] | undefined;
  isLoading: boolean;
  /** The Add-Rate trigger and its dialog; the page owns that open state. */
  headerAction: ReactNode;
  onEdit: (rate: MortgageRate) => void;
  onDelete: (id: string) => void;
  deletePending: boolean;
  onAddFirst: () => void;
}

export function RatesTable({
  rates,
  isLoading,
  headerAction,
  onEdit,
  onDelete,
  deletePending,
  onAddFirst,
}: RatesTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Mortgage Rates</CardTitle>
          <CardDescription>
            Set rates by state, zipcode, or national default
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
        ) : rates && rates.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>APR</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((rate) => (
                <TableRow key={rate.id} data-testid={`row-rate-${rate.id}`}>
                  <TableCell className="font-medium">
                    {rate.program.name}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {rate.zipcode ? (
                        <span>{rate.zipcode}</span>
                      ) : rate.state ? (
                        <span>{rate.state}</span>
                      ) : (
                        <span className="text-muted-foreground">National</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {parseFloat(rate.rate).toFixed(3)}%
                  </TableCell>
                  <TableCell>
                    {parseFloat(rate.apr).toFixed(3)}%
                  </TableCell>
                  <TableCell>
                    {rate.points ? parseFloat(rate.points).toFixed(2) : "0.00"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={rate.isActive ? "default" : "secondary"}>
                      {rate.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon" aria-label="Edit"
                        onClick={() => onEdit(rate)}
                        data-testid={`button-edit-rate-${rate.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon" aria-label="Delete"
                        onClick={() => onDelete(rate.id)}
                        disabled={deletePending}
                        data-testid={`button-delete-rate-${rate.id}`}
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
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="mb-4">No rates configured yet</p>
            <Button onClick={onAddFirst}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Rate
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
