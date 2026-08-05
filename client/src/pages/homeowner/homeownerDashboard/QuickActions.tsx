import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Building2, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { HomeownerProfile } from "./types";

export function QuickActions({ profile }: { profile: HomeownerProfile }) {
  const { toast } = useToast();
  const [balanceDialog, setBalanceDialog] = useState(false);
  const [valueDialog, setValueDialog] = useState(false);
  const [newBalance, setNewBalance] = useState(profile.currentLoanBalance || "");
  const [newValue, setNewValue] = useState(profile.propertyValue || "");

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      apiRequest("PUT", `/api/homeowner/profile/${profile.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/homeowner/profile"] });
      toast({ title: "Updated", description: "Profile has been updated." });
      setBalanceDialog(false);
      setValueDialog(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to update.", variant: "destructive" }),
  });

  return (
    <Card data-testid="card-quick-actions">
      <CardHeader>
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={balanceDialog} onOpenChange={setBalanceDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-update-balance">
                <Wallet className="h-4 w-4 mr-1" /> Update Balance
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Update Loan Balance</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium text-foreground">New Balance</label>
                  <Input
                    type="number"
                    value={newBalance}
                    onChange={(e) => setNewBalance(e.target.value)}
                    placeholder="Current loan balance"
                    className="mt-1"
                    data-testid="input-new-balance"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => updateMutation.mutate({ currentLoanBalance: newBalance })}
                    disabled={updateMutation.isPending}
                    data-testid="button-save-balance"
                  >
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={valueDialog} onOpenChange={setValueDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-update-value">
                <Building2 className="h-4 w-4 mr-1" /> Update Property Value
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Update Property Value</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium text-foreground">Estimated Value</label>
                  <Input
                    type="number"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="Current property value"
                    className="mt-1"
                    data-testid="input-new-value"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => updateMutation.mutate({ propertyValue: newValue })}
                    disabled={updateMutation.isPending}
                    data-testid="button-save-value"
                  >
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
