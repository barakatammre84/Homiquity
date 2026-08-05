import type { SlaStatus } from "@/lib/sla";

export interface TaskWithSlaStatus {
  id: string;
  applicationId: string;
  title: string;
  description?: string;
  taskType: string;
  taskTypeCode?: string;
  triggerSource?: string;
  ownerRole?: string;
  slaClass?: string;
  slaDueAt?: string;
  escalationLevel?: number;
  status: string;
  priority?: string;
  createdAt?: string;
  slaStatus: SlaStatus;
  timeRemaining: number | null;
  percentageElapsed: number | null;
}

export interface TaskMetrics {
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  breached: number;
  byRole: Record<string, number>;
  bySlaClass: Record<string, number>;
  byStatus: Record<string, { green: number; amber: number; red: number }>;
}

export interface SlaClassConfig {
  id: string;
  slaClass: string;
  name: string;
  description?: string;
  targetResolutionMinutes?: number;
  escalationStartMinutes?: number;
  hardBreachMinutes?: number;
  blocksLoanProgress?: boolean;
  colorCode?: string;
}

export const ROLE_LABELS: Record<string, string> = {
  LO: "Loan Officer",
  LOA: "LO Assistant",
  PROCESSOR: "Processor",
  UW: "Underwriter",
  CLOSER: "Closer",
  ADMIN: "Admin",
  BORROWER: "Borrower",
  SYSTEM: "System",
};

export const USER_ROLE_TO_TASK_ROLE: Record<string, string> = {
  lo: "LO",
  loa: "LOA",
  processor: "PROCESSOR",
  underwriter: "UW",
  closer: "CLOSER",
  admin: "ADMIN",
};
