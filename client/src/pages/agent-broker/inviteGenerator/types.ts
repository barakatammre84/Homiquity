import { z } from "zod";
import type { ApplicationInvite } from "@shared/schema";

export const inviteFormSchema = z.object({
  clientName: z.string().optional(),
  clientEmail: z.string().email("Please enter a valid email").optional().or(z.literal("")),
  clientPhone: z.string().optional(),
  message: z.string().optional(),
  // No `.default(30)`: the form's defaultValues already supply 30 and every
  // reset() goes back to them, so the default could never fire — while making
  // the schema's input type differ from its output type, which a
  // single-generic `useForm<T>` cannot express.
  expiresInDays: z.number().min(1).max(90),
});

export type InviteFormValues = z.infer<typeof inviteFormSchema>;

export interface InviteWithStatus extends ApplicationInvite {
  isExpired: boolean;
  /** Stage of the linked application (stage only — no financials). */
  applicationStatus: string | null;
}

export type FilterTab = "all" | "pending" | "clicked" | "applied" | "expired";
