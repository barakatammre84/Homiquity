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

interface PendingSession {
  id: string;
  scheduledAt: string;
  topic: string | null;
  borrowerName: string;
  createdAt: string | null;
}

interface PendingResponse {
  total: number;
  sessions: PendingSession[];
}

export function SessionRequestsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<PendingResponse>({
    queryKey: ["/api/accelerator/sessions/pending"],
  });

  const confirm = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("POST", `/api/accelerator/sessions/${sessionId}/confirm`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accelerator/sessions/pending"] });
      toast({
        title: "Session confirmed",
        description: "Your name is on it, and the borrower can see that you're taking it.",
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

  const pending = data?.sessions ?? [];
  if (isLoading || pending.length === 0) return null;

  return (
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
            <Button
              size="sm"
              variant="secondary"
              className="touch-target h-7 shrink-0 px-2 text-xs"
              onClick={() => confirm.mutate(session.id)}
              disabled={confirm.isPending}
              data-testid={`confirm-session-${session.id}`}
            >
              {confirm.isPending && confirm.variables === session.id ? "Confirming…" : "Confirm"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
