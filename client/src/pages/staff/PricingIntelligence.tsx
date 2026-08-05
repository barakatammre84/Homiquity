import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Crosshair, ShieldAlert } from "lucide-react";

/**
 * Staff pricing-intelligence panel (roadmap ARC-2) — the consumer for the
 * three market-data moat endpoints (public HMDA + Fannie Mae performance
 * aggregates). READ-ONLY and advisory by design: nothing here writes pricing —
 * rate changes go through rate sheets (see competitorRateService's Reg Z
 * rationale). Staff-only because competitor-relative positioning is an
 * internal pricing input, never a borrower-facing disclosure.
 *
 * Honesty rules:
 *  - A 404 means the ingest hasn't run — the endpoint's own hint is rendered,
 *    never an empty chart pretending to be data.
 *  - deltaBps is signed and labeled (negative = we win); no absolute-value
 *    flattering.
 */

interface UndercutQuote {
  ourBestOffer: {
    lenderName: string;
    productName: string;
    productType: string;
    adjustedRate: number;
  } | null;
  benchmark: {
    medianRate: number;
    p25Rate: number | null;
    p75Rate: number | null;
    loanCount: number;
    activityYear: number;
    resolvedLevel: string;
    lenders: string;
  } | null;
  deltaBps: number | null;
  beatsMedian: boolean | null;
  note: string;
}

interface RiskProfile {
  creditBucket: string;
  ltvBand: string;
  dtiBand: string;
  loanCount: number;
  defaultRatePct: string | null;
  seriousDelinqRatePct: string | null;
  prepayRatePct: string | null;
  avgOrigRate: string | null;
  sourceDataset: string;
}

interface ProfileInput {
  creditScore: string;
  loanAmount: string;
  propertyValue: string;
  state: string;
}

const rate = (v: number | string | null | undefined) =>
  v === null || v === undefined ? "—" : `${parseFloat(String(v)).toFixed(3)}%`;

export default function PricingIntelligence() {
  const [form, setForm] = useState<ProfileInput>({
    creditScore: "740",
    loanAmount: "380000",
    propertyValue: "475000",
    state: "IL",
  });
  const [submitted, setSubmitted] = useState<ProfileInput | null>(null);

  const params = submitted
    ? new URLSearchParams({
        creditScore: submitted.creditScore,
        loanAmount: submitted.loanAmount,
        propertyValue: submitted.propertyValue,
        ...(submitted.state ? { state: submitted.state.toUpperCase() } : {}),
      }).toString()
    : "";
  const ltv = submitted
    ? ((parseFloat(submitted.loanAmount) / parseFloat(submitted.propertyValue)) * 100).toFixed(1)
    : "";

  const undercut = useQuery<UndercutQuote>({
    queryKey: [`/api/market-data/undercut-quote?${params}`],
    enabled: !!submitted,
    retry: false,
  });
  const risk = useQuery<RiskProfile>({
    queryKey: [
      `/api/market-data/risk-profile?creditScore=${submitted?.creditScore ?? ""}&ltv=${ltv}`,
    ],
    enabled: !!submitted,
    retry: false,
  });

  const set = (key: keyof ProfileInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const valid =
    parseInt(form.creditScore, 10) > 0 &&
    parseFloat(form.loanAmount) > 0 &&
    parseFloat(form.propertyValue) > 0;

  return (
    <div className="space-y-6 p-6" data-testid="page-pricing-intelligence">
      <div>
        <h1 className="text-2xl font-semibold">Pricing Intelligence</h1>
        <p className="text-sm text-muted-foreground">
          Where our best executable rate sits against the ingested competitor market, and how the
          borrower&apos;s risk band has historically performed. Advisory only — rate changes go
          through rate sheets, never from here.
        </p>
      </div>

      <Card data-testid="card-profile-form">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crosshair className="h-5 w-5" />
            Borrower profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) setSubmitted(form);
            }}
          >
            <div>
              <Label htmlFor="pi-score">Credit score</Label>
              <Input id="pi-score" inputMode="numeric" value={form.creditScore} onChange={set("creditScore")} data-testid="input-credit-score" />
            </div>
            <div>
              <Label htmlFor="pi-loan">Loan amount</Label>
              <Input id="pi-loan" inputMode="numeric" value={form.loanAmount} onChange={set("loanAmount")} data-testid="input-loan-amount" />
            </div>
            <div>
              <Label htmlFor="pi-value">Property value</Label>
              <Input id="pi-value" inputMode="numeric" value={form.propertyValue} onChange={set("propertyValue")} data-testid="input-property-value" />
            </div>
            <div>
              <Label htmlFor="pi-state">State</Label>
              <Input id="pi-state" maxLength={2} value={form.state} onChange={set("state")} data-testid="input-state" />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={!valid} className="w-full" data-testid="button-run-analysis">
                Run analysis
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {submitted && (
        <>
          {/* ---- Us vs the market ---- */}
          <Card data-testid="card-undercut">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Us vs. the market
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {undercut.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : undercut.isError ? (
                <p className="text-sm text-muted-foreground" data-testid="text-undercut-error">
                  {(undercut.error as Error).message}
                </p>
              ) : undercut.data ? (
                <>
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Our best offer</div>
                      <div className="text-xl font-semibold" data-testid="text-our-rate">
                        {undercut.data.ourBestOffer ? rate(undercut.data.ourBestOffer.adjustedRate) : "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {undercut.data.ourBestOffer
                          ? `${undercut.data.ourBestOffer.lenderName} · ${undercut.data.ourBestOffer.productName}`
                          : "No executable offer for this profile"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Competitor median</div>
                      <div className="text-xl font-semibold" data-testid="text-market-median">
                        {undercut.data.benchmark ? rate(undercut.data.benchmark.medianRate) : "—"}
                      </div>
                      {undercut.data.benchmark && (
                        <div className="text-xs text-muted-foreground">
                          p25 {rate(undercut.data.benchmark.p25Rate)} · p75 {rate(undercut.data.benchmark.p75Rate)} ·{" "}
                          {undercut.data.benchmark.loanCount.toLocaleString()} loans ({undercut.data.benchmark.activityYear},{" "}
                          {undercut.data.benchmark.resolvedLevel})
                        </div>
                      )}
                    </div>
                    {undercut.data.deltaBps !== null && (
                      <Badge
                        variant={undercut.data.beatsMedian ? "success" : "warning"}
                        data-testid="badge-delta"
                      >
                        {undercut.data.deltaBps > 0 ? "+" : ""}
                        {undercut.data.deltaBps} bps vs median
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground" data-testid="text-undercut-note">
                    {undercut.data.note}
                  </p>
                </>
              ) : null}
            </CardContent>
          </Card>

          {/* ---- Risk band history ---- */}
          <Card data-testid="card-risk-profile">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Risk-band history (LTV {ltv}%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {risk.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : risk.isError ? (
                <p className="text-sm text-muted-foreground" data-testid="text-risk-error">
                  {(risk.error as Error).message}
                </p>
              ) : risk.data ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-6 text-sm" data-testid="risk-stats">
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Default rate</div>
                      <div className="font-semibold">{rate(risk.data.defaultRatePct)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">90+ day delinq</div>
                      <div className="font-semibold">{rate(risk.data.seriousDelinqRatePct)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Prepay rate</div>
                      <div className="font-semibold">{rate(risk.data.prepayRatePct)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Cohort</div>
                      <div className="font-semibold">
                        {risk.data.creditBucket} / {risk.data.ltvBand} / {risk.data.dtiBand}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {risk.data.loanCount.toLocaleString()} loans · dataset {risk.data.sourceDataset} — historical
                    Fannie Mae performance, not a prediction for this borrower.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
