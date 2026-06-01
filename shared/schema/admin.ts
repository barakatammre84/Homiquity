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
import { loanApplications } from "./lending";
import { agentProfiles } from "./property";

// ================================
// Learning Center & FAQ System
// ================================

export const contentCategories = pgTable("content_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 20 }),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertContentCategorySchema = createInsertSchema(contentCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContentCategory = z.infer<typeof insertContentCategorySchema>;
export type ContentCategory = typeof contentCategories.$inferSelect;

export const articles = pgTable("articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  featuredImage: varchar("featured_image", { length: 500 }),
  categoryId: varchar("category_id").references(() => contentCategories.id),
  tags: text("tags").array(),
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  publishedAt: timestamp("published_at"),
  authorId: varchar("author_id").references(() => users.id),
  viewCount: integer("view_count").default(0),
  readTimeMinutes: integer("read_time_minutes").default(5),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_articles_category").on(table.categoryId),
  index("idx_articles_status").on(table.status),
  index("idx_articles_published_at").on(table.publishedAt),
]);

export const insertArticleSchema = createInsertSchema(articles).omit({
  id: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type Article = typeof articles.$inferSelect;

export const faqs = pgTable("faqs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  categoryId: varchar("category_id").references(() => contentCategories.id),
  tags: text("tags").array(),
  searchKeywords: text("search_keywords").array(),
  displayOrder: integer("display_order").default(0),
  isPopular: boolean("is_popular").default(false),
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  authorId: varchar("author_id").references(() => users.id),
  helpfulCount: integer("helpful_count").default(0),
  notHelpfulCount: integer("not_helpful_count").default(0),
  viewCount: integer("view_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_faqs_category").on(table.categoryId),
  index("idx_faqs_status").on(table.status),
  index("idx_faqs_popular").on(table.isPopular),
]);

export const insertFaqSchema = createInsertSchema(faqs).omit({
  id: true,
  helpfulCount: true,
  notHelpfulCount: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFaq = z.infer<typeof insertFaqSchema>;
export type Faq = typeof faqs.$inferSelect;

// ===== BROKER COMMISSIONS =====

export const brokerCommissions = pgTable("broker_commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brokerId: varchar("broker_id").references(() => users.id).notNull(),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  loanAmount: decimal("loan_amount", { precision: 12, scale: 2 }).notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 4 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  paidAt: timestamp("paid_at"),
  paidBy: varchar("paid_by").references(() => users.id),
  paymentReference: varchar("payment_reference", { length: 255 }),
  paymentMethod: varchar("payment_method", { length: 50 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_broker_commissions_broker").on(table.brokerId),
  index("idx_broker_commissions_application").on(table.applicationId),
  index("idx_broker_commissions_status").on(table.status),
]);

export const insertBrokerCommissionSchema = createInsertSchema(brokerCommissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBrokerCommission = z.infer<typeof insertBrokerCommissionSchema>;
export type BrokerCommission = typeof brokerCommissions.$inferSelect;

// ===== CALCULATOR RESULTS =====

export const calculatorResults = pgTable("calculator_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  calculatorType: varchar("calculator_type", { length: 50 }).notNull(),
  inputs: jsonb("inputs").notNull(),
  results: jsonb("results").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_calculator_results_user").on(table.userId),
  index("idx_calculator_results_type").on(table.calculatorType),
]);

export const insertCalculatorResultSchema = createInsertSchema(calculatorResults).omit({
  id: true,
  createdAt: true,
});

export type InsertCalculatorResult = z.infer<typeof insertCalculatorResultSchema>;
export type CalculatorResult = typeof calculatorResults.$inferSelect;

export const calculatorProfiles = pgTable("calculator_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).unique().notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  annualIncome: integer("annual_income"),
  monthlyDebts: integer("monthly_debts"),
  creditScore: integer("credit_score"),
  downPaymentSaved: integer("down_payment_saved"),
  debts: jsonb("debts"),
  calculatorInputs: jsonb("calculator_inputs"),
  calculatorResults: jsonb("calculator_results"),
  maxHomePrice: integer("max_home_price"),
  zipCode: varchar("zip_code", { length: 10 }),
  convertedToUser: boolean("converted_to_user").default(false),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_calculator_profiles_email").on(table.email),
]);

export const insertCalculatorProfileSchema = createInsertSchema(calculatorProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCalculatorProfile = z.infer<typeof insertCalculatorProfileSchema>;
export type CalculatorProfile = typeof calculatorProfiles.$inferSelect;

// ===== PARTNER API INTEGRATIONS =====

export const PARTNER_SERVICE_TYPES = [
  "credit_report",
  "title_search",
  "appraisal",
  "flood_cert",
  "verification_employment",
  "verification_income",
  "verification_assets",
  "tax_transcripts",
  "homeowners_insurance",
] as const;

export type PartnerServiceType = typeof PARTNER_SERVICE_TYPES[number];

export const partnerProviders = pgTable("partner_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).unique().notNull(),
  serviceType: varchar("service_type", { length: 50 }).notNull(),
  apiBaseUrl: varchar("api_base_url", { length: 255 }),
  apiVersion: varchar("api_version", { length: 20 }),
  credentialSecretKey: varchar("credential_secret_key", { length: 100 }),
  isActive: boolean("is_active").default(true).notNull(),
  isTestMode: boolean("is_test_mode").default(true).notNull(),
  baseFee: decimal("base_fee", { precision: 10, scale: 2 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 20 }),
  expectedTurnaroundHours: integer("expected_turnaround_hours"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_partner_providers_type").on(table.serviceType),
  index("idx_partner_providers_code").on(table.code),
]);

export const insertPartnerProviderSchema = createInsertSchema(partnerProviders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPartnerProvider = z.infer<typeof insertPartnerProviderSchema>;
export type PartnerProvider = typeof partnerProviders.$inferSelect;

export const partnerOrders = pgTable("partner_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  providerId: varchar("provider_id").references(() => partnerProviders.id).notNull(),
  serviceType: varchar("service_type", { length: 50 }).notNull(),
  orderReference: varchar("order_reference", { length: 100 }),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  requestPayload: jsonb("request_payload"),
  responsePayload: jsonb("response_payload"),
  resultSummary: jsonb("result_summary"),
  creditScoreExperian: integer("credit_score_experian"),
  creditScoreEquifax: integer("credit_score_equifax"),
  creditScoreTransUnion: integer("credit_score_transunion"),
  appraisedValue: decimal("appraised_value", { precision: 12, scale: 2 }),
  titleStatus: varchar("title_status", { length: 50 }),
  fee: decimal("fee", { precision: 10, scale: 2 }),
  feePaidByBorrower: boolean("fee_paid_by_borrower").default(true),
  orderedAt: timestamp("ordered_at").defaultNow(),
  orderedBy: varchar("ordered_by").references(() => users.id).notNull(),
  submittedAt: timestamp("submitted_at"),
  completedAt: timestamp("completed_at"),
  errorCode: varchar("error_code", { length: 50 }),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  resultDocumentPath: text("result_document_path"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_partner_orders_application").on(table.applicationId),
  index("idx_partner_orders_provider").on(table.providerId),
  index("idx_partner_orders_status").on(table.status),
  index("idx_partner_orders_type").on(table.serviceType),
]);

export const insertPartnerOrderSchema = createInsertSchema(partnerOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPartnerOrder = z.infer<typeof insertPartnerOrderSchema>;
export type PartnerOrder = typeof partnerOrders.$inferSelect;

// ================================
// Digital Onboarding - KBA, KYC/AML, Personalized Journeys
// ================================

export const kbaSessions = pgTable("kba_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  applicationId: varchar("application_id").references(() => loanApplications.id),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  questionsData: jsonb("questions_data"),
  answersData: jsonb("answers_data"),
  score: integer("score"),
  totalQuestions: integer("total_questions").default(5),
  passingScore: integer("passing_score").default(4),
  attemptNumber: integer("attempt_number").default(1),
  maxAttempts: integer("max_attempts").default(3),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertKbaSessionSchema = createInsertSchema(kbaSessions).omit({
  id: true,
  createdAt: true,
});
export type InsertKbaSession = z.infer<typeof insertKbaSessionSchema>;
export type KbaSession = typeof kbaSessions.$inferSelect;

export const kycScreenings = pgTable("kyc_screenings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  applicationId: varchar("application_id").references(() => loanApplications.id),
  overallStatus: varchar("overall_status", { length: 50 }).default("pending").notNull(),
  ofacStatus: varchar("ofac_status", { length: 50 }).default("pending"),
  ofacCheckedAt: timestamp("ofac_checked_at"),
  sanctionsStatus: varchar("sanctions_status", { length: 50 }).default("pending"),
  sanctionsCheckedAt: timestamp("sanctions_checked_at"),
  pepStatus: varchar("pep_status", { length: 50 }).default("pending"),
  pepCheckedAt: timestamp("pep_checked_at"),
  adverseMediaStatus: varchar("adverse_media_status", { length: 50 }).default("pending"),
  adverseMediaCheckedAt: timestamp("adverse_media_checked_at"),
  riskLevel: varchar("risk_level", { length: 20 }),
  riskScore: integer("risk_score"),
  screeningNotes: text("screening_notes"),
  reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertKycScreeningSchema = createInsertSchema(kycScreenings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertKycScreening = z.infer<typeof insertKycScreeningSchema>;
export type KycScreening = typeof kycScreenings.$inferSelect;

export const onboardingProfiles = pgTable("onboarding_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  applicationId: varchar("application_id").references(() => loanApplications.id),
  borrowerType: varchar("borrower_type", { length: 50 }).default("first_time_buyer"),
  journeyStatus: varchar("journey_status", { length: 50 }).default("not_started"),
  completedSteps: jsonb("completed_steps").$type<string[]>().default([]),
  currentStep: varchar("current_step", { length: 100 }),
  identityVerified: boolean("identity_verified").default(false),
  kycCleared: boolean("kyc_cleared").default(false),
  documentsComplete: boolean("documents_complete").default(false),
  personalInfoComplete: boolean("personal_info_complete").default(false),
  progressPercent: integer("progress_percent").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOnboardingProfileSchema = createInsertSchema(onboardingProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOnboardingProfile = z.infer<typeof insertOnboardingProfileSchema>;
export type OnboardingProfile = typeof onboardingProfiles.$inferSelect;

export const onboardingFeedback = pgTable("onboarding_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  applicationId: varchar("application_id").references(() => loanApplications.id),
  step: varchar("step", { length: 100 }),
  rating: integer("rating"),
  comment: text("comment"),
  feedbackType: varchar("feedback_type", { length: 50 }).default("general"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOnboardingFeedbackSchema = createInsertSchema(onboardingFeedback).omit({
  id: true,
  createdAt: true,
});
export type InsertOnboardingFeedback = z.infer<typeof insertOnboardingFeedbackSchema>;
export type OnboardingFeedback = typeof onboardingFeedback.$inferSelect;

// ===== AGENT CO-BRANDING PORTAL =====

export const coBrandProfiles = pgTable("co_brand_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  brandName: varchar("brand_name", { length: 255 }).notNull(),
  tagline: varchar("tagline", { length: 500 }),
  logoUrl: text("logo_url"),
  heroImageUrl: text("hero_image_url"),
  primaryColor: varchar("primary_color", { length: 20 }).default("#1e3a5f"),
  accentColor: varchar("accent_color", { length: 20 }).default("#10b981"),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 20 }),
  websiteUrl: text("website_url"),
  nmlsId: varchar("nmls_id", { length: 50 }),
  licenseNumber: varchar("license_number", { length: 100 }),
  disclaimerText: text("disclaimer_text"),
  bio: text("bio"),
  specialties: text("specialties").array(),
  serviceAreas: text("service_areas").array(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCoBrandProfileSchema = createInsertSchema(coBrandProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCoBrandProfile = z.infer<typeof insertCoBrandProfileSchema>;
export type CoBrandProfile = typeof coBrandProfiles.$inferSelect;

// ===== DEAL DESK =====

export const dealDeskThreads = pgTable("deal_desk_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentUserId: varchar("agent_user_id").references(() => users.id).notNull(),
  loUserId: varchar("lo_user_id").references(() => users.id),
  subject: varchar("subject", { length: 500 }).notNull(),
  scenarioType: varchar("scenario_type", { length: 50 }),
  status: varchar("status", { length: 20 }).default("open").notNull(),
  loanAmount: decimal("loan_amount"),
  propertyType: varchar("property_type", { length: 50 }),
  creditScore: integer("credit_score"),
  borrowerType: varchar("borrower_type", { length: 50 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  closedAt: timestamp("closed_at"),
});

export const insertDealDeskThreadSchema = createInsertSchema(dealDeskThreads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  closedAt: true,
});
export type InsertDealDeskThread = z.infer<typeof insertDealDeskThreadSchema>;
export type DealDeskThread = typeof dealDeskThreads.$inferSelect;

export const dealDeskMessages = pgTable("deal_desk_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").references(() => dealDeskThreads.id).notNull(),
  senderUserId: varchar("sender_user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDealDeskMessageSchema = createInsertSchema(dealDeskMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertDealDeskMessage = z.infer<typeof insertDealDeskMessageSchema>;
export type DealDeskMessage = typeof dealDeskMessages.$inferSelect;

// ===== DOWN PAYMENT ASSISTANCE PROGRAMS =====

export const dpaPrograms = pgTable("dpa_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  programType: varchar("program_type", { length: 50 }).notNull(),
  state: varchar("state", { length: 2 }),
  description: text("description").notNull(),
  assistanceType: varchar("assistance_type", { length: 50 }).notNull(),
  maxAssistanceAmount: decimal("max_assistance_amount"),
  maxAssistancePercent: decimal("max_assistance_percent"),
  minCreditScore: integer("min_credit_score"),
  maxIncome: decimal("max_income"),
  maxHomePrice: decimal("max_home_price"),
  firstTimeBuyerOnly: boolean("first_time_buyer_only").default(false),
  eligibilityNotes: text("eligibility_notes"),
  applicationUrl: text("application_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDpaProgramSchema = createInsertSchema(dpaPrograms).omit({
  id: true,
  createdAt: true,
});
export type InsertDpaProgram = z.infer<typeof insertDpaProgramSchema>;
export type DpaProgram = typeof dpaPrograms.$inferSelect;

// ===== AGENT PIPELINE VIEW =====

export const agentPipelineAccess = pgTable("agent_pipeline_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentUserId: varchar("agent_user_id").references(() => users.id).notNull(),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  borrowerName: varchar("borrower_name", { length: 255 }),
  currentStage: varchar("current_stage", { length: 50 }),
  lastMilestone: varchar("last_milestone", { length: 255 }),
  nextStep: varchar("next_step", { length: 255 }),
  estimatedCloseDate: timestamp("estimated_close_date"),
  loanAmount: decimal("loan_amount"),
  propertyAddress: varchar("property_address", { length: 500 }),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_agent_pipeline_agent").on(table.agentUserId),
  index("idx_agent_pipeline_app").on(table.applicationId),
]);

export const insertAgentPipelineAccessSchema = createInsertSchema(agentPipelineAccess).omit({
  id: true,
  createdAt: true,
  lastUpdatedAt: true,
});
export type InsertAgentPipelineAccess = z.infer<typeof insertAgentPipelineAccessSchema>;
export type AgentPipelineAccess = typeof agentPipelineAccess.$inferSelect;

// ===== DEAL RESCUE ESCALATIONS =====

export const dealRescueEscalations = pgTable("deal_rescue_escalations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id),
  reportedByUserId: varchar("reported_by_user_id").references(() => users.id).notNull(),
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id),
  urgency: varchar("urgency", { length: 20 }).default("high").notNull(),
  issueType: varchar("issue_type", { length: 50 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  description: text("description").notNull(),
  borrowerName: varchar("borrower_name", { length: 255 }),
  propertyAddress: varchar("property_address", { length: 500 }),
  closingDate: timestamp("closing_date"),
  status: varchar("status", { length: 20 }).default("open").notNull(),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at"),
  resolvedByUserId: varchar("resolved_by_user_id").references(() => users.id),
  slaDeadline: timestamp("sla_deadline"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_deal_rescue_status").on(table.status),
  index("idx_deal_rescue_reporter").on(table.reportedByUserId),
  index("idx_deal_rescue_urgency").on(table.urgency),
]);

export const insertDealRescueEscalationSchema = createInsertSchema(dealRescueEscalations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  resolvedByUserId: true,
});
export type InsertDealRescueEscalation = z.infer<typeof insertDealRescueEscalationSchema>;
export type DealRescueEscalation = typeof dealRescueEscalations.$inferSelect;

// ===== AGENT STRATEGY SESSIONS =====

export const strategySessions = pgTable("strategy_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentUserId: varchar("agent_user_id").references(() => users.id).notNull(),
  loUserId: varchar("lo_user_id").references(() => users.id),
  scheduledAt: timestamp("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").default(30),
  sessionType: varchar("session_type", { length: 50 }).default("weekly_review"),
  topic: varchar("topic", { length: 500 }),
  notes: text("notes"),
  actionItems: jsonb("action_items"),
  status: varchar("status", { length: 20 }).default("scheduled").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_strategy_sessions_agent").on(table.agentUserId),
  index("idx_strategy_sessions_scheduled").on(table.scheduledAt),
]);

export const insertStrategySessionSchema = createInsertSchema(strategySessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});
export type InsertStrategySession = z.infer<typeof insertStrategySessionSchema>;
export type StrategySession = typeof strategySessions.$inferSelect;

// ===== HOMEBUYER ACCELERATOR PROGRAM =====

export const acceleratorEnrollments = pgTable("accelerator_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  programType: varchar("program_type", { length: 50 }).notNull(),
  currentPhase: integer("current_phase").default(1),
  totalPhases: integer("total_phases").default(6),
  targetDate: timestamp("target_date"),
  currentCreditScore: integer("current_credit_score"),
  targetCreditScore: integer("target_credit_score"),
  currentSavings: decimal("current_savings"),
  targetDownPayment: decimal("target_down_payment"),
  currentDti: decimal("current_dti"),
  targetDti: decimal("target_dti"),
  monthlyBudget: decimal("monthly_budget"),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_accelerator_user").on(table.userId),
  index("idx_accelerator_status").on(table.status),
]);

export const insertAcceleratorEnrollmentSchema = createInsertSchema(acceleratorEnrollments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});
export type InsertAcceleratorEnrollment = z.infer<typeof insertAcceleratorEnrollmentSchema>;
export type AcceleratorEnrollment = typeof acceleratorEnrollments.$inferSelect;

export const acceleratorMilestones = pgTable("accelerator_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enrollmentId: varchar("enrollment_id").references(() => acceleratorEnrollments.id).notNull(),
  phase: integer("phase").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).notNull(),
  targetValue: varchar("target_value", { length: 100 }),
  currentValue: varchar("current_value", { length: 100 }),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_accelerator_milestones_enrollment").on(table.enrollmentId),
]);

export const insertAcceleratorMilestoneSchema = createInsertSchema(acceleratorMilestones).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});
export type InsertAcceleratorMilestone = z.infer<typeof insertAcceleratorMilestoneSchema>;
export type AcceleratorMilestone = typeof acceleratorMilestones.$inferSelect;

// ===== CLOSING SLA GUARANTEES =====

export const closingGuarantees = pgTable("closing_guarantees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  guaranteeType: varchar("guarantee_type", { length: 50 }).notNull(),
  targetDate: timestamp("target_date").notNull(),
  targetHours: integer("target_hours"),
  actualDate: timestamp("actual_date"),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  isAtRisk: boolean("is_at_risk").default(false),
  riskReason: text("risk_reason"),
  isMet: boolean("is_met"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_closing_guarantees_app").on(table.applicationId),
  index("idx_closing_guarantees_status").on(table.status),
]);

export const insertClosingGuaranteeSchema = createInsertSchema(closingGuarantees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertClosingGuarantee = z.infer<typeof insertClosingGuaranteeSchema>;
export type ClosingGuarantee = typeof closingGuarantees.$inferSelect;

// ===== NOTIFICATIONS =====

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  status: varchar("status", { length: 20 }).default("unread").notNull(),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: varchar("entity_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_notifications_user").on(table.userId),
  index("idx_notifications_user_status").on(table.userId, table.status),
]);

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// ===== STAFF INVITES =====

export const staffInvites = pgTable("staff_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 64 }).notNull().unique(),
  role: varchar("role", { length: 50 }).notNull(),
  email: varchar("email", { length: 255 }),
  createdBy: varchar("created_by").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  usedBy: varchar("used_by"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_staff_invites_code").on(table.code),
]);

export const insertStaffInviteSchema = createInsertSchema(staffInvites).omit({
  id: true,
  usedAt: true,
  usedBy: true,
  createdAt: true,
});
export type InsertStaffInvite = z.infer<typeof insertStaffInviteSchema>;
export type StaffInvite = typeof staffInvites.$inferSelect;

// ===== AUDIT LOGS =====

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorUserId: varchar("actor_user_id"),
  action: varchar("action", { length: 100 }).notNull(),
  targetType: varchar("target_type", { length: 50 }),
  targetId: varchar("target_id"),
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_audit_logs_actor").on(table.actorUserId),
  index("idx_audit_logs_action").on(table.action),
  index("idx_audit_logs_created").on(table.createdAt),
]);

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// ===== USER ACTIVITIES =====

export const userActivities = pgTable("user_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  sessionId: varchar("session_id", { length: 100 }),
  activityType: varchar("activity_type", { length: 50 }).notNull(),
  page: varchar("page", { length: 255 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_user_activities_user").on(table.userId),
  index("idx_user_activities_type").on(table.activityType),
]);

export const insertUserActivitySchema = createInsertSchema(userActivities).omit({
  id: true,
  createdAt: true,
});
export type InsertUserActivity = z.infer<typeof insertUserActivitySchema>;
export type UserActivity = typeof userActivities.$inferSelect;

// ===== EMAIL CAPTURES =====

export const emailCaptures = pgTable("email_captures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull(),
  source: varchar("source", { length: 50 }).default("website"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_email_captures_email").on(table.email),
]);

export const agentReferralRequests = pgTable("agent_referral_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  location: varchar("location", { length: 255 }).notNull(),
  buyingTimeline: varchar("buying_timeline", { length: 50 }).notNull(),
  priceRange: varchar("price_range", { length: 50 }),
  propertyType: varchar("property_type", { length: 50 }),
  specialNeeds: text("special_needs"),
  preApproved: boolean("pre_approved").default(false),
  preferredAgentId: varchar("preferred_agent_id").references(() => agentProfiles.id),
  matchedAgentId: varchar("matched_agent_id").references(() => agentProfiles.id),
  status: varchar("status", { length: 30 }).default("pending"),
  referralSentAt: timestamp("referral_sent_at"),
  agentRespondedAt: timestamp("agent_responded_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_agent_referral_status").on(table.status),
  index("idx_agent_referral_agent").on(table.matchedAgentId),
  index("idx_agent_referral_email").on(table.email),
]);

export const insertAgentReferralRequestSchema = createInsertSchema(agentReferralRequests).omit({
  id: true,
  matchedAgentId: true,
  status: true,
  referralSentAt: true,
  agentRespondedAt: true,
  createdAt: true,
}).extend({
  preferredAgentId: z.string().optional().nullable(),
});
export type InsertAgentReferralRequest = z.infer<typeof insertAgentReferralRequestSchema>;
export type AgentReferralRequest = typeof agentReferralRequests.$inferSelect;
