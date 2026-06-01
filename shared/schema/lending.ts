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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./core";
import {
  underwritingDecisions,
  underwritingSnapshots,
  underwritingRulesDsl,
  confidenceBreakdowns,
  CONDITION_CATEGORIES,
} from "./underwriting";
import { creditConsents } from "./compliance";

// Loan Applications
export const loanApplications = pgTable("loan_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  status: varchar("status", { length: 50 }).default("draft").notNull(),
  
  // Borrower Information
  annualIncome: decimal("annual_income", { precision: 12, scale: 2 }),
  monthlyDebts: decimal("monthly_debts", { precision: 10, scale: 2 }),
  creditScore: integer("credit_score"),
  employmentType: varchar("employment_type", { length: 50 }),
  employmentYears: integer("employment_years"),
  employerName: varchar("employer_name", { length: 255 }),
  
  // Property Information
  propertyAddress: text("property_address"),
  propertyCity: varchar("property_city", { length: 100 }),
  propertyState: varchar("property_state", { length: 50 }),
  propertyZip: varchar("property_zip", { length: 20 }),
  propertyType: varchar("property_type", { length: 50 }),
  propertyValue: decimal("property_value", { precision: 12, scale: 2 }),
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 2 }),
  downPayment: decimal("down_payment", { precision: 12, scale: 2 }),
  
  // Loan Preferences
  loanPurpose: varchar("loan_purpose", { length: 50 }),
  preferredLoanType: varchar("preferred_loan_type", { length: 50 }),
  isVeteran: boolean("is_veteran").default(false),
  isFirstTimeBuyer: boolean("is_first_time_buyer").default(false),
  
  // Multi-income source tracking
  incomeSources: jsonb("income_sources"),
  
  // Calculated Values (populated by AI analysis)
  dtiRatio: decimal("dti_ratio", { precision: 5, scale: 2 }),
  ltvRatio: decimal("ltv_ratio", { precision: 5, scale: 2 }),
  preApprovalAmount: decimal("pre_approval_amount", { precision: 12, scale: 2 }),
  
  // AI Analysis
  aiAnalysis: jsonb("ai_analysis"),
  aiAnalyzedAt: timestamp("ai_analyzed_at"),
  
  // Broker reference
  referringBrokerId: varchar("referring_broker_id").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_loan_applications_user").on(table.userId),
  index("idx_loan_applications_status").on(table.status),
  index("idx_loan_applications_created").on(table.createdAt),
  index("idx_loan_applications_broker").on(table.referringBrokerId),
  index("idx_loan_applications_user_status").on(table.userId, table.status),
]);

export const insertLoanApplicationSchema = createInsertSchema(loanApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLoanApplication = z.infer<typeof insertLoanApplicationSchema>;
export type LoanApplication = typeof loanApplications.$inferSelect;

// Deal Team Members - tracks all professionals working on a loan application
export const dealTeamRoles = [
  "loan_officer",
  "loan_processor", 
  "underwriter",
  "closer",
  "real_estate_agent",
  "title_agent",
  "appraiser",
  "insurance_agent",
  "attorney",
  "escrow_officer",
] as const;

export const dealTeamRoleLabels: Record<typeof dealTeamRoles[number], string> = {
  loan_officer: "Loan Officer",
  loan_processor: "Loan Processor",
  underwriter: "Underwriter",
  closer: "Closer/Funder",
  real_estate_agent: "Real Estate Agent",
  title_agent: "Title Agent",
  appraiser: "Appraiser",
  insurance_agent: "Insurance Agent",
  attorney: "Attorney",
  escrow_officer: "Escrow Officer",
};

export const dealTeamMembers = pgTable("deal_team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  userId: varchar("user_id").references(() => users.id),
  
  teamRole: varchar("team_role", { length: 50 }).notNull(),
  
  externalName: varchar("external_name", { length: 255 }),
  externalEmail: varchar("external_email", { length: 255 }),
  externalPhone: varchar("external_phone", { length: 50 }),
  externalCompany: varchar("external_company", { length: 255 }),
  
  isPrimary: boolean("is_primary").default(false),
  isActive: boolean("is_active").default(true).notNull(),
  
  assignedBy: varchar("assigned_by").references(() => users.id),
  assignedAt: timestamp("assigned_at").defaultNow(),
  
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_deal_team_application").on(table.applicationId),
  index("idx_deal_team_user").on(table.userId),
  index("idx_deal_team_role").on(table.teamRole),
]);

export const insertDealTeamMemberSchema = createInsertSchema(dealTeamMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDealTeamMember = z.infer<typeof insertDealTeamMemberSchema>;
export type DealTeamMember = typeof dealTeamMembers.$inferSelect;

// Application Properties - supports multiple properties per application
export const applicationProperties = pgTable("application_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  address: text("address").notNull(),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zipCode: varchar("zip_code", { length: 20 }),
  propertyType: varchar("property_type", { length: 50 }),
  
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 2 }).notNull(),
  downPayment: decimal("down_payment", { precision: 12, scale: 2 }),
  
  status: varchar("status", { length: 50 }).default("active").notNull(),
  isCurrentProperty: boolean("is_current_property").default(true).notNull(),
  
  offerAmount: decimal("offer_amount", { precision: 12, scale: 2 }),
  offerDate: timestamp("offer_date"),
  offerStatus: varchar("offer_status", { length: 50 }),
  
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertApplicationPropertySchema = createInsertSchema(applicationProperties).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertApplicationProperty = z.infer<typeof insertApplicationPropertySchema>;
export type ApplicationProperty = typeof applicationProperties.$inferSelect;

// Loan Options (generated scenarios)
export const loanOptions = pgTable("loan_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  loanType: varchar("loan_type", { length: 50 }).notNull(),
  loanTerm: integer("loan_term").notNull(),
  
  interestRate: decimal("interest_rate", { precision: 5, scale: 3 }).notNull(),
  apr: decimal("apr", { precision: 5, scale: 3 }).notNull(),
  
  points: decimal("points", { precision: 5, scale: 3 }).default("0"),
  pointsCost: decimal("points_cost", { precision: 10, scale: 2 }).default("0"),
  
  monthlyPayment: decimal("monthly_payment", { precision: 10, scale: 2 }).notNull(),
  principalAndInterest: decimal("principal_and_interest", { precision: 10, scale: 2 }).notNull(),
  propertyTax: decimal("property_tax", { precision: 10, scale: 2 }),
  homeInsurance: decimal("home_insurance", { precision: 10, scale: 2 }),
  pmi: decimal("pmi", { precision: 10, scale: 2 }),
  hoaFees: decimal("hoa_fees", { precision: 10, scale: 2 }),
  
  loanAmount: decimal("loan_amount", { precision: 12, scale: 2 }).notNull(),
  closingCosts: decimal("closing_costs", { precision: 10, scale: 2 }),
  cashToClose: decimal("cash_to_close", { precision: 12, scale: 2 }),
  totalInterestPaid: decimal("total_interest_paid", { precision: 12, scale: 2 }),
  
  downPaymentAmount: decimal("down_payment_amount", { precision: 12, scale: 2 }),
  downPaymentPercent: decimal("down_payment_percent", { precision: 5, scale: 2 }),
  
  isRecommended: boolean("is_recommended").default(false),
  isLocked: boolean("is_locked").default(false),
  lockedAt: timestamp("locked_at"),
  lockExpiresAt: timestamp("lock_expires_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLoanOptionSchema = createInsertSchema(loanOptions).omit({
  id: true,
  createdAt: true,
});

export type InsertLoanOption = z.infer<typeof insertLoanOptionSchema>;
export type LoanOption = typeof loanOptions.$inferSelect;

// Documents
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  documentType: varchar("document_type", { length: 50 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),
  storagePath: text("storage_path").notNull(),
  
  status: varchar("status", { length: 50 }).default("uploaded"),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_documents_application").on(table.applicationId),
  index("idx_documents_user").on(table.userId),
  index("idx_documents_status").on(table.status),
  index("idx_documents_user_status").on(table.userId, table.status),
]);

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// Deal Activities (for tracking loan progress)
export const dealActivities = pgTable("deal_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  activityType: varchar("activity_type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  metadata: jsonb("metadata"),
  
  performedBy: varchar("performed_by").references(() => users.id),
  visibleToRoles: text("visible_to_roles").array(),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDealActivitySchema = createInsertSchema(dealActivities).omit({
  id: true,
  createdAt: true,
});

export type InsertDealActivity = z.infer<typeof insertDealActivitySchema>;
export type DealActivity = typeof dealActivities.$inferSelect;

// URLA Personal Information (Section 1a)
export const urlaPersonalInfo = pgTable("urla_personal_info", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  firstName: varchar("first_name", { length: 100 }),
  middleName: varchar("middle_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  suffix: varchar("suffix", { length: 20 }),
  
  ssn: varchar("ssn", { length: 11 }),
  dateOfBirth: varchar("date_of_birth", { length: 10 }),
  citizenship: varchar("citizenship", { length: 50 }),
  
  alternateNames: text("alternate_names"),
  
  creditType: varchar("credit_type", { length: 50 }),
  totalBorrowers: integer("total_borrowers"),
  coBorrowerNames: text("co_borrower_names"),
  
  maritalStatus: varchar("marital_status", { length: 50 }),
  numberOfDependents: integer("number_of_dependents"),
  dependentAges: text("dependent_ages"),
  
  homePhone: varchar("home_phone", { length: 20 }),
  cellPhone: varchar("cell_phone", { length: 20 }),
  workPhone: varchar("work_phone", { length: 20 }),
  workPhoneExt: varchar("work_phone_ext", { length: 10 }),
  email: varchar("email", { length: 255 }),
  
  currentStreet: text("current_street"),
  currentUnit: varchar("current_unit", { length: 20 }),
  currentCity: varchar("current_city", { length: 100 }),
  currentState: varchar("current_state", { length: 50 }),
  currentZip: varchar("current_zip", { length: 20 }),
  currentCountry: varchar("current_country", { length: 100 }),
  currentAddressYears: integer("current_address_years"),
  currentAddressMonths: integer("current_address_months"),
  currentHousingType: varchar("current_housing_type", { length: 50 }),
  currentRentAmount: decimal("current_rent_amount", { precision: 10, scale: 2 }),
  
  formerStreet: text("former_street"),
  formerUnit: varchar("former_unit", { length: 20 }),
  formerCity: varchar("former_city", { length: 100 }),
  formerState: varchar("former_state", { length: 50 }),
  formerZip: varchar("former_zip", { length: 20 }),
  formerCountry: varchar("former_country", { length: 100 }),
  formerAddressYears: integer("former_address_years"),
  formerAddressMonths: integer("former_address_months"),
  formerHousingType: varchar("former_housing_type", { length: 50 }),
  formerRentAmount: decimal("former_rent_amount", { precision: 10, scale: 2 }),
  
  mailingDifferent: boolean("mailing_different").default(false),
  mailingStreet: text("mailing_street"),
  mailingUnit: varchar("mailing_unit", { length: 20 }),
  mailingCity: varchar("mailing_city", { length: 100 }),
  mailingState: varchar("mailing_state", { length: 50 }),
  mailingZip: varchar("mailing_zip", { length: 20 }),
  mailingCountry: varchar("mailing_country", { length: 100 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUrlaPersonalInfoSchema = createInsertSchema(urlaPersonalInfo).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUrlaPersonalInfo = z.infer<typeof insertUrlaPersonalInfoSchema>;
export type UrlaPersonalInfo = typeof urlaPersonalInfo.$inferSelect;

// Employment History (Sections 1b, 1c, 1d)
export const employmentHistory = pgTable("employment_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  employmentType: varchar("employment_type", { length: 50 }).notNull(),
  
  employerName: varchar("employer_name", { length: 255 }),
  employerPhone: varchar("employer_phone", { length: 20 }),
  employerStreet: text("employer_street"),
  employerUnit: varchar("employer_unit", { length: 20 }),
  employerCity: varchar("employer_city", { length: 100 }),
  employerState: varchar("employer_state", { length: 50 }),
  employerZip: varchar("employer_zip", { length: 20 }),
  employerCountry: varchar("employer_country", { length: 100 }),
  
  positionTitle: varchar("position_title", { length: 255 }),
  startDate: varchar("start_date", { length: 10 }),
  endDate: varchar("end_date", { length: 10 }),
  yearsInLineOfWork: integer("years_in_line_of_work"),
  monthsInLineOfWork: integer("months_in_line_of_work"),
  
  isSelfEmployed: boolean("is_self_employed").default(false),
  ownershipShareLessThan25: boolean("ownership_share_less_than_25"),
  ownershipShare25OrMore: boolean("ownership_share_25_or_more"),
  isEmployedByFamilyMember: boolean("is_employed_by_family_member").default(false),
  isEmployedByPropertySeller: boolean("is_employed_by_property_seller").default(false),
  
  baseIncome: decimal("base_income", { precision: 12, scale: 2 }),
  overtimeIncome: decimal("overtime_income", { precision: 12, scale: 2 }),
  bonusIncome: decimal("bonus_income", { precision: 12, scale: 2 }),
  commissionIncome: decimal("commission_income", { precision: 12, scale: 2 }),
  militaryEntitlements: decimal("military_entitlements", { precision: 12, scale: 2 }),
  otherIncome: decimal("other_income", { precision: 12, scale: 2 }),
  totalMonthlyIncome: decimal("total_monthly_income", { precision: 12, scale: 2 }),
  
  monthlyIncomeOrLoss: decimal("monthly_income_or_loss", { precision: 12, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEmploymentHistorySchema = createInsertSchema(employmentHistory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmploymentHistory = z.infer<typeof insertEmploymentHistorySchema>;
export type EmploymentHistory = typeof employmentHistory.$inferSelect;

// Other Income Sources (Section 1e)
export const otherIncomeSources = pgTable("other_income_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  incomeSource: varchar("income_source", { length: 100 }).notNull(),
  monthlyAmount: decimal("monthly_amount", { precision: 12, scale: 2 }).notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOtherIncomeSourceSchema = createInsertSchema(otherIncomeSources).omit({
  id: true,
  createdAt: true,
});

export type InsertOtherIncomeSource = z.infer<typeof insertOtherIncomeSourceSchema>;
export type OtherIncomeSource = typeof otherIncomeSources.$inferSelect;

// Assets (Section 2a)
export const urlaAssets = pgTable("urla_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  accountType: varchar("account_type", { length: 100 }).notNull(),
  financialInstitution: varchar("financial_institution", { length: 255 }),
  accountNumber: varchar("account_number", { length: 100 }),
  cashOrMarketValue: decimal("cash_or_market_value", { precision: 12, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUrlaAssetSchema = createInsertSchema(urlaAssets).omit({
  id: true,
  createdAt: true,
});

export type InsertUrlaAsset = z.infer<typeof insertUrlaAssetSchema>;
export type UrlaAsset = typeof urlaAssets.$inferSelect;

// Liabilities (Section 2)
export const urlaLiabilities = pgTable("urla_liabilities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  liabilityType: varchar("liability_type", { length: 100 }).notNull(),
  creditorName: varchar("creditor_name", { length: 255 }),
  accountNumber: varchar("account_number", { length: 100 }),
  unpaidBalance: decimal("unpaid_balance", { precision: 12, scale: 2 }),
  monthlyPayment: decimal("monthly_payment", { precision: 10, scale: 2 }),
  toBePaidOff: boolean("to_be_paid_off").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUrlaLiabilitySchema = createInsertSchema(urlaLiabilities).omit({
  id: true,
  createdAt: true,
});

export type InsertUrlaLiability = z.infer<typeof insertUrlaLiabilitySchema>;
export type UrlaLiability = typeof urlaLiabilities.$inferSelect;

// URLA Property Information (Section for Property and Loan details)
export const urlaPropertyInfo = pgTable("urla_property_info", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  propertyStreet: text("property_street"),
  propertyUnit: varchar("property_unit", { length: 20 }),
  propertyCity: varchar("property_city", { length: 100 }),
  propertyState: varchar("property_state", { length: 50 }),
  propertyZip: varchar("property_zip", { length: 20 }),
  propertyCountry: varchar("property_country", { length: 100 }),
  
  numberOfUnits: integer("number_of_units"),
  propertyValue: decimal("property_value", { precision: 12, scale: 2 }),
  occupancyType: varchar("occupancy_type", { length: 50 }),
  
  isMixedUse: boolean("is_mixed_use").default(false),
  mixedUseDescription: text("mixed_use_description"),
  
  isManufacturedHome: boolean("is_manufactured_home").default(false),
  manufacturedWidth: varchar("manufactured_width", { length: 50 }),
  
  legalDescription: text("legal_description"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUrlaPropertyInfoSchema = createInsertSchema(urlaPropertyInfo).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUrlaPropertyInfo = z.infer<typeof insertUrlaPropertyInfoSchema>;
export type UrlaPropertyInfo = typeof urlaPropertyInfo.$inferSelect;

// Borrower Declarations (URLA Section 5 / MISMO 3.4 Declarations)
export const borrowerDeclarations = pgTable("borrower_declarations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  willOccupyAsPrimaryResidence: boolean("will_occupy_as_primary_residence"),
  hasOwnershipInterestInPast3Years: boolean("has_ownership_interest_in_past_3_years"),
  priorPropertyType: varchar("prior_property_type", { length: 50 }),
  priorPropertyTitle: varchar("prior_property_title", { length: 50 }),
  
  hasRelationshipWithSeller: boolean("has_relationship_with_seller"),
  isBorrowingForDownPayment: boolean("is_borrowing_for_down_payment"),
  borrowedAmount: decimal("borrowed_amount", { precision: 12, scale: 2 }),
  
  hasAppliedForMortgageOnOtherProperty: boolean("has_applied_for_mortgage_on_other_property"),
  hasCreditForMortgageOnOtherProperty: boolean("has_credit_for_mortgage_on_other_property"),
  hasPriorityLienOnSubjectProperty: boolean("has_priority_lien_on_subject_property"),
  
  hasCoMakerEndorser: boolean("has_co_maker_endorser"),
  hasOutstandingJudgments: boolean("has_outstanding_judgments"),
  isDelinquentOnFederalDebt: boolean("is_delinquent_on_federal_debt"),
  isPartyToLawsuit: boolean("is_party_to_lawsuit"),
  hasConveyedTitleInLieuOfForeclosure: boolean("has_conveyed_title_in_lieu_of_foreclosure"),
  hasCompletedShortSale: boolean("has_completed_short_sale"),
  hasBeenForeclosed: boolean("has_been_foreclosed"),
  hasDeclaredBankruptcy: boolean("has_declared_bankruptcy"),
  bankruptcyTypes: text("bankruptcy_types"),
  
  hasUndisclosedDebt: boolean("has_undisclosed_debt"),
  undisclosedDebtAmount: decimal("undisclosed_debt_amount", { precision: 12, scale: 2 }),
  hasAppliedForNewCredit: boolean("has_applied_for_new_credit"),
  hasPriorityLienToBePaidOff: boolean("has_priority_lien_to_be_paid_off"),
  
  isUSCitizen: boolean("is_us_citizen"),
  isPermanentResidentAlien: boolean("is_permanent_resident_alien"),
  
  declarationsCompletedAt: timestamp("declarations_completed_at"),
  declarationsVerifiedAt: timestamp("declarations_verified_at"),
  declarationsVerifiedBy: varchar("declarations_verified_by").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBorrowerDeclarationsSchema = createInsertSchema(borrowerDeclarations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBorrowerDeclarations = z.infer<typeof insertBorrowerDeclarationsSchema>;
export type BorrowerDeclarations = typeof borrowerDeclarations.$inferSelect;

const VALID_US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC"
] as const;

export type USStateCode = typeof VALID_US_STATES[number];
export { VALID_US_STATES };

const currencyString = (fieldLabel: string) =>
  z.string()
    .min(1, `${fieldLabel} is required`)
    .refine(
      (v) => {
        const num = parseFloat(v.replace(/[,$]/g, ""));
        return !isNaN(num) && num >= 0;
      },
      { message: `${fieldLabel} must be a valid dollar amount` }
    );

const positiveCurrencyString = (fieldLabel: string) =>
  z.string()
    .min(1, `${fieldLabel} is required`)
    .refine(
      (v) => {
        const num = parseFloat(v.replace(/[,$]/g, ""));
        return !isNaN(num) && num > 0;
      },
      { message: `${fieldLabel} must be greater than $0` }
    )
    .refine(
      (v) => {
        const num = parseFloat(v.replace(/[,$]/g, ""));
        return num <= 100_000_000;
      },
      { message: `${fieldLabel} exceeds the maximum allowed value` }
    );

export const rentalPropertyEntrySchema = z.object({
  address: z.string()
    .min(1, "Property address is required")
    .max(500, "Address is too long"),
  city: z.string().max(100, "City name is too long").optional(),
  state: z.string()
    .refine((v) => !v || VALID_US_STATES.includes(v as any), { message: "Please select a valid US state" })
    .optional(),
  monthlyRentalIncome: z.string()
    .min(1, "Monthly rental income is required")
    .refine(
      (v) => { const n = parseFloat(v.replace(/[,$]/g, "")); return !isNaN(n) && n > 0; },
      { message: "Rental income must be a valid amount greater than $0" }
    )
    .refine(
      (v) => { const n = parseFloat(v.replace(/[,$]/g, "")); return n <= 1_000_000; },
      { message: "Monthly rental income exceeds the maximum allowed value" }
    ),
  monthlyDebtPayment: z.string()
    .refine(
      (v) => { if (!v) return true; const n = parseFloat(v.replace(/[,$]/g, "")); return !isNaN(n) && n >= 0; },
      { message: "Debt payment must be a valid dollar amount" }
    )
    .optional(),
});

export type RentalPropertyEntry = z.infer<typeof rentalPropertyEntrySchema>;

export const incomeSourceEntrySchema = z.object({
  type: z.enum(
    ["w2", "self_employed", "rental", "social_security", "pension", "investment", "other"],
    { errorMap: () => ({ message: "Please select a valid income type" }) }
  ),
  annualAmount: z.string()
    .min(1, "Income amount is required")
    .refine(
      (v) => { const n = parseFloat(v.replace(/[,$]/g, "")); return !isNaN(n) && n > 0; },
      { message: "Income amount must be greater than $0" }
    )
    .refine(
      (v) => { const n = parseFloat(v.replace(/[,$]/g, "")); return n <= 100_000_000; },
      { message: "Income amount exceeds the maximum allowed value" }
    ),
  employerName: z.string().max(200, "Employer name is too long").optional(),
  yearsInRole: z.string()
    .refine(
      (v) => { if (!v) return true; const n = parseInt(v); return !isNaN(n) && n >= 0 && n <= 80; },
      { message: "Years in role must be between 0 and 80" }
    )
    .optional(),
  rentalProperties: z.array(rentalPropertyEntrySchema).optional(),
});

export type IncomeSourceEntry = z.infer<typeof incomeSourceEntrySchema>;

const preApprovalFormBaseSchema = z.object({
  annualIncome: positiveCurrencyString("Annual income"),
  employmentType: z.enum(
    ["employed", "self_employed", "retired", "other"],
    { errorMap: () => ({ message: "Please select your employment status" }) }
  ),
  employmentYears: z.string()
    .min(1, "Years at current job is required")
    .refine(
      (v) => { const n = parseInt(v); return !isNaN(n) && n >= 0; },
      { message: "Please enter a valid number of years" }
    )
    .refine(
      (v) => { const n = parseInt(v); return n <= 80; },
      { message: "Years at current job cannot exceed 80" }
    ),

  hasAdditionalIncome: z.boolean().optional(),
  incomeSources: z.array(incomeSourceEntrySchema).optional(),

  monthlyDebts: currencyString("Monthly debts")
    .refine(
      (v) => { const n = parseFloat(v.replace(/[,$]/g, "")); return n <= 1_000_000; },
      { message: "Monthly debts exceeds the maximum allowed value" }
    ),
  creditScore: z.string()
    .min(1, "Credit score range is required")
    .refine(
      (v) => ["760", "720", "680", "640", "600", "not_sure"].includes(v),
      { message: "Please select a valid credit score range" }
    ),

  loanPurpose: z.enum(
    ["purchase", "refinance", "cash_out"],
    { errorMap: () => ({ message: "Please select what you're looking to do" }) }
  ),
  propertyType: z.enum(
    ["single_family", "condo", "townhouse", "multi_family"],
    { errorMap: () => ({ message: "Please select a property type" }) }
  ),
  purchasePrice: positiveCurrencyString("Purchase price"),
  downPayment: currencyString("Down payment"),

  isVeteran: z.boolean(),
  isFirstTimeBuyer: z.boolean(),
  propertyState: z.string()
    .min(1, "Property state is required")
    .refine(
      (v) => VALID_US_STATES.includes(v as any),
      { message: "Please select a valid US state" }
    ),
});

export type PreApprovalFormData = z.infer<typeof preApprovalFormBaseSchema>;

export const preApprovalFormSchema = preApprovalFormBaseSchema.superRefine(
  (data, ctx) => {
    const dp = parseFloat(data.downPayment.replace(/[,$]/g, ""));
    const pp = parseFloat(data.purchasePrice.replace(/[,$]/g, ""));
    if (!isNaN(dp) && !isNaN(pp) && dp > pp) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Down payment cannot be more than the purchase price",
        path: ["downPayment"],
      });
    }
  }
);

// =============================================================================
// MORTGAGE RATES
// =============================================================================

export const mortgageRatePrograms = pgTable("mortgage_rate_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  description: text("description"),
  termYears: integer("term_years"),
  isAdjustable: boolean("is_adjustable").default(false),
  adjustmentPeriod: varchar("adjustment_period", { length: 20 }),
  loanType: varchar("loan_type", { length: 50 }),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMortgageRateProgramSchema = createInsertSchema(mortgageRatePrograms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMortgageRateProgram = z.infer<typeof insertMortgageRateProgramSchema>;
export type MortgageRateProgram = typeof mortgageRatePrograms.$inferSelect;

export const mortgageRates = pgTable("mortgage_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  state: varchar("state", { length: 2 }),
  zipcode: varchar("zipcode", { length: 10 }),
  
  programId: varchar("program_id").references(() => mortgageRatePrograms.id).notNull(),
  
  rate: decimal("rate", { precision: 6, scale: 3 }).notNull(),
  apr: decimal("apr", { precision: 6, scale: 3 }).notNull(),
  points: decimal("points", { precision: 5, scale: 2 }),
  pointsCost: decimal("points_cost", { precision: 10, scale: 2 }),
  
  loanAmount: decimal("loan_amount", { precision: 12, scale: 2 }).default("160000"),
  downPaymentPercent: integer("down_payment_percent").default(20),
  creditScoreMin: integer("credit_score_min").default(760),
  
  isActive: boolean("is_active").default(true),
  effectiveDate: timestamp("effective_date").defaultNow(),
  expiresAt: timestamp("expires_at"),
  
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_mortgage_rates_location").on(table.state, table.zipcode),
  index("idx_mortgage_rates_program").on(table.programId),
  index("idx_mortgage_rates_active").on(table.isActive),
]);

export const insertMortgageRateSchema = createInsertSchema(mortgageRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMortgageRate = z.infer<typeof insertMortgageRateSchema>;
export type MortgageRate = typeof mortgageRates.$inferSelect;

// Application Invites - Referral links for LOs and agents to send to affluent clients
export const applicationInvites = pgTable("application_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  referrerId: varchar("referrer_id").references(() => users.id).notNull(),
  referrerType: varchar("referrer_type", { length: 20 }).notNull(),
  
  clientName: varchar("client_name", { length: 255 }),
  clientEmail: varchar("client_email", { length: 255 }),
  clientPhone: varchar("client_phone", { length: 20 }),
  
  token: varchar("token", { length: 64 }).unique().notNull(),
  message: text("message"),
  
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  
  expiresAt: timestamp("expires_at").notNull(),
  clickedAt: timestamp("clicked_at"),
  appliedAt: timestamp("applied_at"),
  loanApplicationId: varchar("loan_application_id").references(() => loanApplications.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_application_invites_referrer").on(table.referrerId),
  index("idx_application_invites_token").on(table.token),
  index("idx_application_invites_status").on(table.status),
]);

export const insertApplicationInviteSchema = createInsertSchema(applicationInvites).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertApplicationInvite = z.infer<typeof insertApplicationInviteSchema>;
export type ApplicationInvite = typeof applicationInvites.$inferSelect;

// ===== RATE LOCK SYSTEM =====

export const rateLocks = pgTable("rate_locks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  loanOptionId: varchar("loan_option_id").references(() => loanOptions.id).notNull(),
  
  interestRate: decimal("interest_rate", { precision: 5, scale: 3 }).notNull(),
  points: decimal("points", { precision: 5, scale: 3 }),
  loanAmount: decimal("loan_amount", { precision: 12, scale: 2 }).notNull(),
  loanType: varchar("loan_type", { length: 50 }).notNull(),
  loanTerm: integer("loan_term").notNull(),
  
  lockPeriodDays: integer("lock_period_days").notNull(),
  lockedAt: timestamp("locked_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  
  status: varchar("status", { length: 50 }).default("active").notNull(),
  
  extensionCount: integer("extension_count").default(0),
  originalExpiresAt: timestamp("original_expires_at"),
  extensionFee: decimal("extension_fee", { precision: 10, scale: 2 }),
  
  lockedBy: varchar("locked_by").references(() => users.id).notNull(),
  cancelledBy: varchar("cancelled_by").references(() => users.id),
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason"),
  
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_rate_locks_application").on(table.applicationId),
  index("idx_rate_locks_status").on(table.status),
  index("idx_rate_locks_expires").on(table.expiresAt),
]);

export const insertRateLockSchema = createInsertSchema(rateLocks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRateLock = z.infer<typeof insertRateLockSchema>;
export type RateLock = typeof rateLocks.$inferSelect;

// ===== ANALYTICS & SLA TRACKING =====

export const applicationMilestones = pgTable("application_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  applicationReceivedAt: timestamp("application_received_at"),
  documentCollectionStartedAt: timestamp("document_collection_started_at"),
  documentCollectionCompletedAt: timestamp("document_collection_completed_at"),
  submittedToProcessingAt: timestamp("submitted_to_processing_at"),
  processingCompletedAt: timestamp("processing_completed_at"),
  submittedToUnderwritingAt: timestamp("submitted_to_underwriting_at"),
  conditionalApprovalAt: timestamp("conditional_approval_at"),
  clearToCloseAt: timestamp("clear_to_close_at"),
  closingScheduledAt: timestamp("closing_scheduled_at"),
  closedAt: timestamp("closed_at"),
  fundedAt: timestamp("funded_at"),
  
  deniedAt: timestamp("denied_at"),
  denialReason: text("denial_reason"),
  
  withdrawnAt: timestamp("withdrawn_at"),
  withdrawalReason: text("withdrawal_reason"),
  
  totalCycleTimeHours: decimal("total_cycle_time_hours", { precision: 10, scale: 2 }),
  processingTimeHours: decimal("processing_time_hours", { precision: 10, scale: 2 }),
  underwritingTimeHours: decimal("underwriting_time_hours", { precision: 10, scale: 2 }),
  closingTimeHours: decimal("closing_time_hours", { precision: 10, scale: 2 }),
  
  slaTargetDate: timestamp("sla_target_date"),
  isSlaMet: boolean("is_sla_met"),
  slaBreachReason: text("sla_breach_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_application_milestones_app").on(table.applicationId),
]);

export const insertApplicationMilestoneSchema = createInsertSchema(applicationMilestones).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertApplicationMilestone = z.infer<typeof insertApplicationMilestoneSchema>;
export type ApplicationMilestone = typeof applicationMilestones.$inferSelect;

// SLA Configurations - Define SLA targets
export const slaConfigurations = pgTable("sla_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  applicationToProcessingHours: integer("application_to_processing_hours").default(24),
  processingToUnderwritingHours: integer("processing_to_underwriting_hours").default(48),
  underwritingDecisionHours: integer("underwriting_decision_hours").default(72),
  conditionalToCtcHours: integer("conditional_to_ctc_hours").default(48),
  ctcToClosingHours: integer("ctc_to_closing_hours").default(72),
  totalApplicationToCloseHours: integer("total_application_to_close_hours").default(360),
  
  loanType: varchar("loan_type", { length: 50 }),
  
  isActive: boolean("is_active").default(true).notNull(),
  effectiveDate: timestamp("effective_date").notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_sla_configurations_active").on(table.isActive),
]);

export const insertSlaConfigurationSchema = createInsertSchema(slaConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSlaConfiguration = z.infer<typeof insertSlaConfigurationSchema>;
export type SlaConfiguration = typeof slaConfigurations.$inferSelect;

// Daily Analytics Snapshots - Pre-computed metrics for dashboard
export const analyticsSnapshots = pgTable("analytics_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  snapshotDate: timestamp("snapshot_date").notNull(),
  
  totalApplications: integer("total_applications").default(0),
  applicationsInPipeline: integer("applications_in_pipeline").default(0),
  applicationsProcessing: integer("applications_processing").default(0),
  applicationsUnderwriting: integer("applications_underwriting").default(0),
  applicationsApproved: integer("applications_approved").default(0),
  applicationsDenied: integer("applications_denied").default(0),
  applicationsWithdrawn: integer("applications_withdrawn").default(0),
  applicationsClosed: integer("applications_closed").default(0),
  applicationsFunded: integer("applications_funded").default(0),
  
  newApplicationsToday: integer("new_applications_today").default(0),
  closedVolumeToday: decimal("closed_volume_today", { precision: 14, scale: 2 }).default("0"),
  fundedVolumeToday: decimal("funded_volume_today", { precision: 14, scale: 2 }).default("0"),
  
  avgTotalCycleTime: decimal("avg_total_cycle_time", { precision: 10, scale: 2 }),
  avgProcessingTime: decimal("avg_processing_time", { precision: 10, scale: 2 }),
  avgUnderwritingTime: decimal("avg_underwriting_time", { precision: 10, scale: 2 }),
  
  slaComplianceRate: decimal("sla_compliance_rate", { precision: 5, scale: 2 }),
  loansAtRiskOfSlaBreach: integer("loans_at_risk_of_sla_breach").default(0),
  
  applicationToApprovalRate: decimal("application_to_approval_rate", { precision: 5, scale: 2 }),
  approvalToCloseRate: decimal("approval_to_close_rate", { precision: 5, scale: 2 }),
  pullThroughRate: decimal("pull_through_rate", { precision: 5, scale: 2 }),
  
  avgLoansPerLO: decimal("avg_loans_per_lo", { precision: 5, scale: 1 }),
  avgLoansPerProcessor: decimal("avg_loans_per_processor", { precision: 5, scale: 1 }),
  avgLoansPerUnderwriter: decimal("avg_loans_per_underwriter", { precision: 5, scale: 1 }),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_analytics_snapshots_date").on(table.snapshotDate),
]);

export const insertAnalyticsSnapshotSchema = createInsertSchema(analyticsSnapshots).omit({
  id: true,
  createdAt: true,
});

export type InsertAnalyticsSnapshot = z.infer<typeof insertAnalyticsSnapshotSchema>;
export type AnalyticsSnapshot = typeof analyticsSnapshots.$inferSelect;

// ============================================================================
// PRE-APPROVAL LETTER GENERATOR (Lender-Grade, Broker-Safe)
// ============================================================================

export const disclaimerVersions = pgTable("disclaimer_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  version: varchar("version", { length: 20 }).notNull().unique(),
  
  disclaimerType: varchar("disclaimer_type", { length: 50 }).notNull(),
  
  text: text("text").notNull(),
  
  approvedByCounsel: boolean("approved_by_counsel").default(false),
  counselApprovalDate: timestamp("counsel_approval_date"),
  counselName: varchar("counsel_name", { length: 255 }),
  
  effectiveFrom: timestamp("effective_from").notNull(),
  effectiveTo: timestamp("effective_to"),
  
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
}, (table) => [
  index("idx_disclaimer_versions_type_version").on(table.disclaimerType, table.version),
  index("idx_disclaimer_versions_effective").on(table.effectiveFrom, table.effectiveTo),
]);

export const insertDisclaimerVersionSchema = createInsertSchema(disclaimerVersions).omit({
  id: true,
  createdAt: true,
});

export const PRE_APPROVAL_PRODUCT_TYPES = ["CONV", "FHA", "VA", "HELOC", "DSCR"] as const;
export type PreApprovalProductType = typeof PRE_APPROVAL_PRODUCT_TYPES[number];

export const PRE_APPROVAL_OCCUPANCY_TYPES = ["Primary", "Second", "Investment"] as const;
export type PreApprovalOccupancyType = typeof PRE_APPROVAL_OCCUPANCY_TYPES[number];

export const PRE_APPROVAL_LETTER_STATUS = [
  "draft",
  "issued",
  "superseded",
  "expired",
  "revoked",
] as const;
export type PreApprovalLetterStatus = typeof PRE_APPROVAL_LETTER_STATUS[number];

export const preApprovalLetters = pgTable("pre_approval_letters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  letterNumber: varchar("letter_number", { length: 50 }).notNull().unique(),
  
  borrowerName: varchar("borrower_name", { length: 255 }).notNull(),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  loanAmount: decimal("loan_amount", { precision: 14, scale: 2 }).notNull(),
  productType: varchar("product_type", { length: 20 }).notNull(),
  occupancy: varchar("occupancy", { length: 20 }).notNull(),
  loanPurpose: varchar("loan_purpose", { length: 50 }),
  
  rateLockedAt: timestamp("rate_locked_at"),
  lockedRate: decimal("locked_rate", { precision: 5, scale: 3 }),
  
  underwritingSnapshotId: varchar("underwriting_snapshot_id").references(() => underwritingDecisions.id),
  
  primaryDisclaimerId: varchar("primary_disclaimer_id").references(() => disclaimerVersions.id),
  brokerRoleDisclaimerId: varchar("broker_role_disclaimer_id").references(() => disclaimerVersions.id),
  documentRelianceDisclaimerId: varchar("document_reliance_disclaimer_id").references(() => disclaimerVersions.id),
  changeInCircumstanceDisclaimerId: varchar("change_in_circumstance_disclaimer_id").references(() => disclaimerVersions.id),
  systemGeneratedDisclaimerId: varchar("system_generated_disclaimer_id").references(() => disclaimerVersions.id),
  
  expirationDate: timestamp("expiration_date").notNull(),
  
  status: varchar("status", { length: 20 }).notNull().default("issued"),
  
  generatedBySystem: boolean("generated_by_system").default(true),
  generatedAt: timestamp("generated_at").defaultNow(),
  
  companyLegalName: varchar("company_legal_name", { length: 255 }).notNull(),
  companyNmlsId: varchar("company_nmls_id", { length: 50 }).notNull(),
  companyContactInfo: text("company_contact_info"),
  
  loanOfficerId: varchar("loan_officer_id").references(() => users.id),
  loanOfficerNmlsId: varchar("loan_officer_nmls_id", { length: 50 }),
  
  pdfStorageKey: varchar("pdf_storage_key", { length: 500 }),
  pdfGeneratedAt: timestamp("pdf_generated_at"),
  watermarkApplied: boolean("watermark_applied").default(true),
  
  isLocked: boolean("is_locked").default(true),
  
  revokedAt: timestamp("revoked_at"),
  revokedBy: varchar("revoked_by").references(() => users.id),
  revocationReason: text("revocation_reason"),
  
  supersededAt: timestamp("superseded_at"),
  supersededBy: varchar("superseded_by"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_pre_approval_letters_application").on(table.applicationId),
  index("idx_pre_approval_letters_borrower").on(table.borrowerName),
  index("idx_pre_approval_letters_status").on(table.status),
  index("idx_pre_approval_letters_expiration").on(table.expirationDate),
  index("idx_pre_approval_letters_snapshot").on(table.underwritingSnapshotId),
]);

export const insertPreApprovalLetterSchema = createInsertSchema(preApprovalLetters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const PRE_APPROVAL_CONDITION_CATEGORIES = [
  ...CONDITION_CATEGORIES,
  "lender_underwriting",
  "appraisal",
  "verification",
  "documentation",
] as const;
export type PreApprovalConditionCategory = typeof PRE_APPROVAL_CONDITION_CATEGORIES[number];

export const preApprovalConditions = pgTable("pre_approval_conditions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  letterId: varchar("letter_id").references(() => preApprovalLetters.id).notNull(),
  
  category: varchar("category", { length: 50 }).notNull(),
  conditionText: text("condition_text").notNull(),
  
  autoGenerated: boolean("auto_generated").default(true),
  sourceRuleId: varchar("source_rule_id").references(() => underwritingRulesDsl.id),
  
  isStandardCondition: boolean("is_standard_condition").default(false),
  
  displayOrder: integer("display_order").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_pre_approval_conditions_letter").on(table.letterId),
  index("idx_pre_approval_conditions_category").on(table.category),
]);

export const insertPreApprovalConditionSchema = createInsertSchema(preApprovalConditions).omit({
  id: true,
  createdAt: true,
});

// Pre-Qualification Letters
export const preQualificationLetters = pgTable("pre_qualification_letters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  letterNumber: varchar("letter_number", { length: 50 }).notNull().unique(),
  borrowerName: varchar("borrower_name", { length: 255 }).notNull(),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),

  estimatedAmount: decimal("estimated_amount", { precision: 14, scale: 2 }).notNull(),
  productType: varchar("product_type", { length: 20 }).notNull(),
  occupancy: varchar("occupancy", { length: 20 }).notNull(),
  loanPurpose: varchar("loan_purpose", { length: 50 }),

  annualIncome: decimal("annual_income", { precision: 12, scale: 2 }),
  creditScoreRange: varchar("credit_score_range", { length: 50 }),
  employmentType: varchar("employment_type", { length: 50 }),
  estimatedDti: decimal("estimated_dti", { precision: 5, scale: 2 }),
  downPaymentPercent: decimal("down_payment_percent", { precision: 5, scale: 2 }),

  expirationDate: timestamp("expiration_date").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("issued"),

  generatedAt: timestamp("generated_at").defaultNow(),
  companyLegalName: varchar("company_legal_name", { length: 255 }).notNull(),
  companyNmlsId: varchar("company_nmls_id", { length: 50 }).notNull(),
  companyContactInfo: text("company_contact_info"),

  loanOfficerId: varchar("loan_officer_id").references(() => users.id),
  loanOfficerNmlsId: varchar("loan_officer_nmls_id", { length: 50 }),

  pdfStorageKey: varchar("pdf_storage_key", { length: 500 }),
  pdfGeneratedAt: timestamp("pdf_generated_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_pre_qual_letters_application").on(table.applicationId),
  index("idx_pre_qual_letters_status").on(table.status),
]);

export const insertPreQualificationLetterSchema = createInsertSchema(preQualificationLetters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPreQualificationLetter = z.infer<typeof insertPreQualificationLetterSchema>;
export type PreQualificationLetter = typeof preQualificationLetters.$inferSelect;

// Letter Generation Log
export const LETTER_GENERATION_EVENTS = [
  "generation_started",
  "validation_passed",
  "validation_failed",
  "pdf_generated",
  "pdf_failed",
  "letter_issued",
  "letter_revoked",
  "letter_superseded",
  "letter_expired",
  "reanalysis_triggered",
] as const;
export type LetterGenerationEvent = typeof LETTER_GENERATION_EVENTS[number];

export const letterGenerationLogs = pgTable("letter_generation_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  letterId: varchar("letter_id").references(() => preApprovalLetters.id),
  
  eventType: varchar("event_type", { length: 50 }).notNull(),
  eventDetails: jsonb("event_details"),
  
  triggerConditions: jsonb("trigger_conditions"),
  conditionsMet: boolean("conditions_met"),
  failedConditions: jsonb("failed_conditions"),
  
  reanalysisReason: varchar("reanalysis_reason", { length: 100 }),
  previousSnapshotId: varchar("previous_snapshot_id").references(() => underwritingDecisions.id),
  newSnapshotId: varchar("new_snapshot_id").references(() => underwritingDecisions.id),
  
  triggeredBy: varchar("triggered_by").references(() => users.id),
  triggeredBySystem: boolean("triggered_by_system").default(false),
  
  eventAt: timestamp("event_at").defaultNow(),
  processingTimeMs: integer("processing_time_ms"),
  
  errorMessage: text("error_message"),
  errorStack: text("error_stack"),
}, (table) => [
  index("idx_letter_generation_logs_application").on(table.applicationId),
  index("idx_letter_generation_logs_letter").on(table.letterId),
  index("idx_letter_generation_logs_event").on(table.eventType),
  index("idx_letter_generation_logs_time").on(table.eventAt),
]);

export const insertLetterGenerationLogSchema = createInsertSchema(letterGenerationLogs).omit({
  id: true,
});

export const STANDARD_PRE_APPROVAL_CONDITIONS = [
  { category: "lender_underwriting", text: "Final lender underwriting approval", order: 1 },
  { category: "appraisal", text: "Satisfactory appraisal of the subject property", order: 2 },
  { category: "verification", text: "Verification of unchanged financial condition prior to closing", order: 3 },
  { category: "documentation", text: "Receipt of any additional documentation as requested by the lender", order: 4 },
  { category: "title", text: "Clear and marketable title to the subject property", order: 5 },
  { category: "insurance", text: "Proof of adequate homeowner's insurance", order: 6 },
] as const;

export type InsertDisclaimerVersion = z.infer<typeof insertDisclaimerVersionSchema>;
export type DisclaimerVersion = typeof disclaimerVersions.$inferSelect;
export type InsertPreApprovalLetter = z.infer<typeof insertPreApprovalLetterSchema>;
export type PreApprovalLetter = typeof preApprovalLetters.$inferSelect;
export type InsertPreApprovalCondition = z.infer<typeof insertPreApprovalConditionSchema>;
export type PreApprovalCondition = typeof preApprovalConditions.$inferSelect;
export type InsertLetterGenerationLog = z.infer<typeof insertLetterGenerationLogSchema>;
export type LetterGenerationLog = typeof letterGenerationLogs.$inferSelect;

// ============================================================================
// INSTITUTIONAL PLATFORM FEATURES
// ============================================================================

export const expirationPolicies = pgTable("expiration_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  policyName: varchar("policy_name", { length: 100 }).notNull(),
  productType: varchar("product_type", { length: 20 }).notNull(),
  
  preApprovalValidityDays: integer("pre_approval_validity_days").default(90).notNull(),
  creditValidityDays: integer("credit_validity_days").default(120).notNull(),
  incomeDocValidityDays: integer("income_doc_validity_days").default(60).notNull(),
  assetDocValidityDays: integer("asset_doc_validity_days").default(60).notNull(),
  employmentVerificationValidityDays: integer("employment_verification_validity_days").default(30),
  
  preApprovalWarningDays: integer("pre_approval_warning_days").default(14),
  creditWarningDays: integer("credit_warning_days").default(21),
  incomeDocWarningDays: integer("income_doc_warning_days").default(10),
  assetDocWarningDays: integer("asset_doc_warning_days").default(10),
  
  isActive: boolean("is_active").default(true),
  effectiveFrom: timestamp("effective_from").notNull(),
  effectiveTo: timestamp("effective_to"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_expiration_policies_product").on(table.productType),
  index("idx_expiration_policies_active").on(table.isActive),
]);

export const insertExpirationPolicySchema = createInsertSchema(expirationPolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const CREDIT_REFRESH_TYPES = ["SOFT", "HARD"] as const;
export type CreditRefreshType = typeof CREDIT_REFRESH_TYPES[number];

export const CREDIT_REFRESH_REASONS = [
  "credit_expiring",
  "liability_change_detected",
  "aus_submission",
  "lender_selection",
  "borrower_request",
  "rate_lock_required",
  "compliance_requirement",
] as const;
export type CreditRefreshReason = typeof CREDIT_REFRESH_REASONS[number];

export const creditRefreshDecisions = pgTable("credit_refresh_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  borrowerId: varchar("borrower_id").references(() => users.id).notNull(),
  
  refreshType: varchar("refresh_type", { length: 10 }).notNull(),
  reason: varchar("reason", { length: 50 }).notNull(),
  reasonDetails: text("reason_details"),
  
  consentId: varchar("consent_id").references(() => creditConsents.id),
  consentObtained: boolean("consent_obtained").default(false),
  consentObtainedAt: timestamp("consent_obtained_at"),
  
  previousCreditReportId: varchar("previous_credit_report_id"),
  previousCreditScore: integer("previous_credit_score"),
  previousExpirationDate: timestamp("previous_expiration_date"),
  
  newCreditReportId: varchar("new_credit_report_id"),
  newCreditScore: integer("new_credit_score"),
  newExpirationDate: timestamp("new_expiration_date"),
  
  scoreChange: integer("score_change"),
  significantChange: boolean("significant_change").default(false),
  
  previousSnapshotId: varchar("previous_snapshot_id").references(() => underwritingDecisions.id),
  newSnapshotId: varchar("new_snapshot_id").references(() => underwritingDecisions.id),
  previousLetterId: varchar("previous_letter_id").references(() => preApprovalLetters.id),
  newLetterId: varchar("new_letter_id").references(() => preApprovalLetters.id),
  
  decisionMadeBy: varchar("decision_made_by").references(() => users.id),
  decisionMadeBySystem: boolean("decision_made_by_system").default(false),
  decisionAt: timestamp("decision_at").defaultNow(),
  
  executedAt: timestamp("executed_at"),
  executionStatus: varchar("execution_status", { length: 20 }),
  executionError: text("execution_error"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_credit_refresh_decisions_application").on(table.applicationId),
  index("idx_credit_refresh_decisions_borrower").on(table.borrowerId),
  index("idx_credit_refresh_decisions_type").on(table.refreshType),
  index("idx_credit_refresh_decisions_decision_at").on(table.decisionAt),
]);

export const insertCreditRefreshDecisionSchema = createInsertSchema(creditRefreshDecisions).omit({
  id: true,
  createdAt: true,
});

export const lenderPreApprovalFormats = pgTable("lender_pre_approval_formats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  lenderId: varchar("lender_id", { length: 100 }).notNull().unique(),
  lenderName: varchar("lender_name", { length: 255 }).notNull(),
  lenderLogo: varchar("lender_logo", { length: 500 }),
  
  showLoanAmount: boolean("show_loan_amount").default(true),
  showDti: boolean("show_dti").default(false),
  showCreditScore: boolean("show_credit_score").default(false),
  showAssetReserves: boolean("show_asset_reserves").default(false),
  showIncomeDetails: boolean("show_income_details").default(false),
  showLtv: boolean("show_ltv").default(false),
  showProductType: boolean("show_product_type").default(true),
  showOccupancy: boolean("show_occupancy").default(true),
  showPropertyAddress: boolean("show_property_address").default(true),
  
  requiredFields: jsonb("required_fields").$type<string[]>().default([]),
  
  disclaimerOverrides: jsonb("disclaimer_overrides").$type<{
    primary?: string;
    brokerRole?: string;
    documentReliance?: string;
    changeInCircumstance?: string;
    systemGenerated?: string;
    lenderSpecific?: string;
  }>(),
  
  brandingRules: jsonb("branding_rules").$type<{
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    headerStyle?: string;
    footerText?: string;
    customWatermark?: string;
  }>(),
  
  letterFormat: varchar("letter_format", { length: 20 }).default("standard"),
  includeConditions: boolean("include_conditions").default(true),
  maxConditionsToShow: integer("max_conditions_to_show"),
  
  fieldOrdering: jsonb("field_ordering").$type<string[]>(),
  
  templateId: varchar("template_id", { length: 100 }),
  templateVersion: varchar("template_version", { length: 20 }),
  
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_lender_pre_approval_formats_lender").on(table.lenderId),
  index("idx_lender_pre_approval_formats_active").on(table.isActive),
]);

export const insertLenderPreApprovalFormatSchema = createInsertSchema(lenderPreApprovalFormats).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const CONFIDENCE_LEVELS = ["strong", "solid", "fragile"] as const;
export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[number];

export const agentConfidenceViews = pgTable("agent_confidence_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  confidenceBreakdownId: varchar("confidence_breakdown_id").references(() => confidenceBreakdowns.id).notNull(),
  
  overallScore: decimal("overall_score", { precision: 4, scale: 2 }).notNull(),
  
  incomeScore: decimal("income_score", { precision: 4, scale: 2 }),
  assetsScore: decimal("assets_score", { precision: 4, scale: 2 }),
  creditScore: decimal("credit_score", { precision: 4, scale: 2 }),
  documentationScore: decimal("documentation_score", { precision: 4, scale: 2 }),
  stabilityScore: decimal("stability_score", { precision: 4, scale: 2 }),
  
  confidenceLevel: varchar("confidence_level", { length: 20 }).notNull(),
  
  riskFlags: jsonb("risk_flags").$type<string[]>().default([]),
  
  tooltipText: text("tooltip_text").default("Confidence score reflects the strength and completeness of the loan file based on preliminary analysis. It is not a lender decision."),
  
  visibleToAgents: boolean("visible_to_agents").default(true),
  visibleToBorrower: boolean("visible_to_borrower").default(false),
  visibleToLO: boolean("visible_to_lo").default(true),
  visibleToProcessor: boolean("visible_to_processor").default(true),
  visibleToUnderwriter: boolean("visible_to_underwriter").default(true),
  
  underwritingSnapshotId: varchar("underwriting_snapshot_id").references(() => underwritingDecisions.id),
  
  computedAt: timestamp("computed_at").defaultNow(),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_agent_confidence_views_application").on(table.applicationId),
  index("idx_agent_confidence_views_level").on(table.confidenceLevel),
  index("idx_agent_confidence_views_computed").on(table.computedAt),
]);

export const insertAgentConfidenceViewSchema = createInsertSchema(agentConfidenceViews).omit({
  id: true,
  createdAt: true,
});

export const documentExpirations = pgTable("document_expirations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  
  documentType: varchar("document_type", { length: 50 }).notNull(),
  
  documentDate: timestamp("document_date").notNull(),
  expirationDate: timestamp("expiration_date").notNull(),
  warningDate: timestamp("warning_date"),
  
  policyId: varchar("policy_id").references(() => expirationPolicies.id),
  
  status: varchar("status", { length: 20 }).default("valid"),
  
  warningNotifiedAt: timestamp("warning_notified_at"),
  expirationNotifiedAt: timestamp("expiration_notified_at"),
  notifiedBorrower: boolean("notified_borrower").default(false),
  notifiedLO: boolean("notified_lo").default(false),
  notifiedAgent: boolean("notified_agent").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_document_expirations_application").on(table.applicationId),
  index("idx_document_expirations_document").on(table.documentId),
  index("idx_document_expirations_status").on(table.status),
  index("idx_document_expirations_expiration").on(table.expirationDate),
]);

export const insertDocumentExpirationSchema = createInsertSchema(documentExpirations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertExpirationPolicy = z.infer<typeof insertExpirationPolicySchema>;
export type ExpirationPolicy = typeof expirationPolicies.$inferSelect;
export type InsertCreditRefreshDecision = z.infer<typeof insertCreditRefreshDecisionSchema>;
export type CreditRefreshDecision = typeof creditRefreshDecisions.$inferSelect;
export type InsertLenderPreApprovalFormat = z.infer<typeof insertLenderPreApprovalFormatSchema>;
export type LenderPreApprovalFormat = typeof lenderPreApprovalFormats.$inferSelect;
export type InsertAgentConfidenceView = z.infer<typeof insertAgentConfidenceViewSchema>;
export type AgentConfidenceView = typeof agentConfidenceViews.$inferSelect;
export type InsertDocumentExpiration = z.infer<typeof insertDocumentExpirationSchema>;
export type DocumentExpiration = typeof documentExpirations.$inferSelect;

// =============================================================================
// LENDER DATA PACKAGES
// =============================================================================

export const lenderDataPackages = pgTable("lender_data_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  packageId: varchar("package_id", { length: 100 }).notNull().unique(),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  
  lenderId: varchar("lender_id", { length: 100 }).notNull(),
  lenderName: varchar("lender_name", { length: 255 }).notNull(),
  lenderFormatId: varchar("lender_format_id").references(() => lenderPreApprovalFormats.id),
  
  status: varchar("status", { length: 30 }).default("DRAFT"),
  
  borrowerSummary: jsonb("borrower_summary").$type<{
    borrowerType: string;
    occupancy: string;
    loanPurpose: string;
    productType: string;
    confidenceScore?: number;
    preApprovalAmount: number;
    expirationDate: string;
  }>(),
  
  underwritingMetrics: jsonb("underwriting_metrics").$type<{
    DTI: {
      frontEnd: number;
      backEnd: number;
      calculationMethod: string;
      confidence?: number;
    };
    DSCR?: {
      applicable: boolean;
      value?: number;
      method?: string;
      confidence?: number;
    };
    LTV: number;
    CLTV: number;
    creditScore?: number;
    reserves?: number;
  }>(),
  
  decisionSnapshot: jsonb("decision_snapshot").$type<{
    decisionType: string;
    snapshotId: string;
    policyAuthority: string;
    policyVersion: string;
    issuedAt: string;
    expiresAt: string;
    decisionStatus: string;
  }>(),
  
  documentIndex: jsonb("document_index").$type<{
    documents: {
      documentId: string;
      type: string;
      borrower: string;
      dateRange?: string;
      confidence: number;
      pages: number;
    }[];
    extractedData: {
      income: Record<string, number>;
      assets: Record<string, number | boolean>;
    };
  }>(),
  
  cocStatus: jsonb("coc_status").$type<{
    monitoringActive: boolean;
    lastChecked: string;
    materialChangesDetected: boolean;
    rulesetVersion: string;
    events?: {
      dimension: string;
      event: string;
      severity: string;
      actionTaken: string;
      timestamp: string;
    }[];
  }>(),
  
  explanations: jsonb("explanations").$type<{
    metric: string;
    method: string;
    inputs: string[];
    reasoning: string;
  }[]>(),
  
  submittedAt: timestamp("submitted_at"),
  submittedBy: varchar("submitted_by"),
  responseReceivedAt: timestamp("response_received_at"),
  lenderResponse: jsonb("lender_response").$type<{
    status: string;
    conditions?: string[];
    notes?: string;
    respondedBy?: string;
  }>(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_lender_data_packages_application").on(table.applicationId),
  index("idx_lender_data_packages_snapshot").on(table.snapshotId),
  index("idx_lender_data_packages_lender").on(table.lenderId),
  index("idx_lender_data_packages_status").on(table.status),
]);

export const insertLenderDataPackageSchema = createInsertSchema(lenderDataPackages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLenderDataPackage = z.infer<typeof insertLenderDataPackageSchema>;
export type LenderDataPackage = typeof lenderDataPackages.$inferSelect;

// =============================================================================
// OFFER BRIDGE ARCHITECTURE
// =============================================================================

export const wholesaleLenders = pgTable("wholesale_lenders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  lenderId: varchar("lender_id", { length: 100 }).notNull().unique(),
  lenderName: varchar("lender_name", { length: 255 }).notNull(),
  lenderCode: varchar("lender_code", { length: 20 }).notNull().unique(),
  
  primaryContact: varchar("primary_contact", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  portalUrl: varchar("portal_url", { length: 500 }),
  
  integrationTier: varchar("integration_tier", { length: 20 }).default("MANUAL").notNull(),
  
  apiConfig: jsonb("api_config").$type<{
    baseUrl?: string;
    authType?: "API_KEY" | "OAUTH" | "BASIC";
    endpoints?: {
      pricing?: string;
      lock?: string;
      productEligibility?: string;
    };
  }>(),
  
  capabilities: jsonb("capabilities").$type<{
    productTypes: string[];
    occupancyTypes: string[];
    statesLicensed: string[];
    minLoanAmount?: number;
    maxLoanAmount?: number;
    minCreditScore?: number;
  }>(),
  
  brokerCompensation: jsonb("broker_compensation").$type<{
    compensationType: "BORROWER_PAID" | "LENDER_PAID" | "EITHER";
    defaultBps?: number;
    minBps?: number;
    maxBps?: number;
  }>(),
  
  status: varchar("status", { length: 20 }).default("ACTIVE"),
  isPreferred: boolean("is_preferred").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_wholesale_lenders_code").on(table.lenderCode),
  index("idx_wholesale_lenders_tier").on(table.integrationTier),
  index("idx_wholesale_lenders_status").on(table.status),
]);

export const insertWholesaleLenderSchema = createInsertSchema(wholesaleLenders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWholesaleLender = z.infer<typeof insertWholesaleLenderSchema>;
export type WholesaleLender = typeof wholesaleLenders.$inferSelect;

export const rateSheets = pgTable("rate_sheets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  sheetId: varchar("sheet_id", { length: 100 }).notNull().unique(),
  lenderId: varchar("lender_id").references(() => wholesaleLenders.id).notNull(),
  
  version: varchar("version", { length: 20 }).notNull(),
  effectiveDate: date("effective_date").notNull(),
  expirationDate: date("expiration_date").notNull(),
  
  uploadMethod: varchar("upload_method", { length: 20 }).default("MANUAL"),
  uploadedBy: varchar("uploaded_by"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  sourceFileName: varchar("source_file_name", { length: 255 }),
  
  productTypes: text("product_types").array(),
  lockTerms: integer("lock_terms").array(),
  
  status: varchar("status", { length: 20 }).default("ACTIVE"),
  
  rawData: jsonb("raw_data"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_rate_sheets_lender").on(table.lenderId),
  index("idx_rate_sheets_effective").on(table.effectiveDate),
  index("idx_rate_sheets_status").on(table.status),
]);

export const insertRateSheetSchema = createInsertSchema(rateSheets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRateSheet = z.infer<typeof insertRateSheetSchema>;
export type RateSheet = typeof rateSheets.$inferSelect;

export const rateSheetProducts = pgTable("rate_sheet_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  rateSheetId: varchar("rate_sheet_id").references(() => rateSheets.id).notNull(),
  
  productCode: varchar("product_code", { length: 50 }).notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  productType: varchar("product_type", { length: 30 }).notNull(),
  loanTerm: integer("loan_term").notNull(),
  amortizationType: varchar("amortization_type", { length: 20 }).default("FIXED"),
  
  baseRate: decimal("base_rate", { precision: 6, scale: 4 }).notNull(),
  
  lockTermAdjustments: jsonb("lock_term_adjustments").$type<{
    [lockDays: string]: number;
  }>(),
  
  pointsGrid: jsonb("points_grid").$type<{
    rate: number;
    points: number;
    rebate: number;
  }[]>(),
  
  eligibilityConstraints: jsonb("eligibility_constraints").$type<{
    minLoanAmount?: number;
    maxLoanAmount?: number;
    minCreditScore?: number;
    maxLTV?: number;
    maxDTI?: number;
    occupancyTypes?: string[];
    propertyTypes?: string[];
  }>(),
  
  lenderFees: jsonb("lender_fees").$type<{
    originationFee?: number;
    underwritingFee?: number;
    processingFee?: number;
    floodCertFee?: number;
    appraisalFee?: number;
    other?: { name: string; amount: number }[];
  }>(),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_rate_sheet_products_sheet").on(table.rateSheetId),
  index("idx_rate_sheet_products_type").on(table.productType),
  index("idx_rate_sheet_products_code").on(table.productCode),
]);

export const insertRateSheetProductSchema = createInsertSchema(rateSheetProducts).omit({
  id: true,
  createdAt: true,
});

export type InsertRateSheetProduct = z.infer<typeof insertRateSheetProductSchema>;
export type RateSheetProduct = typeof rateSheetProducts.$inferSelect;

export const lenderPricingAdjustments = pgTable("lender_pricing_adjustments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  lenderId: varchar("lender_id").references(() => wholesaleLenders.id).notNull(),
  rateSheetId: varchar("rate_sheet_id").references(() => rateSheets.id),
  
  adjustmentType: varchar("adjustment_type", { length: 30 }).notNull(),
  adjustmentName: varchar("adjustment_name", { length: 255 }).notNull(),
  
  condition: jsonb("condition").$type<{
    creditScoreMin?: number;
    creditScoreMax?: number;
    ltvMin?: number;
    ltvMax?: number;
    occupancy?: string;
    propertyType?: string;
    loanPurpose?: string;
    productType?: string;
  }>().notNull(),
  
  adjustmentValue: decimal("adjustment_value", { precision: 6, scale: 4 }).notNull(),
  
  isStackable: boolean("is_stackable").default(true),
  
  guidelineReference: varchar("guideline_reference", { length: 255 }),
  
  effectiveDate: date("effective_date").notNull(),
  expirationDate: date("expiration_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_lender_pricing_adj_lender").on(table.lenderId),
  index("idx_lender_pricing_adj_type").on(table.adjustmentType),
  index("idx_lender_pricing_adj_effective").on(table.effectiveDate),
]);

export const insertLenderPricingAdjustmentSchema = createInsertSchema(lenderPricingAdjustments).omit({
  id: true,
  createdAt: true,
});

export type InsertLenderPricingAdjustment = z.infer<typeof insertLenderPricingAdjustmentSchema>;
export type LenderPricingAdjustment = typeof lenderPricingAdjustments.$inferSelect;

export const lenderOffers = pgTable("lender_offers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  offerId: varchar("offer_id", { length: 100 }).notNull().unique(),
  
  lenderId: varchar("lender_id").references(() => wholesaleLenders.id).notNull(),
  productId: varchar("product_id").references(() => rateSheetProducts.id).notNull(),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  
  rate: decimal("rate", { precision: 6, scale: 4 }).notNull(),
  apr: decimal("apr", { precision: 6, scale: 4 }),
  points: decimal("points", { precision: 6, scale: 4 }).default("0"),
  
  lenderFees: decimal("lender_fees", { precision: 12, scale: 2 }).default("0"),
  thirdPartyFees: decimal("third_party_fees", { precision: 12, scale: 2 }).default("0"),
  totalClosingCosts: decimal("total_closing_costs", { precision: 12, scale: 2 }),
  
  monthlyPrincipalInterest: decimal("monthly_pi", { precision: 12, scale: 2 }),
  monthlyMI: decimal("monthly_mi", { precision: 12, scale: 2 }).default("0"),
  monthlyTotal: decimal("monthly_total", { precision: 12, scale: 2 }),
  
  lockTerm: integer("lock_term").notNull(),
  lockExpiration: timestamp("lock_expiration"),
  
  offerExpiration: timestamp("offer_expiration").notNull(),
  
  conditions: jsonb("conditions").$type<{
    preClosing?: string[];
    postClosing?: string[];
    priorToDoc?: string[];
  }>(),
  
  brokerCompensationBps: integer("broker_compensation_bps"),
  brokerCompensationAmount: decimal("broker_compensation_amount", { precision: 12, scale: 2 }),
  
  status: varchar("status", { length: 20 }).default("PROPOSED").notNull(),
  
  selectedAt: timestamp("selected_at"),
  selectedBy: varchar("selected_by"),
  
  lockedAt: timestamp("locked_at"),
  lockedBy: varchar("locked_by"),
  lockConfirmationNumber: varchar("lock_confirmation_number", { length: 100 }),
  
  pricingBreakdown: jsonb("pricing_breakdown").$type<{
    baseRate: number;
    llpaAdjustments: { name: string; value: number }[];
    lockAdjustment: number;
    finalRate: number;
    totalAdjustments: number;
  }>(),
  
  labels: text("labels").array(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_lender_offers_application").on(table.applicationId),
  index("idx_lender_offers_snapshot").on(table.snapshotId),
  index("idx_lender_offers_lender").on(table.lenderId),
  index("idx_lender_offers_status").on(table.status),
  index("idx_lender_offers_expiration").on(table.offerExpiration),
]);

export const insertLenderOfferSchema = createInsertSchema(lenderOffers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLenderOffer = z.infer<typeof insertLenderOfferSchema>;
export type LenderOffer = typeof lenderOffers.$inferSelect;

export const lockRequests = pgTable("lock_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  requestId: varchar("request_id", { length: 100 }).notNull().unique(),
  
  offerId: varchar("offer_id").references(() => lenderOffers.id).notNull(),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  requestedLockTerm: integer("requested_lock_term").notNull(),
  requestedLockExpiration: date("requested_lock_expiration").notNull(),
  
  clientAttestation: jsonb("client_attestation").$type<{
    noMaterialChanges: boolean;
    informationAccurate: boolean;
    attestedAt: string;
    attestedBy: string;
    ipAddress?: string;
  }>(),
  
  cocCheckResult: jsonb("coc_check_result").$type<{
    checkedAt: string;
    snapshotCurrent: boolean;
    materialChangesDetected: boolean;
    changes?: {
      dimension: string;
      severity: string;
      description: string;
    }[];
  }>(),
  
  status: varchar("status", { length: 20 }).default("PENDING").notNull(),
  
  submittedAt: timestamp("submitted_at"),
  submittedBy: varchar("submitted_by"),
  submissionMethod: varchar("submission_method", { length: 20 }),
  
  lenderResponse: jsonb("lender_response").$type<{
    status: "CONFIRMED" | "DENIED" | "PENDING";
    confirmationNumber?: string;
    confirmedRate?: number;
    confirmedLockExpiration?: string;
    denialReason?: string;
    conditions?: string[];
    respondedAt?: string;
    respondedBy?: string;
  }>(),
  
  confirmedAt: timestamp("confirmed_at"),
  confirmationNumber: varchar("confirmation_number", { length: 100 }),
  confirmedRate: decimal("confirmed_rate", { precision: 6, scale: 4 }),
  confirmedLockExpiration: date("confirmed_lock_expiration"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_lock_requests_offer").on(table.offerId),
  index("idx_lock_requests_application").on(table.applicationId),
  index("idx_lock_requests_status").on(table.status),
]);

export const insertLockRequestSchema = createInsertSchema(lockRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLockRequest = z.infer<typeof insertLockRequestSchema>;
export type LockRequest = typeof lockRequests.$inferSelect;

export const brokerOfferControls = pgTable("broker_offer_controls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  suppressedLenderIds: text("suppressed_lender_ids").array(),
  
  offerRanking: jsonb("offer_ranking").$type<{
    offerId: string;
    rank: number;
    reason?: string;
  }[]>(),
  
  houseOverlays: jsonb("house_overlays").$type<{
    minCreditScore?: number;
    maxDTI?: number;
    maxLTV?: number;
    excludePropertyTypes?: string[];
    excludeOccupancyTypes?: string[];
    notes?: string;
  }>(),
  
  brokerCompensationType: varchar("broker_compensation_type", { length: 20 }),
  brokerCompensationBps: integer("broker_compensation_bps"),
  compensationLockedAt: timestamp("compensation_locked_at"),
  compensationLockedBy: varchar("compensation_locked_by"),
  
  displayPreferences: jsonb("display_preferences").$type<{
    maxOffersToShow?: number;
    defaultSortBy?: "PAYMENT" | "TOTAL_COST" | "RATE";
    showPointsToggle?: boolean;
  }>(),
  
  actionLog: jsonb("action_log").$type<{
    action: string;
    timestamp: string;
    performedBy: string;
    details?: Record<string, unknown>;
  }[]>(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_broker_offer_controls_application").on(table.applicationId),
]);

export const insertBrokerOfferControlSchema = createInsertSchema(brokerOfferControls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBrokerOfferControl = z.infer<typeof insertBrokerOfferControlSchema>;
export type BrokerOfferControl = typeof brokerOfferControls.$inferSelect;

export const offerSelectionEvents = pgTable("offer_selection_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  eventId: varchar("event_id", { length: 100 }).notNull().unique(),
  
  offerId: varchar("offer_id").references(() => lenderOffers.id).notNull(),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  lenderId: varchar("lender_id").references(() => wholesaleLenders.id).notNull(),
  
  eventType: varchar("event_type", { length: 30 }).notNull(),
  
  selectionData: jsonb("selection_data").$type<{
    rate: number;
    points: number;
    monthlyPayment: number;
    totalClosingCosts: number;
    lockTerm: number;
    labels?: string[];
  }>(),
  
  performedBy: varchar("performed_by").notNull(),
  performedAt: timestamp("performed_at").defaultNow().notNull(),
  
  lenderVisibility: jsonb("lender_visibility").$type<{
    eligibilitySnapshotId: string;
    offerAccepted: boolean;
    acceptedAt?: string;
    noChangesPending: boolean;
    cocStatus?: string;
  }>(),
  
  clientMetadata: jsonb("client_metadata").$type<{
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  }>(),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_offer_selection_events_offer").on(table.offerId),
  index("idx_offer_selection_events_application").on(table.applicationId),
  index("idx_offer_selection_events_type").on(table.eventType),
  index("idx_offer_selection_events_performed_at").on(table.performedAt),
]);

export const insertOfferSelectionEventSchema = createInsertSchema(offerSelectionEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertOfferSelectionEvent = z.infer<typeof insertOfferSelectionEventSchema>;
export type OfferSelectionEvent = typeof offerSelectionEvents.$inferSelect;

export const offerComparisonSessions = pgTable("offer_comparison_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  sessionId: varchar("session_id", { length: 100 }).notNull().unique(),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  borrowerId: varchar("borrower_id").references(() => users.id).notNull(),
  
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  
  offersShown: jsonb("offers_shown").$type<{
    offerId: string;
    lenderId: string;
    rate: number;
    points: number;
    monthlyPayment: number;
    totalCost: number;
    labels: string[];
    viewedAt?: string;
    viewDurationMs?: number;
  }[]>(),
  
  comparisonActions: jsonb("comparison_actions").$type<{
    action: "TOGGLE_POINTS" | "SORT_BY" | "EXPAND_DETAILS" | "BREAKEVEN_CALC" | "SELECT" | "DESELECT";
    timestamp: string;
    data?: Record<string, unknown>;
  }[]>(),
  
  selectedOfferId: varchar("selected_offer_id").references(() => lenderOffers.id),
  selectionReason: varchar("selection_reason", { length: 255 }),
  
  breakevenCalculations: jsonb("breakeven_calculations").$type<{
    offer1Id: string;
    offer2Id: string;
    breakevenMonths: number;
    calculatedAt: string;
  }[]>(),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_offer_comparison_sessions_application").on(table.applicationId),
  index("idx_offer_comparison_sessions_borrower").on(table.borrowerId),
  index("idx_offer_comparison_sessions_started").on(table.startedAt),
]);

export const insertOfferComparisonSessionSchema = createInsertSchema(offerComparisonSessions).omit({
  id: true,
  createdAt: true,
});

export type InsertOfferComparisonSession = z.infer<typeof insertOfferComparisonSessionSchema>;
export type OfferComparisonSession = typeof offerComparisonSessions.$inferSelect;

export const MESSAGE_TYPES = ["text", "document_request", "document_submitted"] as const;
export type MessageType = typeof MESSAGE_TYPES[number];

export interface DocumentRequestData {
  documentType: string;
  documentName: string;
  description?: string;
  dueDate?: string;
  status: "pending" | "submitted" | "approved" | "rejected";
  documentId?: string;
}

export const teamMessages = pgTable("team_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  recipientId: varchar("recipient_id").references(() => users.id).notNull(),
  
  applicationId: varchar("application_id").references(() => loanApplications.id),
  
  message: text("message").notNull(),
  
  messageType: varchar("message_type", { length: 50 }).default("text"),
  documentRequestData: jsonb("document_request_data"),
  
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_team_messages_sender").on(table.senderId),
  index("idx_team_messages_recipient").on(table.recipientId),
  index("idx_team_messages_application").on(table.applicationId),
  index("idx_team_messages_created").on(table.createdAt),
]);

export const insertTeamMessageSchema = createInsertSchema(teamMessages).omit({
  id: true,
  createdAt: true,
  readAt: true,
});

export type InsertTeamMessage = z.infer<typeof insertTeamMessageSchema>;
export type TeamMessage = typeof teamMessages.$inferSelect;

// ============================================================================
// LOAN PIPELINE TRACKING (Fast Closing Optimization)
// ============================================================================

export const LOAN_STAGES = [
  "draft",
  "submitted",
  "pre_approved",
  "doc_collection",
  "processing",
  "underwriting",
  "conditional",
  "clear_to_close",
  "closing",
  "funded",
  "denied",
] as const;

export type LoanStage = typeof LOAN_STAGES[number];

export const loanMilestones = pgTable("loan_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),

  submittedAt: timestamp("submitted_at"),
  preApprovedAt: timestamp("pre_approved_at"),
  docCollectionStartedAt: timestamp("doc_collection_started_at"),
  processingStartedAt: timestamp("processing_started_at"),
  underwritingStartedAt: timestamp("underwriting_started_at"),
  conditionalApprovedAt: timestamp("conditional_approved_at"),
  clearToCloseAt: timestamp("clear_to_close_at"),
  closingScheduledAt: timestamp("closing_scheduled_at"),
  fundedAt: timestamp("funded_at"),
  deniedAt: timestamp("denied_at"),

  targetCloseDate: timestamp("target_close_date"),
  actualCloseDate: timestamp("actual_close_date"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLoanMilestoneSchema = createInsertSchema(loanMilestones).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLoanMilestone = z.infer<typeof insertLoanMilestoneSchema>;
export type LoanMilestone = typeof loanMilestones.$inferSelect;

// ============================================================================
// PLAID VERIFICATION SYSTEM
// ============================================================================

export const plaidLinkTokens = pgTable("plaid_link_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),

  linkToken: text("link_token").notNull(),
  verificationType: varchar("verification_type", { length: 50 }).notNull(),

  status: varchar("status", { length: 50 }).default("pending").notNull(),
  expiresAt: timestamp("expires_at").notNull(),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPlaidLinkTokenSchema = createInsertSchema(plaidLinkTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertPlaidLinkToken = z.infer<typeof insertPlaidLinkTokenSchema>;
export type PlaidLinkToken = typeof plaidLinkTokens.$inferSelect;

export const verifications = pgTable("verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),

  verificationType: varchar("verification_type", { length: 50 }).notNull(),

  plaidItemId: varchar("plaid_item_id", { length: 255 }),
  plaidAccessToken: text("plaid_access_token"),
  plaidVerificationId: varchar("plaid_verification_id", { length: 255 }),

  status: varchar("status", { length: 50 }).default("pending").notNull(),
  verificationMethod: varchar("verification_method", { length: 50 }),

  employerName: varchar("employer_name", { length: 255 }),
  employerAddress: text("employer_address"),
  jobTitle: varchar("job_title", { length: 255 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isCurrentEmployer: boolean("is_current_employer"),
  employmentStatus: varchar("employment_status", { length: 50 }),

  annualIncome: decimal("annual_income", { precision: 12, scale: 2 }),
  payFrequency: varchar("pay_frequency", { length: 50 }),
  lastPayDate: timestamp("last_pay_date"),
  lastPayAmount: decimal("last_pay_amount", { precision: 10, scale: 2 }),

  identityVerified: boolean("identity_verified").default(false),
  identityMatchScore: integer("identity_match_score"),
  addressVerified: boolean("address_verified").default(false),
  ssnVerified: boolean("ssn_verified").default(false),
  dateOfBirthVerified: boolean("date_of_birth_verified").default(false),

  rawResponse: jsonb("raw_response"),

  reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),

  verifiedAt: timestamp("verified_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVerificationSchema = createInsertSchema(verifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVerification = z.infer<typeof insertVerificationSchema>;
export type Verification = typeof verifications.$inferSelect;
