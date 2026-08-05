import type { ReactNode } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_DISPLAY_NAMES } from "@shared/roles";

export interface DashboardHeroProps {
  userRole: string;
  onRefreshAll: () => void;
  /** The CreateTaskDialog, which owns its own trigger button. */
  action: ReactNode;
}

export function DashboardHero({ userRole, onRefreshAll, action }: DashboardHeroProps) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/90">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />

      <div className="relative px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary-foreground/80 mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm font-medium">Unified Command Center</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl" data-testid="text-staff-dashboard-title">
              {ROLE_DISPLAY_NAMES[userRole as keyof typeof ROLE_DISPLAY_NAMES] || "Staff"} Dashboard
            </h1>
            <p className="mt-1 text-sm text-primary-foreground/80">
              Pipeline, tasks, compliance, and activity in one view
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/20 text-white"
              onClick={onRefreshAll}
              data-testid="button-refresh-all"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh All
            </Button>
            {action}
          </div>
        </div>
      </div>
    </div>
  );
}
