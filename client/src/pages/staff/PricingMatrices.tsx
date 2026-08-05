import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Lock, Plus } from "lucide-react";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { PageShell } from "@/components/PageShell";
import { StatsRow } from "./pricingMatrices/StatsRow";
import { MatrixVersionsTable } from "./pricingMatrices/MatrixVersionsTable";
import { ViewCellsDialog } from "./pricingMatrices/ViewCellsDialog";
import { ActivateDialog } from "./pricingMatrices/ActivateDialog";
import { RetireDialog } from "./pricingMatrices/RetireDialog";
import { ScheduleDialog } from "./pricingMatrices/ScheduleDialog";
import { PublishDialog } from "./pricingMatrices/PublishDialog";
import type { LookupMatrixListItem } from "./pricingMatrices/types";

export default function PricingMatrices() {
  const { user } = useAuth();
  const userRole = user?.role ?? "";
  const canRead = userRole === "admin" || userRole === "underwriter";
  const canManage = userRole === "admin";
  const [codeFilter, setCodeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [viewMatrix, setViewMatrix] = useState<LookupMatrixListItem | null>(null);
  const [activateMatrix, setActivateMatrix] = useState<LookupMatrixListItem | null>(null);
  const [retireMatrix, setRetireMatrix] = useState<LookupMatrixListItem | null>(null);
  const [scheduleMatrix, setScheduleMatrix] = useState<LookupMatrixListItem | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);

  const {
    data: matrices = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<LookupMatrixListItem[]>({
    queryKey: ["/api/lookup-matrices"],
    enabled: canRead,
  });

  const filtered = matrices.filter((m) => {
    if (codeFilter && !m.matrixCode.toLowerCase().includes(codeFilter.toLowerCase())) return false;
    if (statusFilter !== "ALL" && m.lifecycleStatus !== statusFilter) return false;
    return true;
  });

  const activeCount = matrices.filter((m) => m.lifecycleStatus === "ACTIVE").length;
  const draftCount = matrices.filter((m) => m.lifecycleStatus === "DRAFT").length;
  const retiredCount = matrices.filter((m) => m.lifecycleStatus === "RETIRED").length;
  const codeCount = new Set(matrices.map((m) => m.matrixCode)).size;

  const knownCodes = Array.from(new Set(matrices.map((m) => m.matrixCode))).sort();

  if (!canRead) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Lock className="h-10 w-10 text-muted-foreground" />
            <CardTitle data-testid="text-not-authorized-title">Not authorized</CardTitle>
            <CardDescription className="max-w-md" data-testid="text-not-authorized-description">
              Pricing matrices are managed by administrators and reviewed by underwriters. Your role
              doesn't have access to this screen.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PageShell
      width="full"
      title="Pricing Matrices"
      titleTestId="text-pricing-matrices-title"
      subtitle={
        canManage
          ? "Publish, schedule, activate, and retire versioned pricing & underwriting matrices"
          : "Review versioned pricing & underwriting matrices and their cells"
      }
      contentClassName="space-y-6"
      headerAction={
        canManage && (
          <Button onClick={() => setPublishOpen(true)} data-testid="button-open-publish">
            <Plus className="h-4 w-4 mr-2" />
            Publish New Version
          </Button>
        )
      }
    >
      {/* Before the stat tiles: the counts below are derived from `matrices`, so
          a failed load would render "0 active / 0 draft" — on a pricing
          governance screen that reads as a published state, not an outage. */}
      {isError && (
        <QueryErrorState
          error={error}
          onRetry={() => void refetch()}
          title="We couldn't load pricing matrices"
          data-testid="pricing-matrices-error"
        />
      )}

      <StatsRow
        isLoading={isLoading}
        isError={isError}
        activeCount={activeCount}
        draftCount={draftCount}
        retiredCount={retiredCount}
        codeCount={codeCount}
      />

      <MatrixVersionsTable
        matrices={filtered}
        isLoading={isLoading}
        canManage={canManage}
        codeFilter={codeFilter}
        onCodeFilterChange={setCodeFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onView={setViewMatrix}
        onActivate={setActivateMatrix}
        onSchedule={setScheduleMatrix}
        onRetire={setRetireMatrix}
      />

      <ViewCellsDialog matrix={viewMatrix} onClose={() => setViewMatrix(null)} />
      <ActivateDialog matrix={activateMatrix} onClose={() => setActivateMatrix(null)} />
      <RetireDialog matrix={retireMatrix} onClose={() => setRetireMatrix(null)} />
      <ScheduleDialog matrix={scheduleMatrix} onClose={() => setScheduleMatrix(null)} />
      <PublishDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        knownCodes={knownCodes}
      />
    </PageShell>
  );
}
