import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Send } from "lucide-react";

export interface NewScenarioDraft {
  subject: string;
  scenarioType: string;
  notes: string;
  loanAmount: string;
  creditScore: string;
}

export const emptyScenarioDraft = (): NewScenarioDraft => ({
  subject: "",
  scenarioType: "general",
  notes: "",
  loanAmount: "",
  creditScore: "",
});

export interface NewScenarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: NewScenarioDraft;
  onDraftChange: (draft: NewScenarioDraft) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function NewScenarioDialog({
  open,
  onOpenChange,
  draft,
  onDraftChange,
  onSubmit,
  isPending,
}: NewScenarioDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-new-scenario">
          <Plus className="h-4 w-4 mr-1" /> New Scenario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ask a Scenario Question</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium">Question</label>
            <Input
              value={draft.subject}
              onChange={(e) => onDraftChange({ ...draft, subject: e.target.value })}
              placeholder="e.g., Can a borrower with 580 credit get FHA?"
              className="mt-1"
              data-testid="input-scenario-subject"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Scenario Type</label>
            <Select value={draft.scenarioType} onValueChange={(v) => onDraftChange({ ...draft, scenarioType: v })}>
              <SelectTrigger className="mt-1" data-testid="select-scenario-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Question</SelectItem>
                <SelectItem value="eligibility">Eligibility Check</SelectItem>
                <SelectItem value="pricing">Pricing Scenario</SelectItem>
                <SelectItem value="documentation">Documentation</SelectItem>
                <SelectItem value="program">Loan Program</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Loan Amount</label>
              <Input
                type="number"
                value={draft.loanAmount}
                onChange={(e) => onDraftChange({ ...draft, loanAmount: e.target.value })}
                placeholder="$350,000"
                className="mt-1"
                data-testid="input-scenario-amount"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Credit Score</label>
              <Input
                type="number"
                value={draft.creditScore}
                onChange={(e) => onDraftChange({ ...draft, creditScore: e.target.value })}
                placeholder="720"
                className="mt-1"
                data-testid="input-scenario-credit"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Details</label>
            <Textarea
              value={draft.notes}
              onChange={(e) => onDraftChange({ ...draft, notes: e.target.value })}
              placeholder="Provide additional details about the scenario..."
              className="mt-1"
              rows={3}
              data-testid="input-scenario-notes"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={onSubmit} disabled={!draft.subject || isPending} data-testid="button-submit-scenario">
              <Send className="h-4 w-4 mr-1" /> Submit Question
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
