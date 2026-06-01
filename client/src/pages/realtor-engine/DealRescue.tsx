import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AddressInput } from "@/components/AddressInput";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Plus,
  User,
  MapPin,
  Calendar,
  Shield,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface DealRescueEscalation {
  id: string;
  applicationId: string | null;
  reportedByUserId: string;
  assignedToUserId: string | null;
  urgency: string;
  issueType: string;
  subject: string;
  description: string;
  borrowerName: string | null;
  propertyAddress: string | null;
  closingDate: string | null;
  status: string;
  resolution: string | null;
  resolvedAt: string | null;
  slaDeadline: string | null;
  createdAt: string;
}

const urgencyOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function getUrgencyVariant(urgency: string): "destructive" | "default" | "secondary" | "outline" {
  switch (urgency) {
    case "critical": return "destructive";
    case "high": return "default";
    case "medium": return "secondary";
    case "low": return "outline";
    default: return "secondary";
  }
}

function getUrgencyClassName(urgency: string): string {
  switch (urgency) {
    case "high": return "bg-orange-600 text-white border-orange-600";
    case "medium": return "bg-amber-500 text-white border-amber-500";
    case "low": return "bg-blue-500 text-white border-blue-500";
    default: return "";
  }
}

function getStatusVariant(status: string): "destructive" | "default" | "secondary" | "outline" {
  switch (status) {
    case "open": return "secondary";
    case "in_progress": return "default";
    case "resolved": return "outline";
    default: return "secondary";
  }
}

function getStatusClassName(status: string): string {
  switch (status) {
    case "open": return "bg-yellow-500 text-white border-yellow-500";
    case "in_progress": return "bg-blue-500 text-white border-blue-500";
    case "resolved": return "bg-green-600 text-white border-green-600";
    default: return "";
  }
}

function formatStatusLabel(status: string): string {
  switch (status) {
    case "open": return "Open";
    case "in_progress": return "In Progress";
    case "resolved": return "Resolved";
    default: return status;
  }
}

function formatIssueType(type: string): string {
  return type.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function SlaCountdown({ deadline }: { deadline: string }) {
  const now = new Date();
  const sla = new Date(deadline);
  const diffMs = sla.getTime() - now.getTime();

  if (diffMs <= 0) {
    return <span className="text-xs font-medium text-destructive" data-testid="text-sla-expired">SLA Expired</span>;
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const isUrgent = hours < 4;

  return (
    <span className={`text-xs font-medium flex items-center gap-1 ${isUrgent ? "text-destructive" : "text-muted-foreground"}`} data-testid="text-sla-countdown">
      <Clock className="h-3 w-3" />
      {hours}h {minutes}m remaining
    </span>
  );
}

function CreateEscalationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    subject: "",
    urgency: "high",
    issueType: "other",
    description: "",
    borrowerName: "",
    propertyAddress: "",
    closingDate: "",
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/deal-rescue", {
      subject: form.subject,
      urgency: form.urgency,
      issueType: form.issueType,
      description: form.description,
      borrowerName: form.borrowerName || null,
      propertyAddress: form.propertyAddress || null,
      closingDate: form.closingDate || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deal-rescue"] });
      toast({ title: "Escalation reported", description: "Your issue has been submitted for review." });
      onOpenChange(false);
      setForm({ subject: "", urgency: "high", issueType: "other", description: "", borrowerName: "", propertyAddress: "", closingDate: "" });
    },
    onError: () => toast({ title: "Error", description: "Failed to create escalation", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report an Issue</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium">Subject</label>
            <Input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Brief description of the issue"
              className="mt-1"
              data-testid="input-escalation-subject"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Urgency</label>
              <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                <SelectTrigger className="mt-1" data-testid="select-escalation-urgency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Issue Type</label>
              <Select value={form.issueType} onValueChange={(v) => setForm({ ...form, issueType: v })}>
                <SelectTrigger className="mt-1" data-testid="select-escalation-issue-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="appraisal_issue">Appraisal Issue</SelectItem>
                  <SelectItem value="document_missing">Document Missing</SelectItem>
                  <SelectItem value="title_issue">Title Issue</SelectItem>
                  <SelectItem value="rate_lock_expiring">Rate Lock Expiring</SelectItem>
                  <SelectItem value="closing_delay">Closing Delay</SelectItem>
                  <SelectItem value="underwriting_condition">Underwriting Condition</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the issue in detail..."
              className="mt-1"
              rows={3}
              data-testid="input-escalation-description"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Borrower Name <span className="text-muted-foreground">(optional)</span></label>
              <Input
                value={form.borrowerName}
                onChange={(e) => setForm({ ...form, borrowerName: e.target.value })}
                placeholder="John Doe"
                className="mt-1"
                data-testid="input-escalation-borrower"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Property Address <span className="text-muted-foreground">(optional)</span></label>
              <AddressInput
                placeholder="Start typing a property address..."
                className="mt-1"
                defaultValue={form.propertyAddress}
                onSelect={(result) => setForm({ ...form, propertyAddress: result.formattedAddress })}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Closing Date <span className="text-muted-foreground">(optional)</span></label>
            <Input
              type="date"
              value={form.closingDate}
              onChange={(e) => setForm({ ...form, closingDate: e.target.value })}
              className="mt-1"
              data-testid="input-escalation-closing-date"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!form.subject || !form.description || createMutation.isPending}
              data-testid="button-submit-escalation"
            >
              {createMutation.isPending ? "Submitting..." : "Submit Escalation"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResolveDialog({ escalation, open, onOpenChange }: { escalation: DealRescueEscalation; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [resolution, setResolution] = useState("");

  const resolveMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/deal-rescue/${escalation.id}`, {
      status: "resolved",
      resolution,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deal-rescue"] });
      toast({ title: "Escalation resolved", description: "The issue has been marked as resolved." });
      onOpenChange(false);
      setResolution("");
    },
    onError: () => toast({ title: "Error", description: "Failed to resolve escalation", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve Escalation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">Resolving: <span className="font-medium text-foreground">{escalation.subject}</span></p>
          <div>
            <label className="text-sm font-medium">Resolution Notes</label>
            <Textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Describe how this issue was resolved..."
              className="mt-1"
              rows={4}
              data-testid="input-resolution-notes"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => resolveMutation.mutate()}
              disabled={!resolution || resolveMutation.isPending}
              data-testid="button-submit-resolution"
            >
              {resolveMutation.isPending ? "Resolving..." : "Mark as Resolved"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DealRescue() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<DealRescueEscalation | null>(null);

  const { data: escalations = [], isLoading } = useQuery<DealRescueEscalation[]>({
    queryKey: ["/api/deal-rescue"],
  });

  const sorted = [...escalations].sort((a, b) => {
    const urgDiff = (urgencyOrder[a.urgency] ?? 99) - (urgencyOrder[b.urgency] ?? 99);
    if (urgDiff !== 0) return urgDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const openCount = escalations.filter(e => e.status === "open" || e.status === "in_progress").length;
  const criticalCount = escalations.filter(e => e.urgency === "critical" && e.status !== "resolved").length;

  const resolvedItems = escalations.filter(e => e.resolvedAt && e.createdAt);
  let avgResolution = "N/A";
  if (resolvedItems.length > 0) {
    const totalMs = resolvedItems.reduce((sum, e) => {
      return sum + (new Date(e.resolvedAt!).getTime() - new Date(e.createdAt).getTime());
    }, 0);
    const avgMs = totalMs / resolvedItems.length;
    const avgHours = Math.round(avgMs / (1000 * 60 * 60));
    avgResolution = avgHours < 24 ? `${avgHours}h` : `${Math.round(avgHours / 24)}d`;
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" data-testid="deal-rescue-page">
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="text-page-title">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            Deal Rescue Hotline
          </h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-subtitle">Urgent escalation for at-risk deals</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-report-issue">
          <Plus className="h-4 w-4 mr-1" /> Report Issue
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card data-testid="card-stat-open">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-yellow-500/10 p-2">
                <Shield className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground" data-testid="text-stat-open-count">{openCount}</p>
                <p className="text-xs text-muted-foreground">Open Escalations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-critical">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-destructive/10 p-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground" data-testid="text-stat-critical-count">{criticalCount}</p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-resolution">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-green-500/10 p-2">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground" data-testid="text-stat-avg-resolution">{avgResolution}</p>
                <p className="text-xs text-muted-foreground">Avg Resolution Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {sorted.length === 0 ? (
        <Card data-testid="card-no-escalations">
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">No escalations</p>
            <p className="text-sm text-muted-foreground mt-1">All deals are on track. Report an issue if something needs attention.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((esc) => (
            <Card key={esc.id} data-testid={`card-escalation-${esc.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground" data-testid={`text-subject-${esc.id}`}>{esc.subject}</p>
                      <Badge
                        variant={getUrgencyVariant(esc.urgency)}
                        className={getUrgencyClassName(esc.urgency)}
                        data-testid={`badge-urgency-${esc.id}`}
                      >
                        {esc.urgency.charAt(0).toUpperCase() + esc.urgency.slice(1)}
                      </Badge>
                      <Badge variant="outline" data-testid={`badge-issue-type-${esc.id}`}>
                        {formatIssueType(esc.issueType)}
                      </Badge>
                      <Badge
                        variant={getStatusVariant(esc.status)}
                        className={getStatusClassName(esc.status)}
                        data-testid={`badge-status-${esc.id}`}
                      >
                        {formatStatusLabel(esc.status)}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground" data-testid={`text-description-${esc.id}`}>{esc.description}</p>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      {esc.borrowerName && (
                        <span className="flex items-center gap-1" data-testid={`text-borrower-${esc.id}`}>
                          <User className="h-3 w-3" /> {esc.borrowerName}
                        </span>
                      )}
                      {esc.propertyAddress && (
                        <span className="flex items-center gap-1" data-testid={`text-address-${esc.id}`}>
                          <MapPin className="h-3 w-3" /> {esc.propertyAddress}
                        </span>
                      )}
                      {esc.slaDeadline && (
                        <SlaCountdown deadline={esc.slaDeadline} />
                      )}
                      {esc.closingDate && (
                        <span className="flex items-center gap-1" data-testid={`text-closing-date-${esc.id}`}>
                          <Calendar className="h-3 w-3" /> Closing: {format(new Date(esc.closingDate), "MMM d, yyyy")}
                        </span>
                      )}
                      <span data-testid={`text-created-${esc.id}`}>
                        Reported {formatDistanceToNow(new Date(esc.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    {esc.resolution && (
                      <div className="mt-2 rounded-md bg-muted p-2">
                        <p className="text-xs font-medium text-foreground">Resolution:</p>
                        <p className="text-xs text-muted-foreground" data-testid={`text-resolution-${esc.id}`}>{esc.resolution}</p>
                      </div>
                    )}
                  </div>

                  {esc.status !== "resolved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setResolveTarget(esc)}
                      data-testid={`button-resolve-${esc.id}`}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Resolve
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateEscalationDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      {resolveTarget && (
        <ResolveDialog
          escalation={resolveTarget}
          open={!!resolveTarget}
          onOpenChange={(v) => { if (!v) setResolveTarget(null); }}
        />
      )}
    </div>
  );
}
