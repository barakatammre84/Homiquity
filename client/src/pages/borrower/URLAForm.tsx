import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTrackActivity, useTrackFormStart } from "@/hooks/useActivityTracker";
import { apiRequest, queryClient, dashboardKeys } from "@/lib/queryClient";
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
import { PageShell } from "@/components/PageShell";
import {
  emptySlice,
  type AssetForm,
  type BorrowerSlice,
  type LiabilityForm,
  type PersonalInfoForm,
} from "./urla/types";
import { STEPS, type StepContext } from "./urla/steps";
import { buildBorrowerData, detectCoBorrower, emptyBorrowerData } from "./urla/borrowerSlices";
import { buildPayload } from "./urla/payload";
import { PersonalInfoSection } from "./urla/PersonalInfoSection";
import { EmploymentSection } from "./urla/EmploymentSection";
import { AssetsSection } from "./urla/AssetsSection";
import { LiabilitiesSection } from "./urla/LiabilitiesSection";
import { PropertySection } from "./urla/PropertySection";
import { DeclarationsSection } from "./urla/DeclarationsSection";
import { DemographicsSection } from "./urla/DemographicsSection";
import { BorrowerSwitcherCard } from "./urla/BorrowerSwitcherCard";
import { StepRail } from "./urla/StepRail";
import { StepNav } from "./urla/StepNav";
import { SaveStatus } from "./urla/SaveStatus";
import { NoApplicationCard } from "./urla/NoApplicationCard";

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
    queryKey: ['/api/urla', activeApplication?.id],
    enabled: !!activeApplication?.id,
  });

  // Per-borrower section data, keyed by borrowerSequenceNumber (1 = primary, 2 = co-borrower)
  const [borrowerData, setBorrowerData] = useState<Record<number, BorrowerSlice>>(emptyBorrowerData);
  const [activeSeq, setActiveSeq] = useState<number>(1);
  const [hasCoBorrower, setHasCoBorrower] = useState<boolean>(false);
  // Shared (primary-only) data
  const [otherIncomes, setOtherIncomes] = useState<Partial<OtherIncomeSource>[]>([]);
  const [propertyInfo, setPropertyInfo] = useState<Partial<UrlaPropertyInfo>>({});

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
    setBorrowerData(buildBorrowerData(urlaData));
    setOtherIncomes(urlaData.otherIncomeSources?.length ? urlaData.otherIncomeSources : []);
    setPropertyInfo(urlaData.propertyInfo || {});
    // One-way latch: never flips back to false, so an in-progress co-borrower
    // the borrower just added isn't dropped by a refetch that predates them.
    if (detectCoBorrower(urlaData)) setHasCoBorrower(true);
  }, [urlaData, activeApplication?.id]);

  useEffect(() => {
    if (activeApplication?.id) trackFormStart("urla");
  }, [activeApplication?.id, trackFormStart]);

  // The ONLY URLA write path from the client. tests/complianceInvariants.test.ts
  // relies on that being true: it scopes its TRID-trigger assertion to the
  // server's /save handler precisely because this is the sole caller. If a
  // second URLA write endpoint is ever added here, that test must be revisited.
  const saveMutation = useMutation({
    mutationFn: async ({ data }: { data: ReturnType<typeof buildPayload>; silent?: boolean }) => {
      const response = await apiRequest("POST", `/api/urla/${activeApplication?.id}/save`, data);
      return response.json();
    },
    onSuccess: (_result, variables) => {
      setLastSavedAt(new Date());
      if (!variables.silent) {
        toast({
          title: "Application saved",
          description: "Everything is safely stored — you can pick this up anytime.",
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/urla', activeApplication?.id] });
    },
    onError: () => {
      toast({
        title: "We couldn't save that just now",
        description: "Your answers are still here on the page. Give it another try in a moment — if it keeps happening, message your loan team.",
        variant: "destructive",
      });
    },
  });

  const currentPayload = () =>
    buildPayload({ borrowerData, otherIncomes, propertyInfo, hasCoBorrower });

  const handleSave = () => {
    saveMutation.mutate({ data: currentPayload() });
  };

  const stepIndex = STEPS.findIndex((s) => s.id === activeStep);
  const isLastStep = stepIndex === STEPS.length - 1;

  const handleContinue = () => {
    // Final step saves loudly (toast); intermediate steps save quietly and advance.
    saveMutation.mutate({ data: currentPayload(), silent: !isLastStep });
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
        <NoApplicationCard />
      </PageShell>
    );
  }

  const app = urlaData?.application || activeApplication;
  const stepContext: StepContext = { slice, propertyInfo, app };
  const completedCount = STEPS.filter((s) => s.isComplete(stepContext)).length;
  const currentStep = STEPS[stepIndex];

  return (
    <PageShell
      width="wide"
      title="Your Loan Application"
      subtitle="Uniform Residential Loan Application · Freddie Mac Form 65 / Fannie Mae Form 1003 (Effective 1/2021)"
      headerAction={
        <SaveStatus
          isSaving={saveMutation.isPending}
          lastSavedAt={lastSavedAt}
          onSave={handleSave}
        />
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

        <BorrowerSwitcherCard
          activeSeq={activeSeq}
          onSelectSeq={setActiveSeq}
          hasCoBorrower={hasCoBorrower}
          onAddCoBorrower={() => {
            setHasCoBorrower(true);
            setActiveSeq(2);
          }}
          onRemoveCoBorrower={() => {
            setBorrowerData((prev) => ({ ...prev, 2: emptySlice() }));
            setHasCoBorrower(false);
            setActiveSeq(1);
          }}
        />

        <Tabs value={activeStep} onValueChange={setActiveStep}>
          <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-8">
            <div className="mb-6 lg:sticky lg:top-6 lg:mb-0">
              <StepRail stepContext={stepContext} />
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
                <PropertySection propertyInfo={propertyInfo} onChange={setPropertyInfo} app={app} />
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

              <StepNav
                isFirstStep={stepIndex === 0}
                isLastStep={isLastStep}
                onBack={handleBack}
                onContinue={handleContinue}
                isSaving={saveMutation.isPending}
              />
            </div>
          </div>
        </Tabs>
    </PageShell>
  );
}
