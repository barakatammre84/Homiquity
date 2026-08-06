import { z } from "zod";

export const savingsFormSchema = z.object({
  amount: z.coerce.number().min(0.01),
  description: z.string().optional(),
});

export type SavingsFormValues = z.infer<typeof savingsFormSchema>;

export interface GapAnalysis {
  hasGoal: boolean;
  analysis?: {
    credit: {
      current: number;
      target: number;
      gap: number;
      progress: number;
      status: "ready" | "close" | "working";
    };
    savings: {
      current: number;
      target: number;
      gap: number;
      progress: number;
      monthlyRate: number;
      monthsToGoal: number | null;
      status: "ready" | "close" | "working";
    };
    dti: {
      current: number;
      maxAllowed: number;
      availableForPayment: number;
      status: "within_guideline" | "above_guideline";
    };
    overall: {
      progress: number;
      phase: string;
      journeyDay: number;
      goalsComplete: boolean;
    };
  };
}

export interface CreditRecommendation {
  priority: "high" | "medium" | "low";
  actionType: string;
  title: string;
  description: string;
  estimatedPointsGain: number;
  timeframe: string;
}
