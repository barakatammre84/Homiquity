import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Icons, iconSize } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

// Accelerator 1:1 requests — borrowers asking for time with a loan officer.
//
// These people are the reason this card cannot be part of the intake inbox
// beside it: they are aspiring owners with no loan application, so they are
// invisible to every application-shaped queue in the product. The intake inbox
// reads loan_applications; tasks.application_id is NOT NULL. Before this card
// existed, a request wrote a row and told the borrower it was "scheduled" while
// no staff surface anywhere read the table.
//
// Confirming mirrors claiming a file from the intake pool: it puts YOUR name on
// the session, and the borrower's page then says who they are meeting.
//
// Icons come from the registry (@/lib/icons), not straight from lucide-react:
// `directLucideImports` is a ratchet that may only ever go down, and a new file
// with a bare lucide import pushes it up by one.

interface DeskSession {
  id: string;
  scheduledAt: string;
  topic: string | null;
  borrowerName: string;
  createdAt: string | null;
}

interface SessionListResponse {
  total: number;
  sessions: DeskSession[];
}

export function SessionRequestsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<SessionListResponse>({
    queryKey: ["/api/accelerator/sessions/pending"],
  });
  const { data: mine } = useQuery<SessionListResponse>({
    queryKey: ["/api/accelerator/sessions/mine"],
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/accelerator/sessions/pending"] });
    queryClient.invalidateQueries({ queryKey: ["/api/accelerator/sessions/mine"] });
  };

  const confirm = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("POST", `/api/accelerator/sessions/${sessionId}/confirm`, {});
      return res.json();
    },
    onSuccess: () => {
      refresh();
      toast({
        title: "Session confirmed",
        description: "Your name is on it, and the borrower has been told.",
      });
    },
    onError: (error) => {
      toast({
        title: "Couldn't confirm this session",
        description: error instanceof Error ? error.message : "Unexpected error.",
        variant: "destructive",
      });
    },
  });

  const decline = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("POST", `/api/accelerator/sessions/${sessionId}/decline`, {});
      return res.json();
    },
    onSuccess: () => {
      refresh();
      toast({
        title: "Request declined",
        description: "The borrower has been told it isn't going ahead.",
      });
    },
    onError: (error) =>
      toast({
        title: "Couldn't decline this request",
        description: error instanceof Error ? error.message : "Unexpected error.",
        variant: "destructive",
      }),
  });

  const outcome = useMutation({
    mutationFn: async ({ sessionId, attended }: { sessionId: string; attended: boolean }) => {
      const res = await apiRequest(
        "POST",
        `/api/accelerator/sessions/${sessionId}/outcome`,
        { attended },
      );
      return res.json();
    },
    onSuccess: () => {
      refresh();
      toast({ title: "Recorded", description: "The borrower has been told." });
    },
    onError: (error) =>
      toast({
        title: "Couldn't record this",
        description: error instanceof Error ? error.message : "Unexpected error.",
        variant: "destructive",
      }),
  });

  const pending = data?.sessions ?? [];
  const upcoming = mine?.sessions ?? [];
  const now = Date.now();
  if (isLoading && upcoming.length === 0) return null;
  if (pending.length === 0 && upcoming.length === 0) return null;

  return (
    <>
      {pending.length > 0 && (
    <div
      className="mb-3 rounded-lg border border-info-subtle-foreground/25 bg-info-subtle p-3 text-info-subtle-foreground"
      data-testid="session-requests"
    >
      <div className="mb-2 flex items-center gap-2">
        <Icons.calendar className={`${iconSize.inline} shrink-0`} aria-hidden="true" />
        <h2 className="text-sm font-semibold">
          1:1 requests — {pending.length} waiting
        </h2>
      </div>
      <ul className="space-y-1.5">
        {pending.map((session) => (
          <li
            key={session.id}
            className="flex items-center justify-between gap-2"
            data-testid={`session-request-${session.id}`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{session.borrowerName}</p>
              <p className="text-xs opacity-80">
                asked for {format(new Date(session.scheduledAt), "MMM d, h:mm a")}
                {session.topic ? ` — ${session.topic}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                size="sm"
                variant="secondary"
                className="touch-target h-7 px-2 text-xs"
                onClick={() => confirm.mutate(session.id)}
                disabled={confirm.isPending || decline.isPending}
                data-testid={`confirm-session-${session.id}`}
              >
                {confirm.isPending && confirm.variables === session.id ? "Confirming…" : "Confirm"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="touch-target h-7 px-2 text-xs"
                onClick={() => decline.mutate(session.id)}
                disabled={confirm.isPending || decline.isPending}
                data-testid={`decline-session-${session.id}`}
              >
                {decline.isPending && decline.variables === session.id ? "…" : "Decline"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
      )}

      {upcoming.length > 0 && (
        <div
          className="mb-3 rounded-lg border border-border bg-card p-3"
          data-testid="my-sessions"
        >
          <div className="mb-2 flex items-center gap-2">
            <Icons.calendar className={`${iconSize.inline} shrink-0`} aria-hidden="true" />
            <h2 className="text-sm font-semibold">Your 1:1s — {upcoming.length}</h2>
          </div>
          <ul className="space-y-1.5">
            {upcoming.map((session) => {
              // A meeting cannot be reported before it starts — the server
              // refuses it, so the buttons must not offer it either.
              const started = new Date(session.scheduledAt).getTime() <= now;
              return (
                <li
                  key={session.id}
                  className="flex items-center justify-between gap-2"
                  data-testid={`my-session-${session.id}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{session.borrowerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(session.scheduledAt), "MMM d, h:mm a")}
                      {session.topic ? ` — ${session.topic}` : ""}
                    </p>
                  </div>
                  {started ? (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="touch-target h-7 px-2 text-xs"
                        onClick={() => outcome.mutate({ sessionId: session.id, attended: true })}
                        disabled={outcome.isPending}
                        data-testid={`complete-session-${session.id}`}
                      >
                        Done
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="touch-target h-7 px-2 text-xs"
                        onClick={() => outcome.mutate({ sessionId: session.id, attended: false })}
                        disabled={outcome.isPending}
                        data-testid={`noshow-session-${session.id}`}
                      >
                        No-show
                      </Button>
                    </div>
                  ) : (
                    <span
                      className="shrink-0 text-xs text-muted-foreground"
                      data-testid={`upcoming-session-${session.id}`}
                    >
                      upcoming
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
