import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTrackActivity, useTrackFormStart } from "@/hooks/useActivityTracker";
import { apiRequest, queryClient, dashboardKeys, urlaKeys, loanApplicationKeys } from "@/lib/queryClient";
import type {
  LoanApplication,
  UrlaPersonalInfo,
  EmploymentHistory,
  UrlaAsset,
  UrlaLiability,
  UrlaPropertyInfo,
  OtherIncomeSource,
  BorrowerDeclarations,
  HmdaDemographics,
} from "@shared/schema";
import { useActiveApplication } from "@/hooks/useActiveApplication";
import {
  Users,
  FileText,
  Save,
  Plus,
  Trash2,
  Loader2,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import {
  DECLARATION_QUESTIONS,
  demographicsToPayload,
  emptyDemographics,
  emptySlice,
  hmdaToState,
  toLoanDetailsState,
  type AssetForm,
  type BorrowerSlice,
  type LiabilityForm,
  type PersonalInfoForm,
  type SectionsPayload,
  type UrlaSavePayload,
} from "./urla/types";
import { isUrlaRowSaveable, urlaRowSaveState, type UrlaRowSection } from "@shared/lib/urlaRowContent";
import type { UrlaLoanDetails } from "@shared/schema";
import { PersonalInfoSection } from "./urla/PersonalInfoSection";
import { EmploymentSection } from "./urla/EmploymentSection";
import { AssetsSection } from "./urla/AssetsSection";
import { LiabilitiesSection } from "./urla/LiabilitiesSection";
import { PropertySection } from "./urla/PropertySection";
import { DeclarationsSection } from "./urla/DeclarationsSection";
import { DemographicsSection } from "./urla/DemographicsSection";

interface DashboardData {
  applications: LoanApplication[];
}

interface UrlaData {
  application: LoanApplication;
  personalInfo: UrlaPersonalInfo | null;
  allPersonalInfo?: UrlaPersonalInfo[];
  employmentHistory: EmploymentHistory[];
  otherIncomeSources: OtherIncomeSource[];
  assets: UrlaAsset[];
  liabilities: UrlaLiability[];
  propertyInfo: UrlaPropertyInfo | null;
  declarations?: BorrowerDeclarations | null;
  allDeclarations?: BorrowerDeclarations[];
  hmdaDemographics?: HmdaDemographics[];
}

interface StepContext {
  slice: BorrowerSlice;
  otherIncomes: Partial<OtherIncomeSource>[];
  propertyInfo: Partial<UrlaPropertyInfo>;
  app: LoanApplication;
}

interface UrlaStep {
  id: string;
  label: string;
  estimate: string;
  intro: string;
  isComplete: (ctx: StepContext) => boolean;
}

// Completion is advisory only — it drives the progress bar and the check marks
// in the step rail, never gates navigation or saving (URLA is save-as-you-go).
const STEPS: UrlaStep[] = [
  {
    id: "borrower",
    label: "About you",
    estimate: "~4 min",
    intro: "Let's start with you. Nothing here is graded — it's simply how your loan file gets opened.",
    isComplete: ({ slice }) =>
      !!(slice.personalInfo.firstName && slice.personalInfo.lastName &&
         slice.personalInfo.dateOfBirth && (slice.personalInfo.ssn || slice.personalInfo.ssnLast4)),
  },
  {
    id: "employment",
    label: "Work & income",
    estimate: "~5 min",
    intro: "Your work and income story. Two years of history is the underwriting standard.",
    isComplete: ({ slice }) =>
      slice.employmentRecords.some((e) => e.employerName || e.positionTitle),
  },
  {
    id: "assets",
    label: "Assets",
    estimate: "~2 min",
    intro: "Where your down payment and reserves will come from.",
    isComplete: ({ slice }) =>
      slice.assets.some((a) => a.accountType || a.financialInstitution),
  },
  {
    id: "liabilities",
    label: "Liabilities",
    estimate: "~2 min",
    intro: "Your monthly obligations. Listing everything now prevents surprises later.",
    isComplete: ({ slice }) =>
      slice.liabilities.some((l) => l.liabilityType || l.creditorName),
  },
  {
    id: "property",
    label: "Property & loan",
    estimate: "~2 min",
    intro: "The home and loan this application is for — much of it carries over from your pre-approval.",
    isComplete: ({ propertyInfo, app }) =>
      !!((propertyInfo.propertyStreet || app.propertyAddress) &&
         (propertyInfo.propertyValue || app.propertyValue || app.purchasePrice)),
  },
  {
    id: "declarations",
    label: "Declarations",
    estimate: "~2 min",
    intro: "Standard questions every lender must ask — answer honestly, there are no trick questions.",
    isComplete: ({ slice }) =>
      DECLARATION_QUESTIONS.every((q) => typeof slice.declarations[q.key] === "boolean"),
  },
  {
    id: "demographics",
    label: "Demographics",
    estimate: "~1 min",
    intro: "Optional federal monitoring questions. Declining to answer is always allowed.",
    isComplete: ({ slice }) => {
      const d = slice.demographics;
      const ethnicity = d.ethnicityHispanicLatino || d.ethnicityNotHispanicLatino || d.ethnicityNotProvided;
      const race = d.raceAmericanIndian || d.raceAsian || d.raceBlack || d.raceNativeHawaiian || d.raceWhite || d.raceNotProvided;
      const sex = d.sexFemale || d.sexMale || d.sexNotProvided;
      const age = !!d.age || d.ageNotProvided;
      return ethnicity && race && sex && age;
    },
  },
];

export default function URLAForm() {
  const { isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const track = useTrackActivity();
  const trackFormStart = useTrackFormStart();

  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    isError: dashboardIsError,
    error: dashboardErrorObj,
    refetch: refetchDashboard,
  } = useQuery<DashboardData>({
    queryKey: dashboardKeys.root(),
    enabled: !authLoading,
  });

  const applications = dashboardData?.applications || [];
  const { activeApplication } = useActiveApplication(applications);

  const {
    data: urlaData,
    isLoading: urlaLoading,
    isError: urlaIsError,
    error: urlaErrorObj,
    refetch: refetchUrla,
  } = useQuery<UrlaData>({
    queryKey: urlaKeys.detail(activeApplication?.id),
    enabled: !!activeApplication?.id,
  });

  // Per-borrower section data, keyed by borrowerSequenceNumber (1 = primary, 2 = co-borrower)
  const [borrowerData, setBorrowerData] = useState<Record<number, BorrowerSlice>>({ 1: emptySlice(), 2: emptySlice() });
  const [activeSeq, setActiveSeq] = useState<number>(1);
  const [hasCoBorrower, setHasCoBorrower] = useState<boolean>(false);
  // Shared (primary-only) data
  const [otherIncomes, setOtherIncomes] = useState<Partial<OtherIncomeSource>[]>([]);
  const [propertyInfo, setPropertyInfo] = useState<Partial<UrlaPropertyInfo>>({});
  // Section 4a (WF2-F4): borrower-stated loan type + amortization type, with
  // borrower-safe defaults preselected — visible and editable, never a silent
  // server-side default. Saved to the loan_applications columns section-4
  // gating requires.
  const [loanDetails, setLoanDetails] = useState<UrlaLoanDetails>({
    preferredLoanType: "conventional",
    amortizationType: "fixed",
  });

  const [activeStep, setActiveStep] = useState<string>(STEPS[0].id);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const slice = borrowerData[activeSeq] ?? emptySlice();
  const updateSlice = (patch: Partial<BorrowerSlice>) =>
    setBorrowerData((prev) => ({ ...prev, [activeSeq]: { ...(prev[activeSeq] ?? emptySlice()), ...patch } }));

  const setPersonalInfo = (v: PersonalInfoForm) => updateSlice({ personalInfo: v });
  const setEmploymentRecords = (v: Partial<EmploymentHistory>[]) => updateSlice({ employmentRecords: v });
  const setAssets = (v: AssetForm[]) => updateSlice({ assets: v });
  const setLiabilities = (v: LiabilityForm[]) => updateSlice({ liabilities: v });
  const setDeclarations = (v: Partial<BorrowerDeclarations>) => updateSlice({ declarations: v });
  const setDemographics = (v: BorrowerSlice["demographics"]) => updateSlice({ demographics: v });

  useEffect(() => {
    if (!urlaData) return;
    const seqOf = (r: { borrowerSequenceNumber?: number | null }) => r.borrowerSequenceNumber ?? 1;

    const buildSlice = (seq: number): BorrowerSlice => {
      const pi = (urlaData.allPersonalInfo || []).find((p) => seqOf(p) === seq);
      const emp = (urlaData.employmentHistory || []).filter((e) => seqOf(e) === seq);
      const ast = (urlaData.assets || []).filter((a) => seqOf(a) === seq);
      const lia = (urlaData.liabilities || []).filter((l) => seqOf(l) === seq);
      const decl = (urlaData.allDeclarations || []).find((d) => seqOf(d) === seq);
      const hmda = (urlaData.hmdaDemographics || []).find((h) => seqOf(h) === seq);
      return {
        personalInfo: pi || {},
        employmentRecords: emp.length ? emp : [{}],
        assets: ast.length ? ast : [{}],
        liabilities: lia.length ? lia : [{}],
        declarations: decl || {},
        demographics: hmda ? hmdaToState(hmda) : emptyDemographics(),
      };
    };

    setBorrowerData({ 1: buildSlice(1), 2: buildSlice(2) });
    setOtherIncomes(urlaData.otherIncomeSources?.length ? urlaData.otherIncomeSources : []);
    setPropertyInfo(urlaData.propertyInfo || {});
    setLoanDetails(toLoanDetailsState(urlaData.application));

    const hasCo =
      (urlaData.allPersonalInfo || []).some((p) => seqOf(p) > 1) ||
      (urlaData.employmentHistory || []).some((e) => seqOf(e) > 1) ||
      (urlaData.assets || []).some((a) => seqOf(a) > 1) ||
      (urlaData.liabilities || []).some((l) => seqOf(l) > 1) ||
      (urlaData.allDeclarations || []).some((d) => seqOf(d) > 1) ||
      (urlaData.hmdaDemographics || []).some((h) => seqOf(h) > 1);
    if (hasCo) setHasCoBorrower(true);
  }, [urlaData, activeApplication?.id]);

  useEffect(() => {
    if (activeApplication?.id) trackFormStart("urla");
  }, [activeApplication?.id, trackFormStart]);

  // Removal has to be a real request. The bulk save is upsert-only and simply
  // omits `coApplicants` when the flag is false, so clearing slot 2 locally
  // deleted nothing and the next refetch put the co-borrower back (#450).
  //
  // Note what this does NOT do: it does not make `hasCoBorrower` two-way. That
  // latch is monotonic on purpose — hydration only ever sets it TRUE, which is
  // what lets ADD Co-Borrower survive the post-save refetch. Once the seq-2 rows
  // are genuinely gone, the six-way `hasCo` check computes false on its own and
  // the latch never fires. Fixing the data made the state machine correct.
  const removeCoBorrowerMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/urla/${activeApplication?.id}/co-applicant/2`);
      return response.json();
    },
    onSuccess: () => {
      setBorrowerData((prev) => ({ ...prev, 2: emptySlice() }));
      setHasCoBorrower(false);
      setActiveSeq(1);
      queryClient.invalidateQueries({ queryKey: urlaKeys.detail(activeApplication?.id) });
      toast({
        title: "Co-borrower removed",
        description: "Their information has been deleted from this application. Yours is unchanged.",
      });
    },
    onError: () => {
      // The old behaviour failed silently and looked like success. Say so.
      toast({
        title: "We couldn't remove the co-borrower",
        description: "Nothing was changed. Give it another try in a moment — if it keeps happening, message your loan team.",
        variant: "destructive",
      });
    },
  });

  // Which rows the borrower filled in but the save cannot accept, phrased for
  // them. Takes no arguments and reads the same state buildPayload does, on
  // purpose — see knowledge-base/handbook/URLA_FORM_REFACTOR_TRAP.md: giving
  // these builders a parameter is what lets the wrong borrower slice be passed.
  const describeUnsavedRows = (): string[] => {
    const notes: string[] = [];
    const sections: [UrlaRowSection, Record<string, unknown>[], string][] = [
      ["employment", borrowerData[1]?.employmentRecords ?? [], "job"],
      ["asset", borrowerData[1]?.assets ?? [], "asset"],
      ["liability", borrowerData[1]?.liabilities ?? [], "liability"],
      ["otherIncome", otherIncomes as Record<string, unknown>[], "other-income"],
    ];
    for (const [section, rows, noun] of sections) {
      const blocked = rows
        .map(r => urlaRowSaveState(section, r))
        .filter((s): s is { state: "incomplete"; missing: string[] } => s.state === "incomplete");
      if (!blocked.length) continue;
      const missing = Array.from(new Set(blocked.flatMap(b => b.missing)));
      notes.push(
        blocked.length === 1
          ? `one ${noun} row still needs ${missing.join(" and ")}`
          : `${blocked.length} ${noun} rows still need ${missing.join(" and ")}`,
      );
    }
    return notes;
  };

  const saveMutation = useMutation({
    mutationFn: async ({ data }: { data: UrlaSavePayload; silent?: boolean }) => {
      const response = await apiRequest("POST", `/api/urla/${activeApplication?.id}/save`, data);
      return response.json();
    },
    onSuccess: (_result, variables) => {
      setLastSavedAt(new Date());
      if (!variables.silent) {
        // Rows the database cannot accept are still left out of the payload —
        // but the borrower is told, by row and by reason. Reporting "Everything
        // is safely stored" over a dropped row was the actual defect in #451:
        // the row vanished from the payload, the toast claimed success, and the
        // post-save refetch erased it from the screen too, so no state existed
        // in which the borrower could tell.
        const unsaved = describeUnsavedRows();
        if (unsaved.length) {
          toast({
            title: "Saved — but some rows need one more detail",
            description: `${unsaved.join("; ")}. Everything else is stored; add the missing detail and save again.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Application saved",
            description: "Everything is safely stored — you can pick this up anytime.",
          });
        }
      }
      const savedApplicationId = activeApplication?.id;
      if (!savedApplicationId) return;
      queryClient.invalidateQueries({ queryKey: urlaKeys.detail(savedApplicationId) });
      // The save is NOT confined to the URLA tables. `POST /api/urla/:id/save`
      // runs evaluateTridTrigger (server/services/trid.ts), and once the six
      // pieces of application information are on file that writes
      // `tridTriggeredAt` onto the LOAN APPLICATION ROW and appends a
      // compliance deal-activity — Reg Z §1026.2(a)(3), which starts the
      // 3-business-day Loan Estimate clock.
      //
      // Both of those are served under loanApplicationKeys.detail (the detail
      // response carries `activities`), and two borrower surfaces read it:
      // LoanPipeline and CreditConsent. Invalidating only the URLA key left
      // them rendering the pre-trigger file — the borrower completes the
      // section that legally starts their LE clock and the app still shows the
      // state from before it started.
      //
      // detail() is the family PREFIX, so this reaches the nested pipeline /
      // conditions reads too; enumerating those by hand is the failure mode
      // documented on homeownershipGoalKeys.
      //
      // Deliberately OUTSIDE the `!variables.silent` branch. The six pieces
      // complete at an INTERMEDIATE step (personal info + property info), which
      // saves silently — so gating this on the loud final save would skip the
      // one save that actually trips the trigger. `silent` is per-step, not a
      // debounced autosave (handleContinue), so this runs a handful of times
      // per session, not per keystroke.
      queryClient.invalidateQueries({
        queryKey: loanApplicationKeys.detail(savedApplicationId),
      });
    },
    onError: () => {
      toast({
        title: "We couldn't save that just now",
        description: "Your answers are still here on the page. Give it another try in a moment — if it keeps happening, message your loan team.",
        variant: "destructive",
      });
    },
  });

  // Every repeating section drops rows the borrower never touched, but the test
  // is EMPTINESS (hasBorrowerContent), not "did they fill in the one field we
  // picked". The old per-section predicates discarded any row filled in a
  // different order — employment dates and income without the employer name, an
  // asset balance without an institution, a liability payment without a
  // creditor — and the save then reported "Everything is safely stored".
  const buildSectionsPayload = (s: BorrowerSlice): SectionsPayload => ({
    personalInfo: s.personalInfo,
    employmentHistory: s.employmentRecords
      .filter(r => isUrlaRowSaveable("employment", r))
      .map(emp => ({ ...emp, employmentType: emp.employmentType || "current" })),
    assets: s.assets.filter(r => isUrlaRowSaveable("asset", r)),
    liabilities: s.liabilities.filter(r => isUrlaRowSaveable("liability", r)),
    declarations: s.declarations,
    demographics: demographicsToPayload(s.demographics),
  });

  const buildPayload = (): UrlaSavePayload => {
    // Was `incomeSource && monthlyAmount` — the only section requiring BOTH, so
    // it lost a row for a source with no amount yet AND for an amount with no
    // source. That asymmetry was not deliberate.
    const cleanedOtherIncomes = otherIncomes.filter(r => isUrlaRowSaveable("otherIncome", r));
    const primary = buildSectionsPayload(borrowerData[1] ?? emptySlice());

    const payload: UrlaSavePayload = {
      ...primary,
      otherIncomeSources: cleanedOtherIncomes,
      propertyInfo,
      loanDetails,
    };

    if (hasCoBorrower) {
      payload.coApplicants = [buildSectionsPayload(borrowerData[2] ?? emptySlice())];
    }

    return payload;
  };

  const handleSave = () => {
    saveMutation.mutate({ data: buildPayload() });
  };

  const stepIndex = STEPS.findIndex((s) => s.id === activeStep);
  const isLastStep = stepIndex === STEPS.length - 1;

  const handleContinue = () => {
    // Final step saves loudly (toast); intermediate steps save quietly and advance.
    saveMutation.mutate({ data: buildPayload(), silent: !isLastStep });
    track("urla_section_complete", "/urla-form", {
      form: "urla",
      step_id: activeStep,
      step: stepIndex + 1,
      total: STEPS.length,
      application_id: activeApplication?.id,
    });
    if (!isLastStep) {
      setActiveStep(STEPS[stepIndex + 1].id);
      window.scrollTo({ top: 0 });
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setActiveStep(STEPS[stepIndex - 1].id);
      window.scrollTo({ top: 0 });
    }
  };

  if (authLoading || dashboardLoading || urlaLoading) {
    return (
      <PageShell width="wide">
        <Skeleton className="mb-8 h-8 w-48" />
        <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
          <Skeleton className="mb-6 h-12 lg:h-96" />
          <Skeleton className="h-96" />
        </div>
      </PageShell>
    );
  }

  // A load failure would otherwise fall through to "No application open yet"
  // (masking a server error) or a blank 1003 the user could overwrite — show an
  // honest error + retry first (ux-01).
  if (dashboardIsError || urlaIsError) {
    return (
      <div className="p-8">
        <QueryErrorState
          error={dashboardErrorObj ?? urlaErrorObj}
          onRetry={() => {
            void refetchDashboard();
            void refetchUrla();
          }}
          title="We couldn't load your loan file"
          data-testid="urla-error"
        />
      </div>
    );
  }

  if (!activeApplication) {
    return (
      <PageShell width="wide">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No application open yet</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-md text-center">
              Start your pre-approval and we'll open your loan file here — most people
              finish it in about three minutes.
            </p>
            <Button asChild className="mt-6">
              <Link href="/apply">Start pre-approval</Link>
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const app = urlaData?.application || activeApplication;
  const stepContext: StepContext = { slice, otherIncomes, propertyInfo, app };
  const completedCount = STEPS.filter((s) => s.isComplete(stepContext)).length;
  const currentStep = STEPS[stepIndex];

  return (
    <PageShell
      width="wide"
      title="Your Loan Application"
      subtitle="Uniform Residential Loan Application · Freddie Mac Form 65 / Fannie Mae Form 1003 (Effective 1/2021)"
      headerAction={
        <div className="flex items-center gap-4">
          <p aria-live="polite" className="text-xs text-muted-foreground" data-testid="text-urla-save-status">
            {saveMutation.isPending ? (
              "Saving…"
            ) : lastSavedAt ? (
              <span className="flex items-center gap-1">
                <Check aria-hidden="true" className="h-3 w-3" />
                Saved at {lastSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            ) : (
              "Progress saves each time you continue"
            )}
          </p>
          <Button onClick={handleSave} disabled={saveMutation.isPending} variant="outline" className="gap-2" data-testid="button-save-urla-top">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      }
    >
      <div className="mb-8 space-y-2">
        <Progress
          value={(completedCount / STEPS.length) * 100}
          className="h-1.5"
          aria-label={`Application progress: ${completedCount} of ${STEPS.length} sections complete`}
        />
        <p className="text-xs text-muted-foreground" data-testid="text-urla-progress">
          {completedCount} of {STEPS.length} sections complete
        </p>
      </div>

        <Card className="mb-8">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Editing for:</span>
              <Button
                variant={activeSeq === 1 ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveSeq(1)}
                data-testid="button-borrower-primary"
              >
                Primary Borrower
              </Button>
              {hasCoBorrower && (
                <Button
                  variant={activeSeq === 2 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveSeq(2)}
                  data-testid="button-borrower-co"
                >
                  Co-Borrower
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!hasCoBorrower ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    setHasCoBorrower(true);
                    setActiveSeq(2);
                  }}
                  data-testid="button-add-coborrower"
                >
                  <Plus className="h-4 w-4" />
                  Add Co-Borrower
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  disabled={removeCoBorrowerMutation.isPending}
                  onClick={() => {
                    // Confirm because this is now durable and irreversible. It
                    // used to be local state only, which is exactly why the
                    // co-borrower came back after the next refetch (#450).
                    const co = borrowerData[2]?.personalInfo;
                    const who = [co?.firstName, co?.lastName].filter(Boolean).join(" ").trim();
                    const ok = window.confirm(
                      `Remove ${who || "the co-borrower"} from this application?\n\n` +
                      "Everything they entered — employment, assets, liabilities and declarations — is deleted and cannot be recovered. Your own information is not affected.",
                    );
                    if (!ok) return;
                    removeCoBorrowerMutation.mutate();
                  }}
                  data-testid="button-remove-coborrower"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove Co-Borrower
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeStep} onValueChange={setActiveStep}>
          <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-8">
            <div className="mb-6 lg:sticky lg:top-6 lg:mb-0">
              <TabsList className="flex h-auto w-full items-stretch justify-start gap-1 overflow-x-auto bg-transparent p-0 lg:flex-col lg:overflow-visible">
                {STEPS.map((step, index) => {
                  const complete = step.isComplete(stepContext);
                  return (
                    <TabsTrigger
                      key={step.id}
                      value={step.id}
                      data-testid={`tab-${step.id}`}
                      className="h-auto shrink-0 justify-start gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-none"
                    >
                      {complete ? (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success-subtle-foreground">
                          <Check aria-hidden="true" className="h-3.5 w-3.5" />
                          <span className="sr-only">Section complete:</span>
                        </span>
                      ) : (
                        <span
                          aria-hidden="true"
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium"
                        >
                          {index + 1}
                        </span>
                      )}
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">{step.label}</span>
                        <span className="hidden text-[11px] font-normal text-muted-foreground lg:block">
                          {step.estimate}
                        </span>
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <div className="min-w-0">
              <div aria-live="polite" className="mb-6 space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Step {stepIndex + 1} of {STEPS.length} · {currentStep.estimate}
                </p>
                <p className="text-sm text-muted-foreground">{currentStep.intro}</p>
              </div>

              <TabsContent value="borrower" className="mt-0 space-y-6">
                <PersonalInfoSection personalInfo={slice.personalInfo} onChange={setPersonalInfo} />
              </TabsContent>

              <TabsContent value="employment" className="mt-0 space-y-6">
                <EmploymentSection
                  employmentRecords={slice.employmentRecords}
                  onChange={setEmploymentRecords}
                  otherIncomes={otherIncomes}
                  onOtherIncomesChange={setOtherIncomes}
                  app={app}
                  activeSeq={activeSeq}
                />
              </TabsContent>

              <TabsContent value="assets" className="mt-0 space-y-6">
                <AssetsSection assets={slice.assets} onChange={setAssets} />
              </TabsContent>

              <TabsContent value="liabilities" className="mt-0 space-y-6">
                <LiabilitiesSection liabilities={slice.liabilities} onChange={setLiabilities} />
              </TabsContent>

              <TabsContent value="property" className="mt-0 space-y-6">
                <PropertySection
                  propertyInfo={propertyInfo}
                  onChange={setPropertyInfo}
                  loanDetails={loanDetails}
                  onLoanDetailsChange={setLoanDetails}
                  app={app}
                />
              </TabsContent>

              <TabsContent value="declarations" className="mt-0 space-y-6">
                <DeclarationsSection
                  declarations={slice.declarations}
                  onChange={setDeclarations}
                  activeSeq={activeSeq}
                />
              </TabsContent>

              <TabsContent value="demographics" className="mt-0 space-y-6">
                <DemographicsSection
                  demographics={slice.demographics}
                  onChange={setDemographics}
                  activeSeq={activeSeq}
                />
              </TabsContent>

              <div className="mt-8 flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  variant="ghost"
                  className="gap-2"
                  onClick={handleBack}
                  disabled={stepIndex === 0}
                  data-testid="button-urla-back"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  className="gap-2"
                  onClick={handleContinue}
                  disabled={saveMutation.isPending}
                  data-testid={isLastStep ? "button-save-urla" : "button-urla-continue"}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isLastStep ? (
                    <Save className="h-4 w-4" />
                  ) : null}
                  {isLastStep ? "Save application" : "Save & continue"}
                  {!isLastStep && <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </Tabs>
    </PageShell>
  );
}
