import { CheckCircle2, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { matchesPipelineSearch } from "./derive";
import { PipelineLoanCard } from "./PipelineLoanCard";
import type { ComplianceData, PipelineSummary, QueueTask } from "./model";

export interface PipelineTabProps {
  pipeline: PipelineSummary[];
  isLoading: boolean;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  complianceData: ComplianceData | undefined;
  sortedQueueTasks: QueueTask[];
  /** Which loan has its inline compliance checklist expanded, if any. */
  checklistAppId: string | null;
  onToggleChecklist: (applicationId: string) => void;
  onViewFile: (applicationId: string) => void;
}

export function PipelineTab({
  pipeline,
  isLoading,
  searchTerm,
  onSearchTermChange,
  complianceData,
  sortedQueueTasks,
  checklistAppId,
  onToggleChecklist,
  onViewFile,
}: PipelineTabProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="text-lg font-semibold" data-testid="text-pipeline-heading">Active Loans</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search loans..."
              className="pl-9 w-48"
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              data-testid="input-search-pipeline"
            />
          </div>
        </div>
        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}</div>
        ) : pipeline.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">No active loans</p>
              <p className="text-muted-foreground">Pipeline is clear</p>
            </CardContent>
          </Card>
        ) : (
          pipeline
            .filter(item => matchesPipelineSearch(item, searchTerm))
            .map((item) => (
              <PipelineLoanCard
                key={item.applicationId}
                item={item}
                compApp={complianceData?.applications?.find(a => a.applicationId === item.applicationId)}
                openTasks={sortedQueueTasks.filter(t => t.applicationId === item.applicationId)}
                checklistOpen={checklistAppId === item.applicationId}
                onToggleChecklist={() => onToggleChecklist(item.applicationId)}
                onView={() => onViewFile(item.applicationId)}
              />
            ))
        )}
      </div>
    </div>
  );
}
