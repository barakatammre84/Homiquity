import type { getChecklistStatusInfo } from "@/lib/documentChecklist";

type StatusInfo = ReturnType<typeof getChecklistStatusInfo>;

export function ChecklistStatusSummary({ statusInfo }: { statusInfo: StatusInfo }) {
  const StatusIcon = statusInfo.icon;
  return (
    <div className={`mb-6 inline-flex items-center gap-4 rounded-xl px-5 py-3 ${statusInfo.bgColor} border ${statusInfo.borderColor}`} data-testid="status-summary">
      <StatusIcon className={`h-8 w-8 ${statusInfo.iconColor}`} />
      <div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-foreground" data-testid="status-title">{statusInfo.title}</span>
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusInfo.badgeColor}`}>
            {statusInfo.badgeText}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{statusInfo.subtitle}</p>
      </div>
    </div>
  );
}
