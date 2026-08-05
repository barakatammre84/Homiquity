import { Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTimeRemaining } from "@/lib/formatters";
import { slaBadgeClass } from "./slaClassBadge";
import type { SlaClassConfig } from "./types";

export function SlaClassesCard({ slaClasses }: { slaClasses: SlaClassConfig[] | undefined }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          SLA Classes
        </CardTitle>
        <CardDescription>
          Response time requirements
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {slaClasses?.map((sla) => (
            <div
              key={sla.id}
              className="flex items-center justify-between p-2 rounded-md border"
            >
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={slaBadgeClass(sla.colorCode)}
                  data-testid={`badge-sla-class-${sla.slaClass}`}
                >
                  {sla.slaClass}
                </Badge>
                <span className="text-sm font-medium">{sla.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {sla.targetResolutionMinutes
                  ? formatTimeRemaining(sla.targetResolutionMinutes)
                  : "No limit"}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
