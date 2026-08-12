import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowRight, CheckCircle2, Home, Loader2, Mail, Save, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { writeCalculatorPrefill } from "@/lib/calculatorPrefill";
import { formatCurrency } from "@/lib/formatters";
import type { RentInputs, TierResult } from "./types";

export interface ResultsSidebarProps {
  inputs: RentInputs;
  primary: TierResult | undefined;
  loading: boolean;
}

export function ResultsSidebar({ inputs, primary, loading }: ResultsSidebarProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveEmail, setSaveEmail] = useState("");
  const [saveFirstName, setSaveFirstName] = useState("");
  const [saveLastName, setSaveLastName] = useState("");
  const [savePhone, setSavePhone] = useState("");

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/calculator-profiles", {
        email: saveEmail,
        firstName: saveFirstName || undefined,
        lastName: saveLastName || undefined,
        phone: savePhone || undefined,
        creditScore: inputs.creditScore,
        downPaymentSaved: inputs.downPaymentSaved,
        calculatorInputs: inputs,
        calculatorResults: primary,
        maxHomePrice: primary ? Math.round(primary.homePrice) : undefined,
        zipCode: inputs.zipCode || undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: "Results Saved",
        description: "Your info has been saved. When you're ready, start your pre-approval and your data will be pre-filled.",
      });
      setIsSaveDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save your results.", variant: "destructive" });
    },
  });

  const handleStartPreApproval = () => {
    if (!primary) return;
    writeCalculatorPrefill({
      downPayment: inputs.downPaymentSaved,
      creditScore: inputs.creditScore,
      purchasePrice: Math.round(primary.homePrice),
    });
    navigate(`/apply?price=${Math.round(primary.homePrice)}&source=calculator`);
  };

  return (
    <Card className="border-2 border-primary lg:sticky lg:top-4" style={{ zIndex: 10 }}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Home className="h-5 w-5" />
          Your rent could cover
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading || !primary ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Calculating your numbers...
          </div>
        ) : (
          <>
            <div>
              <p className="text-4xl font-bold text-primary" data-testid="text-home-price">
                {formatCurrency(primary.homePrice)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                A home at roughly your rent of{" "}
                <span className="font-semibold text-foreground">
                  {formatCurrency(inputs.monthlyRent)}/mo
                </span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary" data-testid="badge-rate">
                  {primary.interestRate.toFixed(3)}% rate
                </Badge>
                <Badge variant="secondary" data-testid="badge-down-pct">
                  {(primary.minDownPaymentPct * 100).toFixed(0)}% min down
                </Badge>
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Button
                size="lg"
                className="w-full"
                onClick={handleStartPreApproval}
                data-testid="button-start-preapproval"
              >
                Get Pre-Approved Now
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
                      Enter your email to save your readiness results. When you're ready to
                      apply, your information will be pre-filled — no re-entering data.
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
                      <p>Home price: {formatCurrency(primary.homePrice)}</p>
                      <p>Monthly rent: {formatCurrency(inputs.monthlyRent)}</p>
                      <p>Down payment needed: {formatCurrency(primary.downPaymentNeeded)}</p>
                      <p>Savings: {formatCurrency(inputs.downPaymentSaved)}</p>
                    </div>

                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Shield className="h-4 w-4 shrink-0 mt-0.5" />
                      <p>
                        Your information is encrypted and will only be used to pre-fill your
                        application when you're ready.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => saveProfileMutation.mutate()}
                      disabled={!saveEmail || saveProfileMutation.isPending}
                      className="w-full"
                      data-testid="button-confirm-save"
                    >
                      {saveProfileMutation.isPending ? "Saving..." : "Save Results"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
