import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  decimal,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Role system - Mortgage Industry Specific Roles
// Staff Roles (Internal & Partner)
export const STAFF_ROLES = [
  "admin",           // Tech/Ops Lead - Full system access
  "lo",              // Loan Officer - Sales & lead qualification
  "loa",             // Loan Officer Assistant - Document collection & appointments
  "processor",       // Processor - File bundling & pre-underwriting
  "underwriter",     // Underwriter - Final loan decisions
  "closer",          // Closer/Funder - Wire management & final docs
  "broker",          // Mortgage Broker - Loan origination & lender relationships
  "lender",          // Lender Representative - Loan product & pricing management
] as const;

// Client Roles
export const CLIENT_ROLES = [
  "aspiring_owner",  // Renter exploring homeownership (sandbox mode)
  "active_buyer",    // Borrower in buying process
] as const;

// All roles combined
export const ALL_ROLES = [...STAFF_ROLES, ...CLIENT_ROLES] as const;
export type UserRole = typeof ALL_ROLES[number];

// Role display names for UI
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  admin: "Tech/Ops Lead",
  lo: "Loan Officer",
  loa: "Loan Officer Assistant",
  processor: "Processor",
  underwriter: "Underwriter",
  closer: "Closer/Funder",
  broker: "Mortgage Broker",
  lender: "Lender Representative",
  aspiring_owner: "Aspiring Owner",
  active_buyer: "Active Buyer",
};

// Role descriptions for UI
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: "Full system access, user management, configuration",
  lo: "Sales & lead qualification, client relationships",
  loa: "Document collection, appointments, client updates",
  processor: "File bundling, pre-underwriting, condition management",
  underwriter: "Final loan approval/denial, risk assessment",
  closer: "Wire management, final document sign-off",
  broker: "Loan origination, lender relationships, deal management",
  lender: "Loan product management, pricing, approvals",
  aspiring_owner: "Explore homeownership, sandbox mode, gap calculator",
  active_buyer: "Apply for mortgages, upload documents, track progress",
};

// Helper to check if role is staff
export function isStaffRole(role: string): boolean {
  return STAFF_ROLES.includes(role as typeof STAFF_ROLES[number]);
}

// Helper to check if role is client
export function isClientRole(role: string): boolean {
  return CLIENT_ROLES.includes(role as typeof CLIENT_ROLES[number]);
}

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  passwordHash: varchar("password_hash"),
  authProvider: varchar("auth_provider", { length: 20 }).default("email"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { length: 50 }).default("aspiring_owner").notNull(), // See ALL_ROLES constant
  // Partner tracking - for external loan officers using the platform
  isPartner: boolean("is_partner").default(false),
  partnerCompanyName: varchar("partner_company_name", { length: 255 }),
  nmlsId: varchar("nmls_id", { length: 20 }), // NMLS license number for loan officers
  // Referral link system for LOs
  referralCode: varchar("referral_code", { length: 20 }).unique(), // Unique code for LO referral links (e.g., "JOHN-SMITH-LO")
  referredByUserId: varchar("referred_by_user_id"), // Who referred this user (references users.id)
  // Presence tracking - for online/away status
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
