import { Archive, CheckCircle2, Edit, Layers, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface StatsRowProps {
  isLoading: boolean;
  isError: boolean;
  activeCount: number;
  draftCount: number;
  retiredCount: number;
  codeCount: number;
}

function StatValue({ isLoading, isError, value, testId }: { isLoading: boolean; isError: boolean; value: number; testId: string }) {
  return (
    <p className="text-2xl font-bold" data-testid={testId}>
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isError ? "—" : value}
    </p>
  );
}

export function StatsRow({ isLoading, isError, activeCount, draftCount, retiredCount, codeCount }: StatsRowProps) {
  return (
    <div className="grid gap-6 md:grid-cols-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <StatValue isLoading={isLoading} isError={isError} value={activeCount} testId="stat-active" />
            </div>
            <CheckCircle2 className="h-8 w-8 text-primary/20" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm text-muted-foreground">Drafts</p>
              <StatValue isLoading={isLoading} isError={isError} value={draftCount} testId="stat-draft" />
            </div>
            <Edit className="h-8 w-8 text-primary/20" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm text-muted-foreground">Retired</p>
              <StatValue isLoading={isLoading} isError={isError} value={retiredCount} testId="stat-retired" />
            </div>
            <Archive className="h-8 w-8 text-primary/20" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm text-muted-foreground">Matrix Codes</p>
              <StatValue isLoading={isLoading} isError={isError} value={codeCount} testId="stat-codes" />
            </div>
            <Layers className="h-8 w-8 text-primary/20" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
