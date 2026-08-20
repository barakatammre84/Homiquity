import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function ScheduleSessionDialog({ enrollmentId }: { enrollmentId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [sessionData, setSessionData] = useState({ scheduledAt: "", topic: "" });
  // The server rejects a past datetime; the picker should not offer one either.
  // Local time, because that is what a `datetime-local` input reads.
  const minDateTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  const scheduleMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/accelerator/coaching", {
        enrollmentId,
        scheduledAt: sessionData.scheduledAt,
        topic: sessionData.topic || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accelerator/coaching", enrollmentId] });
      // Not "Scheduled". Nothing is booked until a loan officer confirms it,
      // and this toast used to say otherwise while no staff surface anywhere
      // read the request.
      toast({
        title: "Request sent",
        description: "A loan officer will confirm a time with you. Nothing is booked yet.",
      });
      setOpen(false);
      setSessionData({ scheduledAt: "", topic: "" });
    },
    onError: (error) =>
      toast({
        title: "We couldn't send your request",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="touch-target" data-testid="button-schedule-session">
          <Plus className="h-4 w-4 mr-1" /> Request a session
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ask for a 1:1 with a loan officer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground" data-testid="text-session-request-explainer">
            Tell us when suits you and a loan officer from our team will confirm. This is a
            conversation about your plan — it is not an application and runs no credit check.
          </p>
          <div>
            <label className="text-sm font-medium" htmlFor="session-date">
              What time works for you?
            </label>
            <Input
              id="session-date"
              type="datetime-local"
              min={minDateTime}
              value={sessionData.scheduledAt}
              onChange={(e) => setSessionData({ ...sessionData, scheduledAt: e.target.value })}
              className="mt-1"
              data-testid="input-session-date"
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="session-topic">
              What would you like to talk about? (optional)
            </label>
            <Input
              id="session-topic"
              value={sessionData.topic}
              onChange={(e) => setSessionData({ ...sessionData, topic: e.target.value })}
              placeholder="e.g., Credit improvement strategy"
              className="mt-1"
              data-testid="input-session-topic"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => scheduleMutation.mutate()}
              disabled={!sessionData.scheduledAt || scheduleMutation.isPending}
              data-testid="button-confirm-schedule"
            >
              {scheduleMutation.isPending ? "Sending..." : "Send request"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
