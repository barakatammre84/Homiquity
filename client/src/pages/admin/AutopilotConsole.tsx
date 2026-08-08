import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  apiRequest,
  autopilotKeys,
  queryClient,
  type AutopilotMetricsRange,
} from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Lazy so recharts (~150KB) code-splits out of the console's main chunk.
const AutopilotTrendChart = lazy(() => import("./AutopilotTrendChart"));
interface AutopilotTrendResp {
  buckets: { date: string; count: number }[];
}
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
const DEFAULT_RANGE = "30";

/** Read a valid range from the URL (?range=), falling back to the default. */
function rangeFromUrl(): string {
  const r = new URLSearchParams(window.location.search).get("range");
  return RANGE_OPTIONS.some((o) => o.value === r) ? (r as string) : DEFAULT_RANGE;
}

const fmtTrendDate = (d: string): string =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Accessible table alternative to the trend chart (dataviz: a table view always
 * exists). Same data, screen-reader-friendly: caption, column/row headers, and a
 * total. No recharts dependency, so it renders even if the chart chunk fails.
 */
function TrendTable({ data }: { data: { date: string; count: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <div className="max-h-52 overflow-y-auto rounded-lg border border-border">
      <table className="w-full text-xs" data-testid="autopilot-trend-table">
        <caption className="sr-only">Daily Autopilot activity for the selected range</caption>
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-border text-muted-foreground">
            <th scope="col" className="px-3 py-2 text-left font-medium">Date</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Activity</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date} className="border-b border-border/50 last:border-0">
              <th scope="row" className="px-3 py-1.5 text-left font-normal text-foreground">
                {fmtTrendDate(d.date)}
              </th>
              <td className="px-3 py-1.5 text-right tabular-nums text-foreground">{d.count}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="sticky bottom-0 bg-card">
          <tr className="border-t border-border font-medium">
            <th scope="row" className="px-3 py-2 text-left">Total</th>
            <td className="px-3 py-2 text-right tabular-nums">{total}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function AutopilotConsole() {
  const { toast } = useToast();
  // Persist the selected range in the URL (?range=) so a reload or a shared link
  // keeps it. replaceState keeps filter changes out of the back-button history.
  const [rangeValue, setRangeRaw] = useState<string>(rangeFromUrl);
  const setRangeValue = (v: string) => {
    setRangeRaw(v);
    const sp = new URLSearchParams(window.location.search);
    sp.set("range", v);
    window.history.replaceState(null, "", `${window.location.pathname}?${sp.toString()}`);
  };
  const rangeDays = RANGE_OPTIONS.find((r) => r.value === rangeValue)?.days ?? 30;
  const [trendView, setTrendView] = useState<"chart" | "table">("chart");

  const { data: config, isLoading: configLoading } = useQuery<AutopilotConfigResp>({
    queryKey: autopilotKeys.config(),
  });

  // The window is resolved HERE, in render, and travels in the key.
  //
  // It used to be computed inside each queryFn (`new Date()` at fetch time)
  // while the key carried only `rangeDays`. That made the time window a request
  // input that did not appear in the cache key: one entry silently meant a
  // different 30 days on every refetch, and with refetchOnWindowFocus on, an
  // admin comparing two numbers could be reading two different windows.
  //
  // Pinned per range selection (not per render) so the key is stable — a
  // re-derived `to` on every render would mint a new key each time and refetch
  // forever. Choosing a range, or reloading, is what advances the window.
  const range = useMemo<AutopilotMetricsRange>(() => {
    const to = new Date();
    const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [rangeDays]);

  const { data: metrics, isLoading: metricsLoading } = useQuery<AutopilotMetricsResp>({
    queryKey: autopilotKeys.metrics(range),
  });
  const { data: trend, isLoading: trendLoading } = useQuery<AutopilotTrendResp>({
    queryKey: autopilotKeys.metricsTrend(range),
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
      queryClient.invalidateQueries({ queryKey: autopilotKeys.config() });
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

        {/* Daily activity trend — single series, so the title names it (no legend).
            A Chart/Table toggle gives an accessible table alternative. */}
        <Card className="mt-4">
          <CardContent className="p-4 sm:p-5">
            <Tabs value={trendView} onValueChange={(v) => setTrendView(v as "chart" | "table")}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Agent activity</h3>
                  <p className="text-xs text-muted-foreground">Reviews, follow-ups, and relays per day.</p>
                </div>
                <TabsList className="h-8">
                  <TabsTrigger value="chart" className="text-xs" data-testid="tab-trend-chart">
                    Chart
                  </TabsTrigger>
                  <TabsTrigger value="table" className="text-xs" data-testid="tab-trend-table">
                    Table
                  </TabsTrigger>
                </TabsList>
              </div>
              {trendLoading ? (
                <Skeleton className="h-52 w-full" />
              ) : (
                <>
                  <TabsContent value="chart" className="mt-0">
                    <Suspense fallback={<Skeleton className="h-52 w-full" />}>
                      <AutopilotTrendChart data={trend?.buckets ?? []} />
                    </Suspense>
                  </TabsContent>
                  <TabsContent value="table" className="mt-0">
                    <TrendTable data={trend?.buckets ?? []} />
                  </TabsContent>
                </>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
