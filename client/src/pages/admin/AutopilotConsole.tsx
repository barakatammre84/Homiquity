import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, FileSearch, ListChecks, FolderKanban, Clock, Power, BadgeCheck, AlertTriangle } from "lucide-react";

interface AutopilotConfigResp {
  enabled: boolean;
  followUpGenerationEnabled: boolean;
  applicationDataUpdatesEnabled: boolean;
  decisionRelayEnabled: boolean;
  loanOfficerAllowlist: string[] | null;
  guidelineMode: string;
  updatedAt: string | null;
}

interface AutopilotMetricsResp {
  range: { from: string; to: string };
  documentsReviewed: number;
  agentActions: number;
  followUpsCreated: number;
  applicationsTouched: number;
  approvalsRelayed: number;
  adverseActionFlags: number;
  hoursSaved: number;
  minutesSavedPerReview: number;
}

function ToggleRow(props: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{props.label}</Label>
        <p className="text-xs text-muted-foreground">{props.description}</p>
      </div>
      <Switch checked={props.checked} onCheckedChange={props.onChange} data-testid={props.testId} />
    </div>
  );
}

function StatCard(props: { icon: React.ElementType; label: string; value: string | number; hint?: string }) {
  const Icon = props.icon;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">{props.label}</span>
        </div>
        <p className="mt-2 text-2xl font-bold tabular-nums">{props.value}</p>
        {props.hint && <p className="text-xs text-muted-foreground mt-0.5">{props.hint}</p>}
      </CardContent>
    </Card>
  );
}

const RANGE_OPTIONS: { value: string; label: string; days: number }[] = [
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "90", label: "Last 90 days", days: 90 },
  { value: "365", label: "Last 12 months", days: 365 },
];

export default function AutopilotConsole() {
  const { toast } = useToast();
  const [rangeValue, setRangeValue] = useState("30");
  const rangeDays = RANGE_OPTIONS.find((r) => r.value === rangeValue)?.days ?? 30;

  const { data: config, isLoading: configLoading } = useQuery<AutopilotConfigResp>({
    queryKey: ["/api/autopilot/config"],
  });
  const { data: metrics, isLoading: metricsLoading } = useQuery<AutopilotMetricsResp>({
    // Re-fetches when the range changes (rangeDays is part of the key).
    queryKey: ["/api/autopilot/metrics", rangeDays],
    queryFn: async () => {
      const to = new Date();
      const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000);
      const res = await fetch(
        `/api/autopilot/metrics?from=${from.toISOString()}&to=${to.toISOString()}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load metrics");
      return res.json();
    },
  });

  const [enabled, setEnabled] = useState(false);
  const [followUp, setFollowUp] = useState(true);
  const [appData, setAppData] = useState(true);
  const [decisionRelay, setDecisionRelay] = useState(false);
  const [allowlist, setAllowlist] = useState("");

  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setFollowUp(config.followUpGenerationEnabled);
      setAppData(config.applicationDataUpdatesEnabled);
      setDecisionRelay(config.decisionRelayEnabled);
      setAllowlist((config.loanOfficerAllowlist ?? []).join(", "));
    }
  }, [config]);

  const save = useMutation({
    mutationFn: async () => {
      const list = allowlist.split(",").map((s) => s.trim()).filter(Boolean);
      const res = await apiRequest("PATCH", "/api/autopilot/config", {
        enabled,
        followUpGenerationEnabled: followUp,
        applicationDataUpdatesEnabled: appData,
        decisionRelayEnabled: decisionRelay,
        loanOfficerAllowlist: list.length ? list : null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autopilot/config"] });
      toast({ title: "Autopilot settings saved" });
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  const dirty =
    config &&
    (enabled !== config.enabled ||
      followUp !== config.followUpGenerationEnabled ||
      appData !== config.applicationDataUpdatesEnabled ||
      decisionRelay !== config.decisionRelayEnabled ||
      allowlist !== (config.loanOfficerAllowlist ?? []).join(", "));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-autopilot-console-title">
            Autopilot
          </h1>
          <p className="text-sm text-muted-foreground">
            Always-on packaging agent — reviews documents, builds needs lists, and drives files toward
            lender-ready. It never makes a credit decision; the lender does.
          </p>
        </div>
      </div>

      {/* Activation */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Power className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">Activation</h2>
              {config && (
                <Badge variant={config.enabled ? "default" : "secondary"} data-testid="badge-autopilot-state">
                  {config.enabled ? "Active" : "Off"}
                </Badge>
              )}
            </div>
          </div>

          {configLoading ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="mt-2 divide-y">
              <ToggleRow
                label="Enable Autopilot"
                description="Master switch. When off, uploads and sections behave exactly as before — no agent runs."
                checked={enabled}
                onChange={setEnabled}
                testId="switch-autopilot-enabled"
              />
              <ToggleRow
                label="Follow-Up Generation"
                description="Let the agent create guideline-cited document conditions from its findings."
                checked={followUp}
                onChange={setFollowUp}
                testId="switch-autopilot-followups"
              />
              <ToggleRow
                label="Application Data Updates"
                description="Reserved for verified writebacks to application data (reconciliation)."
                checked={appData}
                onChange={setAppData}
                testId="switch-autopilot-appdata"
              />
              <ToggleRow
                label="Decision Relay"
                description="Relay a lender's decision — approval to the borrower (Reg N), denial to staff for the ECOA §1002.9 adverse-action notice. Borrower-facing: enable only after counsel sign-off."
                checked={decisionRelay}
                onChange={setDecisionRelay}
                testId="switch-autopilot-decision-relay"
              />
              <div className="py-3 space-y-1.5">
                <Label htmlFor="autopilot-allowlist" className="text-sm font-medium">
                  Loan-officer pilot allowlist
                </Label>
                <p className="text-xs text-muted-foreground">
                  Comma-separated LO user ids. Leave blank to run for all loan officers.
                </p>
                <Input
                  id="autopilot-allowlist"
                  value={allowlist}
                  onChange={(e) => setAllowlist(e.target.value)}
                  placeholder="e.g. lo_123, lo_456"
                  data-testid="input-autopilot-allowlist"
                />
              </div>
              <div className="flex items-center justify-between gap-3 pt-4">
                <span className="text-xs text-muted-foreground">
                  Guideline mode: <span className="font-medium">Fannie Mae</span>
                </span>
                <Button
                  onClick={() => save.mutate()}
                  disabled={!dirty || save.isPending}
                  data-testid="button-autopilot-save"
                >
                  {save.isPending ? "Saving…" : "Save settings"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Value / ROI */}
      <div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-base font-semibold">Agent value</h2>
          <Select value={rangeValue} onValueChange={setRangeValue}>
            <SelectTrigger className="h-8 w-[150px] text-xs" data-testid="select-autopilot-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value} className="text-xs">
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {metricsLoading ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard icon={FileSearch} label="Documents reviewed" value={metrics?.documentsReviewed ?? 0} />
            <StatCard icon={ListChecks} label="Follow-ups created" value={metrics?.followUpsCreated ?? 0} />
            <StatCard icon={FolderKanban} label="Applications touched" value={metrics?.applicationsTouched ?? 0} />
            <StatCard icon={BadgeCheck} label="Approvals relayed" value={metrics?.approvalsRelayed ?? 0} />
            <StatCard icon={AlertTriangle} label="Adverse-action flags" value={metrics?.adverseActionFlags ?? 0} />
            <StatCard
              icon={Clock}
              label="Hours saved"
              value={metrics?.hoursSaved ?? 0}
              hint="documents × 8 min"
            />
          </div>
        )}
      </div>
    </div>
  );
}
