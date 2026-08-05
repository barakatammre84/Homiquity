import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ScheduleForm } from "./types";

export interface ScheduleSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ScheduleForm;
  onFormChange: (form: ScheduleForm) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function ScheduleSessionDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSubmit,
  isPending,
}: ScheduleSessionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              value={form.scheduledAt}
              onChange={(e) => onFormChange({ ...form, scheduledAt: e.target.value })}
              className="mt-1"
              data-testid="input-schedule-datetime"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Duration</label>
            <Select
              value={form.durationMinutes}
              onValueChange={(v) => onFormChange({ ...form, durationMinutes: v })}
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
              value={form.sessionType}
              onValueChange={(v) => onFormChange({ ...form, sessionType: v })}
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
              value={form.topic}
              onChange={(e) => onFormChange({ ...form, topic: e.target.value })}
              placeholder="e.g., Q1 pipeline review"
              className="mt-1"
              data-testid="input-topic"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Notes (optional)</label>
            <Textarea
              value={form.notes}
              onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
              placeholder="Any agenda items or notes for this session..."
              className="mt-1"
              rows={3}
              data-testid="input-schedule-notes"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={onSubmit}
              disabled={!form.scheduledAt || !form.topic || isPending}
              data-testid="button-submit-schedule"
            >
              {isPending ? "Scheduling..." : "Schedule Session"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
