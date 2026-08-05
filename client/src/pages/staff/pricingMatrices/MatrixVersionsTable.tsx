import { CalendarClock, Eye, Grid3x3, Loader2, PlayCircle, Archive } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "./StatusBadge";
import { formatDate, type LookupMatrixListItem } from "./types";

export interface MatrixVersionsTableProps {
  matrices: LookupMatrixListItem[];
  isLoading: boolean;
  canManage: boolean;
  codeFilter: string;
  onCodeFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onView: (matrix: LookupMatrixListItem) => void;
  onActivate: (matrix: LookupMatrixListItem) => void;
  onSchedule: (matrix: LookupMatrixListItem) => void;
  onRetire: (matrix: LookupMatrixListItem) => void;
}

export function MatrixVersionsTable({
  matrices,
  isLoading,
  canManage,
  codeFilter,
  onCodeFilterChange,
  statusFilter,
  onStatusFilterChange,
  onView,
  onActivate,
  onSchedule,
  onRetire,
}: MatrixVersionsTableProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Grid3x3 className="h-5 w-5" />
              Matrix Versions
            </CardTitle>
            <CardDescription>One row per code/version with its lifecycle status and cell count</CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              placeholder="Filter by code"
              value={codeFilter}
              onChange={(e) => onCodeFilterChange(e.target.value)}
              className="w-48"
              data-testid="input-filter-code"
            />
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
              <SelectTrigger className="w-40" data-testid="select-filter-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="RETIRED">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Matrix Code</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Effective</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="text-right">Cells</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : matrices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No matrices found
                </TableCell>
              </TableRow>
            ) : (
              matrices.map((m) => {
                const futureDated =
                  m.lifecycleStatus === "ACTIVE" && new Date(m.effectiveDate).getTime() > Date.now();
                return (
                  <TableRow key={m.id} data-testid={`row-matrix-${m.id}`}>
                    <TableCell className="font-medium" data-testid={`text-code-${m.id}`}>
                      {m.matrixCode}
                      {m.description && (
                        <p className="text-xs text-muted-foreground font-normal">{m.description}</p>
                      )}
                    </TableCell>
                    <TableCell data-testid={`text-version-${m.id}`}>v{m.version}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        <StatusBadge status={m.lifecycleStatus} />
                        {futureDated && (
                          <Badge variant="outline" className="gap-1">
                            <CalendarClock className="h-3 w-3" />
                            Scheduled
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-effective-${m.id}`}>{formatDate(m.effectiveDate)}</TableCell>
                    <TableCell data-testid={`text-expires-${m.id}`}>{formatDate(m.expirationDate)}</TableCell>
                    <TableCell className="text-right" data-testid={`text-cells-${m.id}`}>{m.cellCount}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onView(m)}
                          data-testid={`button-view-${m.id}`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Cells
                        </Button>
                        {canManage && m.lifecycleStatus === "DRAFT" && (
                          <Button
                            size="sm"
                            onClick={() => onActivate(m)}
                            data-testid={`button-activate-${m.id}`}
                          >
                            <PlayCircle className="h-4 w-4 mr-1" />
                            Activate
                          </Button>
                        )}
                        {canManage && m.lifecycleStatus === "ACTIVE" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onSchedule(m)}
                              data-testid={`button-schedule-${m.id}`}
                            >
                              <CalendarClock className="h-4 w-4 mr-1" />
                              Schedule
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => onRetire(m)}
                              data-testid={`button-retire-${m.id}`}
                            >
                              <Archive className="h-4 w-4 mr-1" />
                              Retire
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
