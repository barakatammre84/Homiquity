import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" }, { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" }, { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" }, { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" }, { value: "HI", label: "Hawaii" }, { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" }, { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" }, { value: "KY", label: "Kentucky" }, { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" }, { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" }, { value: "MN", label: "Minnesota" }, { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" }, { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" }, { value: "NH", label: "New Hampshire" }, { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" }, { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" }, { value: "OH", label: "Ohio" }, { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" }, { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" }, { value: "SD", label: "South Dakota" }, { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" }, { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" }, { value: "WA", label: "Washington" }, { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" },
];

function ProgramTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    grant: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    forgivable_loan: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    deferred_loan: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
    second_mortgage: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    matched_savings: "bg-pink-500/10 text-pink-700 dark:text-pink-300",
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
  const [filters, setFilters] = useState({
    state: "all",
    firstTimeBuyer: "all",
    minCreditScore: "",
    maxIncome: "",
  });

  const queryParams = new URLSearchParams();
  if (filters.state !== "all") queryParams.set("state", filters.state);
  if (filters.firstTimeBuyer === "yes") queryParams.set("firstTimeBuyer", "true");
  if (filters.minCreditScore) queryParams.set("minCreditScore", filters.minCreditScore);
  if (filters.maxIncome) queryParams.set("maxIncome", filters.maxIncome);

  const queryString = queryParams.toString();
  const endpoint = `/api/dpa-programs${queryString ? `?${queryString}` : ""}`;
  const { data: programs = [], isLoading } = useQuery<DpaProgram[]>({
    queryKey: [endpoint],
  });

  const activePrograms = programs.filter(p => p.isActive);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" data-testid="down-payment-wizard">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <PiggyBank className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground md:text-2xl" data-testid="text-wizard-title">Down Payment Assistance Finder</h1>
            <p className="text-sm text-muted-foreground">Find grants and programs that can reduce or eliminate your down payment.</p>
          </div>
        </div>
      </div>

      <Card className="mb-6 border-primary/20" data-testid="card-info">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Over $100 billion in down payment assistance is available nationwide</p>
              <p className="text-xs text-muted-foreground mt-1">
                Most first-time buyers qualify for at least one program. Filter below to find programs that match your profile.
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
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
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Annual Income</label>
              <Input
                type="number"
                value={filters.maxIncome}
                onChange={(e) => setFilters({ ...filters, maxIncome: e.target.value })}
                placeholder="e.g., 75000"
                className="mt-1"
                data-testid="input-income"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground" data-testid="text-result-count">
          {isLoading ? "Loading..." : `${activePrograms.length} program${activePrograms.length !== 1 ? "s" : ""} found`}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}</div>
      ) : activePrograms.length === 0 ? (
        <Card data-testid="card-no-results">
          <CardContent className="py-8 text-center">
            <Search className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">No programs found</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters. Many federal programs are available nationwide.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setFilters({ state: "all", firstTimeBuyer: "all", minCreditScore: "", maxIncome: "" })} data-testid="button-clear-filters">
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
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
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

      <Card className="mt-6" data-testid="card-bottom-cta">
        <CardContent className="py-6 text-center">
          <PiggyBank className="mx-auto h-8 w-8 text-primary mb-3" />
          <h3 className="font-bold text-foreground mb-1">Found a program that fits?</h3>
          <p className="text-sm text-muted-foreground mb-4">Start your pre-approval and we'll factor in DPA programs automatically.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild data-testid="button-apply">
              <Link href="/apply">
                Start Pre-Approval
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
            <Button variant="outline" asChild data-testid="button-dpa-coach">
              <Link href="/ai-coach">
                <Bot className="h-3.5 w-3.5" />
                Ask AI Coach
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
