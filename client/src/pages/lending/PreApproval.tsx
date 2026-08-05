import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, Link } from "wouter";
import { SEOHead } from "@/components/SEOHead";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { preApprovalFormSchema, type PreApprovalFormData, type RentalPropertyEntry, type IncomeSourceEntry } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, loanApplicationKeys, dashboardKeys } from "@/lib/queryClient";
import { friendlyApiError } from "@/lib/errorMessage";
import { maskCurrencyDigits } from "@/lib/formatters";
import {
  PREAPPROVAL_AUTOSAVE_KEY as AUTOSAVE_KEY,
  PREAPPROVAL_STEP_KEY as AUTOSAVE_STEP_KEY,
  PREAPPROVAL_PENDING_SUBMIT_KEY as PENDING_SUBMIT_KEY,
} from "@/lib/pendingAttribution";
import { useAuth } from "@/hooks/useAuth";
import { usePageView, useTrackActivity, useTrackFormStart, useTrackFormAbandon } from "@/hooks/useActivityTracker";
import {
  ArrowRight,
  ChevronLeft,
  DollarSign,
  Home,
  Loader2,
  Check,
  AlertCircle,
  Info,
} from "lucide-react";

import { FunnelProvider, useFunnel } from "@/funnel/FunnelContext";
import { PRE_APPROVAL_DEFAULTS } from "@/funnel/preApprovalMachine";
import { useFunnelAutosave } from "@/funnel/useFunnelAutosave";
import { VerificationPulse } from "@/funnel/VerificationPulse";
import { Checkbox } from "@/components/ui/checkbox";
import { QUESTIONS_BY_ID } from "./preApproval/questions";
import { AdvisoryPanel, getDynamicTitle, ADVISORY_HIDDEN_STEPS } from "./preApproval/AdvisoryPanel";
import { useDraftRestore } from "./preApproval/useDraftRestore";
import { useServerDraftAutosave } from "./preApproval/useServerDraftAutosave";
import { useCoachPrefill, type CoachIntake } from "./preApproval/coachPrefill";
import { StateStep } from "./preApproval/StateStep";
import { IncomeSourcesStep } from "./preApproval/IncomeSourcesStep";
import { RestoreDraftBanner, AuthGateOverlay, AffordabilityTeaserOverlay, FunnelFooter } from "./preApproval/FunnelChrome";
import { calculateAffordabilityEstimate, type AffordabilityEstimateResults } from "@/lib/affordabilityEstimate";
import { buildTeaserInputs, parseTargetPrice } from "./preApproval/affordabilityTeaser";

export default function PreApproval() {
  return (
    <FunnelProvider initialAnswers={PRE_APPROVAL_DEFAULTS}>
      <PreApprovalFunnel />
    </FunnelProvider>
  );
}

function PreApprovalFunnel() {
  const {
    stepId,
    flags,
    progress,
    next,
    back,
    goTo,
    hydrate,
    syncAnswers,
    setConsent,
    checkGate,
    state: funnelState,
  } = useFunnel();
  const direction = funnelState.direction;
  const [selectedIncomeTypes, setSelectedIncomeTypes] = useState<string[]>([]);
  const [incomeDetails, setIncomeDetails] = useState<Record<string, { annualAmount: string; employerName: string; yearsInRole: string }>>({});
  const [rentalProperties, setRentalProperties] = useState<RentalPropertyEntry[]>([]);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  usePageView("/apply");
  const track = useTrackActivity();
  const trackFormStart = useTrackFormStart();
  useTrackFormAbandon("preapproval", progress.index > 0 && stepId !== "final");
  const prevStepRef = useRef(0);

  const urlParams = new URLSearchParams(window.location.search);
  const urlType = urlParams.get("type");
  const urlPrice = urlParams.get("price");
  const urlState = urlParams.get("state");
  const urlPropertyType = urlParams.get("propertyType");
  const urlPropertyId = urlParams.get("propertyId");
  const urlSource = urlParams.get("source");
  const defaultLoanPurpose = urlType === "refinance" ? "refinance" : urlType === "heloc" ? "cash_out" : "purchase";

  const inviteId = useRef(sessionStorage.getItem("inviteId"));

  const form = useForm<PreApprovalFormData>({
    resolver: zodResolver(preApprovalFormSchema),
    mode: "onChange",
    defaultValues: {
      annualIncome: "",
      // /self-employed pre-screens income shape; honor it so those borrowers
      // land with the right employment type preselected (still editable at
      // its step — the route recomputes if they change it).
      employmentType: urlType === "self-employed" ? "self_employed" : "employed",
      employmentYears: "",
      monthlyDebts: "",
      creditScore: "",
      loanPurpose: defaultLoanPurpose,
      propertyType: (urlPropertyType as any) || "single_family",
      purchasePrice: urlPrice || "",
      downPayment: "",
      // /va-loans and /first-time-buyer pre-screen these; honor them so
      // borrowers aren't asked twice (checkboxes stay editable at their step).
      isVeteran: urlType === "va",
      isFirstTimeBuyer: urlType === "first-time",
      avoidsInterestFinancing: false,
      propertyState: urlState || "",
      hasAdditionalIncome: false,
      incomeSources: [],
    },
  });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("calculatorPrefill");
      if (!raw) return;
      const prefill = JSON.parse(raw);
      sessionStorage.removeItem("calculatorPrefill");
      const current = form.getValues();
      if (prefill.annualIncome && !current.annualIncome) {
        form.setValue("annualIncome", String(prefill.annualIncome));
      }
      if (prefill.monthlyDebts && !current.monthlyDebts) {
        form.setValue("monthlyDebts", String(prefill.monthlyDebts));
      }
      if (prefill.downPayment && !current.downPayment) {
        form.setValue("downPayment", String(prefill.downPayment));
      }
      if (prefill.creditScore && !current.creditScore) {
        const score = prefill.creditScore;
        const bucket = score >= 740 ? "excellent" : score >= 700 ? "good" : score >= 660 ? "fair" : "poor";
        form.setValue("creditScore", bucket);
      }
      if (prefill.purchasePrice && !current.purchasePrice) {
        form.setValue("purchasePrice", String(prefill.purchasePrice));
      }
    } catch {}
  }, []);

  // Draft/step/pending-submit keys now live in @/lib/pendingAttribution so the
  // post-auth router (getPostAuthRoute) can detect a deferred submit too.
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [teaser, setTeaser] = useState<{ estimate: AffordabilityEstimateResults; targetPrice: number | null } | null>(null);

  const hasMeaningfulData = useCallback((values: PreApprovalFormData) => {
    return Object.entries(values).some(([k, v]) => {
      if (k === "isVeteran" || k === "isFirstTimeBuyer" || k === "avoidsInterestFinancing") return false;
      if (k === "employmentType" && v === "employed") return false;
      if (k === "propertyType" && v === "single_family") return false;
      if (k === "loanPurpose" && v === defaultLoanPurpose) return false;
      return typeof v === "string" && v.length > 0;
    });
  }, [defaultLoanPurpose]);

  const clearAutosave = useCallback(() => {
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
      localStorage.removeItem(AUTOSAVE_STEP_KEY);
      localStorage.removeItem(PENDING_SUBMIT_KEY);
    } catch {}
  }, []);

  // The pending key is consumed synchronously below, but the restore offer
  // must stay suppressed for the rest of this mount while the deferred
  // auto-submit runs — the ref outlives the key.
  const pendingSubmitRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      const pending = localStorage.getItem(PENDING_SUBMIT_KEY);
      if (!pending) return;
      pendingSubmitRef.current = true;
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (!saved) { localStorage.removeItem(PENDING_SUBMIT_KEY); return; }
      const formData = JSON.parse(saved) as PreApprovalFormData;
      form.reset(formData);
      localStorage.removeItem(PENDING_SUBMIT_KEY);
      // The pending marker is only ever written after the final-step consent
      // gate passed, so restore the acknowledgment for the deferred submit.
      setConsent(true);
      setTimeout(() => {
        submitMutation.mutate(formData);
      }, 500);
    } catch {
      localStorage.removeItem(PENDING_SUBMIT_KEY);
    }
  }, [isAuthenticated]);

  const currentQ = QUESTIONS_BY_ID[stepId];

  const watchedValues = form.watch();
  const dynamicTitle = useMemo(() => getDynamicTitle(currentQ, watchedValues), [currentQ, watchedValues]);

  // Mirror form values into the machine so routing always sees the latest
  // answers (guarded so an unchanged snapshot doesn't dispatch every render).
  const lastSyncedRef = useRef("");
  useEffect(() => {
    const snapshot = JSON.stringify(watchedValues);
    if (snapshot !== lastSyncedRef.current) {
      lastSyncedRef.current = snapshot;
      syncAnswers(watchedValues);
    }
  }, [watchedValues, syncAnswers]);

  // A blocked NEXT (validation gate) surfaces as a toast.
  useEffect(() => {
    if (funnelState.blockedGate) {
      toast({
        title: "One more thing",
        description: funnelState.blockedGate.errors[0],
        variant: "destructive",
      });
    }
  }, [funnelState.blockedGate, toast]);

  const { readSaved } = useFunnelAutosave<PreApprovalFormData>({
    storageKey: AUTOSAVE_KEY,
    stepStorageKey: AUTOSAVE_STEP_KEY,
    values: watchedValues,
    stepId,
    enabled: stepId !== "intro",
    shouldPersist: hasMeaningfulData,
  });

  // Rebuild the income-sources step's UI stores from restored entries — they
  // mirror form.incomeSources (see the income_sources case in renderInput), so
  // a restore has to reseed them or the step renders empty.
  const applyIncomeSources = useCallback((sources: PreApprovalFormData["incomeSources"]) => {
    if (!Array.isArray(sources) || sources.length === 0) return;
    const types: string[] = [];
    const details: Record<string, { annualAmount: string; employerName: string; yearsInRole: string }> = {};
    let rentals: RentalPropertyEntry[] = [];
    for (const src of sources) {
      types.push(src.type);
      details[src.type] = {
        annualAmount: src.annualAmount || "",
        employerName: src.employerName || "",
        yearsInRole: src.yearsInRole || "",
      };
      if (src.type === "rental" && Array.isArray(src.rentalProperties)) {
        rentals = src.rentalProperties;
      }
    }
    setSelectedIncomeTypes(types);
    setIncomeDetails(details);
    if (rentals.length > 0) {
      setRentalProperties(rentals);
    }
  }, []);

  const hasPendingSubmit = useCallback(() => {
    if (pendingSubmitRef.current) return true;
    try {
      return !!localStorage.getItem(PENDING_SUBMIT_KEY);
    } catch {
      return false;
    }
  }, []);

  // A1: the server-draft container id — adopted from useDraftRestore when a
  // prior draft exists, or minted by the server autosave's find-or-create.
  const [adoptedDraftId, setAdoptedDraftId] = useState<string | null>(null);

  const {
    applicationId,
    showRestoreBanner,
    restore: handleRestoreDraft,
    dismiss: handleDismissRestore,
  } = useDraftRestore({
    form,
    isAuthenticated,
    hasPendingSubmit,
    readSaved,
    clearAutosave,
    applyIncomeSources,
    goTo,
    hydrate,
    toast,
  });

  useEffect(() => {
    if (progress.index !== prevStepRef.current && progress.index > 0) {
      track("preapproval_step", "/apply", {
        step: progress.index,
        step_id: stepId,
        total: progress.total,
      });
      prevStepRef.current = progress.index;
    }
  }, [progress.index, progress.total, stepId, track]);

  // Load coach intake data to gap-fill fields the borrower has left blank.
  const { data: coachIntake } = useQuery<{
    intake: CoachIntake | null;
    readinessTier?: string;
    completionPercentage?: number;
  } | null>({
    queryKey: ["/api/coach/intake/latest"],
    enabled: isAuthenticated,
  });

  // Gap-fill from the coach conversation's intake: blank fields only, never an
  // answer the borrower already gave (see preApproval/coachPrefill.ts for the
  // rule and the overwrite bug it replaces). Saved-draft answers are
  // deliberately NOT applied here — adopting a draft (data + PATCH target) is
  // consent-gated through useDraftRestore's banner.
  useCoachPrefill(form, coachIntake?.intake);

  // Create/update application mutation
  const submitMutation = useMutation({
    mutationFn: async (data: PreApprovalFormData) => {
      const payload: Record<string, unknown> = {
        ...data,
        annualIncome: data.annualIncome.replace(/,/g, ""),
        purchasePrice: data.purchasePrice.replace(/,/g, ""),
        downPayment: data.downPayment.replace(/,/g, ""),
        monthlyDebts: data.monthlyDebts.replace(/,/g, ""),
        // FCRA soft-pull authorization from the final step — persisted
        // server-side as a credit_consents evidence row (IP, UA, disclosure).
        softPullConsentAccepted: funnelState.consent.softPullAcknowledged,
      };

      if (inviteId.current) {
        payload.inviteId = inviteId.current;
      }

      // Always POST — the intake route consumes the user's existing draft
      // container server-side (updating it and flipping draft → submitted
      // through the pipeline engine with the full intake side effects). The
      // old client-side PATCH branch skipped the status flip, analysis, and
      // notifications entirely, leaving the "submitted" application in draft.
      const response = await apiRequest("POST", "/api/loan-applications", payload);
      return response.json();
    },
    onSuccess: async (result) => {
      clearAutosave();
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.all() });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.root() });

      if (inviteId.current) {
        sessionStorage.removeItem("inviteId");
        sessionStorage.removeItem("prefillName");
        sessionStorage.removeItem("prefillEmail");
      }

      toast({
        title: "Application submitted",
        description: "Your numbers were run against underwriting guidelines — no AI, just math.",
      });
      navigate(`/loan-options/${result.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: friendlyApiError(error, "Failed to submit application. Please try again."),
        variant: "destructive",
      });
    },
  });

  // A1: authenticated progress also persists to the ONE server draft row, so
  // a device switch doesn't lose the application. Disabled once a submit is
  // in flight — the intake route consumes the draft at that point.
  useServerDraftAutosave({
    isAuthenticated,
    values: watchedValues,
    enabled: stepId !== "intro" && !submitMutation.isPending && !submitMutation.isSuccess,
    hasMeaningfulData,
    applicationId: applicationId ?? adoptedDraftId,
    onDraftAdopted: setAdoptedDraftId,
  });

  const handleNext = async () => {
    if (currentQ.type === "intro") {
      trackFormStart("preapproval");
      next(form.getValues());
      return;
    }

    if (currentQ.type === "final") {
      const isValid = await form.trigger();
      const gate = checkGate("final", form.getValues());
      if (!isValid || !gate.ok) {
        toast({
          title: "Please complete all fields",
          description: gate.errors[0] ?? "Some required information is missing.",
          variant: "destructive",
        });
        return;
      }
      if (!isAuthenticated) {
        try {
          localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(form.getValues()));
          localStorage.setItem(AUTOSAVE_STEP_KEY, stepId);
          localStorage.setItem(PENDING_SUBMIT_KEY, "true");
        } catch {}
        const values = form.getValues();
        const teaserInputs = buildTeaserInputs(values);
        if (teaserInputs) {
          setTeaser({
            estimate: calculateAffordabilityEstimate(teaserInputs),
            targetPrice: parseTargetPrice(values.purchasePrice),
          });
        } else {
          setShowAuthGate(true);
        }
        return;
      }
      submitMutation.mutate(form.getValues());
      return;
    }

    // boolean_pair and incomeSources have no single field to trigger; the
    // machine's step gate validates them (and everything else) inside NEXT.
    if (currentQ.type === "boolean_pair" || currentQ.id === "incomeSources") {
      next(form.getValues());
      return;
    }

    if (currentQ.field) {
      const isValid = await form.trigger(currentQ.field);
      if (isValid) {
        next(form.getValues());
      } else {
        toast({
          title: "Please fill out this field",
          description: "This information is required to continue.",
          variant: "destructive"
        });
      }
    }
  };

  const handleBack = () => {
    if (progress.index > 0) {
      back(form.getValues());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && currentQ.type !== "choice" && currentQ.type !== "state" && currentQ.type !== "income_sources") {
      e.preventDefault();
      handleNext();
    }
  };

  const renderInput = () => {
    const IconComponent = currentQ.icon;

    switch (currentQ.type) {
      case "currency": {
        const fieldName = currentQ.field as keyof PreApprovalFormData;
        const watchedValue = form.watch(fieldName);
        const displayValue = typeof watchedValue === 'string' ? watchedValue : "";
        const fieldError = form.formState.errors[fieldName];
        return (
          <div className="w-full max-w-md mx-auto">
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 text-primary" />
              <Input
                key={`currency-${fieldName}`}
                autoFocus
                data-testid={`input-${currentQ.field}`}
                value={displayValue}
                onChange={(e) => {
                  const formatted = maskCurrencyDigits(e.target.value);
                  form.setValue(fieldName, formatted as never, { shouldValidate: true, shouldDirty: true });
                }}
                className={`pl-16 h-20 text-4xl border-0 border-b-2 rounded-none focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/40 ${fieldError ? "border-destructive focus-visible:border-destructive" : "border-muted focus-visible:border-primary"}`}
                placeholder={currentQ.placeholder}
                onKeyDown={handleKeyDown}
              />
            </div>
            {fieldError && (
              <p role="alert" className="mt-2 text-sm text-destructive flex items-center gap-1.5" data-testid={`error-${currentQ.field}`}>
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {fieldError.message as string}
              </p>
            )}
          </div>
        );
      }

      case "number": {
        const fieldName = currentQ.field as keyof PreApprovalFormData;
        const watchedValue = form.watch(fieldName);
        const displayValue = typeof watchedValue === 'string' ? watchedValue : "";
        const fieldError = form.formState.errors[fieldName];
        return (
          <div className="w-full max-w-md mx-auto">
            <div className="relative">
              {IconComponent && <IconComponent className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 text-primary" />}
              <Input
                key={`number-${fieldName}`}
                autoFocus
                data-testid={`input-${currentQ.field}`}
                type="text"
                inputMode="numeric"
                value={displayValue}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  form.setValue(fieldName, value as never, { shouldValidate: true, shouldDirty: true });
                }}
                className={`pl-16 h-20 text-4xl border-0 border-b-2 rounded-none focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/40 ${fieldError ? "border-destructive focus-visible:border-destructive" : "border-muted focus-visible:border-primary"}`}
                placeholder={currentQ.placeholder}
                onKeyDown={handleKeyDown}
              />
            </div>
            {fieldError && (
              <p role="alert" className="mt-2 text-sm text-destructive flex items-center gap-1.5" data-testid={`error-${currentQ.field}`}>
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {fieldError.message as string}
              </p>
            )}
          </div>
        );
      }

      case "choice":
        return (
          <div className="grid gap-3 w-full max-w-lg mx-auto">
            {currentQ.options?.map((option) => {
              const OptionIcon = option.icon;
              const fieldVal = form.watch(currentQ.field as keyof PreApprovalFormData);
              const isSelected = currentQ.id === "hasAdditionalIncome"
                ? (option.value === "yes" ? fieldVal === true : fieldVal === false)
                : fieldVal === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  data-testid={`option-${currentQ.field}-${option.value}`}
                  onClick={() => {
                    if (currentQ.id === "hasAdditionalIncome") {
                      form.setValue("hasAdditionalIncome", (option.value === "yes") as never);
                      if (option.value === "no") {
                        form.setValue("incomeSources", [] as never);
                      }
                    } else {
                      form.setValue(currentQ.field as keyof PreApprovalFormData, option.value as never);
                    }
                    // The machine recomputes the route from the answers, so
                    // injected steps (complex income) appear/disappear here.
                    setTimeout(() => next(form.getValues()), 200);
                  }}
                  className={`flex items-center gap-4 p-5 text-left text-lg font-medium border-2 rounded-xl transition-all duration-200 group hover:scale-[1.02] active:scale-[0.99]
                    ${isSelected
                      ? "border-primary bg-primary/5"
                      : "border-transparent bg-muted/40 hover:bg-muted"
                    }`}
                >
                  {OptionIcon && (
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors
                      ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"}`}>
                      <OptionIcon className="h-5 w-5" />
                    </div>
                  )}
                  <span className={`flex-1 ${isSelected ? "text-primary" : "text-foreground"}`}>
                    {option.label}
                  </span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                    ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                    {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                </button>
              );
            })}
          </div>
        );

      case "state":
        return (
          <StateStep
            value={form.watch("propertyState")}
            onSelectState={(v) => form.setValue("propertyState", v, { shouldValidate: true })}
            onAdvance={() => next(form.getValues())}
          />
        );

      case "income_sources": {
        return (
          <IncomeSourcesStep
            employmentType={form.getValues("employmentType")}
            selectedIncomeTypes={selectedIncomeTypes}
            incomeDetails={incomeDetails}
            rentalProperties={rentalProperties}
            setSelectedIncomeTypes={setSelectedIncomeTypes}
            setIncomeDetails={setIncomeDetails}
            setRentalProperties={setRentalProperties}
            setIncomeSources={(entries) => form.setValue("incomeSources", entries as never)}
          />
        );
      }

      case "boolean_pair":
        return (
          <div className="grid gap-4 w-full max-w-lg mx-auto">
            {currentQ.booleanFields?.map((field) => {
              const FieldIcon = field.icon;
              const isChecked = form.watch(field.field) as boolean;
              return (
                <button
                  key={field.field}
                  type="button"
                  data-testid={`toggle-${field.field}`}
                  onClick={() => {
                    form.setValue(field.field, !isChecked as never);
                  }}
                  className={`flex items-center gap-4 p-5 text-left text-lg font-medium border-2 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]
                    ${isChecked 
                      ? "border-primary bg-primary/5" 
                      : "border-muted hover:border-primary/50"
                    }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors
                    ${isChecked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <FieldIcon className="h-5 w-5" />
                  </div>
                  <span className={`flex-1 ${isChecked ? "text-primary" : "text-foreground"}`}>
                    {field.label}
                  </span>
                  <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors
                    ${isChecked ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                    {isChecked && <Check className="w-4 h-4 text-primary-foreground" />}
                  </div>
                </button>
              );
            })}
          </div>
        );

      case "final": {
        const acknowledged = funnelState.consent.softPullAcknowledged;
        return (
          <div className="w-full max-w-md mx-auto text-left">
            <label
              className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors
                ${acknowledged ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"}`}
              data-testid="label-soft-pull-consent"
            >
              <Checkbox
                checked={acknowledged}
                onCheckedChange={(checked) => setConsent(checked === true)}
                className="mt-0.5"
                data-testid="checkbox-soft-pull-consent"
              />
              <span className="text-sm text-muted-foreground leading-relaxed">
                I authorize Homiquity to obtain my credit report using a{" "}
                <span className="font-medium text-foreground">soft inquiry</span>, which will not
                affect my credit score. This authorization is required by the Fair Credit
                Reporting Act (FCRA) and is not an application for credit.
              </span>
            </label>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const restoreBanner = showRestoreBanner ? (
    <RestoreDraftBanner onRestore={handleRestoreDraft} onDismiss={handleDismissRestore} />
  ) : null;

  if (currentQ.type === "intro") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-center">
        {restoreBanner}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl"
        >
          <div className="mb-8 flex justify-center">
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center">
              <Home className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h1 
            className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-6"
            data-testid="text-intro-title"
          >
            {currentQ.title}
          </h1>
          <p className="text-xl text-muted-foreground mb-12">{currentQ.subtitle}</p>
          <Button 
            onClick={handleNext} 
            size="lg" 
            className="text-lg px-8 py-6 h-auto rounded-full"
            data-testid="button-start-preapproval"
          >
            {currentQ.buttonText} <ArrowRight className="ml-2" />
          </Button>
          <p className="mt-8 text-sm text-muted-foreground">
            Have a saved application?{" "}
            <a href="/login" className="text-primary hover:underline">
              Sign in to resume
            </a>
          </p>
          {urlPropertyId && urlSource === "property-detail" && (
            <Link href={`/properties/${urlPropertyId}`}>
              <Button variant="ghost" size="sm" className="mt-4 gap-1.5 text-muted-foreground" data-testid="button-back-to-property">
                <ChevronLeft className="h-3.5 w-3.5" /> Back to property listing
              </Button>
            </Link>
          )}
        </motion.div>
      </div>
    );
  }

  // The Conversational Form Steps
  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
      <SEOHead title="Get Pre-Approved in 3 Minutes" description="Start your mortgage pre-approval application. Answer a few questions about your income and finances to get a clear, confident approval decision." />
      {restoreBanner}
      
      <VerificationPulse active={submitMutation.isPending} />

      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-muted z-50">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress.percent}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Navigation Header */}
      <div className="fixed top-0 w-full p-4 sm:p-6 flex justify-between items-center z-40 bg-background/80 backdrop-blur-sm">
        <button
          onClick={handleBack}
          disabled={progress.index === 0}
          className={`p-2 rounded-full hover:bg-muted transition-all ${progress.index === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          data-testid="button-back"
        >
          <ChevronLeft className="w-6 h-6 text-muted-foreground" />
        </button>
        <div className="flex flex-col items-center" data-testid="text-step-counter">
          <span className="text-sm font-medium text-muted-foreground">
            Step {progress.index} of {progress.total}
          </span>
          <span className="text-[11px] text-muted-foreground/60">
            {progress.index <= 4 ? "~2 min left" : progress.index <= 8 ? "~1 min left" : "Almost done"}
          </span>
        </div>
        <div className="flex items-center gap-1 w-10 justify-end">
          {progress.index > 0 && (
            <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1" data-testid="text-autosave-indicator">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Advisory Panel (Desktop only) */}
      <AdvisoryPanel formValues={watchedValues} currentStepId={currentQ.id} />

      {/* Main Content Area */}
      <div
        className={cn(
          "flex-1 flex flex-col items-center justify-center p-6 pt-20 pb-0 w-full max-w-4xl mx-auto relative",
          // Only reserve the right-hand column while the advisory panel is shown;
          // on the opening steps it isn't, so the question stays centered.
          !ADVISORY_HIDDEN_STEPS.includes(currentQ.id) && "lg:pr-96",
        )}
      >
        {/*
          mode="wait" mounts the next step only after the previous step's exit
          animation completes, and framer-motion drives that animation off
          requestAnimationFrame — which browsers stop entirely while
          document.visibilityState === "hidden". Machine state (and the
          "Step X of Y" header above, which lives outside this AnimatePresence)
          still advances, so a hidden document can sit indefinitely at
          header = step N+1 while the step-N question stays in the DOM, frozen
          at its last animation pose. Verified 2026-07-17: a real user cannot
          reach that state — a hidden tab receives no trusted pointer/keyboard
          input, and if the tab is hidden mid-transition the stalled exit
          completes on the first frame after it becomes visible again,
          resyncing the UI. Only scripted drivers (element.click() / CDP
          against an unrendered pane) can observe the desync, so headless
          funnel tests must force the pane to render (screenshot/focus) or
          assert on the step counter, not on the question text.
        */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={stepId}
            custom={direction}
            initial={{ x: direction * 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction * -50, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full text-center"
          >
            {/* Question Title */}
            <h2 
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight"
              data-testid="text-question"
            >
              {dynamicTitle}
            </h2>
            
            {currentQ.subtitle && (
              <p className="text-lg text-muted-foreground mb-8">{currentQ.subtitle}</p>
            )}

            {(currentQ.id === "downPayment" && flags.vaZeroDown) ? (
               <p className="text-base text-muted-foreground/70 mb-8 max-w-lg mx-auto" data-testid="text-va-zero-down">
                 As a veteran, you may qualify for a VA loan with <span className="font-medium text-foreground">$0 down and no PMI</span>. Enter 0 to explore that path.
               </p>
            ) : currentQ.subtext && (
               <p className="text-base text-muted-foreground/70 mb-8 max-w-lg mx-auto">{currentQ.subtext}</p>
            )}

            {/* Input Area */}
            <div className="mb-10">
              {renderInput()}
              {currentQ.why && (
                <p
                  className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground/70"
                  data-testid={`text-why-${currentQ.id}`}
                >
                  <Info className="h-3 w-3 shrink-0" />
                  {currentQ.why}
                </p>
              )}
            </div>

            {/* Continue Button (for non-choice inputs) */}
            {(currentQ.type === "currency" || currentQ.type === "number" || currentQ.type === "boolean_pair" || currentQ.type === "income_sources" || currentQ.type === "final") && (
              <Button 
                onClick={handleNext} 
                size="lg" 
                disabled={submitMutation.isPending}
                className="text-lg px-10 py-6 h-auto rounded-full shadow-lg hover:shadow-xl transition-all"
                data-testid={currentQ.type === "final" ? "button-submit" : "button-continue"}
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Analyzing...
                  </>
                ) : currentQ.type === "final" ? (
                  "Get My Loan Options"
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </>
                )}
              </Button>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {teaser && (
        <AffordabilityTeaserOverlay
          estimate={teaser.estimate}
          targetPrice={teaser.targetPrice}
          onContinue={() => {
            setTeaser(null);
            setShowAuthGate(true);
          }}
          onDismiss={() => setTeaser(null)}
        />
      )}

      {showAuthGate && <AuthGateOverlay onDismiss={() => setShowAuthGate(false)} />}

      <FunnelFooter />
    </div>
  );
}
