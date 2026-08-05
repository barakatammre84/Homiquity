import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

export function CreateGuaranteeDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    applicationId: "",
    guaranteeType: "underwriting_24h",
    targetDate: "",
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/closing-guarantees", formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/closing-guarantees"] });
      toast({ title: "Guarantee Created", description: "The closing guarantee has been created successfully." });
      setOpen(false);
      setFormData({ applicationId: "", guaranteeType: "underwriting_24h", targetDate: "" });
    },
    onError: () => toast({ title: "Error", description: "Failed to create guarantee.", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-create-guarantee">
          <Plus className="h-4 w-4 mr-1" /> Create Guarantee
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Closing Guarantee</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium text-foreground">Application ID</label>
            <Input
              value={formData.applicationId}
              onChange={(e) => setFormData({ ...formData, applicationId: e.target.value })}
              placeholder="Enter application ID"
              className="mt-1"
              data-testid="input-guarantee-app-id"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Guarantee Type</label>
            <Select value={formData.guaranteeType} onValueChange={(v) => setFormData({ ...formData, guaranteeType: v })}>
              <SelectTrigger className="mt-1" data-testid="select-guarantee-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="underwriting_24h">24-Hour Underwriting</SelectItem>
                <SelectItem value="appraisal_48h">48-Hour Appraisal</SelectItem>
                <SelectItem value="closing_10day">10-Day Close</SelectItem>
                <SelectItem value="communication_daily">Daily Communication</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Target Date</label>
            <Input
              type="datetime-local"
              value={formData.targetDate}
              onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
              className="mt-1"
              data-testid="input-guarantee-target-date"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!formData.applicationId || !formData.targetDate || createMutation.isPending}
              data-testid="button-submit-guarantee"
            >
              {createMutation.isPending ? "Creating..." : "Create Guarantee"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
