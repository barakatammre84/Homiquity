export type SlaStatus = "green" | "amber" | "red";

export const SLA_STATUS_COLORS: Record<SlaStatus, string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
};

export const SLA_DOT_COLORS: Record<SlaStatus, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
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
