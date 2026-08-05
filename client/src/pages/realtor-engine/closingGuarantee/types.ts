import { CalendarClock, FileCheck, MessageSquare, Shield, Timer } from "lucide-react";

export interface ClosingGuaranteeRecord {
  id: string;
  applicationId: string;
  guaranteeType: string;
  targetDate: string;
  targetHours: number | null;
  actualDate: string | null;
  status: string;
  isAtRisk: boolean;
  riskReason: string | null;
  isMet: boolean | null;
  createdAt: string;
}

export const GUARANTEE_LABELS: Record<string, string> = {
  underwriting_24h: "24-Hour Underwriting",
  appraisal_48h: "48-Hour Appraisal",
  closing_10day: "10-Day Close",
  communication_daily: "Daily Communication",
};

export const GUARANTEE_ICONS: Record<string, typeof Shield> = {
  underwriting_24h: FileCheck,
  appraisal_48h: CalendarClock,
  closing_10day: Timer,
  communication_daily: MessageSquare,
};
