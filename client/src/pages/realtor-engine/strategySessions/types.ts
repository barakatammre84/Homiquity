import { BarChart3, FileText, GraduationCap, TrendingUp, Video } from "lucide-react";

export interface StrategySession {
  id: string;
  agentUserId: string;
  loUserId: string | null;
  scheduledAt: string;
  durationMinutes: number;
  sessionType: string;
  topic: string | null;
  notes: string | null;
  actionItems: string[] | null;
  status: string;
  completedAt: string | null;
  createdAt: string;
}

export const SESSION_TYPE_CONFIG: Record<string, { label: string; icon: typeof Video }> = {
  weekly_review: { label: "Weekly Review", icon: BarChart3 },
  deal_review: { label: "Deal Review", icon: FileText },
  market_update: { label: "Market Update", icon: TrendingUp },
  training: { label: "Training", icon: GraduationCap },
};

export interface ScheduleForm {
  scheduledAt: string;
  durationMinutes: string;
  sessionType: string;
  topic: string;
  notes: string;
}

export const emptyScheduleForm = (): ScheduleForm => ({
  scheduledAt: "",
  durationMinutes: "30",
  sessionType: "weekly_review",
  topic: "",
  notes: "",
});

export interface NotesForm {
  notes: string;
  actionItems: string;
}
