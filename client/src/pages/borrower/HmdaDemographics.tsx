import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, loanApplicationKeys } from "@/lib/queryClient";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, ShieldCheck, Users } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import type { HmdaDemographics as HmdaData } from "@shared/schema";
import { emptyHmdaForm, formToPayload, hmdaToForm, type HmdaFormState } from "./hmda/hmdaMapping";
import { HmdaDisclosureAlert } from "./hmda/HmdaDisclosureAlert";
import { EthnicityCard } from "./hmda/EthnicityCard";
import { RaceCard } from "./hmda/RaceCard";
import { SexCard } from "./hmda/SexCard";
import { AgeCard } from "./hmda/AgeCard";

interface HmdaResponse {
  demographics: HmdaData | null;
}

export default function HmdaDemographics() {
  const queryClient = useQueryClient();
  const { id: applicationId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [form, setForm] = useState<HmdaFormState>(emptyHmdaForm);
  const patch = (p: Partial<HmdaFormState>) => setForm((prev) => ({ ...prev, ...p }));

  const demographicsQuery = useQuery<HmdaResponse>({
    queryKey: loanApplicationKeys.hmda(applicationId),
    enabled: !!applicationId,
  });

  useEffect(() => {
    const d = demographicsQuery.data?.demographics;
    if (d) setForm(hmdaToForm(d));
  }, [demographicsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/loan-applications/${applicationId}/hmda`, formToPayload(form));
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Demographic information has been saved successfully." });
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.hmda(applicationId) });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save demographic information.", variant: "destructive" });
    },
  });

  if (demographicsQuery.isLoading) {
    return (
      <PageShell width="content" contentClassName="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </PageShell>
    );
  }

  // If the existing responses fail to load, don't show a blank form — the user
  // could unknowingly overwrite previously-saved demographics. Error + retry (ux-01).
  if (demographicsQuery.isError) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <QueryErrorState
          error={demographicsQuery.error}
          onRetry={() => demographicsQuery.refetch()}
          title="We couldn't load your information"
          data-testid="hmda-error"
        />
      </div>
    );
  }

  return (
    <PageShell
      width="content"
      icon={<Users className="h-6 w-6 text-muted-foreground" />}
      title="Demographic Information"
      subtitle="Government Monitoring Information (HMDA)"
      titleTestId="heading-hmda"
      headerLead={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation(`/dashboard`)}
          data-testid="button-back-dashboard"
          className="-ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      }
      contentClassName="space-y-6"
    >
      <HmdaDisclosureAlert />

      <EthnicityCard ethnicity={form.ethnicity} onChange={(ethnicity) => patch({ ethnicity })} />

      <RaceCard race={form.race} onChange={(race) => patch({ race })} />

      <SexCard sex={form.sex} onChange={(sex) => patch({ sex })} />

      <AgeCard
        age={form.age}
        ageNotProvided={form.ageNotProvided}
        onChange={({ age, ageNotProvided }) => patch({ age, ageNotProvided })}
      />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          <span>This information is collected for federal compliance purposes only and will not affect your loan application.</span>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="gap-2"
          data-testid="button-save-hmda"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Saving..." : "Save Information"}
        </Button>
      </div>
    </PageShell>
  );
}
