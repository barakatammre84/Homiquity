import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { users } from "./core";
import { acceleratorEnrollments } from "./admin";

export const coachingSessions = pgTable("coaching_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enrollmentId: varchar("enrollment_id").references(() => acceleratorEnrollments.id).notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").default(30),
  topic: varchar("topic", { length: 500 }),
  notes: text("notes"),
  actionItems: jsonb("action_items"),
  // SESSION_STATUSES in shared/acceleratorProgram.ts is the vocabulary. The
  // column default stays "scheduled" for the rows that predate the request →
  // confirm split; every new borrower-created row is written as "requested",
  // because a borrower asking for a time is not a booking (migration 0057).
  status: varchar("status", { length: 20 }).default("scheduled").notNull(),
  /** The loan officer who accepted this session. NULL until one does. */
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id),
  confirmedAt: timestamp("confirmed_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_coaching_sessions_enrollment").on(table.enrollmentId),
  index("idx_coaching_sessions_scheduled").on(table.scheduledAt),
  index("idx_coaching_sessions_status").on(table.status),
  index("idx_coaching_sessions_assigned").on(table.assignedToUserId),
]);

export const insertCoachingSessionSchema = createInsertSchema(coachingSessions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
  confirmedAt: true,
});
export type InsertCoachingSession = z.infer<typeof insertCoachingSessionSchema>;
export type CoachingSession = typeof coachingSessions.$inferSelect;

export const coachConversations = pgTable("coach_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: varchar("title", { length: 200 }).default("New Conversation"),
  readinessTier: varchar("readiness_tier", { length: 30 }),
  completionPercentage: integer("completion_percentage"),
  financialProfile: jsonb("financial_profile"),
  actionPlan: jsonb("action_plan"),
  recommendedLoanTypes: jsonb("recommended_loan_types"),
  documentChecklist: jsonb("document_checklist"),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_coach_conversations_user").on(table.userId),
  index("idx_coach_conversations_status").on(table.status),
]);

export const insertCoachConversationSchema = createInsertSchema(coachConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCoachConversation = z.infer<typeof insertCoachConversationSchema>;
export type CoachConversation = typeof coachConversations.$inferSelect;

export const coachMessages = pgTable("coach_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => coachConversations.id).notNull(),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  structuredData: jsonb("structured_data"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_coach_messages_conversation").on(table.conversationId),
  index("idx_coach_messages_conv_role_created").on(table.conversationId, table.role, table.createdAt),
]);

export const insertCoachMessageSchema = createInsertSchema(coachMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertCoachMessage = z.infer<typeof insertCoachMessageSchema>;
export type CoachMessage = typeof coachMessages.$inferSelect;
