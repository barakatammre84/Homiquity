// Onboarding / "update my info" form for the Gap to Homeownership goal.
//
// Extracted from GapCalculator.tsx so that page owns data-fetching and
// mutations while this owns the form's presentation. The eight numeric inputs
// were eight hand-copied FormField blocks differing only in name/label/
// placeholder/description/testid; they are now driven by GOAL_FIELDS below, so
// adding or relabeling a field is a one-line data change instead of a
// 19-line copy-paste.
import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Home, Loader2 } from "lucide-react";

/**
 * A number the borrower types into an `<input type="number">`, which hands us a
 * string. Spelled out rather than `z.coerce.number()` because coerce's INPUT
 * type is `unknown` — that leaves `field.value` untypable where the control is
 * spread onto the `<Input>` below. Coercion is identical; only the input type
 * is honest.
 */
const typedNumber = () =>
  z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? v : Number(v)))
    .pipe(z.number());

export const goalFormSchema = z.object({
  currentCreditScore: typedNumber().pipe(z.number().min(300).max(850)),
  monthlyIncome: typedNumber().pipe(z.number().min(0)),
  monthlyDebts: typedNumber().pipe(z.number().min(0)),
  currentRent: typedNumber().pipe(z.number().min(0)),
  currentSavingsBalance: typedNumber().pipe(z.number().min(0)),
  currentMonthlySavings: typedNumber().pipe(z.number().min(0)),
  targetHomePrice: typedNumber().pipe(z.number().min(0)),
  targetDownPayment: typedNumber().pipe(z.number().min(0)),
  targetCity: z.string().optional(),
  targetState: z.string().optional(),
});

/** What the fields hold while editing (strings from the DOM). */
export type GoalFormInput = z.input<typeof goalFormSchema>;
/** What `handleSubmit` yields once the resolver has coerced. */
export type GoalFormValues = z.output<typeof goalFormSchema>;

/** The numeric snapshot fields, in the order the borrower answers them. */
const GOAL_FIELDS: {
  name: keyof GoalFormInput;
  label: string;
  placeholder: string;
  description: string;
  testId: string;
}[] = [
  {
    name: "currentCreditScore",
    label: "Current Credit Score",
    placeholder: "600",
    description: "Your estimated credit score (300-850)",
    testId: "input-credit-score",
  },
  {
    name: "monthlyIncome",
    label: "Monthly Income",
    placeholder: "5000",
    description: "Your gross monthly income",
    testId: "input-monthly-income",
  },
  {
    name: "monthlyDebts",
    label: "Monthly Debts",
    placeholder: "500",
    description: "Car payments, credit cards, loans, etc.",
    testId: "input-monthly-debts",
  },
  {
    name: "currentRent",
    label: "Current Rent",
    placeholder: "1500",
    description: "Your current monthly rent payment",
    testId: "input-current-rent",
  },
  {
    name: "currentSavingsBalance",
    label: "Current Savings",
    placeholder: "0",
    description: "Amount saved for a down payment",
    testId: "input-current-savings",
  },
  {
    name: "currentMonthlySavings",
    label: "Monthly Savings Rate",
    placeholder: "300",
    description: "How much you can save each month",
    testId: "input-monthly-savings",
  },
  {
    name: "targetHomePrice",
    label: "Target Home Price",
    placeholder: "350000",
    description: "The price range you're targeting",
    testId: "input-target-price",
  },
  {
    name: "targetDownPayment",
    label: "Target Down Payment",
    placeholder: "17500",
    description: "Recommended: 5-20% of home price",
    testId: "input-target-down-payment",
  },
];

export function GapGoalOnboardingForm({
  form,
  onSubmit,
  onCancel,
  isSubmitting,
  isUpdate,
}: {
  form: UseFormReturn<GoalFormInput, unknown, GoalFormValues>;
  onSubmit: (data: GoalFormValues) => void;
  /** Only offered when a goal already exists — otherwise there's nothing to go back to. */
  onCancel?: () => void;
  isSubmitting: boolean;
  isUpdate: boolean;
}) {
  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Home className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Gap to Homeownership</h1>
        <p className="text-muted-foreground">
          Let's see where you are today and build your personalized path to homeownership
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Financial Snapshot</CardTitle>
          <CardDescription>
            Tell us about your current situation so we can create your personalized plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                {GOAL_FIELDS.map((spec) => (
                  <FormField
                    key={spec.name}
                    control={form.control}
                    name={spec.name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{spec.label}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder={spec.placeholder}
                            {...field}
                            data-testid={spec.testId}
                          />
                        </FormControl>
                        <FormDescription>{spec.description}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>

              <div className="flex justify-end gap-2">
                {onCancel && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                )}
                <Button type="submit" disabled={isSubmitting} data-testid="button-start-journey">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isUpdate ? "Update My Info" : "Start My Journey"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
