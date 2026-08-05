import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { AcceleratorEnrollment } from "./types";

export function FinancialUpdateDialog({ enrollment }: { enrollment: AcceleratorEnrollment }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({
    currentCreditScore: enrollment.currentCreditScore?.toString() || "",
    currentSavings: enrollment.currentSavings || "",
    currentDti: enrollment.currentDti || "",
    targetDate: enrollment.targetDate || "",
    targetCreditScore: enrollment.targetCreditScore?.toString() || "",
    targetDownPayment: enrollment.targetDownPayment || "",
    targetDti: enrollment.targetDti || "",
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      apiRequest("PUT", `/api/accelerator/enrollment/${enrollment.id}`, {
        currentCreditScore: values.currentCreditScore ? parseInt(values.currentCreditScore) : null,
        currentSavings: values.currentSavings || null,
        currentDti: values.currentDti || null,
        targetDate: values.targetDate || null,
        targetCreditScore: values.targetCreditScore ? parseInt(values.targetCreditScore) : null,
        targetDownPayment: values.targetDownPayment || null,
        targetDti: values.targetDti || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accelerator/enrollment"] });
      toast({ title: "Updated", description: "Financial values have been updated." });
      setOpen(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to update values.", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-update-financials">
          <TrendingUp className="h-4 w-4 mr-1" /> Update Financials
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Financial Values</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium">Target Date</label>
            <Input
              type="date"
              value={values.targetDate}
              onChange={(e) => setValues({ ...values, targetDate: e.target.value })}
              className="mt-1"
              data-testid="input-target-date"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Current Credit Score</label>
              <Input
                type="number"
                value={values.currentCreditScore}
                onChange={(e) => setValues({ ...values, currentCreditScore: e.target.value })}
                placeholder="720"
                className="mt-1"
                data-testid="input-current-credit-score"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Target Credit Score</label>
              <Input
                type="number"
                value={values.targetCreditScore}
                onChange={(e) => setValues({ ...values, targetCreditScore: e.target.value })}
                placeholder="740"
                className="mt-1"
                data-testid="input-target-credit-score"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Current Savings ($)</label>
              <Input
                type="number"
                value={values.currentSavings}
                onChange={(e) => setValues({ ...values, currentSavings: e.target.value })}
                placeholder="15000"
                className="mt-1"
                data-testid="input-current-savings"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Target Down Payment ($)</label>
              <Input
                type="number"
                value={values.targetDownPayment}
                onChange={(e) => setValues({ ...values, targetDownPayment: e.target.value })}
                placeholder="50000"
                className="mt-1"
                data-testid="input-target-down-payment"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Current DTI (%)</label>
              <Input
                type="number"
                value={values.currentDti}
                onChange={(e) => setValues({ ...values, currentDti: e.target.value })}
                placeholder="35"
                className="mt-1"
                data-testid="input-current-dti"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Target DTI (%)</label>
              <Input
                type="number"
                value={values.targetDti}
                onChange={(e) => setValues({ ...values, targetDti: e.target.value })}
                placeholder="28"
                className="mt-1"
                data-testid="input-target-dti"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              data-testid="button-save-financials"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
