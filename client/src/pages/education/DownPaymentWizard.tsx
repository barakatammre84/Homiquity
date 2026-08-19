import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PRELAUNCH_GATED } from "@/lib/prelaunch";
import { SEOHead } from "@/components/SEOHead";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  DollarSign,
  MapPin,
  Star,
  Filter,
  PiggyBank,
  Building2,
  Users,
  Info,
  ArrowRight,
  Bot,
} from "lucide-react";
import { Link } from "wouter";
import { US_STATES as US_STATE_OPTIONS } from "@/lib/us-states";
import { LICENSED_STATES, unlicensedStateMessage } from "@shared/companyIdentity";

interface DpaProgram {
  id: string;
  name: string;
  programType: string;
  state: string | null;
  description: string;
  assistanceType: string;
  maxAssistanceAmount: string | null;
  maxAssistancePercent: string | null;
  minCreditScore: number | null;
  maxIncome: string | null;
  maxHomePrice: string | null;
  firstTimeBuyerOnly: boolean;
  eligibilityNotes: string | null;
  applicationUrl: string | null;
  isActive: boolean;
}

const US_STATES = [
  { value: "all", label: "All States" },
  ...US_STATE_OPTIONS,
];

function ProgramTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    grant: "bg-success/10 text-success-subtle-foreground",
    forgivable_loan: "bg-info/10 text-info",
    deferred_loan: "bg-primary/10 text-primary",
    second_mortgage: "bg-warning/10 text-warning-subtle-foreground",
    matched_savings: "bg-primary/10 text-primary",
  };
  const labels: Record<string, string> = {
    grant: "Grant",
    forgivable_loan: "Forgivable Loan",
    deferred_loan: "Deferred Loan",
    second_mortgage: "2nd Mortgage",
    matched_savings: "Matched Savings",
  };
  return <Badge variant="secondary" className={styles[type] || ""}>{labels[type] || type}</Badge>;
}



export default function DownPaymentWizard() {
  // Defaults to Illinois — the directory's actual coverage — not "all".
  const [filters, setFilters] = useState({
    state: "IL",
    firstTimeBuyer: "all",
    minCreditScore: "",
  });

  const queryParams = new URLSearchParams();
  if (filters.state !== "all") queryParams.set("state", filters.state);
  if (filters.firstTimeBuyer === "yes") queryParams.set("firstTimeBuyer", "true");
  if (filters.minCreditScore) queryParams.set("minCreditScore", filters.minCreditScore);

  // Shown whenever a concrete state outside the licensed footprint is selected,
  // regardless of result count — the notice must stay correct even if the
  // directory ever gains rows for that state.
  const unlicensedStateSelected =
    filters.state !== "all" && !(LICENSED_STATES as readonly string[]).includes(filters.state);

  const queryString = queryParams.toString();
  const endpoint = `/api/dpa-programs${queryString ? `?${queryString}` : ""}`;
  const { data: programs = [], isLoading } = useQuery<DpaProgram[]>({
    queryKey: [endpoint],
  });

  const activePrograms = programs.filter(p => p.isActive);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" data-testid="down-payment-wizard">
      <SEOHead
        title="Down Payment Assistance Finder"
        description="Explore down payment assistance and grant programs — filter by state, first-time buyer status, and credit score to see what each program offers."
        canonical="/down-payment-wizard"
      />
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <PiggyBank className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground md:text-2xl" data-testid="text-wizard-title">Down Payment Assistance Finder</h1>
            <p className="text-sm text-muted-foreground">Find grants and programs that can reduce the cash you need at closing.</p>
          </div>
        </div>
      </div>

      <Card className="mb-6 border-primary/20" data-testid="card-info">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Down payment assistance comes from state and local housing agencies and nonprofits</p>
              <p className="text-xs text-muted-foreground mt-1">
                Grants, forgivable loans, and deferred loans that reduce the cash you need at closing. This directory is
                educational information — program terms are set by the administering agencies and can change, and funding
                can pause without notice. Confirm current details with the agency or a HUD-approved housing counselor.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6" data-testid="card-filters">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filter Programs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">State</label>
              <Select value={filters.state} onValueChange={(v) => setFilters({ ...filters, state: v })}>
                <SelectTrigger className="mt-1" data-testid="select-state">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">First-Time Buyer?</label>
              <Select value={filters.firstTimeBuyer} onValueChange={(v) => setFilters({ ...filters, firstTimeBuyer: v })}>
                <SelectTrigger className="mt-1" data-testid="select-first-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Show All</SelectItem>
                  <SelectItem value="yes">Yes, First-Time Buyer</SelectItem>
                  <SelectItem value="no">No, Repeat Buyer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Your Credit Score</label>
              <Input
                type="number"
                value={filters.minCreditScore}
                onChange={(e) => setFilters({ ...filters, minCreditScore: e.target.value })}
                placeholder="e.g., 680"
                className="mt-1"
                data-testid="input-credit-score"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                We hide programs whose published minimum score is above yours.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground" data-testid="text-result-count">
          {isLoading ? "Loading..." : `${activePrograms.length} program${activePrograms.length !== 1 ? "s" : ""} found`}
        </p>
        <p className="text-xs text-muted-foreground" data-testid="text-coverage-note">
          Our directory currently lists Illinois programs — IHDA statewide, City of Chicago, and Cook County — verified
          with the administering agencies as of July 2026.
        </p>
      </div>

      {unlicensedStateSelected && (
        <Card className="mb-4 border-primary/20" data-testid="card-unlicensed-state-notice">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">{unlicensedStateMessage(filters.state)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}</div>
      ) : activePrograms.length === 0 ? (
        <Card data-testid="card-no-results">
          <CardContent className="py-8 text-center">
            <Search className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">No programs found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Our directory currently lists Illinois programs, verified as of July 2026 — we don't yet have entries for
              other states. Your state's housing finance agency or a HUD-approved housing counselor can point you to
              local programs.
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setFilters({ state: "all", firstTimeBuyer: "all", minCreditScore: "" })} data-testid="button-clear-filters">
              Clear All Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3" data-testid="programs-list">
          {activePrograms.map((program) => (
            <Card key={program.id} className="hover-elevate" data-testid={`card-program-${program.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm font-semibold text-foreground">{program.name}</h3>
                      <ProgramTypeBadge type={program.assistanceType} />
                      <Badge variant="outline" className="text-[10px]">{program.programType}</Badge>
                      {program.firstTimeBuyerOnly && (
                        <Badge variant="outline" className="text-[10px] border-border/30 text-success-subtle-foreground">
                          <Users className="h-3 w-3 mr-0.5" /> First-Time Only
                        </Badge>
                      )}
                    </div>
                    {program.description && (
                      <p className="text-xs text-muted-foreground mb-2">{program.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      {(program.maxAssistancePercent || program.maxAssistanceAmount) && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Up to {program.maxAssistancePercent ? `${program.maxAssistancePercent}%` : `$${Number(program.maxAssistanceAmount).toLocaleString()}`}
                        </span>
                      )}
                      {program.state ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {program.state}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> Nationwide
                        </span>
                      )}
                      {program.minCreditScore && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" /> Min {program.minCreditScore} credit
                        </span>
                      )}
                      {program.maxIncome && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> Income limit: ${Number(program.maxIncome).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {program.eligibilityNotes && (
                      <p className="text-[10px] text-muted-foreground mt-2 italic">{program.eligibilityNotes}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6" data-testid="card-il-guides">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Buying in Illinois?</p>
              <p className="text-xs text-muted-foreground mt-1">
                Our Learning Center guides cover the{" "}
                <Link href="/learn/illinois-down-payment-assistance-2026" className="underline underline-offset-2" data-testid="link-wizard-dpa-ihda">
                  four IHDA statewide programs
                </Link>
                , the{" "}
                <Link href="/learn/chicago-homegrown-purchase-assistance" className="underline underline-offset-2" data-testid="link-wizard-dpa-homegrown">
                  Chicago HomeGrown grant (up to $70,000)
                </Link>
                , and the{" "}
                <Link href="/learn/cook-county-down-payment-assistance-2026" className="underline underline-offset-2" data-testid="link-wizard-dpa-cook">
                  Cook County program reopening July 20, 2026
                </Link>
                .
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6" data-testid="card-bottom-cta">
        <CardContent className="py-6 text-center">
          <PiggyBank className="mx-auto h-8 w-8 text-primary mb-3" />
          <h3 className="font-bold text-foreground mb-1">Found a program worth a closer look?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {PRELAUNCH_GATED
              ? "Program terms and funding change — confirm current details with the administering agency or a HUD-approved housing counselor before you plan around a program."
              : "Mention it to your loan team when you apply — they can walk through how assistance programs work alongside a mortgage."}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            {!PRELAUNCH_GATED && (
              <Button asChild data-testid="button-apply">
                <Link href="/apply">
                  Start Pre-Approval
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild data-testid="button-dpa-coach">
              <Link href="/ai-coach">
                <Bot className="h-3.5 w-3.5" />
                Ask Homi
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
