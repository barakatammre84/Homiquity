import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  decimal,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./core";

// Real Estate Agent Profiles
export const agentProfiles = pgTable("agent_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  
  bio: text("bio"),
  phoneNumber: varchar("phone_number", { length: 20 }),
  licenseNumber: varchar("license_number", { length: 50 }),
  licenseExpiry: varchar("license_expiry", { length: 10 }),
  brokerage: varchar("brokerage", { length: 255 }),
  yearsInBusiness: integer("years_in_business"),
  
  specialties: text("specialties").array(), // ['first_time_buyers', 'luxury', 'investment', 'commercial']
  serviceArea: text("service_area").array(), // list of states/counties served
  
  photoBucket: varchar("photo_bucket"), // object storage path
  photoUrl: varchar("photo_url"),
  
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }),
  totalReviews: integer("total_reviews").default(0),
  
  propertiesSold: integer("properties_sold").default(0),
  activeListings: integer("active_listings").default(0),
  
  socialLinks: jsonb("social_links"), // {twitter, instagram, facebook}
  website: varchar("website", { length: 255 }),
  
  isVerified: boolean("is_verified").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAgentProfileSchema = createInsertSchema(agentProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAgentProfile = z.infer<typeof insertAgentProfileSchema>;
export type AgentProfile = typeof agentProfiles.$inferSelect;

// Properties (for MLS integration)
export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mlsId: varchar("mls_id", { length: 100 }),
  agentId: varchar("agent_id").references(() => agentProfiles.id),
  
  address: text("address").notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 50 }).notNull(),
  zipCode: varchar("zip_code", { length: 20 }).notNull(),
  
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  propertyType: varchar("property_type", { length: 50 }), // single_family, condo, townhouse, multi_family
  
  bedrooms: integer("bedrooms"),
  bathrooms: decimal("bathrooms", { precision: 3, scale: 1 }),
  squareFeet: integer("square_feet"),
  lotSize: decimal("lot_size", { precision: 10, scale: 2 }),
  yearBuilt: integer("year_built"),
  
  description: text("description"),
  features: text("features").array(),
  images: text("images").array(),
  
  status: varchar("status", { length: 50 }).default("active"), // active, pending, sold
  listedAt: timestamp("listed_at"),
  soldAt: timestamp("sold_at"),
  soldPrice: decimal("sold_price", { precision: 12, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPropertySchema = createInsertSchema(properties).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;

// Saved Properties (user favorites)
export const savedProperties = pgTable("saved_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Homeowner Profiles
export const homeownerProfiles = pgTable("homeowner_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  originalLoanAmount: decimal("original_loan_amount"),
  currentLoanBalance: decimal("current_loan_balance"),
  interestRate: decimal("interest_rate", { precision: 5, scale: 3 }),
  monthlyPayment: decimal("monthly_payment"),
  propertyValue: decimal("property_value"),
  purchasePrice: decimal("purchase_price"),
  purchaseDate: timestamp("purchase_date"),
  loanCloseDate: timestamp("loan_close_date"),
  propertyAddress: varchar("property_address", { length: 500 }),
  nextReviewDate: timestamp("next_review_date"),
  lastReviewDate: timestamp("last_review_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_homeowner_profiles_user").on(table.userId),
]);

export const insertHomeownerProfileSchema = createInsertSchema(homeownerProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertHomeownerProfile = z.infer<typeof insertHomeownerProfileSchema>;
export type HomeownerProfile = typeof homeownerProfiles.$inferSelect;

// Refi Alerts
export const refiAlerts = pgTable("refi_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  homeownerProfileId: varchar("homeowner_profile_id").references(() => homeownerProfiles.id).notNull(),
  currentRate: decimal("current_rate", { precision: 5, scale: 3 }).notNull(),
  marketRate: decimal("market_rate", { precision: 5, scale: 3 }).notNull(),
  potentialSavingsMonthly: decimal("potential_savings_monthly"),
  potentialSavingsLifetime: decimal("potential_savings_lifetime"),
  isActionable: boolean("is_actionable").default(false),
  isDismissed: boolean("is_dismissed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_refi_alerts_profile").on(table.homeownerProfileId),
]);

export const insertRefiAlertSchema = createInsertSchema(refiAlerts).omit({
  id: true,
  createdAt: true,
});
export type InsertRefiAlert = z.infer<typeof insertRefiAlertSchema>;
export type RefiAlert = typeof refiAlerts.$inferSelect;

// Equity Snapshots
export const equitySnapshots = pgTable("equity_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  homeownerProfileId: varchar("homeowner_profile_id").references(() => homeownerProfiles.id).notNull(),
  snapshotDate: timestamp("snapshot_date").notNull(),
  estimatedValue: decimal("estimated_value"),
  loanBalance: decimal("loan_balance"),
  equityAmount: decimal("equity_amount"),
  equityPercent: decimal("equity_percent", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_equity_snapshots_profile").on(table.homeownerProfileId),
  index("idx_equity_snapshots_date").on(table.snapshotDate),
]);

export const insertEquitySnapshotSchema = createInsertSchema(equitySnapshots).omit({
  id: true,
  createdAt: true,
});
export type InsertEquitySnapshot = z.infer<typeof insertEquitySnapshotSchema>;
export type EquitySnapshot = typeof equitySnapshots.$inferSelect;
