import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  Clock,
  CheckCircle2,
  Plus,
  FileText,
  XCircle,
  ListChecks,
  Video,
  GraduationCap,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";

interface StrategySession {
  id: string;
  agentUserId: string;
  loUserId: string | null;
  scheduledAt: string;
  durationMinutes: number;
  sessionType: string;
  topic: string | null;
  notes: string | null;
  actionItems: string[] | null;
  status: string;
  completedAt: string | null;
  createdAt: string;
}

const SESSION_TYPE_CONFIG: Record<string, { label: string; icon: typeof Video }> = {
  weekly_review: { label: "Weekly Review", icon: BarChart3 },
  deal_review: { label: "Deal Review", icon: FileText },
  market_update: { label: "Market Update", icon: TrendingUp },
  training: { label: "Training", icon: GraduationCap },
};

function SessionTypeBadge({ type }: { type: string }) {
  const config = SESSION_TYPE_CONFIG[type] || { label: type, icon: Video };
  const Icon = config.icon;
  return (
    <Badge variant="outline" data-testid={`badge-session-type-${type}`}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === "completed" ? "default" : status === "cancelled" ? "secondary" : "outline";
  const className =
    status === "scheduled"
      ? "border-blue-500/50 text-blue-600 dark:text-blue-400"
      : status === "completed"
        ? "bg-green-600 dark:bg-green-700 text-white border-green-600 dark:border-green-700"
        : "";
  return (
    <Badge variant={variant} className={className} data-testid={`badge-status-${status}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function SessionCard({
  session,
  onComplete,
  onCancel,
  onAddNotes,
}: {
  session: StrategySession;
  onComplete: (session: StrategySession) => void;
  onCancel: (id: string) => void;
  onAddNotes: (session: StrategySession) => void;
}) {
  return (
    <Card data-testid={`card-session-${session.id}`}>
      <CardContent className="py-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-foreground" data-testid={`text-topic-${session.id}`}>
                  {session.topic || "Untitled Session"}
                </p>
                <SessionTypeBadge type={session.sessionType} />
                <StatusBadge status={session.status} />
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1" data-testid={`text-date-${session.id}`}>
                  <Calendar className="h-3 w-3" />
                  {format(new Date(session.scheduledAt), "MMM d, yyyy 'at' h:mm a")}
                </span>
                <span className="flex items-center gap-1" data-testid={`text-duration-${session.id}`}>
                  <Clock className="h-3 w-3" />
                  {session.durationMinutes} min
                </span>
              </div>
            </div>
            {session.status === "scheduled" && (
              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAddNotes(session)}
                  data-testid={`button-add-notes-${session.id}`}
                >
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  Add Notes
                </Button>
                <Button
                  size="sm"
                  onClick={() => onComplete(session)}
                  data-testid={`button-complete-${session.id}`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Complete
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onCancel(session.id)}
                  data-testid={`button-cancel-${session.id}`}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Cancel
                </Button>
              </div>
            )}
            {session.status !== "scheduled" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAddNotes(session)}
                data-testid={`button-add-notes-${session.id}`}
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                Add Notes
              </Button>
            )}
          </div>

          {session.notes && (
            <p className="text-xs text-muted-foreground line-clamp-2" data-testid={`text-notes-${session.id}`}>
              {session.notes}
            </p>
          )}

          {session.actionItems && session.actionItems.length > 0 && (
            <div data-testid={`list-action-items-${session.id}`}>
              <div className="flex items-center gap-1 mb-1">
                <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Action Items</span>
              </div>
              <ul className="space-y-0.5">
                {session.actionItems.map((item, idx) => (
                  <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="mt-1 h-1 w-1 rounded-full bg-muted-foreground shrink-0" />
                    <span data-testid={`text-action-item-${session.id}-${idx}`}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function StrategySessions() {
  const { toast } = useToast();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<StrategySession | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const [scheduleForm, setScheduleForm] = useState({
    scheduledAt: "",
    durationMinutes: "30",
    sessionType: "weekly_review",
    topic: "",
    notes: "",
  });

  const [notesForm, setNotesForm] = useState({
    notes: "",
    actionItems: "",
  });

  const { data: sessions = [], isLoading } = useQuery<StrategySession[]>({
    queryKey: ["/api/strategy-sessions"],
  });

  const upcomingSessions = sessions.filter((s) => s.status === "scheduled");
  const completedSessions = sessions.filter((s) => s.status === "completed" || s.status === "cancelled");
  const nextSession = upcomingSessions.length > 0
    ? upcomingSessions.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0]
    : null;

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/strategy-sessions", {
        ...scheduleForm,
        durationMinutes: parseInt(scheduleForm.durationMinutes),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategy-sessions"] });
      toast({ title: "Session Scheduled", description: "Your strategy session has been scheduled." });
      setScheduleOpen(false);
      setScheduleForm({ scheduledAt: "", durationMinutes: "30", sessionType: "weekly_review", topic: "", notes: "" });
    },
    onError: () => toast({ title: "Error", description: "Failed to schedule session.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiRequest("PUT", `/api/strategy-sessions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategy-sessions"] });
      toast({ title: "Session Updated", description: "Session has been updated." });
      setNotesDialogOpen(false);
      setActiveSession(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to update session.", variant: "destructive" }),
  });

  function handleComplete(session: StrategySession) {
    setActiveSession(session);
    setIsCompleting(true);
    setNotesForm({ notes: session.notes || "", actionItems: (session.actionItems || []).join("\n") });
    setNotesDialogOpen(true);
  }

  function handleAddNotes(session: StrategySession) {
    setActiveSession(session);
    setIsCompleting(false);
    setNotesForm({ notes: session.notes || "", actionItems: (session.actionItems || []).join("\n") });
    setNotesDialogOpen(true);
  }

  function handleCancel(id: string) {
    updateMutation.mutate({ id, data: { status: "cancelled" } });
  }

  function handleSaveNotes() {
    if (!activeSession) return;
    const actionItems = notesForm.actionItems
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const data: Record<string, unknown> = {
      notes: notesForm.notes || null,
      actionItems: actionItems.length > 0 ? actionItems : null,
    };
    if (isCompleting) {
      data.status = "completed";
      data.completedAt = new Date().toISOString();
    }
    updateMutation.mutate({ id: activeSession.id, data });
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" data-testid="strategy-sessions-page">
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground" data-testid="text-page-title">Strategy Sessions</h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-subtitle">
            Schedule and track your agent-LO strategy meetings
          </p>
        </div>
        <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-schedule-session">
              <Plus className="h-4 w-4 mr-1" />
              Schedule Session
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule Strategy Session</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium text-foreground">Date & Time</label>
                <Input
                  type="datetime-local"
                  value={scheduleForm.scheduledAt}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledAt: e.target.value })}
                  className="mt-1"
                  data-testid="input-schedule-datetime"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Duration</label>
                <Select
                  value={scheduleForm.durationMinutes}
                  onValueChange={(v) => setScheduleForm({ ...scheduleForm, durationMinutes: v })}
                >
                  <SelectTrigger className="mt-1" data-testid="select-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Session Type</label>
                <Select
                  value={scheduleForm.sessionType}
                  onValueChange={(v) => setScheduleForm({ ...scheduleForm, sessionType: v })}
                >
                  <SelectTrigger className="mt-1" data-testid="select-session-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly_review">Weekly Review</SelectItem>
                    <SelectItem value="deal_review">Deal Review</SelectItem>
                    <SelectItem value="market_update">Market Update</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Topic</label>
                <Input
                  value={scheduleForm.topic}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, topic: e.target.value })}
                  placeholder="e.g., Q1 pipeline review"
                  className="mt-1"
                  data-testid="input-topic"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Notes (optional)</label>
                <Textarea
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                  placeholder="Any agenda items or notes for this session..."
                  className="mt-1"
                  rows={3}
                  data-testid="input-schedule-notes"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!scheduleForm.scheduledAt || !scheduleForm.topic || createMutation.isPending}
                  data-testid="button-submit-schedule"
                >
                  {createMutation.isPending ? "Scheduling..." : "Schedule Session"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card data-testid="card-stat-upcoming">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/10">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground" data-testid="text-upcoming-count">
                  {upcomingSessions.length}
                </p>
                <p className="text-xs text-muted-foreground">Upcoming Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-completed">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-green-500/10">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground" data-testid="text-completed-count">
                  {sessions.filter((s) => s.status === "completed").length}
                </p>
                <p className="text-xs text-muted-foreground">Completed Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-next">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-purple-500/10">
                <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground" data-testid="text-next-session">
                  {nextSession ? format(new Date(nextSession.scheduledAt), "MMM d, h:mm a") : "None"}
                </p>
                <p className="text-xs text-muted-foreground">Next Session</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="upcoming" data-testid="tabs-sessions">
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="upcoming" data-testid="tab-upcoming">
            Upcoming ({upcomingSessions.length})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            Completed ({completedSessions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          {upcomingSessions.length === 0 ? (
            <Card data-testid="card-no-upcoming">
              <CardContent className="py-8 text-center">
                <Calendar className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="font-medium text-foreground">No upcoming sessions</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Schedule a strategy session with your LO partner to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcomingSessions
                .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                .map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onComplete={handleComplete}
                    onCancel={handleCancel}
                    onAddNotes={handleAddNotes}
                  />
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {completedSessions.length === 0 ? (
            <Card data-testid="card-no-completed">
              <CardContent className="py-8 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="font-medium text-foreground">No completed sessions</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Completed and cancelled sessions will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {completedSessions
                .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
                .map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onComplete={handleComplete}
                    onCancel={handleCancel}
                    onAddNotes={handleAddNotes}
                  />
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isCompleting ? "Complete Session" : "Session Notes"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {activeSession && (
              <div className="text-sm text-muted-foreground" data-testid="text-dialog-session-info">
                {activeSession.topic || "Untitled Session"} -{" "}
                {format(new Date(activeSession.scheduledAt), "MMM d, yyyy")}
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-foreground">Notes</label>
              <Textarea
                value={notesForm.notes}
                onChange={(e) => setNotesForm({ ...notesForm, notes: e.target.value })}
                placeholder="Session notes, outcomes, discussion points..."
                className="mt-1"
                rows={4}
                data-testid="input-dialog-notes"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Action Items (one per line)</label>
              <Textarea
                value={notesForm.actionItems}
                onChange={(e) => setNotesForm({ ...notesForm, actionItems: e.target.value })}
                placeholder={"Follow up on deal #1234\nSend market report to agent\nSchedule next review"}
                className="mt-1"
                rows={4}
                data-testid="input-dialog-action-items"
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleSaveNotes}
                disabled={updateMutation.isPending}
                data-testid="button-save-notes"
              >
                {updateMutation.isPending
                  ? "Saving..."
                  : isCompleting
                    ? "Complete & Save"
                    : "Save Notes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
