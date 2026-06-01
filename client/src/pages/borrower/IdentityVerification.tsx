import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  CheckCircle2,
  Clock,
  AlertCircle,
  Fingerprint,
  FileCheck,
  Search,
  UserCheck,
  Lock,
  ChevronRight,
  AlertTriangle,
  CircleDot,
  XCircle,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface KycStatus {
  overallStatus: string;
  riskScore: number;
  ofacStatus?: string;
  sanctionsStatus?: string;
  pepStatus?: string;
  adverseMediaStatus?: string;
}

interface OnboardingStatus {
  profile: Record<string, unknown> | null;
  kba: { id: string; status: string; score: number; attemptNumber: number; maxAttempts: number } | null;
  kyc: KycStatus | null;
  verifications: Array<{ verificationType: string; status: string }>;
  borrowerType: string;
  applicationId: string | null;
  applicationStatus: string | null;
}

interface KbaQuestion {
  id: string;
  question: string;
  choices: string[];
}

function getCheckStatusIcon(status: string) {
  switch (status) {
    case "cleared":
    case "passed":
    case "verified":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "in_progress":
    case "pending":
      return <Clock className="h-4 w-4 text-amber-500" />;
    case "flagged":
      return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <CircleDot className="h-4 w-4 text-muted-foreground" />;
  }
}

function getStatusBadge(status: string) {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { variant: "secondary", label: "Not Started" },
    in_progress: { variant: "outline", label: "In Progress" },
    passed: { variant: "default", label: "Passed" },
    verified: { variant: "default", label: "Verified" },
    cleared: { variant: "default", label: "Cleared" },
    failed: { variant: "destructive", label: "Failed" },
    flagged: { variant: "destructive", label: "Flagged" },
    expired: { variant: "secondary", label: "Expired" },
    not_started: { variant: "secondary", label: "Not Started" },
  };
  const c = config[status] || { variant: "secondary" as const, label: status };
  return <Badge variant={c.variant} data-testid={`badge-status-${status}`}>{c.label}</Badge>;
}

interface KbaResult {
  passed: boolean;
  score: number;
  totalQuestions: number;
  remainingAttempts?: number;
}

function KBAFlow({ kbaStatus, applicationId, onComplete }: { kbaStatus: OnboardingStatus["kba"]; applicationId: string | null; onComplete: () => void }) {
  const [questions, setQuestions] = useState<KbaQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ questionId: string; selectedIndex: number }[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<KbaResult | null>(null);
  const { toast } = useToast();

  const startMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/onboarding/kba/start", { applicationId }),
    onSuccess: async (res) => {
      const data = await res.json();
      if (data.alreadyPassed) {
        setResult({ passed: true, score: data.session.score, totalQuestions: 5 });
        return;
      }
      setSessionId(data.session.id);
      setQuestions(data.session.questions);
      setCurrentIndex(0);
      setAnswers([]);
    },
    onError: () => toast({ title: "Error", description: "Failed to start verification", variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: (finalAnswers: { questionId: string; selectedIndex: number }[]) =>
      apiRequest("POST", `/api/onboarding/kba/${sessionId}/submit`, { answers: finalAnswers }),
    onSuccess: async (res) => {
      const data = await res.json();
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/status"] });
      if (data.passed) {
        onComplete();
        toast({ title: "Identity Verified", description: "You passed the knowledge-based authentication." });
      }
    },
    onError: () => toast({ title: "Error", description: "Failed to submit answers", variant: "destructive" }),
  });

  const handleAnswer = (selectedIndex: number) => {
    const newAnswers = [...answers, { questionId: questions[currentIndex].id, selectedIndex }];
    setAnswers(newAnswers);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      submitMutation.mutate(newAnswers);
    }
  };

  if (kbaStatus?.status === "passed" || result?.passed) {
    return (
      <div className="text-center py-6" data-testid="kba-passed">
        <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
        <p className="font-semibold text-foreground">Identity Verified</p>
        <p className="text-sm text-muted-foreground mt-1">Your identity has been confirmed through knowledge-based authentication.</p>
      </div>
    );
  }

  if (result && !result.passed) {
    return (
      <div className="text-center py-6" data-testid="kba-failed">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <p className="font-semibold text-foreground">Verification Unsuccessful</p>
        <p className="text-sm text-muted-foreground mt-1">
          You answered {result.score} of {result.totalQuestions} correctly. {(result.remainingAttempts ?? 0) > 0 ? `You have ${result.remainingAttempts} attempt(s) remaining.` : "Maximum attempts reached."}
        </p>
        {(result.remainingAttempts ?? 0) > 0 && (
          <Button onClick={() => { setResult(null); startMutation.mutate(); }} className="mt-4" data-testid="button-kba-retry">
            Try Again
          </Button>
        )}
      </div>
    );
  }

  if (questions.length > 0 && !result) {
    const q = questions[currentIndex];
    return (
      <div data-testid="kba-questions">
        <div className="flex items-center justify-between mb-4">
          <Badge variant="outline">Question {currentIndex + 1} of {questions.length}</Badge>
          <span className="text-xs text-muted-foreground">Session expires in 15 minutes</span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <p className="font-medium text-foreground mb-4" data-testid="text-kba-question">{q.question}</p>
            <div className="space-y-2">
              {q.choices.map((choice, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="w-full justify-start text-left"
                  onClick={() => handleAnswer(idx)}
                  disabled={submitMutation.isPending}
                  data-testid={`button-kba-choice-${idx}`}
                >
                  <span className="flex items-center justify-center w-6 h-6 rounded-full border text-xs font-medium mr-3 shrink-0">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  {choice}
                </Button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="flex gap-1 mt-4">
          {questions.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                idx < currentIndex ? "bg-emerald-500" : idx === currentIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-6">
      <Fingerprint className="h-12 w-12 text-primary mx-auto mb-3" />
      <p className="font-semibold text-foreground mb-2">Knowledge-Based Authentication</p>
      <p className="text-sm text-muted-foreground mb-4">
        Answer 5 security questions based on your public records to confirm your identity. You need 4 correct answers to pass.
      </p>
      {kbaStatus && kbaStatus.attemptNumber > 1 && (
        <p className="text-xs text-amber-600 mb-3">Attempt {kbaStatus.attemptNumber} of {kbaStatus.maxAttempts}</p>
      )}
      <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending} data-testid="button-kba-start">
        {startMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Begin Verification
      </Button>
    </div>
  );
}

function KYCAMLStatus({ kyc, applicationId }: { kyc: KycStatus | null; applicationId: string | null }) {
  const { toast } = useToast();

  const screenMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/onboarding/kyc/screen", { applicationId }),
    onSuccess: () => {
      toast({ title: "Screening Started", description: "Compliance checks are running. This takes about 10 seconds." });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["/api/onboarding/status"] }), 3000);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["/api/onboarding/status"] }), 6000);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["/api/onboarding/status"] }), 9000);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["/api/onboarding/status"] }), 12000);
    },
    onError: () => toast({ title: "Error", description: "Failed to start screening", variant: "destructive" }),
  });

  const checks = [
    { key: "ofac", label: "OFAC Watchlist", description: "Office of Foreign Assets Control screening", status: kyc?.ofacStatus || "pending" },
    { key: "sanctions", label: "Sanctions Screening", description: "International sanctions list check", status: kyc?.sanctionsStatus || "pending" },
    { key: "pep", label: "PEP Check", description: "Politically Exposed Person screening", status: kyc?.pepStatus || "pending" },
    { key: "adverseMedia", label: "Adverse Media", description: "Negative news and media screening", status: kyc?.adverseMediaStatus || "pending" },
  ];

  const allCleared = kyc?.overallStatus === "cleared";

  return (
    <div data-testid="kyc-status-panel">
      {allCleared && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-emerald-500/10 rounded-md" data-testid="kyc-cleared-banner">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">All Compliance Checks Passed</p>
            <p className="text-xs text-muted-foreground">Risk Score: {kyc.riskScore}/100 (Low Risk)</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {checks.map((check) => (
          <div key={check.key} className="flex items-center justify-between gap-2" data-testid={`kyc-check-${check.key}`}>
            <div className="flex items-center gap-3 min-w-0">
              {getCheckStatusIcon(check.status)}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{check.label}</p>
                <p className="text-xs text-muted-foreground truncate">{check.description}</p>
              </div>
            </div>
            {getStatusBadge(check.status)}
          </div>
        ))}
      </div>

      {!kyc || kyc.overallStatus === "pending" ? (
        <Button onClick={() => screenMutation.mutate()} disabled={screenMutation.isPending} className="w-full mt-4" data-testid="button-kyc-start">
          {screenMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          <Search className="h-4 w-4 mr-2" />
          Run Compliance Checks
        </Button>
      ) : kyc.overallStatus === "in_progress" ? (
        <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Screening in progress...</span>
        </div>
      ) : null}
    </div>
  );
}

export default function IdentityVerification() {
  const { data: status, isLoading } = useQuery<OnboardingStatus>({
    queryKey: ["/api/onboarding/status"],
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const kbaStatus = status?.kba;
  const kycData = status?.kyc;
  const verifications = status?.verifications || [];
  const applicationId = status?.applicationId || null;

  const identityVerified = kbaStatus?.status === "passed";
  const kycCleared = kycData?.overallStatus === "cleared";
  const docsVerified = verifications.some(v => v.verificationType === "identity" && v.status === "verified");

  const overallProgress = [identityVerified, kycCleared, docsVerified].filter(Boolean).length;

  const steps = [
    { id: "kba", label: "Identity Questions", complete: identityVerified },
    { id: "kyc", label: "Compliance Checks", complete: kycCleared },
    { id: "docs", label: "Document Verification", complete: docsVerified },
  ];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" data-testid="identity-verification-page">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground md:text-2xl" data-testid="text-idv-title">Identity Verification</h1>
            <p className="text-sm text-muted-foreground">Secure, automated verification to protect your identity and meet regulatory requirements.</p>
          </div>
        </div>
      </div>

      <Card className="mb-6" data-testid="card-progress-overview">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-sm font-medium text-foreground">Verification Progress</span>
            <Badge variant={overallProgress === 3 ? "default" : "outline"}>
              {overallProgress} of 3 complete
            </Badge>
          </div>
          <div className="flex gap-2">
            {steps.map((step) => (
              <div key={step.id} className="flex-1" data-testid={`step-indicator-${step.id}`}>
                <div className={`h-2 rounded-full ${step.complete ? "bg-emerald-500" : "bg-muted"}`} />
                <p className={`text-xs mt-1.5 ${step.complete ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}`}>
                  {step.label}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-kba">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Knowledge-Based Auth</CardTitle>
              </div>
              {identityVerified ? getStatusBadge("passed") : kbaStatus ? getStatusBadge(kbaStatus.status) : getStatusBadge("not_started")}
            </div>
            <CardDescription>Answer security questions to verify your identity</CardDescription>
          </CardHeader>
          <CardContent>
            <KBAFlow
              kbaStatus={kbaStatus ?? null}
              applicationId={applicationId}
              onComplete={() => queryClient.invalidateQueries({ queryKey: ["/api/onboarding/status"] })}
            />
          </CardContent>
        </Card>

        <Card data-testid="card-kyc">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">KYC / AML Screening</CardTitle>
              </div>
              {kycData ? getStatusBadge(kycData.overallStatus) : getStatusBadge("not_started")}
            </div>
            <CardDescription>Automated compliance and anti-money laundering checks</CardDescription>
          </CardHeader>
          <CardContent>
            <KYCAMLStatus kyc={kycData ?? null} applicationId={applicationId} />
          </CardContent>
        </Card>

        <Card data-testid="card-doc-verification">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Document Verification</CardTitle>
              </div>
              {docsVerified ? getStatusBadge("verified") : getStatusBadge("pending")}
            </div>
            <CardDescription>Government ID and financial document verification</CardDescription>
          </CardHeader>
          <CardContent>
            {docsVerified ? (
              <div className="text-center py-6" data-testid="docs-verified">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                <p className="font-semibold text-foreground">Documents Verified</p>
                <p className="text-sm text-muted-foreground mt-1">Your identity documents have been verified.</p>
              </div>
            ) : (
              <div className="text-center py-6">
                <FileCheck className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="font-semibold text-foreground mb-2">Verify Your Documents</p>
                <p className="text-sm text-muted-foreground mb-4">Connect your financial institution to verify your identity documents automatically.</p>
                <Button variant="outline" asChild data-testid="button-go-verification">
                  <a href="/verification">
                    Go to Verification Center
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-biometric">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Biometric Authentication</CardTitle>
              </div>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
            <CardDescription>Advanced identity confirmation via facial recognition</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold text-foreground mb-2">Enhanced Security</p>
              <p className="text-sm text-muted-foreground">
                Biometric verification adds an extra layer of protection. This feature uses facial recognition technology to ensure only you can access your mortgage application.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4" data-testid="card-security-notice">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Your data is protected</p>
              <p className="text-xs text-muted-foreground mt-1">
                All verification data is encrypted end-to-end and stored securely. We comply with GLBA, FCRA, and SOC 2 Type II standards. Your information is never shared with third parties beyond what is necessary for the verification process.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
