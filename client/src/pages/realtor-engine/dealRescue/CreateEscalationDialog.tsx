import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressInput } from "@/components/AddressInput";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export function CreateEscalationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
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
