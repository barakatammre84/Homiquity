import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Plus,
  Info,
  Timer,
  CalendarClock,
  FileCheck,
  MessageSquare,
} from "lucide-react";
import { format } from "date-fns";

interface ClosingGuarantee {
  id: string;
  applicationId: string;
  guaranteeType: string;
  targetDate: string;
  targetHours: number | null;
  actualDate: string | null;
  status: string;
  isAtRisk: boolean;
  riskReason: string | null;
  isMet: boolean | null;
  createdAt: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

const GUARANTEE_LABELS: Record<string, string> = {
  underwriting_24h: "24-Hour Underwriting",
  appraisal_48h: "48-Hour Appraisal",
  closing_10day: "10-Day Close",
  communication_daily: "Daily Communication",
};

const GUARANTEE_ICONS: Record<string, typeof Shield> = {
  underwriting_24h: FileCheck,
  appraisal_48h: CalendarClock,
  closing_10day: Timer,
  communication_daily: MessageSquare,
};

function GuaranteeTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    underwriting_24h: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    appraisal_48h: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
    closing_10day: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    communication_daily: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  };
  return (
    <Badge variant="secondary" className={styles[type] || ""} data-testid={`badge-type-${type}`}>
      {GUARANTEE_LABELS[type] || type}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    active: { label: "Active", variant: "default" },
    at_risk: { label: "At Risk", variant: "secondary" },
    met: { label: "Met", variant: "outline" },
    missed: { label: "Missed", variant: "destructive" },
  };
  const c = config[status] || { label: status, variant: "secondary" as const };

  const statusStyles: Record<string, string> = {
    active: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    at_risk: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    met: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    missed: "",
  };

  return (
    <Badge variant={c.variant} className={statusStyles[status] || ""} data-testid={`badge-status-${status}`}>
      {status === "met" && <CheckCircle2 className="h-3 w-3 mr-1" />}
      {status === "at_risk" && <AlertTriangle className="h-3 w-3 mr-1" />}
      {status === "missed" && <XCircle className="h-3 w-3 mr-1" />}
      {status === "active" && <Clock className="h-3 w-3 mr-1" />}
      {c.label}
    </Badge>
  );
}

function useCountdown(targetDate: string) {
  const [remaining, setRemaining] = useState("");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setRemaining("Expired");
        setProgress(100);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setRemaining(`${days} day${days !== 1 ? "s" : ""}, ${hours} hour${hours !== 1 ? "s" : ""} remaining`);
      } else if (hours > 0) {
        setRemaining(`${hours} hour${hours !== 1 ? "s" : ""}, ${minutes} min remaining`);
      } else {
        setRemaining(`${minutes} minute${minutes !== 1 ? "s" : ""} remaining`);
      }
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return { remaining, progress };
}

function GuaranteeCard({ guarantee }: { guarantee: ClosingGuarantee }) {
  const { remaining } = useCountdown(guarantee.targetDate);
  const Icon = GUARANTEE_ICONS[guarantee.guaranteeType] || Shield;

  const now = new Date().getTime();
  const created = new Date(guarantee.createdAt).getTime();
  const target = new Date(guarantee.targetDate).getTime();
  const totalDuration = target - created;
  const elapsed = now - created;
  const progressPercent = totalDuration > 0 ? Math.min(100, Math.max(0, (elapsed / totalDuration) * 100)) : 0;

  return (
    <Card data-testid={`card-guarantee-${guarantee.id}`}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <GuaranteeTypeBadge type={guarantee.guaranteeType} />
              <StatusBadge status={guarantee.status} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span data-testid={`text-app-id-${guarantee.id}`}>
                  Application: {guarantee.applicationId}
                </span>
                <span data-testid={`text-target-date-${guarantee.id}`}>
                  Target: {format(new Date(guarantee.targetDate), "MMM d, yyyy h:mm a")}
                </span>
                {guarantee.targetHours && (
                  <span data-testid={`text-target-hours-${guarantee.id}`}>
                    ({guarantee.targetHours}h window)
                  </span>
                )}
              </div>

              {guarantee.status === "active" && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300" data-testid={`text-countdown-${guarantee.id}`}>
                    {remaining}
                  </span>
                </div>
              )}

              {guarantee.isAtRisk && guarantee.riskReason && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-sm text-amber-700 dark:text-amber-300" data-testid={`text-risk-reason-${guarantee.id}`}>
                    {guarantee.riskReason}
                  </span>
                </div>
              )}

              {guarantee.isMet && guarantee.actualDate && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-sm text-emerald-700 dark:text-emerald-300" data-testid={`text-actual-date-${guarantee.id}`}>
                    Completed: {format(new Date(guarantee.actualDate), "MMM d, yyyy h:mm a")}
                  </span>
                </div>
              )}

              <div className="pt-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <Progress
                  value={progressPercent}
                  className="h-1.5"
                  data-testid={`progress-${guarantee.id}`}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateGuaranteeDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    applicationId: "",
    guaranteeType: "underwriting_24h",
    targetDate: "",
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/closing-guarantees", formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/closing-guarantees"] });
      toast({ title: "Guarantee Created", description: "The closing guarantee has been created successfully." });
      setOpen(false);
      setFormData({ applicationId: "", guaranteeType: "underwriting_24h", targetDate: "" });
    },
    onError: () => toast({ title: "Error", description: "Failed to create guarantee.", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-create-guarantee">
          <Plus className="h-4 w-4 mr-1" /> Create Guarantee
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Closing Guarantee</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium text-foreground">Application ID</label>
            <Input
              value={formData.applicationId}
              onChange={(e) => setFormData({ ...formData, applicationId: e.target.value })}
              placeholder="Enter application ID"
              className="mt-1"
              data-testid="input-guarantee-app-id"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Guarantee Type</label>
            <Select value={formData.guaranteeType} onValueChange={(v) => setFormData({ ...formData, guaranteeType: v })}>
              <SelectTrigger className="mt-1" data-testid="select-guarantee-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="underwriting_24h">24-Hour Underwriting</SelectItem>
                <SelectItem value="appraisal_48h">48-Hour Appraisal</SelectItem>
                <SelectItem value="closing_10day">10-Day Close</SelectItem>
                <SelectItem value="communication_daily">Daily Communication</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Target Date</label>
            <Input
              type="datetime-local"
              value={formData.targetDate}
              onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
              className="mt-1"
              data-testid="input-guarantee-target-date"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!formData.applicationId || !formData.targetDate || createMutation.isPending}
              data-testid="button-submit-guarantee"
            >
              {createMutation.isPending ? "Creating..." : "Create Guarantee"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ClosingGuarantee() {
  const [searchAppId, setSearchAppId] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const endpoint = activeSearch
    ? `/api/closing-guarantees/${activeSearch}`
    : "/api/closing-guarantees";

  const { data: guarantees = [], isLoading } = useQuery<ClosingGuarantee[]>({
    queryKey: ["/api/closing-guarantees", activeSearch],
  });

  const activeCount = guarantees.filter((g) => g.status === "active").length;
  const onTrackCount = guarantees.filter((g) => g.status === "active" && !g.isAtRisk).length;
  const atRiskCount = guarantees.filter((g) => g.isAtRisk).length;
  const metCount = guarantees.filter((g) => g.isMet).length;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" data-testid="closing-guarantee-page">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground md:text-2xl" data-testid="text-page-title">
              Zero-Stress Closing Guarantee
            </h1>
            <p className="text-sm text-muted-foreground" data-testid="text-page-subtitle">
              Track closing timeline guarantees in real time
            </p>
          </div>
        </div>
      </div>

      <Card className="mb-6 border-primary/20" data-testid="card-info">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Our Closing Guarantees</p>
              <p className="text-xs text-muted-foreground mt-1">
                We guarantee 24-hour underwriting decisions, 48-hour appraisal scheduling, and 10-day close options.
                If we miss a guarantee, we make it right.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
        <Card data-testid="stat-active">
          <CardContent className="py-3 text-center">
            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground" data-testid="text-active-count">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-on-track">
          <CardContent className="py-3 text-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground" data-testid="text-on-track-count">{onTrackCount}</p>
            <p className="text-xs text-muted-foreground">On Track</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-at-risk">
          <CardContent className="py-3 text-center">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground" data-testid="text-at-risk-count">{atRiskCount}</p>
            <p className="text-xs text-muted-foreground">At Risk</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-met">
          <CardContent className="py-3 text-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground" data-testid="text-met-count">{metCount}</p>
            <p className="text-xs text-muted-foreground">Met</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="flex gap-2">
            <Input
              value={searchAppId}
              onChange={(e) => setSearchAppId(e.target.value)}
              placeholder="Enter Application ID to filter..."
              data-testid="input-search-app-id"
            />
            <Button
              variant="outline"
              onClick={() => setActiveSearch(searchAppId.trim())}
              data-testid="button-search"
            >
              <Search className="h-4 w-4 mr-1" /> Search
            </Button>
            {activeSearch && (
              <Button
                variant="outline"
                onClick={() => { setActiveSearch(""); setSearchAppId(""); }}
                data-testid="button-clear-search"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
        <CreateGuaranteeDialog />
      </div>

      {activeSearch && (
        <p className="text-sm text-muted-foreground mb-3" data-testid="text-filter-info">
          Showing guarantees for application: <span className="font-medium text-foreground">{activeSearch}</span>
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : guarantees.length === 0 ? (
        <Card data-testid="card-no-guarantees">
          <CardContent className="py-8 text-center">
            <Shield className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">No guarantees found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {activeSearch
                ? "No guarantees found for this application. Try a different ID."
                : "Create a guarantee to start tracking closing timelines."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3" data-testid="guarantees-list">
          {guarantees.map((g) => (
            <GuaranteeCard key={g.id} guarantee={g} />
          ))}
        </div>
      )}
    </div>
  );
}
