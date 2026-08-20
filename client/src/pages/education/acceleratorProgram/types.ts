import { Briefcase, CreditCard, Home } from "lucide-react";

export interface AcceleratorEnrollment {
  id: string;
  userId: string;
  programType: string;
  currentPhase: number;
  totalPhases: number;
  targetDate: string | null;
  currentCreditScore: number | null;
  targetCreditScore: number | null;
  currentSavings: string | null;
  targetDownPayment: string | null;
  currentDti: string | null;
  targetDti: string | null;
  monthlyBudget: string | null;
  status: string;
  completedAt: string | null;
  createdAt: string;
}

export interface AcceleratorMilestone {
  id: string;
  enrollmentId: string;
  phase: number;
  title: string;
  description: string | null;
  category: string;
  targetValue: string | null;
  currentValue: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  dueDate: string | null;
}

export interface CoachingSession {
  id: string;
  enrollmentId: string;
  scheduledAt: string;
  durationMinutes: number;
  topic: string | null;
  notes: string | null;
  actionItems: string[] | null;
  status: string;
  completedAt: string | null;
}

export const PROGRAM_TYPES = [
  {
    key: "first_time_buyer",
    title: "First-Time Buyer",
    description: "For those buying their first home. We guide you through every step from pre-approval to closing day.",
    icon: Home,
  },
  {
    key: "self_employed",
    title: "Self-Employed",
    description: "For business owners and freelancers navigating non-traditional income documentation and lending requirements.",
    icon: Briefcase,
  },
  {
    key: "credit_builder",
    title: "Credit Builder",
    description: "For those working on credit improvement. Build your score strategically to unlock better rates and terms.",
    icon: CreditCard,
  },
];

/**
 * The phase names, from the same definition the server seeds milestones with.
 *
 * This used to be a second, hand-written map ("Foundation", "Financial
 * Fitness", …) that had drifted away from the phases the server actually
 * creates — so the header named phase 1 "Foundation" while every milestone
 * inside it was badged "Financial Assessment" (DESIGN_SYSTEM §13, Agreement).
 */
export { ACCELERATOR_PHASE_NAMES as PHASE_NAMES } from "@shared/acceleratorProgram";
