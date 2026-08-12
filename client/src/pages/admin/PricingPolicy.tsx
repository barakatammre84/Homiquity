import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";

/**
 * Admin pricing policy — the platform fee schedule and wholesale comp bands.
 *
 * These are the two halves of ONE Reg Z points-and-fees budget (audit F-17):
 * our fees and originator compensation compete for the same ~3% cap. Both used
 * to require a code change to move — the fee schedule as compile-time
 * constants, the comp bands as seed data with no surface — so a lender
 * renegotiation meant a deploy.
 *
 * The preview table is the point of the page, not decoration: it shows what a
 * candidate schedule does to real loan sizes BEFORE it is published, because
 * raising fees does not merely raise revenue — it eats the room compensation
 * needs, and past a point our own charges start getting trimmed to fit.
 */

interface FeeSchedule {
  applicationFee: number;
  underwritingFee: number;
  taxServiceFee: number;
  originationFeeRate: number;
}

interface PreviewRow {
  loanAmount: number;
  feesCharged: number;
  standardTotal: number;
  trimmed: boolean;
  originable: boolean;
  maxElectableBps: number | null;
}

interface FeeScheduleResponse {
  active: FeeSchedule;
  version: number | null;
  effectiveFrom: string | null;
  usingBaseline: boolean;
  baseline: FeeSchedule;
  preview: PreviewRow[];
  history: {
    version: number;
    applicationFee: number;
    underwritingFee: number;
    taxServiceFee: number;
    originationFeeRate: number;
    effectiveFrom: string;
    supersededAt: string | null;
    note: string | null;
  }[];
}

interface LenderComp {
  compensationType: "LENDER_PAID" | "BORROWER_PAID" | "EITHER";
  defaultBps: number;
  minBps: number;
  maxBps: number;
}

interface LenderRow {
  id: string;
  lenderName: string;
  lenderCode: string | null;
  status: string | null;
  brokerCompensation: LenderComp | null;
}

const FEE_SCHEDULE_KEY = ["/api/admin/pricing-policy/fee-schedule"] as const;
const LENDERS_KEY = ["/api/admin/pricing-policy/lenders"] as const;

export default function PricingPolicy() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<FeeScheduleResponse>({ queryKey: FEE_SCHEDULE_KEY });
  const { data: lenderData } = useQuery<{ lenders: LenderRow[] }>({ queryKey: LENDERS_KEY });

  const [draft, setDraft] = useState<Record<keyof FeeSchedule, string> | null>(null);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);

  const active = data?.active;
  const editing = draft !== null;

  const startEditing = () => {
    if (!active) return;
    setDraft({
      applicationFee: String(active.applicationFee),
      underwritingFee: String(active.underwritingFee),
      taxServiceFee: String(active.taxServiceFee),
      // Shown as a percentage; converted back to a fraction on submit. Entering
      // "1" and meaning 1% is the obvious slip, so the UI never asks for 0.01.
      originationFeeRate: String(active.originationFeeRate * 100),
    });
    setPreview(null);
    setNote("");
  };

  const draftToPayload = (d: Record<keyof FeeSchedule, string>) => ({
    applicationFee: Number(d.applicationFee),
    underwritingFee: Number(d.underwritingFee),
    taxServiceFee: Number(d.taxServiceFee),
    originationFeeRate: Number(d.originationFeeRate) / 100,
  });

  const draftValid =
    draft !== null &&
    (["applicationFee", "underwritingFee", "taxServiceFee", "originationFeeRate"] as const).every(
      key => draft[key].trim() !== "" && Number.isFinite(Number(draft[key])) && Number(draft[key]) >= 0,
    ) &&
    Number(draft.originationFeeRate) <= 5;

  const previewMutation = useMutation({
    mutationFn: async (): Promise<{ preview: PreviewRow[] }> => {
      const res = await apiRequest(
        "POST",
        "/api/admin/pricing-policy/fee-schedule/preview",
        draftToPayload(draft!),
      );
      return res.json();
    },
    onSuccess: result => setPreview(result.preview),
    onError: (error: Error) =>
      toast({ title: "Could not preview", description: error.message, variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/admin/pricing-policy/fee-schedule", {
        ...draftToPayload(draft!),
        note: note.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FEE_SCHEDULE_KEY });
      setDraft(null);
      setPreview(null);
      toast({
        title: "Fee schedule published",
        description: "New files price from this version. Existing disclosures are unchanged.",
      });
    },
    onError: (error: Error) =>
      toast({ title: "Could not publish", description: error.message, variant: "destructive" }),
  });

  const previewRows = preview ?? data?.preview ?? [];

  return (
    <div className="space-y-6" data-testid="page-pricing-policy">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Pricing policy</h1>
        <p className="text-sm text-muted-foreground">
          Our fees and originator compensation draw on one Reg Z points-and-fees budget. Moving
          either changes how much room the other has.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Platform fee schedule
            {data?.usingBaseline ? (
              <Badge variant="secondary" data-testid="badge-schedule-source">Built-in default</Badge>
            ) : (
              <Badge variant="secondary" data-testid="badge-schedule-source">
                Version {data?.version}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Published versions are append-only — a new version supersedes the old one and both are
            kept, so an already-issued Loan Estimate stays reproducible.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading || !active ? (
            <Skeleton className="h-24 w-full" />
          ) : !editing ? (
            <>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <span className="text-muted-foreground">Application fee</span>
                <span data-testid="text-application-fee">{formatCurrency(active.applicationFee)}</span>
                <span className="text-muted-foreground">Underwriting fee</span>
                <span data-testid="text-underwriting-fee">{formatCurrency(active.underwritingFee)}</span>
                <span className="text-muted-foreground">Tax service fee</span>
                <span data-testid="text-tax-service-fee">{formatCurrency(active.taxServiceFee)}</span>
                <span className="text-muted-foreground">Origination (borrower-paid)</span>
                <span data-testid="text-origination-rate">
                  {(active.originationFeeRate * 100).toFixed(3).replace(/\.?0+$/, "")}%
                </span>
              </div>
              <Button size="sm" onClick={startEditing} data-testid="button-edit-schedule">
                Edit fee schedule
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["applicationFee", "Application fee ($)"],
                    ["underwritingFee", "Underwriting fee ($)"],
                    ["taxServiceFee", "Tax service fee ($)"],
                    ["originationFeeRate", "Origination fee (% of loan)"],
                  ] as const
                ).map(([key, label]) => (
                  <div className="grid gap-1.5" key={key}>
                    <Label htmlFor={`fee-${key}`}>{label}</Label>
                    <Input
                      id={`fee-${key}`}
                      inputMode="decimal"
                      value={draft[key]}
                      onChange={event =>
                        setDraft({ ...draft, [key]: event.target.value })
                      }
                      data-testid={`input-${key}`}
                    />
                  </div>
                ))}
              </div>

              <Alert variant="info">
                <AlertDescription>
                  The tax service fee is a vendor pass-through — it is disclosed and it counts
                  against the QM cap, but it is never trimmed to make a file fit, because we cannot
                  discount someone else&apos;s charge.
                </AlertDescription>
              </Alert>

              <div className="grid gap-1.5">
                <Label htmlFor="fee-note">Why this change</Label>
                <Input
                  id="fee-note"
                  value={note}
                  onChange={event => setNote(event.target.value)}
                  placeholder="e.g. repriced after the Summit comp renegotiation"
                  data-testid="input-note"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!draftValid || previewMutation.isPending}
                  onClick={() => previewMutation.mutate()}
                  data-testid="button-preview-schedule"
                >
                  {previewMutation.isPending ? "Checking…" : "Preview impact"}
                </Button>
                <Button
                  size="sm"
                  disabled={!draftValid || note.trim() === "" || publishMutation.isPending}
                  onClick={() => publishMutation.mutate()}
                  data-testid="button-publish-schedule"
                >
                  {publishMutation.isPending ? "Publishing…" : "Publish new version"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Impact by loan size</CardTitle>
          <CardDescription>
            What a file at 200 bps lender-paid would actually be charged. &ldquo;Trimmed&rdquo;
            means our own fees were reduced to keep the file under the QM cap.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table data-testid="table-fee-preview">
              <TableHeader>
                <TableRow>
                  <TableHead>Loan amount</TableHead>
                  <TableHead>Fees charged</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Max comp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map(row => (
                  <TableRow key={row.loanAmount} data-testid={`row-preview-${row.loanAmount}`}>
                    <TableCell>{formatCurrency(row.loanAmount)}</TableCell>
                    <TableCell>{formatCurrency(row.feesCharged)}</TableCell>
                    <TableCell>
                      {!row.originable ? (
                        <Badge variant="destructive">Not originable</Badge>
                      ) : row.trimmed ? (
                        <Badge variant="secondary">Trimmed from {formatCurrency(row.standardTotal)}</Badge>
                      ) : (
                        <span className="text-muted-foreground">Full schedule</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.maxElectableBps === null ? "—" : `${row.maxElectableBps} bps`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <LenderCompensationCard lenders={lenderData?.lenders ?? []} />

      {data && data.history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Published history</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table data-testid="table-fee-history">
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Fees</TableHead>
                    <TableHead>Effective</TableHead>
                    <TableHead>Why</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.history.map(row => (
                    <TableRow key={row.version}>
                      <TableCell>
                        {row.version}
                        {row.supersededAt === null && (
                          <Badge variant="secondary" className="ml-2">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(row.applicationFee + row.underwritingFee + row.taxServiceFee)}
                      </TableCell>
                      <TableCell>{new Date(row.effectiveFrom).toLocaleDateString()}</TableCell>
                      <TableCell className="text-muted-foreground">{row.note ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LenderCompensationCard({ lenders }: { lenders: LenderRow[] }) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ defaultBps: string; minBps: string; maxBps: string }>({
    defaultBps: "",
    minBps: "",
    maxBps: "",
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, comp }: { id: string; comp: LenderComp }) =>
      apiRequest("PATCH", `/api/admin/pricing-policy/lenders/${id}`, comp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LENDERS_KEY });
      setEditingId(null);
      toast({ title: "Compensation band updated" });
    },
    onError: (error: Error) =>
      toast({ title: "Could not update", description: error.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wholesale compensation bands</CardTitle>
        <CardDescription>
          What each lender pays us, in basis points. This is the other half of the same QM budget —
          a richer comp plan leaves less room for our fees.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table data-testid="table-lender-comp">
            <TableHeader>
              <TableRow>
                <TableHead>Lender</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Range</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lenders.map(lender => {
                const comp = lender.brokerCompensation;
                const isEditing = editingId === lender.id;
                return (
                  <TableRow key={lender.id} data-testid={`row-lender-${lender.id}`}>
                    <TableCell>{lender.lenderName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {comp?.compensationType ?? "—"}
                    </TableCell>
                    {isEditing ? (
                      <>
                        <TableCell>
                          <Input
                            aria-label="Default basis points"
                            inputMode="numeric"
                            value={draft.defaultBps}
                            onChange={e => setDraft({ ...draft, defaultBps: e.target.value })}
                            data-testid={`input-default-bps-${lender.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Input
                              aria-label="Minimum basis points"
                              inputMode="numeric"
                              value={draft.minBps}
                              onChange={e => setDraft({ ...draft, minBps: e.target.value })}
                              data-testid={`input-min-bps-${lender.id}`}
                            />
                            <Input
                              aria-label="Maximum basis points"
                              inputMode="numeric"
                              value={draft.maxBps}
                              onChange={e => setDraft({ ...draft, maxBps: e.target.value })}
                              data-testid={`input-max-bps-${lender.id}`}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            disabled={saveMutation.isPending}
                            onClick={() =>
                              saveMutation.mutate({
                                id: lender.id,
                                comp: {
                                  compensationType: comp?.compensationType ?? "LENDER_PAID",
                                  defaultBps: Number(draft.defaultBps),
                                  minBps: Number(draft.minBps),
                                  maxBps: Number(draft.maxBps),
                                },
                              })
                            }
                            data-testid={`button-save-lender-${lender.id}`}
                          >
                            Save
                          </Button>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell data-testid={`text-default-bps-${lender.id}`}>
                          {comp ? `${comp.defaultBps} bps` : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {comp ? `${comp.minBps}–${comp.maxBps} bps` : "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingId(lender.id);
                              setDraft({
                                defaultBps: String(comp?.defaultBps ?? ""),
                                minBps: String(comp?.minBps ?? ""),
                                maxBps: String(comp?.maxBps ?? ""),
                              });
                            }}
                            data-testid={`button-edit-lender-${lender.id}`}
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
