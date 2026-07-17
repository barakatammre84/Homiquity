import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, Link } from "wouter";
import { SEOHead } from "@/components/SEOHead";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { preApprovalFormSchema, type PreApprovalFormData, type RentalPropertyEntry, type IncomeSourceEntry } from "@shared/schema";
import { COMPANY_IDENTITY, isLicensedState, unlicensedStateMessage } from "@shared/companyIdentity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressInput } from "@/components/AddressInput";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { US_STATES } from "@/lib/us-states";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { friendlyApiError } from "@/lib/errorMessage";
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
  ChevronsUpDown,
  DollarSign, 
  Home,
  Briefcase,
  TrendingUp,
  Clock,
  Shield,
  Users,
  Loader2,
  Check,
  AlertCircle,
  Info,
  Plus,
  Trash2,
  LogIn,
} from "lucide-react";

import { FunnelProvider, useFunnel } from "@/funnel/FunnelContext";
import { PRE_APPROVAL_DEFAULTS } from "@/funnel/preApprovalMachine";
import { useFunnelAutosave } from "@/funnel/useFunnelAutosave";
import { VerificationPulse } from "@/funnel/VerificationPulse";
import { Checkbox } from "@/components/ui/checkbox";
import { QUESTIONS_BY_ID } from "./preApproval/questions";
import { AdvisoryPanel, getDynamicTitle, ADVISORY_HIDDEN_STEPS } from "./preApproval/AdvisoryPanel";
import { useDraftRestore } from "./preApproval/useDraftRestore";

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
  const [stateComboOpen, setStateComboOpen] = useState(false);
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

  // Load coach intake data to pre-fill empty fields
  const { data: coachIntake } = useQuery<{
    intake: {
      annualIncome?: string;
      monthlyDebts?: string;
      creditScore?: string;
      employmentType?: string;
      employmentYears?: string;
      downPayment?: string;
      purchasePrice?: string;
      propertyType?: string;
      loanPurpose?: string;
      isVeteran?: boolean;
      isFirstTimeBuyer?: boolean;
    } | null;
    readinessTier?: string;
    completionPercentage?: number;
  } | null>({
    queryKey: ["/api/coach/intake/latest"],
    enabled: isAuthenticated,
  });

  const [prefillApplied, setPrefillApplied] = useState(false);

  // Gap-fill from the coach conversation's intake. Saved-draft answers are
  // deliberately NOT applied here — adopting a draft (data + PATCH target) is
  // consent-gated through useDraftRestore's banner.
  useEffect(() => {
    if (prefillApplied) return;

    const formData: Partial<PreApprovalFormData> = {};
    let hasData = false;

    const ci = coachIntake?.intake;
    if (ci) {
      const validEmploymentTypes = ["employed", "self_employed", "retired", "other"] as const;
      const validPropertyTypes = ["single_family", "condo", "townhouse", "multi_family"] as const;
      const validLoanPurposes = ["purchase", "refinance", "cash_out"] as const;
      const validCreditScores = ["760", "720", "680", "640", "600", "not_sure"] as const;

      if (!formData.annualIncome && ci.annualIncome) formData.annualIncome = ci.annualIncome.replace(/[^0-9.]/g, "");
      if (!formData.monthlyDebts && ci.monthlyDebts) formData.monthlyDebts = ci.monthlyDebts.replace(/[^0-9.]/g, "");
      if (!formData.creditScore && ci.creditScore) {
        const score = parseInt(ci.creditScore.replace(/[^0-9]/g, ""), 10);
        const matched = validCreditScores.find(v => Math.abs(parseInt(v) - score) <= 30);
        if (matched) formData.creditScore = matched;
      }
      if (!formData.employmentType && ci.employmentType && validEmploymentTypes.includes(ci.employmentType as any)) {
        formData.employmentType = ci.employmentType as PreApprovalFormData["employmentType"];
      }
      if (!formData.employmentYears && ci.employmentYears) formData.employmentYears = ci.employmentYears.replace(/[^0-9]/g, "");
      if (!formData.downPayment && ci.downPayment) formData.downPayment = ci.downPayment.replace(/[^0-9.]/g, "");
      if (!formData.purchasePrice && ci.purchasePrice) formData.purchasePrice = ci.purchasePrice.replace(/[^0-9.]/g, "");
      if (!formData.propertyType && ci.propertyType && validPropertyTypes.includes(ci.propertyType as any)) {
        formData.propertyType = ci.propertyType as PreApprovalFormData["propertyType"];
      }
      if (!formData.loanPurpose && ci.loanPurpose && validLoanPurposes.includes(ci.loanPurpose as any)) {
        formData.loanPurpose = ci.loanPurpose as PreApprovalFormData["loanPurpose"];
      }
      if (formData.isVeteran === undefined && ci.isVeteran !== undefined) formData.isVeteran = ci.isVeteran;
      if (formData.isFirstTimeBuyer === undefined && ci.isFirstTimeBuyer !== undefined) formData.isFirstTimeBuyer = ci.isFirstTimeBuyer;
      hasData = true;
    }

    if (hasData) {
      form.reset({ ...form.getValues(), ...formData } as PreApprovalFormData);
      setPrefillApplied(true);
    }
  }, [coachIntake, form, prefillApplied]);

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

      if (applicationId) {
        const response = await apiRequest("PATCH", `/api/loan-applications/${applicationId}`, payload);
        return response.json();
      } else {
        const response = await apiRequest("POST", "/api/loan-applications", payload);
        return response.json();
      }
    },
    onSuccess: async (result) => {
      clearAutosave();
      queryClient.invalidateQueries({ queryKey: ["/api/loan-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });

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
        setShowAuthGate(true);
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

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
                  const formatted = formatCurrency(e.target.value);
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
        const selectedState = form.watch("propertyState");
        const selectedStateOption = US_STATES.find((s) => s.value === selectedState);
        return (
          <div className="w-full max-w-lg mx-auto">
            <Popover open={stateComboOpen} onOpenChange={setStateComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={stateComboOpen}
                  size="lg"
                  data-testid="button-state-combobox"
                  className="w-full justify-between font-medium"
                >
                  {selectedStateOption
                    ? `${selectedStateOption.label} (${selectedStateOption.value})`
                    : "Search for a state..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Type a state name or abbreviation..." data-testid="input-state-search" />
                  <CommandList>
                    <CommandEmpty>No state found.</CommandEmpty>
                    <CommandGroup>
                      {US_STATES.map((state) => (
                        <CommandItem
                          key={state.value}
                          value={`${state.label} ${state.value}`}
                          data-testid={`option-state-${state.value}`}
                          onSelect={() => {
                            form.setValue("propertyState", state.value, { shouldValidate: true });
                            setStateComboOpen(false);
                            // Licensed-state gate (roadmap A5), mirroring the
                            // server's 422: don't advance into a funnel we
                            // can't finish — the notice below explains why.
                            if (isLicensedState(state.value)) {
                              setTimeout(() => next(form.getValues()), 200);
                            }
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedState === state.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span>{state.label}</span>
                          <span className="ml-auto text-muted-foreground">{state.value}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedState && !isLicensedState(selectedState) && (
              <div
                className="mt-4 rounded-md border p-4 text-left text-sm text-muted-foreground"
                role="alert"
                data-testid="notice-unlicensed-state"
              >
                <p className="font-medium text-foreground">
                  We can't take applications in {selectedStateOption?.label ?? selectedState} yet
                </p>
                <p className="mt-1 leading-relaxed">{unlicensedStateMessage(selectedState)}</p>
                <p className="mt-2 leading-relaxed">
                  Pick a different state to continue, or see{" "}
                  <a href="/disclosures" className="font-medium text-primary underline underline-offset-2">
                    where we're licensed
                  </a>
                  .
                </p>
              </div>
            )}
          </div>
        );

      case "income_sources": {
        const employmentTypeMap: Record<string, string> = { employed: "w2", self_employed: "self_employed", retired: "pension" };
        // Self-employed borrowers keep their primary type in the list — the
        // complex-income block exists precisely to detail 1099/business income.
        const rawPrimaryType = employmentTypeMap[form.getValues("employmentType") || ""] || "";
        const primaryType = rawPrimaryType === "self_employed" ? "" : rawPrimaryType;
        const allIncomeTypes = [
          { value: "w2", label: "W-2 Employment", icon: Briefcase },
          { value: "self_employed", label: "Self-Employment / 1099", icon: Users },
          { value: "rental", label: "Rental Income", icon: Home },
          { value: "social_security", label: "Social Security", icon: Shield },
          { value: "pension", label: "Pension / Retirement", icon: Clock },
          { value: "investment", label: "Investment Income", icon: TrendingUp },
          { value: "other", label: "Other Income", icon: DollarSign },
        ].filter((t) => t.value !== primaryType);

        const buildFormEntries = (types: string[], details: typeof incomeDetails, rentals: RentalPropertyEntry[]) => {
          return types.map((t) => {
            const d = details[t] || { annualAmount: "", employerName: "", yearsInRole: "" };
            const entry: IncomeSourceEntry & { rentalProperties?: RentalPropertyEntry[] } = {
              type: t as IncomeSourceEntry["type"],
              annualAmount: d.annualAmount || "",
              employerName: d.employerName || "",
              yearsInRole: d.yearsInRole || "",
            };
            if (t === "rental" && rentals.length > 0) {
              entry.rentalProperties = rentals;
              const totalMonthly = rentals.reduce((sum, p) => sum + (parseFloat(p.monthlyRentalIncome.replace(/,/g, "")) || 0), 0);
              entry.annualAmount = totalMonthly > 0 ? formatCurrency(String(Math.round(totalMonthly * 12))) : "";
            }
            return entry;
          });
        };

        const toggleIncomeType = (typeValue: string) => {
          const isSelected = selectedIncomeTypes.includes(typeValue);
          let newTypes: string[];
          if (isSelected) {
            newTypes = selectedIncomeTypes.filter((t) => t !== typeValue);
            const newDetails = { ...incomeDetails };
            delete newDetails[typeValue];
            setIncomeDetails(newDetails);
            if (typeValue === "rental") {
              setRentalProperties([]);
            }
          } else {
            newTypes = [...selectedIncomeTypes, typeValue];
            if (!incomeDetails[typeValue]) {
              setIncomeDetails({ ...incomeDetails, [typeValue]: { annualAmount: "", employerName: "", yearsInRole: "" } });
            }
            if (typeValue === "rental" && rentalProperties.length === 0) {
              setRentalProperties([{ address: "", monthlyRentalIncome: "", monthlyDebtPayment: "" }]);
            }
          }
          setSelectedIncomeTypes(newTypes);
          form.setValue("incomeSources", buildFormEntries(newTypes, isSelected ? incomeDetails : { ...incomeDetails, [typeValue]: incomeDetails[typeValue] || { annualAmount: "", employerName: "", yearsInRole: "" } }, typeValue === "rental" && isSelected ? [] : rentalProperties) as never);
        };

        const updateDetail = (typeValue: string, field: string, value: string) => {
          const newDetails = {
            ...incomeDetails,
            [typeValue]: { ...incomeDetails[typeValue], [field]: value },
          };
          setIncomeDetails(newDetails);
          form.setValue("incomeSources", buildFormEntries(selectedIncomeTypes, newDetails, rentalProperties) as never);
        };

        const addRentalProperty = () => {
          const updated = [...rentalProperties, { address: "", monthlyRentalIncome: "", monthlyDebtPayment: "" }];
          setRentalProperties(updated);
          form.setValue("incomeSources", buildFormEntries(selectedIncomeTypes, incomeDetails, updated) as never);
        };

        const removeRentalProperty = (index: number) => {
          const updated = rentalProperties.filter((_, i) => i !== index);
          setRentalProperties(updated);
          form.setValue("incomeSources", buildFormEntries(selectedIncomeTypes, incomeDetails, updated) as never);
        };

        const updateRentalProperty = (index: number, field: keyof RentalPropertyEntry, value: string) => {
          const updated = rentalProperties.map((p, i) => i === index ? { ...p, [field]: value } : p);
          setRentalProperties(updated);
          form.setValue("incomeSources", buildFormEntries(selectedIncomeTypes, incomeDetails, updated) as never);
        };

        const needsEmployerDetails = (typeValue: string) => typeValue === "w2" || typeValue === "self_employed";

        const rentalAnnualTotal = rentalProperties.reduce((sum, p) => sum + (parseFloat(p.monthlyRentalIncome.replace(/,/g, "")) || 0), 0) * 12;

        return (
          <div className="w-full max-w-lg mx-auto space-y-6">
            <div className="grid grid-cols-2 gap-3">
              {allIncomeTypes.map((incomeType) => {
                const TypeIcon = incomeType.icon;
                const isActive = selectedIncomeTypes.includes(incomeType.value);
                return (
                  <button
                    key={incomeType.value}
                    type="button"
                    data-testid={`toggle-income-${incomeType.value}`}
                    onClick={() => toggleIncomeType(incomeType.value)}
                    className={`flex items-center gap-3 p-4 text-left text-sm font-medium border-2 rounded-xl transition-all duration-200
                      ${isActive
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-primary/50"
                      }`}
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors shrink-0
                      ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      <TypeIcon className="h-4 w-4" />
                    </div>
                    <span className={`flex-1 ${isActive ? "text-primary" : "text-foreground"}`}>
                      {incomeType.label}
                    </span>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0
                      ${isActive ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                      {isActive && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedIncomeTypes.length > 0 && (
              <div className="space-y-4">
                {selectedIncomeTypes.map((typeValue) => {
                  const typeInfo = allIncomeTypes.find((t) => t.value === typeValue);
                  const details = incomeDetails[typeValue] || { annualAmount: "", employerName: "", yearsInRole: "" };

                  if (typeValue === "rental") {
                    return (
                      <div key={typeValue} className="border-2 rounded-xl p-5 space-y-4 text-left" data-testid="card-income-rental">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Home className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-foreground">Rental Properties</span>
                          {rentalAnnualTotal > 0 && (
                            <span className="text-sm text-muted-foreground ml-auto">
                              ${formatCurrency(String(Math.round(rentalAnnualTotal)))}/yr total
                            </span>
                          )}
                        </div>

                        {rentalProperties.map((prop, idx) => (
                          <div key={idx} className="border rounded-xl p-4 space-y-3 bg-muted/30" data-testid={`rental-property-${idx}`}>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-sm font-medium text-foreground">Property {idx + 1}</span>
                              {rentalProperties.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon" aria-label="Delete"
                                  data-testid={`button-remove-rental-${idx}`}
                                  onClick={() => removeRentalProperty(idx)}
                                >
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                            <div>
                              <label className="text-sm text-muted-foreground mb-1 block">Property Address</label>
                              <AddressInput
                                placeholder="Start typing a property address..."
                                defaultValue={prop.address}
                                onSelect={(result) => updateRentalProperty(idx, "address", result.formattedAddress)}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-sm text-muted-foreground mb-1 block">Monthly Rental Income</label>
                                <div className="relative">
                                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                  <Input
                                    data-testid={`input-rental-income-${idx}`}
                                    value={prop.monthlyRentalIncome}
                                    onChange={(e) => updateRentalProperty(idx, "monthlyRentalIncome", formatCurrency(e.target.value))}
                                    className="pl-9"
                                    placeholder="2,000"
                                    inputMode="decimal"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-sm text-muted-foreground mb-1 block">Monthly Debt Payment</label>
                                <div className="relative">
                                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                  <Input
                                    data-testid={`input-rental-debt-${idx}`}
                                    value={prop.monthlyDebtPayment || ""}
                                    onChange={(e) => updateRentalProperty(idx, "monthlyDebtPayment", formatCurrency(e.target.value))}
                                    className="pl-9"
                                    placeholder="1,200"
                                    inputMode="decimal"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        <Button
                          type="button"
                          variant="outline"
                          data-testid="button-add-rental-property"
                          onClick={addRentalProperty}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Another Property
                        </Button>
                      </div>
                    );
                  }

                  return (
                    <div key={typeValue} className="border-2 rounded-xl p-5 space-y-4 text-left" data-testid={`card-income-${typeValue}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        {typeInfo && <typeInfo.icon className="h-4 w-4 text-primary" />}
                        <span className="font-semibold text-foreground">{typeInfo?.label}</span>
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground mb-1 block">Annual Amount</label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            data-testid={`input-income-amount-${typeValue}`}
                            value={details.annualAmount}
                            onChange={(e) => updateDetail(typeValue, "annualAmount", formatCurrency(e.target.value))}
                            className="pl-9"
                            placeholder="75,000"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground mb-1 block">
                          {needsEmployerDetails(typeValue) ? "Employer Name" : "Source"}
                        </label>
                        <Input
                          data-testid={`input-income-employer-${typeValue}`}
                          value={details.employerName}
                          onChange={(e) => updateDetail(typeValue, "employerName", e.target.value)}
                          placeholder={needsEmployerDetails(typeValue) ? "Company name" : "Source name (optional)"}
                        />
                      </div>
                      {needsEmployerDetails(typeValue) && (
                        <div>
                          <label className="text-sm text-muted-foreground mb-1 block">Years in Role</label>
                          <Input
                            data-testid={`input-income-years-${typeValue}`}
                            value={details.yearsInRole}
                            onChange={(e) => updateDetail(typeValue, "yearsInRole", e.target.value.replace(/\D/g, ""))}
                            placeholder="3"
                            inputMode="numeric"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-2 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
      data-testid="banner-restore-draft"
    >
      <div className="bg-card border shadow-lg rounded-xl p-4 flex items-center gap-3">
        <div className="bg-primary/10 rounded-lg p-2 shrink-0">
          <Clock className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">You have unsaved progress</p>
          <p className="text-xs text-muted-foreground">Pick up where you left off?</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="ghost" onClick={handleDismissRestore} data-testid="button-dismiss-restore">
            No
          </Button>
          <Button size="sm" onClick={handleRestoreDraft} data-testid="button-restore-draft">
            Restore
          </Button>
        </div>
      </div>
    </motion.div>
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

      {showAuthGate && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          data-testid="auth-gate-overlay"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border rounded-xl shadow-lg p-8 max-w-md w-full text-center"
          >
            <div className="mx-auto mb-6 h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
              <LogIn className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-3" data-testid="text-auth-gate-title">
              One last step
            </h3>
            <p className="text-muted-foreground mb-6">
              Create an account (or sign in) to see your pre-approval results. Your answers are already saved.
            </p>
            <div className="space-y-3">
              <a href="/signup" className="block">
                <Button size="lg" className="w-full" data-testid="button-auth-gate-signup">
                  Create account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <a href="/login" className="block">
                <Button size="lg" variant="outline" className="w-full" data-testid="button-auth-gate-login">
                  Sign In
                </Button>
              </a>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAuthGate(false)}
                data-testid="button-auth-gate-dismiss"
              >
                Go back to form
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1">
              <Shield className="h-3 w-3" />
              Your data is encrypted and never shared
            </p>
          </motion.div>
        </motion.div>
      )}

      {/* Compliance Footer */}
      <footer className="border-t border-muted bg-muted/30 mt-auto" data-testid="footer-compliance">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
          <div className="text-xs text-muted-foreground leading-relaxed space-y-4">
            <p>
              <sup>1</sup> Homiquity&apos;s pre-approval process uses self-reported information and a soft credit inquiry to provide an initial determination. A soft credit check will not affect your credit score. Final loan approval is subject to full underwriting review, including verification of income, assets, employment, and property appraisal. Pre-approval is not a commitment to lend and does not guarantee final approval. All loans are subject to credit and property approval. Terms and conditions apply.
            </p>
          </div>

          <div className="border-t border-muted pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
              <div>
                <p className="font-semibold text-foreground text-base mb-3">Homiquity</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Homiquity Mortgage Corporation is a mortgage broker. Loans are arranged with third-party wholesale lending partners; Homiquity does not make credit decisions or fund loans.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-2">Contact Us</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>{COMPANY_IDENTITY.contactEmail}</p>
                  <p>{COMPANY_IDENTITY.contactPhone}</p>
                </div>
                <div className="mt-3 space-y-1">
                  <p className="font-medium text-foreground text-xs">Resources</p>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>FAQ</p>
                    <p>Privacy Policy</p>
                    <p>Terms of Use</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="font-medium text-foreground mb-2">Legal</p>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>NMLS Consumer Access</p>
                  <p>Disclosures & Licensing</p>
                  <p>Equal Housing Opportunity</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-muted pt-4 text-xs text-muted-foreground leading-relaxed space-y-3">
            <p>
              &copy; {new Date().getFullYear()} Homiquity Mortgage Corporation. All rights reserved. Homiquity is a family of companies serving the homeownership ecosystem including mortgage brokerage, property search, and AI-powered guidance.
            </p>
            <p>
              Mortgage loans arranged by Homiquity Mortgage Corporation through third-party wholesale lending partners. Not available in all states. Equal Housing Opportunity. NMLS Consumer Access.
            </p>
            <div className="flex items-center justify-center gap-4 pt-2">
              <div className="flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" />
                <span>Soft credit check only</span>
              </div>
              <div className="flex items-center gap-1">
                <Home className="h-3.5 w-3.5" />
                <span>Equal Housing Opportunity</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
