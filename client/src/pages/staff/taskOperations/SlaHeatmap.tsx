import { ROLE_LABELS } from "./model";

export function SlaHeatmap({ data }: { data: Record<string, { green: number; amber: number; red: number }> }) {
  const roles = Object.keys(data);

  if (roles.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No task data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {roles.map(role => {
        const stats = data[role];
        const total = stats.green + stats.amber + stats.red;
        if (total === 0) return null;

        return (
          <div key={role} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{ROLE_LABELS[role] || role}</span>
              <span className="text-xs text-muted-foreground">{total} tasks</span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {stats.green > 0 && (
                <div
                  className="bg-success transition-all"
                  style={{ width: `${(stats.green / total) * 100}%` }}
                  title={`${stats.green} on track`}
                />
              )}
              {stats.amber > 0 && (
                <div
                  className="bg-warning transition-all"
                  style={{ width: `${(stats.amber / total) * 100}%` }}
                  title={`${stats.amber} at risk`}
                />
              )}
              {stats.red > 0 && (
                <div
                  className="bg-destructive transition-all"
                  style={{ width: `${(stats.red / total) * 100}%` }}
                  title={`${stats.red} breached`}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
