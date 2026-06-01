import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";

import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency, formatPercent, getLoanTypeLabel } from "@/lib/formatters";
import type { LoanApplication, LoanOption } from "@shared/schema";
import {
  CheckCircle2,
  Star,
  Lock,
  TrendingUp,
  Percent,
  FileText,
  ArrowRight,
  Shield,
  Clock,
  AlertCircle,
  Download,
  Loader2,
  Rocket,
  Upload,
  UserCheck,
} from "lucide-react";

interface LoanOptionsData {
  application: LoanApplication;
  options: LoanOption[];
}

export default function LoanOptions() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<LoanOptionsData>({
    queryKey: ['/api/loan-applications', id, 'options'],
    enabled: !!id,
  });

  const lockRateMutation = useMutation({
    mutationFn: async (optionId: string) => {
      return await apiRequest("POST", `/api/loan-options/${optionId}/lock`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loan-applications', id, 'options'] });
      toast({
        title: "Rate Locked!",
        description: "Your rate has been locked for 30 days.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to lock rate. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <Skeleton className="mx-auto h-8 w-64" />
            <Skeleton className="mx-auto mt-4 h-4 w-96" />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-96 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <h2 className="mt-4 text-xl font-semibold">Unable to load loan options</h2>
          <p className="mt-2 text-muted-foreground">Please try again later.</p>
          <Link href="/apply">
            <Button className="mt-6">Start New Application</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { application, options } = data;
  const preApprovalAmount = application.preApprovalAmount 
    ? formatCurrency(application.preApprovalAmount) 
    : formatCurrency(application.purchasePrice || "0");

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-b from-primary/5 to-background py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-1.5 dark:bg-green-900/30">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                Pre-Approved
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Congratulations! You're pre-approved for
            </h1>
            <p className="mt-4 text-5xl font-bold text-primary" data-testid="text-preapproval-amount">
              {preApprovalAmount}
            </p>
            <p className="mt-4 text-muted-foreground">
              Compare your loan options below and lock in your rate today.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <GenerateLetterButton applicationId={application.id} status={application.status} />
              <PreQualLetterButton applicationId={application.id} status={application.status} />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Your Loan Options</h2>
            <p className="text-muted-foreground">
              Based on your profile, here are your best options
            </p>
          </div>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
            <Shield className="h-4 w-4" />
            <span>Rates as of today</span>
          </div>
        </div>

        {options.length === 0 ? (
          <Card className="p-12 text-center">
            <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Analyzing Your Application</h3>
            <p className="mt-2 text-muted-foreground">
              Our AI is calculating your best loan options. This usually takes less than a minute.
            </p>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {options.map((option) => (
              <Card
                key={option.id}
                className={`relative overflow-hidden ${
                  option.isRecommended ? "ring-2 ring-primary" : ""
                }`}
                data-testid={`card-loan-option-${option.loanType}`}
              >
                {option.isRecommended && (
                  <div className="absolute right-0 top-0 rounded-bl-lg bg-primary px-3 py-1">
                    <div className="flex items-center gap-1 text-xs font-medium text-primary-foreground">
                      <Star className="h-3 w-3" />
                      Recommended
                    </div>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">
                        {getLoanTypeLabel(option.loanType)}
                      </CardTitle>
                      <CardDescription>
                        {option.loanTerm}-year {parseFloat(option.points || "0") > 0 ? "with points" : "no points"}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">
                      {option.loanTerm} yr
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Monthly Payment</p>
                    <p className="text-4xl font-bold" data-testid={`text-monthly-payment-${option.loanType}`}>
                      {formatCurrency(option.monthlyPayment)}
                    </p>
                    <p className="text-xs text-muted-foreground">Principal & Interest</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Percent className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Rate</span>
                      </div>
                      <p className="text-lg font-semibold">{formatPercent(option.interestRate)}</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">APR</span>
                      </div>
                      <p className="text-lg font-semibold">{formatPercent(option.apr)}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Loan Amount</span>
                      <span className="font-medium">{formatCurrency(option.loanAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Down Payment</span>
                      <span className="font-medium">
                        {formatCurrency(option.downPaymentAmount || "0")} ({option.downPaymentPercent}%)
                      </span>
                    </div>
                    {parseFloat(option.points || "0") > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Points</span>
                        <span className="font-medium">
                          {option.points} ({formatCurrency(option.pointsCost || "0")})
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Closing Costs</span>
                      <span className="font-medium">{formatCurrency(option.closingCosts || "0")}</span>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Cash to Close</span>
                        <span className="text-lg font-bold text-primary">
                          {formatCurrency(option.cashToClose || "0")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {option.pmi && parseFloat(option.pmi) > 0 && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-900/20">
                      <p className="text-xs text-yellow-800 dark:text-yellow-200">
                        Includes ${option.pmi}/mo PMI until 20% equity
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {option.isLocked ? (
                      <Button className="w-full" variant="secondary" disabled>
                        <Lock className="mr-2 h-4 w-4" />
                        Rate Locked
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => lockRateMutation.mutate(option.id)}
                        disabled={lockRateMutation.isPending}
                        data-testid={`button-lock-rate-${option.loanType}`}
                      >
                        <Lock className="mr-2 h-4 w-4" />
                        {lockRateMutation.isPending ? "Locking..." : "Lock This Rate"}
                      </Button>
                    )}
                    <Button variant="outline" className="w-full">
                      <FileText className="mr-2 h-4 w-4" />
                      View Full Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-12 space-y-6">
          <div>
            <h2 className="text-2xl font-bold" data-testid="text-next-steps-heading">What Happens Next</h2>
            <p className="text-muted-foreground mt-1">
              {options.some(o => o.isLocked)
                ? "Great, your rate is locked. Complete these steps to finalize your mortgage."
                : "Lock your preferred rate above, then complete these steps to move forward."}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card data-testid="card-next-step-journey">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <Rocket className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">Your Journey</h3>
                    <p className="text-xs text-muted-foreground">Personalized checklist to closing</p>
                  </div>
                </div>
                <Link href="/onboarding">
                  <Button variant="outline" size="sm" className="w-full gap-2 mt-3" data-testid="button-next-journey">
                    View Journey
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card data-testid="card-next-step-documents">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <Upload className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">Upload Documents</h3>
                    <p className="text-xs text-muted-foreground">Pay stubs, tax returns, bank statements</p>
                  </div>
                </div>
                <Link href="/documents">
                  <Button variant="outline" size="sm" className="w-full gap-2 mt-3" data-testid="button-next-documents">
                    Upload Documents
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card data-testid="card-next-step-verification">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <UserCheck className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">Verify Identity</h3>
                    <p className="text-xs text-muted-foreground">Quick compliance check</p>
                  </div>
                </div>
                <Link href="/identity-verification">
                  <Button variant="outline" size="sm" className="w-full gap-2 mt-3" data-testid="button-next-verification">
                    Verify Identity
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center pt-2">
            <Link href="/dashboard">
              <Button className="gap-2" data-testid="button-go-to-dashboard">
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function PreQualLetterButton({ applicationId, status }: { applicationId: string; status: string }) {
  const { toast } = useToast();

  const prequalStatusQuery = useQuery<{ hasLetter: boolean; letterNumber?: string; estimatedAmount?: string }>({
    queryKey: ["/api/loan-applications", applicationId, "prequal-status"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/loan-applications/${applicationId}/generate-prequal`);
      return res.json();
    },
    onSuccess: (data: { letterNumber: string }) => {
      toast({ title: "Letter Generated", description: `Pre-qualification letter #${data.letterNumber} is ready.` });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-applications", applicationId, "prequal-status"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate pre-qualification letter.", variant: "destructive" });
    },
  });

  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/loan-applications/${applicationId}/prequal-pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pre-qualification-letter.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "Failed to download letter.", variant: "destructive" });
    }
  };

  const validStatuses = ["submitted", "analyzing", "pre_approved", "verified", "underwriting", "approved"];
  if (!validStatuses.includes(status)) return null;

  if (status === "pre_approved") return null;

  const hasLetter = prequalStatusQuery.data?.hasLetter;

  return (
    <>
      {!hasLetter && (
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          variant="outline"
          className="gap-2"
          data-testid="button-generate-prequal"
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {generateMutation.isPending ? "Generating..." : "Get Pre-Qualification Letter"}
        </Button>
      )}
      {hasLetter && (
        <Button onClick={handleDownload} variant="outline" className="gap-2" data-testid="button-download-prequal">
          <Download className="h-4 w-4" />
          Download Pre-Qualification Letter
        </Button>
      )}
    </>
  );
}

function GenerateLetterButton({ applicationId, status }: { applicationId: string; status: string }) {
  const { toast } = useToast();

  const letterStatusQuery = useQuery<{ hasLetter: boolean; letterNumber?: string }>({
    queryKey: ["/api/loan-applications", applicationId, "letter-status"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/loan-applications/${applicationId}/generate-letter`);
      return res.json();
    },
    onSuccess: (data: { letterNumber: string }) => {
      toast({ title: "Letter Generated", description: `Pre-approval letter #${data.letterNumber} is ready.` });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-applications", applicationId, "letter-status"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate letter. Please try again.", variant: "destructive" });
    },
  });

  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/loan-applications/${applicationId}/letter-pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pre-approval-letter.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "Failed to download letter.", variant: "destructive" });
    }
  };

  if (status !== "pre_approved") return null;

  const hasLetter = letterStatusQuery.data?.hasLetter;

  return (
    <>
      {!hasLetter && (
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="gap-2"
          data-testid="button-generate-letter"
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {generateMutation.isPending ? "Generating..." : "Generate Pre-Approval Letter"}
        </Button>
      )}
      {hasLetter && (
        <Button onClick={handleDownload} variant="outline" className="gap-2" data-testid="button-download-letter">
          <Download className="h-4 w-4" />
          Download Pre-Approval Letter
        </Button>
      )}
    </>
  );
}
