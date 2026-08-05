import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Home } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressInput } from "@/components/AddressInput";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

/** First-run state: no homeowner profile exists yet, so collect the loan and property basics. */
export function SetupForm() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    propertyAddress: "",
    originalLoanAmount: "",
    currentLoanBalance: "",
    interestRate: "",
    monthlyPayment: "",
    propertyValue: "",
    purchasePrice: "",
    purchaseDate: "",
    loanCloseDate: "",
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/homeowner/profile", formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/homeowner/profile"] });
      toast({ title: "Dashboard Created", description: "Your homeowner dashboard is ready." });
    },
    onError: () => toast({ title: "Error", description: "Failed to create profile.", variant: "destructive" }),
  });

  const update = (field: string, value: string) => setFormData((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto" data-testid="homeowner-setup">
      <div className="mb-6 text-center">
        <div className="p-3 bg-primary/10 rounded-lg inline-block mb-3">
          <Home className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground md:text-2xl" data-testid="text-setup-title">
          Your Homeowner Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1" data-testid="text-setup-subtitle">
          Set up your post-close dashboard to track equity, get refi alerts, and schedule annual reviews
        </p>
      </div>

      <Card data-testid="card-setup-form">
        <CardHeader>
          <CardTitle className="text-base">Property Information</CardTitle>
          <CardDescription>Enter your property and loan details to get started.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Property Address</label>
            <AddressInput
              placeholder="Start typing your property address..."
              className="mt-1"
              defaultValue={formData.propertyAddress}
              onSelect={(result) => update("propertyAddress", result.formattedAddress)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">Original Loan Amount</label>
              <Input
                type="number"
                value={formData.originalLoanAmount}
                onChange={(e) => update("originalLoanAmount", e.target.value)}
                placeholder="350000"
                className="mt-1"
                data-testid="input-original-loan"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Current Balance</label>
              <Input
                type="number"
                value={formData.currentLoanBalance}
                onChange={(e) => update("currentLoanBalance", e.target.value)}
                placeholder="340000"
                className="mt-1"
                data-testid="input-current-balance"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">Interest Rate (%)</label>
              <Input
                type="number"
                step="0.01"
                value={formData.interestRate}
                onChange={(e) => update("interestRate", e.target.value)}
                placeholder="6.5"
                className="mt-1"
                data-testid="input-interest-rate"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Monthly Payment</label>
              <Input
                type="number"
                value={formData.monthlyPayment}
                onChange={(e) => update("monthlyPayment", e.target.value)}
                placeholder="2200"
                className="mt-1"
                data-testid="input-monthly-payment"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">Property Value</label>
              <Input
                type="number"
                value={formData.propertyValue}
                onChange={(e) => update("propertyValue", e.target.value)}
                placeholder="450000"
                className="mt-1"
                data-testid="input-property-value"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Purchase Price</label>
              <Input
                type="number"
                value={formData.purchasePrice}
                onChange={(e) => update("purchasePrice", e.target.value)}
                placeholder="400000"
                className="mt-1"
                data-testid="input-purchase-price"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">Purchase Date</label>
              <Input
                type="date"
                value={formData.purchaseDate}
                onChange={(e) => update("purchaseDate", e.target.value)}
                className="mt-1"
                data-testid="input-purchase-date"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Loan Close Date</label>
              <Input
                type="date"
                value={formData.loanCloseDate}
                onChange={(e) => update("loanCloseDate", e.target.value)}
                className="mt-1"
                data-testid="input-loan-close-date"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!formData.propertyAddress || createMutation.isPending}
              data-testid="button-setup-dashboard"
            >
              {createMutation.isPending ? "Setting Up..." : "Set Up Dashboard"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
