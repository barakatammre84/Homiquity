export type SlaStatus = "green" | "amber" | "red";

export const SLA_STATUS_COLORS: Record<SlaStatus, string> = {
  green: "text-success-subtle-foreground",
  amber: "text-warning-subtle-foreground",
  red: "text-destructive",
};

export const SLA_DOT_COLORS: Record<SlaStatus, string> = {
  green: "bg-success",
  amber: "bg-warning",
  red: "bg-destructive",
};

export const SLA_STATUS_LABELS: Record<SlaStatus, string> = {
  green: "On Track",
  amber: "At Risk",
  red: "Breached",
};

export const SLA_SORT_ORDER: Record<SlaStatus, number> = {
  red: 0,
  amber: 1,
  green: 2,
};
