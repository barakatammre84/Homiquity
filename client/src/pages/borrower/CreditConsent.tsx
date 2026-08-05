import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, loanApplicationKeys } from "@/lib/queryClient";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Shield } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { QueryErrorState } from "@/components/ui/query-boundary";
import type { LoanApplication } from "@shared/schema";
import { draftStep, type CreditSummary, type DisclosureData, type DraftData } from "./creditConsent/types";
import { ActiveConsentCard } from "./creditConsent/ActiveConsentCard";
import { DisclosureCard, DraftResumeAlert } from "./creditConsent/DisclosureCard";
import { AuthorizationForm } from "./creditConsent/AuthorizationForm";
import { FcraRightsCard } from "./creditConsent/FcraRightsCard";
import { runBusy } from "./creditConsent/runBusy";

export default function CreditConsent() {
  const { id: applicationId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [ssnLast4, setSsnLast4] = useState("");
  const [dob, setDob] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [disclosureRead, setDisclosureRead] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const {
    data: application,
    isLoading: appLoading,
    isError: appError,
    error: appErrorObj,
    refetch: refetchApp,
  } = useQuery<LoanApplication>({
    queryKey: loanApplicationKeys.detail(applicationId),
    enabled: !!applicationId,
  });

  const {
    data: disclosure,
    isLoading: disclosureLoading,
    isError: disclosureError,
    error: disclosureErrorObj,
    refetch: refetchDisclosure,
  } = useQuery<DisclosureData>({
    queryKey: ["/api/credit/disclosure"],
    enabled: !!applicationId,
  });

  const { data: creditSummary, isLoading: summaryLoading } = useQuery<CreditSummary>({
    queryKey: loanApplicationKeys.credit.summary(applicationId),
    enabled: !!applicationId,
  });

  const { data: draftData, isLoading: draftLoading } = useQuery<DraftData>({
    queryKey: loanApplicationKeys.credit.draft(applicationId),
    enabled: !!applicationId,
  });

  useEffect(() => {
    if (draftData?.draft && !draftLoaded) {
      const draft = draftData.draft;
      if (draft.borrowerFullName) setFullName(draft.borrowerFullName);
      if (draft.borrowerSSNLast4) setSsnLast4(draft.borrowerSSNLast4);
      if (draft.borrowerDOB) setDob(draft.borrowerDOB);
      if (draft.acknowledged) setAcknowledged(draft.acknowledged);
      if (draft.disclosureRead) setDisclosureRead(draft.disclosureRead);
      setDraftLoaded(true);
    }
  }, [draftData, draftLoaded]);

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/loan-applications/${applicationId}/credit/draft`, {
        borrowerFullName: fullName,
        borrowerSSNLast4: ssnLast4,
        borrowerDOB: dob,
        disclosureRead,
        acknowledged,
        currentStep: draftStep(disclosureRead, acknowledged),
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.credit.draft(applicationId) });
      toast({
        title: "Progress Saved",
        description: "Your consent form progress has been saved. You can return anytime to complete it.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save progress",
        variant: "destructive",
      });
    },
  });

  const handleSaveDraft = () => runBusy(setSaving, () => saveDraftMutation.mutateAsync());

  const submitConsentMutation = useMutation({
    mutationFn: async (consentGiven: boolean) => {
      const response = await apiRequest("POST", `/api/loan-applications/${applicationId}/credit/consent`, {
        consentType: "hard_pull",
        borrowerFullName: fullName,
        borrowerSSNLast4: ssnLast4,
        borrowerDOB: dob,
        consentGiven,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.credit.root(applicationId) });
      toast({
        title: "Consent Recorded",
        description: "Your credit authorization has been recorded successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit consent",
        variant: "destructive",
      });
    },
  });

  const handleSubmitConsent = () => {
    if (!fullName.trim()) {
      toast({
        title: "Required Field",
        description: "Please enter your full legal name",
        variant: "destructive",
      });
      return;
    }

    if (!acknowledged) {
      toast({
        title: "Acknowledgment Required",
        description: "Please acknowledge that you have read and understood the disclosure",
        variant: "destructive",
      });
      return;
    }

    void runBusy(setSubmitting, () => submitConsentMutation.mutateAsync(true));
  };

  const isLoading = appLoading || disclosureLoading || summaryLoading || draftLoading;

  if (isLoading) {
    return (
      <PageShell width="content" contentClassName="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </PageShell>
    );
  }

  // A fetch failure on `application` used to be indistinguishable from a
  // genuine 404 below — right at a page that authorizes a credit pull, that's
  // the worst place to tell a borrower their file vanished when the real
  // problem is a transient network error (ux-10).
  if (appError || disclosureError) {
    return (
      <PageShell width="content">
        <QueryErrorState
          error={appErrorObj ?? disclosureErrorObj}
          onRetry={() => {
            if (appError) refetchApp();
            if (disclosureError) refetchDisclosure();
          }}
          title="We couldn't load this page"
          data-testid="credit-consent-error"
        />
      </PageShell>
    );
  }

  if (!application) {
    return (
      <PageShell width="content">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Application Not Found</h2>
            <p className="text-muted-foreground">The loan application could not be found.</p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const hasActiveConsent = creditSummary?.hasActiveConsent;
  const consent = creditSummary?.consent;
  const latestPull = creditSummary?.latestPull;

  return (
    <PageShell
      width="content"
      icon={<Shield className="h-8 w-8 text-primary" />}
      title="Credit Authorization"
      subtitle="FCRA-compliant credit disclosure and consent"
      titleTestId="text-credit-auth-title"
      contentClassName="space-y-6"
    >
      {hasActiveConsent && <ActiveConsentCard consent={consent} latestPull={latestPull} />}

      {!hasActiveConsent && (
        <>
          {draftData?.draft && <DraftResumeAlert draft={draftData.draft} />}

          <DisclosureCard disclosure={disclosure} />

          <AuthorizationForm
            fullName={fullName}
            onFullNameChange={setFullName}
            ssnLast4={ssnLast4}
            onSsnLast4Change={setSsnLast4}
            dob={dob}
            onDobChange={setDob}
            acknowledged={acknowledged}
            onAcknowledgedChange={setAcknowledged}
            submitting={submitting}
            saving={saving}
            onSubmit={handleSubmitConsent}
            onSaveDraft={handleSaveDraft}
            onCancel={() => setLocation("/dashboard")}
          />
        </>
      )}

      <FcraRightsCard />
    </PageShell>
  );
}
