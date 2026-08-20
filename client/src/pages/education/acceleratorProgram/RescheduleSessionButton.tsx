import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

/**
 * Move a session to a different time.
 *
 * The copy is careful about what this does: moving the time RE-OPENS the ask.
 * A loan officer agreed to a specific slot, not to the borrower's calendar, so
 * the session goes back to "requested" and returns to the desk's queue. Saying
 * "rescheduled" without saying that would put back the exact lie the request →
 * confirm split removed — a booking the borrower believes in and nobody has
 * agreed to.
 */
export function RescheduleSessionButton({
  sessionId,
  enrollmentId,
  disabled,
}: {
  sessionId: string;
  enrollmentId: string;
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  // The server refuses a past datetime; the picker should not offer one either.
  const minDateTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  const reschedule = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/accelerator/sessions/${sessionId}/reschedule`, { scheduledAt }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accelerator/coaching", enrollmentId] });
      toast({
        title: "New time requested",
        description: "A loan officer will confirm the new time. It isn't booked yet.",
      });
      setOpen(false);
      setScheduledAt("");
    },
    onError: (error) =>
      toast({
        title: "We couldn't move that",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="touch-target h-8 px-2 text-xs"
          disabled={disabled}
          data-testid={`button-reschedule-session-${sessionId}`}
        >
          Move
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ask for a different time</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground" data-testid="text-reschedule-explainer">
            Moving the time sends the request back to your loan officer to confirm, so it won't be
            booked again until they do.
          </p>
          <div>
            <label className="text-sm font-medium" htmlFor={`reschedule-${sessionId}`}>
              What time works instead?
            </label>
            <Input
              id={`reschedule-${sessionId}`}
              type="datetime-local"
              min={minDateTime}
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="mt-1"
              data-testid={`input-reschedule-${sessionId}`}
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => reschedule.mutate()}
              disabled={!scheduledAt || reschedule.isPending}
              data-testid={`button-confirm-reschedule-${sessionId}`}
            >
              {reschedule.isPending ? "Sending…" : "Send new time"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
