import { useState, useCallback } from "react";
import { CheckCircle2, CreditCard, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { DEBT_TYPES, debtTypeIcon, type DebtItem } from "./types";

export interface DebtsCardProps {
  debts: DebtItem[];
  onDebtsChange: (debts: DebtItem[]) => void;
}

export function DebtsCard({ debts, onDebtsChange }: DebtsCardProps) {
  const [isDebtDialogOpen, setIsDebtDialogOpen] = useState(false);
  const [newDebtType, setNewDebtType] = useState("auto_loan");
  const [newDebtName, setNewDebtName] = useState("");
  const [newDebtAmount, setNewDebtAmount] = useState("");
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);

  const totalDebtPayments = debts.reduce((sum, d) => sum + d.monthlyPayment, 0);

  const resetForm = () => {
    setNewDebtName("");
    setNewDebtAmount("");
    setNewDebtType("auto_loan");
  };

  const addDebt = useCallback(() => {
    const amount = parseFloat(newDebtAmount) || 0;
    if (amount <= 0) return;

    const typeInfo = DEBT_TYPES.find((t) => t.value === newDebtType);

    if (editingDebtId) {
      onDebtsChange(
        debts.map((d) =>
          d.id === editingDebtId
            ? { ...d, type: newDebtType, name: newDebtName || typeInfo?.label || "Debt", monthlyPayment: amount }
            : d
        )
      );
      setEditingDebtId(null);
    } else {
      onDebtsChange([
        ...debts,
        {
          id: crypto.randomUUID(),
          type: newDebtType,
          name: newDebtName || typeInfo?.label || "Debt",
          monthlyPayment: amount,
        },
      ]);
    }
    resetForm();
  }, [debts, onDebtsChange, newDebtType, newDebtName, newDebtAmount, editingDebtId]);

  const startEditDebt = useCallback((debt: DebtItem) => {
    setEditingDebtId(debt.id);
    setNewDebtType(debt.type);
    setNewDebtName(debt.name);
    setNewDebtAmount(String(debt.monthlyPayment));
  }, []);

  const cancelEditDebt = useCallback(() => {
    setEditingDebtId(null);
    resetForm();
  }, []);

  const removeDebt = useCallback((id: string) => {
    onDebtsChange(debts.filter((d) => d.id !== id));
    if (editingDebtId === id) {
      setEditingDebtId(null);
      resetForm();
    }
  }, [debts, onDebtsChange, editingDebtId]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Monthly Debts
          </CardTitle>
          <Dialog open={isDebtDialogOpen} onOpenChange={setIsDebtDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="touch-target" data-testid="button-add-debts">
                <Plus className="h-4 w-4 mr-1" />
                Add Debts
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add Monthly Debts</DialogTitle>
                <DialogDescription>
                  List your recurring monthly debt payments. This helps calculate an accurate debt-to-income ratio.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {debts.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {debts.map((debt) => {
                      const Icon = debtTypeIcon(debt.type);
                      const isEditing = editingDebtId === debt.id;
                      return (
                        <div
                          key={debt.id}
                          className={`flex items-center justify-between gap-2 rounded-lg p-3 ${isEditing ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/50"}`}
                          data-testid={`debt-item-${debt.id}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm truncate">{debt.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium whitespace-nowrap">
                              {formatCurrency(debt.monthlyPayment)}/mo
                            </span>
                            <Button
                              size="icon" aria-label="Edit"
                              variant="ghost"
                              onClick={() => startEditDebt(debt)}
                              data-testid={`button-edit-debt-${debt.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon" aria-label="Delete"
                              variant="ghost"
                              onClick={() => removeDebt(debt.id)}
                              data-testid={`button-remove-debt-${debt.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-3 border-t pt-4">
                  {editingDebtId && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-primary">Editing debt</p>
                      <Button variant="ghost" size="sm" className="touch-target" onClick={cancelEditDebt} data-testid="button-cancel-edit-debt">
                        Cancel
                      </Button>
                    </div>
                  )}
                  <div>
                    <Label>Debt Type</Label>
                    <Select value={newDebtType} onValueChange={setNewDebtType}>
                      <SelectTrigger data-testid="select-debt-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEBT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Description (optional)</Label>
                    <Input
                      placeholder="e.g., Toyota Camry"
                      value={newDebtName}
                      onChange={(e) => setNewDebtName(e.target.value)}
                      data-testid="input-debt-name"
                    />
                  </div>
                  <div>
                    <Label>Monthly Payment</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="number"
                        placeholder="350"
                        value={newDebtAmount}
                        onChange={(e) => setNewDebtAmount(e.target.value)}
                        className="pl-9"
                        data-testid="input-debt-amount"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addDebt();
                          }
                        }}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={addDebt}
                    disabled={!newDebtAmount || parseFloat(newDebtAmount) <= 0}
                    className="w-full"
                    data-testid="button-confirm-add-debt"
                  >
                    {editingDebtId ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Update Debt
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1" />
                        Add This Debt
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <div className="flex items-center justify-between w-full">
                  <p className="text-sm text-muted-foreground">
                    Total: <span className="font-semibold text-foreground">{formatCurrency(totalDebtPayments)}/mo</span>
                  </p>
                  <Button variant="outline" onClick={() => setIsDebtDialogOpen(false)} data-testid="button-done-debts">
                    Done
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <CardDescription>
          Include car loans, student loans, credit cards, and other recurring payments
        </CardDescription>
      </CardHeader>
      <CardContent>
        {debts.length > 0 ? (
          <div className="space-y-3">
            <div className="space-y-2">
              {debts.map((debt) => {
                const Icon = debtTypeIcon(debt.type);
                return (
                  <div key={debt.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{debt.name}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(debt.monthlyPayment)}/mo</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <span className="font-medium">Total Monthly Debts</span>
              <span className="text-lg font-bold" data-testid="text-total-debts">
                {formatCurrency(totalDebtPayments)}/mo
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-2">No debts added yet</p>
            <p className="text-xs text-muted-foreground">
              Click "Add Debts" to itemize your monthly payments for a more accurate calculation
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
