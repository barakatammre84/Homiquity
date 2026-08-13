import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { DollarSign, Loader2, PiggyBank, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, homeownershipGoalKeys } from "@/lib/queryClient";
import type { SavingsTransaction } from "@shared/schema";
import { savingsFormSchema, type GapAnalysis, type SavingsFormInput, type SavingsFormValues } from "./types";

export interface SavingsVaultTabProps {
  analysis: GapAnalysis["analysis"];
  savingsTransactions: SavingsTransaction[] | undefined;
}

export function SavingsVaultTab({ analysis, savingsTransactions }: SavingsVaultTabProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showSavingsDialog, setShowSavingsDialog] = useState(false);

  // <input, context, output>: the resolver coerces, so `handleSubmit` hands
  // `onSubmitSavings` the parsed number while the field itself stays a string.
  const savingsForm = useForm<SavingsFormInput, unknown, SavingsFormValues>({
    resolver: zodResolver(savingsFormSchema),
    defaultValues: {
      amount: "",
      description: "",
    },
  });

  const addSavingsMutation = useMutation({
    mutationFn: async (data: SavingsFormValues) => {
      const response = await apiRequest("POST", "/api/homeownership-goal/savings", {
        amount: String(data.amount),
        description: data.description || undefined,
        transactionType: "manual_deposit",
      });
      return response.json();
    },
    onSuccess: () => {
      // One prefix covers the goal and both derived views (gap analysis AND
      // credit recommendations). The old pair enumerated two of the three.
      queryClient.invalidateQueries({ queryKey: homeownershipGoalKeys.all() });
      setShowSavingsDialog(false);
      savingsForm.reset();
      toast({
        title: "Deposit Added!",
        description: "Your savings have been updated.",
      });
    },
  });

  const onSubmitSavings = (data: SavingsFormValues) => {
    addSavingsMutation.mutate(data);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5" />
            Savings Vault
          </CardTitle>
          <CardDescription>
            Track your progress toward your down payment goal
          </CardDescription>
        </div>
        <Dialog open={showSavingsDialog} onOpenChange={setShowSavingsDialog}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-savings">
              <Plus className="h-4 w-4 mr-2" />
              Add Deposit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add to Savings</DialogTitle>
              <DialogDescription>
                Record a deposit to your home savings fund
              </DialogDescription>
            </DialogHeader>
            <Form {...savingsForm}>
              <form onSubmit={savingsForm.handleSubmit(onSubmitSavings)} className="space-y-4">
                <FormField
                  control={savingsForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="100.00"
                          {...field}
                          data-testid="input-deposit-amount"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={savingsForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Note (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Monthly savings"
                          {...field}
                          data-testid="input-deposit-note"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={addSavingsMutation.isPending}
                  data-testid="button-submit-deposit"
                >
                  {addSavingsMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add Deposit
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center p-6 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5">
          <DollarSign className="h-12 w-12 mx-auto mb-2 text-primary" />
          <div className="text-4xl font-bold">
            ${(analysis?.savings.current || 0).toLocaleString()}
          </div>
          <p className="text-muted-foreground">
            of ${(analysis?.savings.target || 0).toLocaleString()} goal
          </p>
          <Progress
            value={analysis?.savings.progress || 0}
            className="mt-4 h-3"
          />
        </div>

        <div>
          <h4 className="font-medium mb-3">Recent Transactions</h4>
          {savingsTransactions?.slice(0, 5).map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between py-2 border-b last:border-0"
            >
              <div>
                <p className="font-medium text-sm">
                  {tx.transactionType === "manual_deposit" && "Deposit"}
                  {tx.transactionType === "round_up" && "Round-up"}
                  {tx.transactionType === "recurring" && "Recurring"}
                  {tx.transactionType === "bonus" && "Bonus"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tx.description || new Date(tx.createdAt!).toLocaleDateString()}
                </p>
              </div>
              <span className="font-medium text-success-subtle-foreground">
                +${parseFloat(tx.amount).toLocaleString()}
              </span>
            </div>
          ))}

          {(!savingsTransactions || savingsTransactions.length === 0) && (
            <p className="text-center text-muted-foreground py-4">
              No transactions yet. Add your first deposit!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
