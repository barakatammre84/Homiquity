import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { users } from "./core";

// =============================================================================
// AUTOPILOT — always-on, event-driven origination agent (Homiquity Autopilot).
//
// Homiquity is a broker: the agent PERCEIVES (document extraction), PRE-FLIGHTS
// (deterministic package-readiness + guideline-cited follow-ups) and drives a
// file toward `readyToSubmitToLender`. It never renders a credit decision — the
// wholesale lender does. This table is the operator control surface: a single
// config row with a kill switch and independent capability toggles, mirroring
// the "activate under your existing terms" model.
// =============================================================================

/** Guideline authority the agent cites. v1 supports Fannie Mae only — the only
 *  Selling-Guide authority transcribed in docs/fannie-mae/ and the only mode the
 *  income engine cites. Freddie/Overlay/Custom are future modes. */
export const AUTOPILOT_GUIDELINE_MODES = ["fannie_mae"] as const;
export type AutopilotGuidelineMode = (typeof AUTOPILOT_GUIDELINE_MODES)[number];

export const autopilotConfig = pgTable("autopilot_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Singleton guard: this column is always `true`, and the UNIQUE constraint
  // means at most one row can ever exist (one global config).
  singleton: boolean("singleton").notNull().default(true),

  // Master kill switch. Default OFF — activation is a deliberate operator action.
  // Checked at every orchestrator entry; flipping it OFF stops new runs within
  // one config-cache TTL (in-flight runs complete).
  enabled: boolean("enabled").notNull().default(false),

  // Independent capability toggles (Blend parity): the two side-effectful
  // behaviors can be enabled separately from perception/narration.
  followUpGenerationEnabled: boolean("follow_up_generation_enabled").notNull().default(true),
  applicationDataUpdatesEnabled: boolean("application_data_updates_enabled").notNull().default(true),

  // Decision relay (lender decision → borrower approval / staff adverse-action).
  // Defaults OFF even when Autopilot is enabled: it's borrower-facing outbound
  // messaging on a credit decision (Reg N / ECOA §1002.9), so it stays dark
  // until an operator turns it on (counsel sign-off before activation).
  decisionRelayEnabled: boolean("decision_relay_enabled").notNull().default(false),

  // Pilot rollout: null (or empty) = all loan officers; otherwise the agent only
  // runs for applications owned by a listed LO user id (searchable allowlist).
  loanOfficerAllowlist: jsonb("loan_officer_allowlist").$type<string[] | null>(),

  guidelineMode: varchar("guideline_mode", { length: 30 }).notNull().default("fannie_mae"),

  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertAutopilotConfigSchema = createInsertSchema(autopilotConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AutopilotConfigRow = typeof autopilotConfig.$inferSelect;
export type InsertAutopilotConfig = typeof autopilotConfig.$inferInsert;
