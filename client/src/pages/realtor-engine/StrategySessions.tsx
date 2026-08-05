import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Calendar, CheckCircle2 } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { actionItemsToText, parseActionItems, partitionSessions } from "./strategySessions/derive";
import { emptyScheduleForm, type NotesForm, type StrategySession } from "./strategySessions/types";
import { ScheduleSessionDialog } from "./strategySessions/ScheduleSessionDialog";
import { SessionNotesDialog } from "./strategySessions/SessionNotesDialog";
import { SessionStatsCards } from "./strategySessions/SessionStatsCards";
import { SessionList } from "./strategySessions/SessionList";

export default function StrategySessions() {
  const { toast } = useToast();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<StrategySession | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm);
  const [notesForm, setNotesForm] = useState<NotesForm>({ notes: "", actionItems: "" });

  const {
    data: sessions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<StrategySession[]>({
    queryKey: ["/api/strategy-sessions"],
  });

  const { upcoming, archived, completedCount, next } = partitionSessions(sessions);

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
      setScheduleForm(emptyScheduleForm());
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

  /** Both entry points open the same dialog; only the completing flag differs. */
  function openNotesDialog(session: StrategySession, completing: boolean) {
    setActiveSession(session);
    setIsCompleting(completing);
    setNotesForm({ notes: session.notes || "", actionItems: actionItemsToText(session.actionItems) });
    setNotesDialogOpen(true);
  }

  function handleCancel(id: string) {
    updateMutation.mutate({ id, data: { status: "cancelled" } });
  }

  function handleSaveNotes() {
    if (!activeSession) return;
    const actionItems = parseActionItems(notesForm.actionItems);
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

  // Without this a failed load renders as "no upcoming sessions" — the agent
  // reads it as an empty calendar rather than a broken one (ux-01).
  if (isError) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <QueryErrorState
          error={error}
          onRetry={() => void refetch()}
          title="We couldn't load your strategy sessions"
          data-testid="strategy-sessions-error"
        />
      </div>
    );
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

  const sessionHandlers = {
    onComplete: (session: StrategySession) => openNotesDialog(session, true),
    onCancel: handleCancel,
    onAddNotes: (session: StrategySession) => openNotesDialog(session, false),
  };

  return (
    <PageShell width="content">
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground" data-testid="text-page-title">Strategy Sessions</h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-subtitle">
            Schedule and track your agent-LO strategy meetings
          </p>
        </div>
        <ScheduleSessionDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          form={scheduleForm}
          onFormChange={setScheduleForm}
          onSubmit={() => createMutation.mutate()}
          isPending={createMutation.isPending}
        />
      </div>

      <SessionStatsCards
        upcomingCount={upcoming.length}
        completedCount={completedCount}
        next={next}
      />

      <Tabs defaultValue="upcoming" data-testid="tabs-sessions">
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="upcoming" data-testid="tab-upcoming">
            Upcoming ({upcoming.length})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            Completed ({archived.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          <SessionList
            sessions={upcoming}
            {...sessionHandlers}
            empty={{
              testId: "card-no-upcoming",
              icon: Calendar,
              title: "No upcoming sessions",
              body: "Schedule a strategy session with your LO partner to get started.",
            }}
          />
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <SessionList
            sessions={archived}
            {...sessionHandlers}
            empty={{
              testId: "card-no-completed",
              icon: CheckCircle2,
              title: "No completed sessions",
              body: "Completed and cancelled sessions will appear here.",
            }}
          />
        </TabsContent>
      </Tabs>

      <SessionNotesDialog
        open={notesDialogOpen}
        onOpenChange={setNotesDialogOpen}
        session={activeSession}
        isCompleting={isCompleting}
        form={notesForm}
        onFormChange={setNotesForm}
        onSave={handleSaveNotes}
        isPending={updateMutation.isPending}
      />
    </PageShell>
  );
}
