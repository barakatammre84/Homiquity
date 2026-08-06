import { useState } from "react";
import { useMutation} from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertTriangle, ArrowRight, CheckCircle2, Home, Mail, Save, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PRELAUNCH_GATED } from "@/lib/prelaunch";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import type { AffordabilityInputs, AffordabilityResults, DebtItem } from "./types";

export interface ResultsSidebarProps {
  inputs: AffordabilityInputs;
  debts: DebtItem[];
  results: AffordabilityResults;
}

export function ResultsSidebar({ inputs, debts, results }: ResultsSidebarProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveEmail, setSaveEmail] = useState("");
  const [saveFirstName, setSaveFirstName] = useState("");
  const [saveLastName, setSaveLastName] = useState("");
  const [savePhone, setSavePhone] = useState("");

  const saveResultsMutation = useMutation({
    mutationFn: async (data: { inputs: AffordabilityInputs; results: AffordabilityResults }) => {
      return apiRequest("POST", "/api/calculator-results", {
        calculatorType: "affordability",
        inputs: data.inputs,
        results: data.results,
      });
    },
    onSuccess: () => {
      toast({ title: "Results Saved", description: "Your affordability analysis has been saved." });
      // No calculatorResultKeys.all() invalidation: POST /api/calculator-results
      // saves the result, but no client surface QUERIES the saved-results list, so
      // the invalidation matched nothing (guard:querykeys reachability). Re-add it
      // here when a "my saved calculations" view lands.
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save results.", variant: "destructive" });
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/calculator-profiles", {
        email: saveEmail,
        firstName: saveFirstName || undefined,
        lastName: saveLastName || undefined,
        phone: savePhone || undefined,
        annualIncome: inputs.annualIncome,
        monthlyDebts: inputs.monthlyDebts,
        creditScore: inputs.creditScore,
        downPaymentSaved: inputs.downPaymentSaved,
        debts: debts.map((d) => ({ type: d.type, name: d.name, monthlyPayment: d.monthlyPayment })),
        calculatorInputs: inputs,
        calculatorResults: results,
        maxHomePrice: Math.round(results.maxHomePrice),
        zipCode: inputs.zipCode || undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: "Profile Saved",
        description: "Your info has been saved. When you're ready, start your pre-approval and your data will be pre-filled.",
      });
      setIsSaveDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save profile.", variant: "destructive" });
    },
  });

  const handleStartPreApproval = () => {
    if (user) {
      saveResultsMutation.mutate({ inputs, results });
    }
    try {
      sessionStorage.setItem("calculatorPrefill", JSON.stringify({
        annualIncome: inputs.annualIncome,
        monthlyDebts: inputs.monthlyDebts,
        downPayment: inputs.downPaymentSaved,
        creditScore: inputs.creditScore,
        purchasePrice: Math.round(results.maxHomePrice),
      }));
    } catch {}
    navigate(
      PRELAUNCH_GATED ? "/" : `/apply?price=${Math.round(results.maxHomePrice)}&source=calculator`
    );
  };

  return (
    <Card className="border-2 border-primary lg:sticky lg:top-4" style={{ zIndex: 10 }}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Home className="h-5 w-5" />
          You can afford up to
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-4xl font-bold text-primary" data-testid="text-max-price">
            {formatCurrency(results.maxHomePrice)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Estimated monthly: <span className="font-semibold text-foreground">{formatCurrency(results.monthlyPITI)}/mo</span>
          </p>
          <div className="mt-3">
            {results.withinGuidelines ? (
              <Badge variant="secondary">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Within lending guidelines
              </Badge>
            ) : (
              <Badge variant="secondary">
                <AlertTriangle className="h-3 w-3 mr-1" />
                DTI may require review
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-2 border-t pt-4">
          <Button
            size="lg"
            className="w-full"
            onClick={handleStartPreApproval}
            data-testid="button-start-preapproval"
          >
            {PRELAUNCH_GATED ? "Join the Waitlist" : "Get Pre-Approved Now"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full" data-testid="button-save-profile">
                <Save className="h-4 w-4 mr-2" />
                Save My Results
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>Save Your Results</DialogTitle>
                <DialogDescription>
                  Enter your email to save your affordability profile. When you're ready to apply, your information will be pre-filled — no re-entering data.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="save-email">Email</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="save-email"
                      type="email"
                      placeholder="you@example.com"
                      value={saveEmail}
                      onChange={(e) => setSaveEmail(e.target.value)}
                      className="pl-9"
                      data-testid="input-save-email"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="save-first">First Name</Label>
                    <Input
                      id="save-first"
                      placeholder="John"
                      value={saveFirstName}
                      onChange={(e) => setSaveFirstName(e.target.value)}
                      data-testid="input-save-first-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="save-last">Last Name</Label>
                    <Input
                      id="save-last"
                      placeholder="Smith"
                      value={saveLastName}
                      onChange={(e) => setSaveLastName(e.target.value)}
                      data-testid="input-save-last-name"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="save-phone">Phone (Optional)</Label>
                  <Input
                    id="save-phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={savePhone}
                    onChange={(e) => setSavePhone(e.target.value)}
                    data-testid="input-save-phone"
                  />
                </div>

                <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">What we'll save:</p>
                  <p>Max home price: {formatCurrency(results.maxHomePrice)}</p>
                  <p>Income: {formatCurrency(inputs.annualIncome)}/yr</p>
                  <p>Monthly debts: {formatCurrency(inputs.monthlyDebts)}</p>
                  <p>Down payment: {formatCurrency(inputs.downPaymentSaved)}</p>
                </div>

                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Shield className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>Your information is encrypted and will only be used to pre-fill your application when you're ready.</p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => saveProfileMutation.mutate()}
                  disabled={!saveEmail || saveProfileMutation.isPending}
                  className="w-full"
                  data-testid="button-confirm-save"
                >
                  {saveProfileMutation.isPending ? "Saving..." : "Save Profile"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {user && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => saveResultsMutation.mutate({ inputs, results })}
              disabled={saveResultsMutation.isPending}
              data-testid="button-save-results"
            >
              Save to My Account
            </Button>
          )}
        </div>

        <div className="flex items-center justify-center gap-4 border-t pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Encrypted
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            No Credit Impact
          </span>
          <span className="flex items-center gap-1">
            <Home className="h-3 w-3" />
            Equal Housing
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
