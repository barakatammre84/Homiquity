import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDate as formatDateShared } from "@/lib/formatters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Grid3x3,
  CheckCircle2,
  Edit,
  XCircle,
  Loader2,
  Plus,
  Trash2,
  Eye,
  PlayCircle,
  Archive,
  CalendarClock,
  Info,
  Layers,
  AlertTriangle,
  Lock,
} from "lucide-react";

type LifecycleStatus = "DRAFT" | "ACTIVE" | "RETIRED";

interface LookupMatrix {
  id: string;
  matrixCode: string;
  description: string | null;
  version: number;
  lifecycleStatus: LifecycleStatus;
  previousVersionId: string | null;
  effectiveDate: string;
  expirationDate: string | null;
  createdAt: string;
}

interface LookupMatrixListItem extends LookupMatrix {
  cellCount: number;
}

interface LookupMatrixCell {
  id: string;
  matrixId: string;
  dim1Min: string | null;
  dim1Max: string | null;
  dim2Min: string | null;
  dim2Max: string | null;
  dim3Identifier: string | null;
  outputValue: string;
}

interface LookupMatrixDetail extends LookupMatrix {
  cells: LookupMatrixCell[];
}

interface DraftCell {
  dim1Min: string;
  dim1Max: string;
  dim2Min: string;
  dim2Max: string;
  dim3Identifier: string;
  outputValue: string;
}

function StatusBadge({ status }: { status: LifecycleStatus }) {
  const config = {
    DRAFT: { variant: "secondary" as const, icon: Edit },
    ACTIVE: { variant: "default" as const, icon: CheckCircle2 },
    RETIRED: { variant: "outline" as const, icon: XCircle },
  };
  const { variant, icon: Icon } = config[status];
  return (
    <Badge variant={variant} className="gap-1" data-testid={`badge-status-${status}`}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}

const formatDate = (value: string | null) => formatDateShared(value, "—");

function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

function num(value: string | null): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = parseFloat(value);
  if (Number.isNaN(n)) return value;
  return n.toString();
}

const emptyCell = (): DraftCell => ({
  dim1Min: "",
  dim1Max: "",
  dim2Min: "",
  dim2Max: "",
  dim3Identifier: "",
  outputValue: "",
});

export default function PricingMatrices() {
  const { toast } = useToast();
  const { user } = useAuth();
  const userRole = user?.role ?? "";
  const canRead = userRole === "admin" || userRole === "underwriter";
  const canManage = userRole === "admin";
  const [codeFilter, setCodeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [viewMatrix, setViewMatrix] = useState<LookupMatrixListItem | null>(null);
  const [activateMatrix, setActivateMatrix] = useState<LookupMatrixListItem | null>(null);
  const [retireMatrix, setRetireMatrix] = useState<LookupMatrixListItem | null>(null);
  const [scheduleMatrix, setScheduleMatrix] = useState<LookupMatrixListItem | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);

  const { data: matrices = [], isLoading } = useQuery<LookupMatrixListItem[]>({
    queryKey: ["/api/lookup-matrices"],
    enabled: canRead,
  });

  const filtered = matrices.filter((m) => {
    if (codeFilter && !m.matrixCode.toLowerCase().includes(codeFilter.toLowerCase())) return false;
    if (statusFilter !== "ALL" && m.lifecycleStatus !== statusFilter) return false;
    return true;
  });

  const activeCount = matrices.filter((m) => m.lifecycleStatus === "ACTIVE").length;
  const draftCount = matrices.filter((m) => m.lifecycleStatus === "DRAFT").length;
  const retiredCount = matrices.filter((m) => m.lifecycleStatus === "RETIRED").length;
  const codeCount = new Set(matrices.map((m) => m.matrixCode)).size;

  const knownCodes = Array.from(new Set(matrices.map((m) => m.matrixCode))).sort();

  if (!canRead) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Lock className="h-10 w-10 text-muted-foreground" />
            <CardTitle data-testid="text-not-authorized-title">Not authorized</CardTitle>
            <CardDescription className="max-w-md" data-testid="text-not-authorized-description">
              Pricing matrices are managed by administrators and reviewed by underwriters. Your role
              doesn't have access to this screen.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-pricing-matrices-title">
            Pricing Matrices
          </h1>
          <p className="text-muted-foreground">
            {canManage
              ? "Publish, schedule, activate, and retire versioned pricing & underwriting matrices"
              : "Review versioned pricing & underwriting matrices and their cells"}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setPublishOpen(true)} data-testid="button-open-publish">
            <Plus className="h-4 w-4 mr-2" />
            Publish New Version
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold" data-testid="stat-active">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : activeCount}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Drafts</p>
                <p className="text-2xl font-bold" data-testid="stat-draft">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : draftCount}
                </p>
              </div>
              <Edit className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Retired</p>
                <p className="text-2xl font-bold" data-testid="stat-retired">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : retiredCount}
                </p>
              </div>
              <Archive className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Matrix Codes</p>
                <p className="text-2xl font-bold" data-testid="stat-codes">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : codeCount}
                </p>
              </div>
              <Layers className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
      </div>

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
                onChange={(e) => setCodeFilter(e.target.value)}
                className="w-48"
                data-testid="input-filter-code"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
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
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No matrices found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => {
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
                            onClick={() => setViewMatrix(m)}
                            data-testid={`button-view-${m.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Cells
                          </Button>
                          {canManage && m.lifecycleStatus === "DRAFT" && (
                            <Button
                              size="sm"
                              onClick={() => setActivateMatrix(m)}
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
                                onClick={() => setScheduleMatrix(m)}
                                data-testid={`button-schedule-${m.id}`}
                              >
                                <CalendarClock className="h-4 w-4 mr-1" />
                                Schedule
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setRetireMatrix(m)}
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

      <ViewCellsDialog matrix={viewMatrix} onClose={() => setViewMatrix(null)} />
      <ActivateDialog matrix={activateMatrix} onClose={() => setActivateMatrix(null)} toast={toast} />
      <RetireDialog matrix={retireMatrix} onClose={() => setRetireMatrix(null)} toast={toast} />
      <ScheduleDialog matrix={scheduleMatrix} onClose={() => setScheduleMatrix(null)} toast={toast} />
      <PublishDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        knownCodes={knownCodes}
        toast={toast}
      />
    </div>
  );
}

function ViewCellsDialog({
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

function ActivateDialog({
  matrix,
  onClose,
  toast,
}: {
  matrix: LookupMatrixListItem | null;
  onClose: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
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

function RetireDialog({
  matrix,
  onClose,
  toast,
}: {
  matrix: LookupMatrixListItem | null;
  onClose: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
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

function ScheduleDialog({
  matrix,
  onClose,
  toast,
}: {
  matrix: LookupMatrixListItem | null;
  onClose: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
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

function PublishDialog({
  open,
  onClose,
  knownCodes,
  toast,
}: {
  open: boolean;
  onClose: () => void;
  knownCodes: string[];
  toast: ReturnType<typeof useToast>["toast"];
}) {
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
                size="sm"
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
