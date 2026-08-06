import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

export function ScheduleSessionDialog({ enrollmentId }: { enrollmentId: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [sessionData, setSessionData] = useState({ scheduledAt: "", topic: "" });

  const scheduleMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/accelerator/coaching", {
        enrollmentId,
        scheduledAt: sessionData.scheduledAt,
        topic: sessionData.topic || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accelerator/coaching", enrollmentId] });
      toast({ title: "Scheduled", description: "Coaching session has been scheduled." });
      setOpen(false);
      setSessionData({ scheduledAt: "", topic: "" });
    },
    onError: () => toast({ title: "Error", description: "Failed to schedule session.", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-schedule-session">
          <Plus className="h-4 w-4 mr-1" /> Schedule Session
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Coaching Session</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium">Date & Time</label>
            <Input
              type="datetime-local"
              value={sessionData.scheduledAt}
              onChange={(e) => setSessionData({ ...sessionData, scheduledAt: e.target.value })}
              className="mt-1"
              data-testid="input-session-date"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Topic</label>
            <Input
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
              {scheduleMutation.isPending ? "Scheduling..." : "Schedule"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
