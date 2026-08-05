import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-boundary";
import {
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Info,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { type ClosingGuaranteeRecord } from "./closingGuarantee/types";
import { GuaranteeCard } from "./closingGuarantee/GuaranteeCard";
import { CreateGuaranteeDialog } from "./closingGuarantee/CreateGuaranteeDialog";

export default function ClosingGuarantee() {
  const [searchAppId, setSearchAppId] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const endpoint = activeSearch
    ? `/api/closing-guarantees/${activeSearch}`
    : "/api/closing-guarantees";

  const { data: guarantees = [], isLoading, isError, error, refetch } = useQuery<ClosingGuaranteeRecord[]>({
    queryKey: ["/api/closing-guarantees", activeSearch],
  });

  // Counters read from the same defaulted [] — on error they are all 0, which
  // is why the list below fails visibly rather than rendering an empty state.
  const activeCount = guarantees.filter((g) => g.status === "active").length;
  const onTrackCount = guarantees.filter((g) => g.status === "active" && !g.isAtRisk).length;
  const atRiskCount = guarantees.filter((g) => g.isAtRisk).length;
  const metCount = guarantees.filter((g) => g.isMet).length;

  return (
    <PageShell
      width="content"
      icon={
        <div className="p-2 bg-primary/10 rounded-lg">
          <Shield className="h-5 w-5 text-primary" />
        </div>
      }
      title="Zero-Stress Closing Guarantee"
      subtitle="Track closing timeline guarantees in real time"
      titleTestId="text-page-title"
    >

      <Card className="mb-6 border-primary/20" data-testid="card-info">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Our Closing Guarantees</p>
              <p className="text-xs text-muted-foreground mt-1">
                We guarantee 24-hour underwriting decisions, 48-hour appraisal scheduling, and 10-day close options.
                If we miss a guarantee, we make it right.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
        <Card data-testid="stat-active">
          <CardContent className="py-3 text-center">
            <Clock className="h-5 w-5 text-info mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground" data-testid="text-active-count">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-on-track">
          <CardContent className="py-3 text-center">
            <CheckCircle2 className="h-5 w-5 text-success-subtle-foreground mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground" data-testid="text-on-track-count">{onTrackCount}</p>
            <p className="text-xs text-muted-foreground">On Track</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-at-risk">
          <CardContent className="py-3 text-center">
            <AlertTriangle className="h-5 w-5 text-warning-subtle-foreground mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground" data-testid="text-at-risk-count">{atRiskCount}</p>
            <p className="text-xs text-muted-foreground">At Risk</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-met">
          <CardContent className="py-3 text-center">
            <CheckCircle2 className="h-5 w-5 text-success-subtle-foreground mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground" data-testid="text-met-count">{metCount}</p>
            <p className="text-xs text-muted-foreground">Met</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="flex gap-2">
            <Input
              value={searchAppId}
              onChange={(e) => setSearchAppId(e.target.value)}
              placeholder="Enter Application ID to filter..."
              data-testid="input-search-app-id"
            />
            <Button
              variant="outline"
              onClick={() => setActiveSearch(searchAppId.trim())}
              data-testid="button-search"
            >
              <Search className="h-4 w-4 mr-1" /> Search
            </Button>
            {activeSearch && (
              <Button
                variant="outline"
                onClick={() => { setActiveSearch(""); setSearchAppId(""); }}
                data-testid="button-clear-search"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
        <CreateGuaranteeDialog />
      </div>

      {activeSearch && (
        <p className="text-sm text-muted-foreground mb-3" data-testid="text-filter-info">
          Showing guarantees for application: <span className="font-medium text-foreground">{activeSearch}</span>
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : isError ? (
        // "No guarantees found" on a failed load reads as an all-clear on a
        // page whose whole job is surfacing at-risk closing commitments — and
        // the four counters above would all show 0 alongside it (ux-01).
        <QueryErrorState
          error={error}
          onRetry={() => void refetch()}
          title="We couldn't load the guarantees"
          data-testid="closing-guarantees-error"
        />
      ) : guarantees.length === 0 ? (
        <Card data-testid="card-no-guarantees">
          <CardContent className="py-8 text-center">
            <Shield className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">No guarantees found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {activeSearch
                ? "No guarantees found for this application. Try a different ID."
                : "Create a guarantee to start tracking closing timelines."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3" data-testid="guarantees-list">
          {guarantees.map((g) => (
            <GuaranteeCard key={g.id} guarantee={g} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
