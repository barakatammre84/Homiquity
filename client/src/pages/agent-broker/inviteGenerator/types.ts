import { z } from "zod";
import type { ApplicationInvite } from "@shared/schema";

export const inviteFormSchema = z.object({
  clientName: z.string().optional(),
  clientEmail: z.string().email("Please enter a valid email").optional().or(z.literal("")),
  clientPhone: z.string().optional(),
  message: z.string().optional(),
  expiresInDays: z.number().min(1).max(90).default(30),
});

export type InviteFormValues = z.infer<typeof inviteFormSchema>;

export interface InviteWithStatus extends ApplicationInvite {
  isExpired: boolean;
  /** Stage of the linked application (stage only — no financials). */
  applicationStatus: string | null;
}

export type FilterTab = "all" | "pending" | "clicked" | "applied" | "expired";
