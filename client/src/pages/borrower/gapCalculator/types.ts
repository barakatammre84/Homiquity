import { z } from "zod";

/**
 * `numericField` instead of a bare `z.coerce.number()`: coerce's INPUT type is
 * `unknown`, which leaves `field.value` untypable where the control is spread
 * onto an `<input>`. Accepting `string | number` states what the DOM actually
 * hands us and coerces identically.
 */
const numericField = (min: number, message: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? v : Number(v)))
    .pipe(z.number().min(min, message));

export const savingsFormSchema = z.object({
  amount: numericField(0.01, "Enter a deposit amount greater than zero"),
  description: z.string().optional(),
});

/**
 * `z.coerce.number()` makes input ≠ output, so the form needs BOTH types:
 * the field holds what the `<input>` gives us (a string), the submit handler
 * receives the coerced number. See `SavingsVaultTab`'s `useForm` generics.
 */
export type SavingsFormInput = z.input<typeof savingsFormSchema>;
export type SavingsFormValues = z.output<typeof savingsFormSchema>;

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
