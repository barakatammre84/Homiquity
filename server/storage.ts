import { db } from "./db";
import { eq, desc, and, gte, lte, sql, or, ilike, asc, count, inArray } from "drizzle-orm";
import {
  users,
  loanApplications,
  loanOptions,
  documents,
  dealActivities,
  properties,
  savedProperties,
  urlaPersonalInfo,
  employmentHistory,
  otherIncomeSources,
  urlaAssets,
  urlaLiabilities,
  urlaPropertyInfo,
  borrowerDeclarations,
  tasks,
  taskDocuments,
  agentProfiles,
  loanMilestones,
  loanConditions,
  documentRequirementRules,
  underwritingSnapshots,
  applicationProperties,
  verifications,
  plaidLinkTokens,
  contentCategories,
  articles,
  faqs,
  mortgageRatePrograms,
  mortgageRates,
  brokerCommissions,
  calculatorResults,
  homeownershipGoals,
  creditActions,
  savingsTransactions,
  journeyMilestones,
  applicationInvites,
  rateLocks,
  consentTemplates,
  borrowerConsents,
  partnerProviders,
  partnerOrders,
  applicationMilestones,
  slaConfigurations,
  analyticsSnapshots,
  dealTeamMembers,
  documentPackages,
  documentPackageItems,
  teamMessages,
  isStaffRole,
  type User,
  type UpsertUser,
  type LoanApplication,
  type InsertLoanApplication,
  type LoanOption,
  type InsertLoanOption,
  type Document,
  type InsertDocument,
  type DealActivity,
  type InsertDealActivity,
  type Property,
  type InsertProperty,
  type UrlaPersonalInfo,
  type InsertUrlaPersonalInfo,
  type EmploymentHistory,
  type InsertEmploymentHistory,
  type OtherIncomeSource,
  type InsertOtherIncomeSource,
  type UrlaAsset,
  type InsertUrlaAsset,
  type UrlaLiability,
  type InsertUrlaLiability,
  type UrlaPropertyInfo,
  type InsertUrlaPropertyInfo,
  type BorrowerDeclarations,
  type InsertBorrowerDeclarations,
  type Task,
  type InsertTask,
  type TaskDocument,
  type InsertTaskDocument,
  type AgentProfile,
  type InsertAgentProfile,
  type LoanMilestone,
  type InsertLoanMilestone,
  type LoanCondition,
  type InsertLoanCondition,
  type DocumentRequirementRule,
  type InsertDocumentRequirementRule,
  type UnderwritingSnapshot,
  type InsertUnderwritingSnapshot,
  type ApplicationProperty,
  type InsertApplicationProperty,
  type Verification,
  type InsertVerification,
  type PlaidLinkToken,
  type InsertPlaidLinkToken,
  type ContentCategory,
  type InsertContentCategory,
  type Article,
  type InsertArticle,
  type Faq,
  type InsertFaq,
  type MortgageRateProgram,
  type InsertMortgageRateProgram,
  type MortgageRate,
  type InsertMortgageRate,
  type BrokerCommission,
  type InsertBrokerCommission,
  type CalculatorResult,
  type InsertCalculatorResult,
  type CalculatorProfile,
  type InsertCalculatorProfile,
  calculatorProfiles,
  type HomeownershipGoal,
  type InsertHomeownershipGoal,
  type CreditAction,
  type InsertCreditAction,
  type SavingsTransaction,
  type InsertSavingsTransaction,
  type JourneyMilestone,
  type InsertJourneyMilestone,
  type ApplicationInvite,
  type InsertApplicationInvite,
  type RateLock,
  type InsertRateLock,
  type ConsentTemplate,
  type InsertConsentTemplate,
  type BorrowerConsent,
  type InsertBorrowerConsent,
  type PartnerProvider,
  type InsertPartnerProvider,
  type PartnerOrder,
  type InsertPartnerOrder,
  type ApplicationMilestone,
  type InsertApplicationMilestone,
  type SlaConfiguration,
  type InsertSlaConfiguration,
  type AnalyticsSnapshot,
  type InsertAnalyticsSnapshot,
  type DealTeamMember,
  type InsertDealTeamMember,
  type DocumentPackage,
  type InsertDocumentPackage,
  type DocumentPackageItem,
  type InsertDocumentPackageItem,
  type TeamMessage,
  type InsertTeamMessage,
  kbaSessions,
  kycScreenings,
  onboardingProfiles,
  onboardingFeedback,
  type KbaSession,
  type InsertKbaSession,
  type KycScreening,
  type InsertKycScreening,
  type OnboardingProfile,
  type InsertOnboardingProfile,
  type OnboardingFeedback,
  type InsertOnboardingFeedback,
  coBrandProfiles,
  type CoBrandProfile,
  type InsertCoBrandProfile,
  dealDeskThreads,
  dealDeskMessages,
  type DealDeskThread,
  type InsertDealDeskThread,
  type DealDeskMessage,
  type InsertDealDeskMessage,
  dpaPrograms,
  type DpaProgram,
  type InsertDpaProgram,
  agentPipelineAccess,
  dealRescueEscalations,
  strategySessions,
  acceleratorEnrollments,
  acceleratorMilestones,
  coachingSessions,
  closingGuarantees,
  homeownerProfiles,
  refiAlerts,
  equitySnapshots,
  type AgentPipelineAccess,
  type InsertAgentPipelineAccess,
  type DealRescueEscalation,
  type InsertDealRescueEscalation,
  type StrategySession,
  type InsertStrategySession,
  type AcceleratorEnrollment,
  type InsertAcceleratorEnrollment,
  type AcceleratorMilestone,
  type InsertAcceleratorMilestone,
  type CoachingSession,
  type InsertCoachingSession,
  type ClosingGuarantee,
  type InsertClosingGuarantee,
  type HomeownerProfile,
  type InsertHomeownerProfile,
  type RefiAlert,
  type InsertRefiAlert,
  type EquitySnapshot,
  type InsertEquitySnapshot,
  notifications,
  staffInvites,
  type Notification,
  type InsertNotification,
  type StaffInvite,
  type InsertStaffInvite,
  auditLogs,
  type AuditLog,
  type InsertAuditLog,
  coachConversations,
  coachMessages,
  type CoachConversation,
  type InsertCoachConversation,
  type CoachMessage,
  type InsertCoachMessage,
  underwritingRulesDsl,
  ruleExecutionLog,
  policyProfiles,
  policyThresholds,
  policyApprovalWorkflow,
  policyLenderOverlays,
  type UnderwritingRuleDsl,
  type InsertUnderwritingRuleDsl,
  type RuleExecutionLog,
  type InsertRuleExecutionLog,
  type PolicyProfile,
  type InsertPolicyProfile,
  type PolicyThreshold,
  type InsertPolicyThreshold,
  type PolicyApprovalWorkflow,
  type InsertPolicyApprovalWorkflow,
  type PolicyLenderOverlay,
  type InsertPolicyLenderOverlay,
  wholesaleLenders,
  rateSheets,
  rateSheetProducts,
  lenderPricingAdjustments,
  lenderOffers,
  type WholesaleLender,
  type InsertWholesaleLender,
  type RateSheet,
  type InsertRateSheet,
  type RateSheetProduct,
  type InsertRateSheetProduct,
  type LenderPricingAdjustment,
  type InsertLenderPricingAdjustment,
  type LenderOffer,
  type InsertLenderOffer,
  agentReferralRequests,
  type AgentReferralRequest,
  type InsertAgentReferralRequest,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(limit?: number): Promise<User[]>;
  getUsersByIds(ids: string[]): Promise<User[]>;
  updateUserRole(id: string, role: string): Promise<User | undefined>;

  // Loan Applications
  createLoanApplication(data: InsertLoanApplication): Promise<LoanApplication>;
  getLoanApplication(id: string): Promise<LoanApplication | undefined>;
  getLoanApplicationWithAccess(id: string, userId: string, userRole: string): Promise<LoanApplication | undefined>;
  getLoanApplicationsByUser(userId: string): Promise<LoanApplication[]>;
  getAllLoanApplications(limit?: number): Promise<LoanApplication[]>;
  updateLoanApplication(id: string, data: Partial<LoanApplication>): Promise<LoanApplication | undefined>;

  // Loan Options
  createLoanOption(data: InsertLoanOption): Promise<LoanOption>;
  getLoanOptionsByApplication(applicationId: string): Promise<LoanOption[]>;
  updateLoanOption(id: string, data: Partial<LoanOption>): Promise<LoanOption | undefined>;
  lockLoanOption(id: string): Promise<LoanOption | undefined>;

  // Documents
  createDocument(data: InsertDocument): Promise<Document>;
  getDocumentsByUser(userId: string): Promise<Document[]>;
  getDocumentsByApplication(applicationId: string): Promise<Document[]>;
  updateDocument(id: string, data: Partial<Document>): Promise<Document | undefined>;

  // Deal Activities
  createDealActivity(data: InsertDealActivity): Promise<DealActivity>;
  getDealActivitiesByApplication(applicationId: string): Promise<DealActivity[]>;

  // Properties
  createProperty(data: InsertProperty): Promise<Property>;
  getProperty(id: string): Promise<Property | undefined>;
  getAllProperties(filters?: {
    search?: string;
    type?: string;
    minPrice?: number;
    maxPrice?: number;
  }): Promise<Property[]>;
  updateProperty(id: string, data: Partial<Property>): Promise<Property | undefined>;
  deleteProperty(id: string): Promise<void>;
  getPropertiesByAgent(agentId: string): Promise<Property[]>;
  saveProperty(userId: string, propertyId: string): Promise<void>;
  getSavedProperties(userId: string): Promise<Property[]>;

  // Agent Profiles
  createAgentProfile(data: InsertAgentProfile): Promise<AgentProfile>;
  getAgentProfile(id: string): Promise<AgentProfile | undefined>;
  getAgentProfileByUserId(userId: string): Promise<AgentProfile | undefined>;
  updateAgentProfile(id: string, data: Partial<AgentProfile>): Promise<AgentProfile | undefined>;
  getAllAgentProfiles(): Promise<AgentProfile[]>;
  searchAgentProfiles(filters: { location?: string; specialty?: string }): Promise<AgentProfile[]>;
  createAgentReferralRequest(data: InsertAgentReferralRequest): Promise<AgentReferralRequest>;
  getAgentReferralRequests(agentId?: string): Promise<AgentReferralRequest[]>;
  updateAgentReferralRequest(id: string, data: Partial<AgentReferralRequest>): Promise<AgentReferralRequest | undefined>;

  // Stats
  getAdminStats(): Promise<{
    totalUsers: number;
    totalApplications: number;
    totalLoanVolume: string;
    approvalRate: number;
    applicationsByStatus: { status: string; count: number }[];
    loansByType: { type: string; count: number; volume: string }[];
    recentApplications: (LoanApplication & { user: User })[];
  }>;
  getDashboardStats(userId: string): Promise<{
    totalApplications: number;
    preApprovedAmount: string;
    pendingDocuments: number;
  }>;

  // URLA Data
  getUrlaPersonalInfo(applicationId: string): Promise<UrlaPersonalInfo | undefined>;
  upsertUrlaPersonalInfo(data: InsertUrlaPersonalInfo): Promise<UrlaPersonalInfo>;
  
  getEmploymentHistory(applicationId: string): Promise<EmploymentHistory[]>;
  createEmploymentHistory(data: InsertEmploymentHistory): Promise<EmploymentHistory>;
  updateEmploymentHistory(id: string, data: Partial<EmploymentHistory>): Promise<EmploymentHistory | undefined>;
  deleteEmploymentHistory(id: string): Promise<void>;
  
  getOtherIncomeSources(applicationId: string): Promise<OtherIncomeSource[]>;
  createOtherIncomeSource(data: InsertOtherIncomeSource): Promise<OtherIncomeSource>;
  deleteOtherIncomeSource(id: string): Promise<void>;
  
  getUrlaAssets(applicationId: string): Promise<UrlaAsset[]>;
  createUrlaAsset(data: InsertUrlaAsset): Promise<UrlaAsset>;
  updateUrlaAsset(id: string, data: Partial<UrlaAsset>): Promise<UrlaAsset | undefined>;
  deleteUrlaAsset(id: string): Promise<void>;
  
  getUrlaLiabilities(applicationId: string): Promise<UrlaLiability[]>;
  createUrlaLiability(data: InsertUrlaLiability): Promise<UrlaLiability>;
  updateUrlaLiability(id: string, data: Partial<UrlaLiability>): Promise<UrlaLiability | undefined>;
  deleteUrlaLiability(id: string): Promise<void>;
  
  getUrlaPropertyInfo(applicationId: string): Promise<UrlaPropertyInfo | undefined>;
  upsertUrlaPropertyInfo(data: InsertUrlaPropertyInfo): Promise<UrlaPropertyInfo>;
  
  // Borrower Declarations
  getBorrowerDeclarations(applicationId: string): Promise<BorrowerDeclarations | undefined>;
  upsertBorrowerDeclarations(data: InsertBorrowerDeclarations): Promise<BorrowerDeclarations>;
  
  getCompleteUrlaData(applicationId: string): Promise<{
    personalInfo: UrlaPersonalInfo | undefined;
    employmentHistory: EmploymentHistory[];
    otherIncomeSources: OtherIncomeSource[];
    assets: UrlaAsset[];
    liabilities: UrlaLiability[];
    propertyInfo: UrlaPropertyInfo | undefined;
    declarations: BorrowerDeclarations | undefined;
  }>;

  // MISMO Export Data
  getMISMOLoanData(applicationId: string): Promise<{
    application: LoanApplication;
    user: User | null;
    personalInfo: UrlaPersonalInfo | null;
    employment: EmploymentHistory[];
    assets: UrlaAsset[];
    liabilities: UrlaLiability[];
    propertyInfo: UrlaPropertyInfo | null;
    declarations: BorrowerDeclarations | null;
    loanOptions: LoanOption[];
    documents: Document[];
  } | null>;
  
  // Data Quality Scoring
  getApplicationDataQuality(applicationId: string): Promise<{
    overallScore: number;
    sections: {
      name: string;
      score: number;
      missingFields: string[];
      verificationStatus: string;
    }[];
  }>;

  // Tasks
  createTask(data: InsertTask): Promise<Task>;
  getTask(id: string): Promise<Task | undefined>;
  getTasksByApplication(applicationId: string): Promise<Task[]>;
  getTasksByUser(userId: string): Promise<Task[]>;
  getAllTasks(limit?: number): Promise<Task[]>;
  updateTask(id: string, data: Partial<Task>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;
  
  // Task Documents
  createTaskDocument(data: InsertTaskDocument): Promise<TaskDocument>;
  getTaskDocuments(taskId: string): Promise<(TaskDocument & { document: Document })[]>;
  updateTaskDocument(id: string, data: Partial<TaskDocument>): Promise<TaskDocument | undefined>;
  deleteTaskDocument(id: string): Promise<void>;
  
  // Document Packages - lender-ready document organization
  createDocumentPackage(data: InsertDocumentPackage): Promise<DocumentPackage>;
  getDocumentPackage(id: string): Promise<DocumentPackage | undefined>;
  getDocumentPackagesByApplication(applicationId: string): Promise<DocumentPackage[]>;
  updateDocumentPackage(id: string, data: Partial<DocumentPackage>): Promise<DocumentPackage | undefined>;
  deleteDocumentPackage(id: string): Promise<void>;
  
  // Document Package Items
  addDocumentToPackage(data: InsertDocumentPackageItem): Promise<DocumentPackageItem>;
  getDocumentPackageItems(packageId: string): Promise<(DocumentPackageItem & { document: Document })[]>;
  updateDocumentPackageItem(id: string, data: Partial<DocumentPackageItem>): Promise<DocumentPackageItem | undefined>;
  removeDocumentFromPackage(id: string): Promise<void>;
  
  // Application Properties - multi-property support
  createApplicationProperty(data: InsertApplicationProperty): Promise<ApplicationProperty>;
  getApplicationProperties(applicationId: string): Promise<ApplicationProperty[]>;
  getCurrentProperty(applicationId: string): Promise<ApplicationProperty | undefined>;
  updateApplicationProperty(id: string, data: Partial<ApplicationProperty>): Promise<ApplicationProperty | undefined>;
  switchToProperty(applicationId: string, propertyId: string): Promise<ApplicationProperty | undefined>;
  markDealFellThrough(propertyId: string, reason: string): Promise<ApplicationProperty | undefined>;

  // Deal Team Members
  createDealTeamMember(data: InsertDealTeamMember): Promise<DealTeamMember>;
  getDealTeamMembers(applicationId: string): Promise<(DealTeamMember & { user?: User })[]>;
  getDealTeamMember(id: string): Promise<DealTeamMember | undefined>;
  updateDealTeamMember(id: string, data: Partial<DealTeamMember>): Promise<DealTeamMember | undefined>;
  removeDealTeamMember(id: string): Promise<void>;
  getTeamMembersByUser(userId: string): Promise<(DealTeamMember & { application?: LoanApplication })[]>;

  // Plaid Verifications
  createPlaidLinkToken(data: InsertPlaidLinkToken): Promise<PlaidLinkToken>;
  getPlaidLinkToken(id: string): Promise<PlaidLinkToken | undefined>;
  updatePlaidLinkToken(id: string, data: Partial<PlaidLinkToken>): Promise<PlaidLinkToken | undefined>;
  
  createVerification(data: InsertVerification): Promise<Verification>;
  getVerification(id: string): Promise<Verification | undefined>;
  getVerificationsByApplication(applicationId: string): Promise<Verification[]>;
  getVerificationsByUser(userId: string): Promise<Verification[]>;
  updateVerification(id: string, data: Partial<Verification>): Promise<Verification | undefined>;

  // Content Categories
  createContentCategory(data: InsertContentCategory): Promise<ContentCategory>;
  getContentCategory(id: string): Promise<ContentCategory | undefined>;
  getContentCategoryBySlug(slug: string): Promise<ContentCategory | undefined>;
  getAllContentCategories(): Promise<ContentCategory[]>;
  getActiveContentCategories(): Promise<ContentCategory[]>;
  updateContentCategory(id: string, data: Partial<ContentCategory>): Promise<ContentCategory | undefined>;
  deleteContentCategory(id: string): Promise<void>;

  // Articles (Learning Center)
  createArticle(data: InsertArticle): Promise<Article>;
  getArticle(id: string): Promise<Article | undefined>;
  getArticleBySlug(slug: string): Promise<Article | undefined>;
  getAllArticles(): Promise<Article[]>;
  getPublishedArticles(): Promise<Article[]>;
  getArticlesByCategory(categoryId: string): Promise<Article[]>;
  searchArticles(query: string): Promise<Article[]>;
  updateArticle(id: string, data: Partial<Article>): Promise<Article | undefined>;
  incrementArticleViewCount(id: string): Promise<void>;
  deleteArticle(id: string): Promise<void>;

  // FAQs
  createFaq(data: InsertFaq): Promise<Faq>;
  getFaq(id: string): Promise<Faq | undefined>;
  getAllFaqs(): Promise<Faq[]>;
  getPublishedFaqs(): Promise<Faq[]>;
  getPopularFaqs(): Promise<Faq[]>;
  getFaqsByCategory(categoryId: string): Promise<Faq[]>;
  searchFaqs(query: string): Promise<Faq[]>;
  updateFaq(id: string, data: Partial<Faq>): Promise<Faq | undefined>;
  incrementFaqViewCount(id: string): Promise<void>;
  markFaqHelpful(id: string, helpful: boolean): Promise<void>;
  deleteFaq(id: string): Promise<void>;

  // Mortgage Rate Programs
  createMortgageRateProgram(data: InsertMortgageRateProgram): Promise<MortgageRateProgram>;
  getMortgageRateProgram(id: string): Promise<MortgageRateProgram | undefined>;
  getMortgageRateProgramBySlug(slug: string): Promise<MortgageRateProgram | undefined>;
  getAllMortgageRatePrograms(): Promise<MortgageRateProgram[]>;
  getActiveMortgageRatePrograms(): Promise<MortgageRateProgram[]>;
  updateMortgageRateProgram(id: string, data: Partial<MortgageRateProgram>): Promise<MortgageRateProgram | undefined>;
  deleteMortgageRateProgram(id: string): Promise<void>;

  // Mortgage Rates
  createMortgageRate(data: InsertMortgageRate): Promise<MortgageRate>;
  getMortgageRate(id: string): Promise<MortgageRate | undefined>;
  getMortgageRatesByProgram(programId: string): Promise<MortgageRate[]>;
  getMortgageRatesForLocation(state?: string, zipcode?: string): Promise<(MortgageRate & { program: MortgageRateProgram })[]>;
  getAllMortgageRates(): Promise<(MortgageRate & { program: MortgageRateProgram })[]>;
  updateMortgageRate(id: string, data: Partial<MortgageRate>): Promise<MortgageRate | undefined>;
  deleteMortgageRate(id: string): Promise<void>;

  // Broker Referrals & Commissions
  getBrokerReferrals(brokerId: string): Promise<(LoanApplication & { borrower: User })[]>;
  getBrokerReferralStats(brokerId: string): Promise<{
    totalReferrals: number;
    activeReferrals: number;
    closedLoans: number;
    totalLoanVolume: string;
    totalCommissionsEarned: string;
    pendingCommissions: string;
  }>;
  createBrokerCommission(data: InsertBrokerCommission): Promise<BrokerCommission>;
  getBrokerCommissions(brokerId: string): Promise<(BrokerCommission & { application: LoanApplication })[]>;
  getBrokerCommission(id: string): Promise<BrokerCommission | undefined>;
  updateBrokerCommission(id: string, data: Partial<BrokerCommission>): Promise<BrokerCommission | undefined>;
  getAllPendingCommissions(): Promise<(BrokerCommission & { broker: User; application: LoanApplication })[]>;

  // Calculator Results
  createCalculatorResult(data: InsertCalculatorResult): Promise<CalculatorResult>;
  getCalculatorResultsByUser(userId: string): Promise<CalculatorResult[]>;
  getLatestCalculatorResult(userId: string, type: string): Promise<CalculatorResult | undefined>;

  // Calculator Profiles (Lead Capture)
  upsertCalculatorProfile(email: string, data: Partial<InsertCalculatorProfile>): Promise<CalculatorProfile>;
  getCalculatorProfileByEmail(email: string): Promise<CalculatorProfile | undefined>;

  // Homeownership Goals (Aspiring Owner Journey)
  getHomeownershipGoal(userId: string): Promise<HomeownershipGoal | undefined>;
  createHomeownershipGoal(data: InsertHomeownershipGoal): Promise<HomeownershipGoal>;
  updateHomeownershipGoal(userId: string, data: Partial<HomeownershipGoal>): Promise<HomeownershipGoal | undefined>;
  
  // Credit Actions
  getCreditActions(goalId: string): Promise<CreditAction[]>;
  createCreditAction(data: InsertCreditAction): Promise<CreditAction>;
  updateCreditAction(id: string, data: Partial<CreditAction>): Promise<CreditAction | undefined>;
  
  // Savings Transactions
  getSavingsTransactions(goalId: string): Promise<SavingsTransaction[]>;
  createSavingsTransaction(data: InsertSavingsTransaction): Promise<SavingsTransaction>;
  
  // Journey Milestones
  getJourneyMilestones(goalId: string): Promise<JourneyMilestone[]>;
  createJourneyMilestone(data: InsertJourneyMilestone): Promise<JourneyMilestone>;

  // Application Invites
  createApplicationInvite(data: InsertApplicationInvite): Promise<ApplicationInvite>;
  getApplicationInviteByToken(token: string): Promise<ApplicationInvite | undefined>;
  getApplicationInvitesByReferrer(referrerId: string): Promise<ApplicationInvite[]>;
  updateApplicationInvite(id: string, data: Partial<ApplicationInvite>): Promise<ApplicationInvite | undefined>;

  // KBA Sessions
  createKbaSession(data: InsertKbaSession): Promise<KbaSession>;
  getKbaSession(id: string): Promise<KbaSession | undefined>;
  getKbaSessionsByUser(userId: string): Promise<KbaSession[]>;
  updateKbaSession(id: string, data: Partial<KbaSession>): Promise<KbaSession | undefined>;

  // KYC/AML Screenings
  createKycScreening(data: InsertKycScreening): Promise<KycScreening>;
  getKycScreening(id: string): Promise<KycScreening | undefined>;
  getKycScreeningByApplication(applicationId: string): Promise<KycScreening | undefined>;
  getKycScreeningsByUser(userId: string): Promise<KycScreening[]>;
  updateKycScreening(id: string, data: Partial<KycScreening>): Promise<KycScreening | undefined>;

  // Onboarding Profiles
  createOnboardingProfile(data: InsertOnboardingProfile): Promise<OnboardingProfile>;
  getOnboardingProfile(id: string): Promise<OnboardingProfile | undefined>;
  getOnboardingProfileByUser(userId: string): Promise<OnboardingProfile | undefined>;
  updateOnboardingProfile(id: string, data: Partial<OnboardingProfile>): Promise<OnboardingProfile | undefined>;

  // Onboarding Feedback
  createOnboardingFeedback(data: InsertOnboardingFeedback): Promise<OnboardingFeedback>;
  getOnboardingFeedbackByUser(userId: string): Promise<OnboardingFeedback[]>;

  // Co-Brand Profiles
  createCoBrandProfile(data: InsertCoBrandProfile): Promise<CoBrandProfile>;
  getCoBrandProfile(id: string): Promise<CoBrandProfile | undefined>;
  getCoBrandProfileByUser(userId: string): Promise<CoBrandProfile | undefined>;
  updateCoBrandProfile(id: string, data: Partial<CoBrandProfile>): Promise<CoBrandProfile | undefined>;

  // Deal Desk
  createDealDeskThread(data: InsertDealDeskThread): Promise<DealDeskThread>;
  getDealDeskThread(id: string): Promise<DealDeskThread | undefined>;
  getDealDeskThreadsByUser(userId: string): Promise<DealDeskThread[]>;
  updateDealDeskThread(id: string, data: Partial<DealDeskThread>): Promise<DealDeskThread | undefined>;
  createDealDeskMessage(data: InsertDealDeskMessage): Promise<DealDeskMessage>;
  getDealDeskMessagesByThread(threadId: string): Promise<DealDeskMessage[]>;

  // DPA Programs
  getDpaPrograms(filters?: { state?: string; firstTimeBuyer?: boolean; minCreditScore?: number; maxIncome?: number }): Promise<DpaProgram[]>;
  getDpaProgram(id: string): Promise<DpaProgram | undefined>;

  // Agent Pipeline Access
  getAgentPipeline(agentUserId: string): Promise<AgentPipelineAccess[]>;
  upsertAgentPipelineAccess(data: InsertAgentPipelineAccess): Promise<AgentPipelineAccess>;

  // Deal Rescue Escalations
  getDealRescueEscalations(filters?: { status?: string; reportedByUserId?: string }): Promise<DealRescueEscalation[]>;
  createDealRescueEscalation(data: InsertDealRescueEscalation): Promise<DealRescueEscalation>;
  updateDealRescueEscalation(id: string, data: Partial<DealRescueEscalation>): Promise<DealRescueEscalation | undefined>;

  // Strategy Sessions
  getStrategySessions(agentUserId: string): Promise<StrategySession[]>;
  createStrategySession(data: InsertStrategySession): Promise<StrategySession>;
  updateStrategySession(id: string, data: Partial<StrategySession>): Promise<StrategySession | undefined>;

  // Accelerator Enrollments
  getAcceleratorEnrollment(userId: string): Promise<AcceleratorEnrollment | undefined>;
  createAcceleratorEnrollment(data: InsertAcceleratorEnrollment): Promise<AcceleratorEnrollment>;
  updateAcceleratorEnrollment(id: string, data: Partial<AcceleratorEnrollment>): Promise<AcceleratorEnrollment | undefined>;

  // Accelerator Milestones
  getAcceleratorMilestones(enrollmentId: string): Promise<AcceleratorMilestone[]>;
  createAcceleratorMilestone(data: InsertAcceleratorMilestone): Promise<AcceleratorMilestone>;
  updateAcceleratorMilestone(id: string, data: Partial<AcceleratorMilestone>): Promise<AcceleratorMilestone | undefined>;

  // Coaching Sessions
  getCoachingSessions(enrollmentId: string): Promise<CoachingSession[]>;
  createCoachingSession(data: InsertCoachingSession): Promise<CoachingSession>;
  updateCoachingSession(id: string, data: Partial<CoachingSession>): Promise<CoachingSession | undefined>;

  // Closing Guarantees
  getAllClosingGuarantees(): Promise<ClosingGuarantee[]>;
  getClosingGuarantees(applicationId: string): Promise<ClosingGuarantee[]>;
  createClosingGuarantee(data: InsertClosingGuarantee): Promise<ClosingGuarantee>;
  updateClosingGuarantee(id: string, data: Partial<ClosingGuarantee>): Promise<ClosingGuarantee | undefined>;

  // Homeowner Profiles
  getHomeownerProfile(userId: string): Promise<HomeownerProfile | undefined>;
  createHomeownerProfile(data: InsertHomeownerProfile): Promise<HomeownerProfile>;
  updateHomeownerProfile(id: string, data: Partial<HomeownerProfile>): Promise<HomeownerProfile | undefined>;

  // Refi Alerts
  getRefiAlerts(homeownerProfileId: string): Promise<RefiAlert[]>;
  createRefiAlert(data: InsertRefiAlert): Promise<RefiAlert>;
  updateRefiAlert(id: string, data: Partial<RefiAlert>): Promise<RefiAlert | undefined>;

  // Equity Snapshots
  getEquitySnapshots(homeownerProfileId: string): Promise<EquitySnapshot[]>;
  createEquitySnapshot(data: InsertEquitySnapshot): Promise<EquitySnapshot>;

  // Rate Locks
  createRateLock(data: InsertRateLock): Promise<RateLock>;
  getRateLock(id: string): Promise<RateLock | undefined>;
  getRateLocksByApplication(applicationId: string): Promise<RateLock[]>;
  getActiveRateLock(applicationId: string): Promise<RateLock | undefined>;
  updateRateLock(id: string, data: Partial<RateLock>): Promise<RateLock | undefined>;
  getExpiringRateLocks(withinDays: number): Promise<RateLock[]>;

  // Consent Templates & Borrower Consents
  createConsentTemplate(data: InsertConsentTemplate): Promise<ConsentTemplate>;
  getConsentTemplate(id: string): Promise<ConsentTemplate | undefined>;
  getActiveConsentTemplates(consentType?: string, state?: string): Promise<ConsentTemplate[]>;
  updateConsentTemplate(id: string, data: Partial<ConsentTemplate>): Promise<ConsentTemplate | undefined>;
  createBorrowerConsent(data: InsertBorrowerConsent): Promise<BorrowerConsent>;
  getBorrowerConsent(id: string): Promise<BorrowerConsent | undefined>;
  getBorrowerConsentsByUser(userId: string): Promise<BorrowerConsent[]>;
  getBorrowerConsentsByApplication(applicationId: string): Promise<BorrowerConsent[]>;
  getConsentByTypeAndApplication(consentType: string, applicationId: string): Promise<BorrowerConsent | undefined>;

  // Partner Providers & Orders
  createPartnerProvider(data: InsertPartnerProvider): Promise<PartnerProvider>;
  getPartnerProvider(id: string): Promise<PartnerProvider | undefined>;
  getPartnerProviderByCode(code: string): Promise<PartnerProvider | undefined>;
  getPartnerProvidersByServiceType(serviceType: string): Promise<PartnerProvider[]>;
  getAllPartnerProviders(): Promise<PartnerProvider[]>;
  updatePartnerProvider(id: string, data: Partial<PartnerProvider>): Promise<PartnerProvider | undefined>;
  createPartnerOrder(data: InsertPartnerOrder): Promise<PartnerOrder>;
  getPartnerOrder(id: string): Promise<PartnerOrder | undefined>;
  getPartnerOrdersByApplication(applicationId: string): Promise<PartnerOrder[]>;
  getPartnerOrdersByStatus(status: string): Promise<PartnerOrder[]>;
  updatePartnerOrder(id: string, data: Partial<PartnerOrder>): Promise<PartnerOrder | undefined>;

  // Messaging & Presence
  sendMessage(data: InsertTeamMessage): Promise<TeamMessage>;
  getMessages(userId: string, otherUserId: string): Promise<TeamMessage[]>;
  getConversations(userId: string): Promise<{
    partnerId: string;
    lastMessage: TeamMessage;
    unreadCount: number;
  }[]>;
  markMessagesAsRead(userId: string, senderId: string): Promise<void>;
  getUnreadMessageCount(userId: string): Promise<number>;
  getStaffUsersForTeamDisplay(): Promise<User[]>;
  updateUserPresence(userId: string): Promise<void>;
  getUserPresenceStatus(userId: string): Promise<'online' | 'away' | 'offline'>;
  getTeamMembersWithPresence(): Promise<(User & { presenceStatus: 'online' | 'away' | 'offline' })[]>;
  updateDocumentRequestStatus(
    messageId: string,
    status: 'pending' | 'submitted' | 'approved' | 'rejected',
    documentId?: string
  ): Promise<TeamMessage | null>;
  getPendingDocumentRequests(userId: string): Promise<TeamMessage[]>;

  // Loan Milestones & Conditions
  createLoanMilestone(data: InsertLoanMilestone): Promise<LoanMilestone>;
  getLoanMilestones(applicationId: string): Promise<LoanMilestone | undefined>;
  updateLoanMilestones(applicationId: string, data: Partial<LoanMilestone>): Promise<LoanMilestone | undefined>;
  createLoanCondition(data: InsertLoanCondition): Promise<LoanCondition>;
  getLoanCondition(id: string): Promise<LoanCondition | undefined>;
  getLoanConditionsByApplication(applicationId: string): Promise<LoanCondition[]>;
  updateLoanCondition(id: string, data: Partial<LoanCondition>): Promise<LoanCondition | undefined>;
  deleteLoanCondition(id: string): Promise<void>;
  clearLoanCondition(id: string, userId: string, notes?: string): Promise<LoanCondition | undefined>;

  // Document Requirements
  createDocumentRequirementRule(data: InsertDocumentRequirementRule): Promise<DocumentRequirementRule>;
  getDocumentRequirementRule(id: string): Promise<DocumentRequirementRule | undefined>;
  getAllDocumentRequirementRules(): Promise<DocumentRequirementRule[]>;
  updateDocumentRequirementRule(id: string, data: Partial<DocumentRequirementRule>): Promise<DocumentRequirementRule | undefined>;
  getDocument(id: string): Promise<Document | undefined>;

  // Underwriting Snapshots
  createUnderwritingSnapshot(data: InsertUnderwritingSnapshot): Promise<UnderwritingSnapshot>;
  getUnderwritingSnapshotsByApplication(applicationId: string): Promise<UnderwritingSnapshot[]>;
  getLatestUnderwritingSnapshot(applicationId: string): Promise<UnderwritingSnapshot | undefined>;

  // SLA Configurations
  createSlaConfiguration(data: InsertSlaConfiguration): Promise<SlaConfiguration>;
  getActiveSlaConfiguration(loanType?: string): Promise<SlaConfiguration | undefined>;
  getAllSlaConfigurations(): Promise<SlaConfiguration[]>;
  updateSlaConfiguration(id: string, data: Partial<SlaConfiguration>): Promise<SlaConfiguration | undefined>;

  // Analytics
  createAnalyticsSnapshot(data: InsertAnalyticsSnapshot): Promise<AnalyticsSnapshot>;
  getLatestAnalyticsSnapshot(): Promise<AnalyticsSnapshot | undefined>;
  getAnalyticsSnapshots(days: number): Promise<AnalyticsSnapshot[]>;

  // Application Milestones
  createApplicationMilestone(data: InsertApplicationMilestone): Promise<ApplicationMilestone>;
  getApplicationMilestone(applicationId: string): Promise<ApplicationMilestone | undefined>;
  updateApplicationMilestone(applicationId: string, data: Partial<ApplicationMilestone>): Promise<ApplicationMilestone | undefined>;
  getOrCreateApplicationMilestone(applicationId: string): Promise<ApplicationMilestone>;

  // Referrals
  generateReferralCode(userId: string): Promise<string>;
  getUserByReferralCode(referralCode: string): Promise<User | undefined>;
  setUserReferredBy(userId: string, referringUserId: string): Promise<void>;
  getReferralsByUser(userId: string): Promise<User[]>;
  getReferralStats(userId: string): Promise<{
    totalReferrals: number;
    referralsThisMonth: number;
    activeApplications: number;
    closedLoans: number;
  }>;

  // Pipeline Metrics
  computePipelineMetrics(): Promise<{
    totalApplications: number;
    byStatus: { status: string; count: number }[];
    avgCycleTimeHours: number | null;
    slaComplianceRate: number | null;
    closedVolume: string;
    fundedVolume: string;
  }>;
  getStaffWorkloadMetrics(): Promise<{
    loansPerLO: { userId: string; count: number }[];
    loansPerProcessor: { userId: string; count: number }[];
    loansPerUnderwriter: { userId: string; count: number }[];
  }>;
  getBottleneckAnalysis(): Promise<{
    stage: string;
    avgTimeHours: number;
    count: number;
    atRisk: number;
  }[]>;

  // Notifications
  createNotification(data: InsertNotification): Promise<Notification>;
  getNotificationsByUser(userId: string, limit?: number): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: string): Promise<void>;

  // Staff Invites
  createStaffInvite(data: InsertStaffInvite): Promise<StaffInvite>;
  getStaffInviteByCode(code: string): Promise<StaffInvite | undefined>;
  getStaffInvites(): Promise<StaffInvite[]>;
  redeemStaffInvite(code: string, userId: string): Promise<StaffInvite | undefined>;
  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;

  // AI Coach
  createCoachConversation(data: InsertCoachConversation): Promise<CoachConversation>;
  getCoachConversationsByUser(userId: string): Promise<CoachConversation[]>;
  getCoachConversation(id: string): Promise<CoachConversation | undefined>;
  updateCoachConversation(id: string, data: Partial<CoachConversation>): Promise<CoachConversation | undefined>;
  createCoachMessage(data: InsertCoachMessage): Promise<CoachMessage>;
  getCoachMessages(conversationId: string): Promise<CoachMessage[]>;
  countUserCoachMessagesToday(userId: string): Promise<number>;

  // Underwriting Rules DSL
  getUnderwritingRules(filters?: { category?: string; triggerType?: string; isActive?: boolean }): Promise<UnderwritingRuleDsl[]>;
  getUnderwritingRule(id: string): Promise<UnderwritingRuleDsl | undefined>;
  getUnderwritingRuleByCode(code: string): Promise<UnderwritingRuleDsl | undefined>;
  createUnderwritingRule(data: InsertUnderwritingRuleDsl): Promise<UnderwritingRuleDsl>;
  updateUnderwritingRule(id: string, data: Partial<UnderwritingRuleDsl>): Promise<UnderwritingRuleDsl | undefined>;
  createRuleExecutionLog(data: InsertRuleExecutionLog): Promise<RuleExecutionLog>;
  getRuleExecutionLogs(snapshotId: string): Promise<RuleExecutionLog[]>;

  // Policy Profiles
  getPolicyProfiles(filters?: { authority?: string; productType?: string; status?: string }): Promise<PolicyProfile[]>;
  getPolicyProfile(id: string): Promise<PolicyProfile | undefined>;
  createPolicyProfile(data: InsertPolicyProfile): Promise<PolicyProfile>;
  updatePolicyProfile(id: string, data: Partial<PolicyProfile>): Promise<PolicyProfile | undefined>;

  // Policy Thresholds
  getPolicyThresholds(policyProfileId: string): Promise<PolicyThreshold[]>;
  getPolicyThreshold(id: string): Promise<PolicyThreshold | undefined>;
  createPolicyThreshold(data: InsertPolicyThreshold): Promise<PolicyThreshold>;
  updatePolicyThreshold(id: string, data: Partial<PolicyThreshold>): Promise<PolicyThreshold | undefined>;
  deletePolicyThreshold(id: string): Promise<boolean>;

  // Policy Approval Workflow
  createPolicyApproval(data: InsertPolicyApprovalWorkflow): Promise<PolicyApprovalWorkflow>;
  getPolicyApprovals(policyProfileId: string): Promise<PolicyApprovalWorkflow[]>;

  // Policy Lender Overlays
  getPolicyLenderOverlays(basePolicyProfileId: string): Promise<PolicyLenderOverlay[]>;
  getPolicyLenderOverlay(id: string): Promise<PolicyLenderOverlay | undefined>;
  createPolicyLenderOverlay(data: InsertPolicyLenderOverlay): Promise<PolicyLenderOverlay>;
  updatePolicyLenderOverlay(id: string, data: Partial<PolicyLenderOverlay>): Promise<PolicyLenderOverlay | undefined>;
  deletePolicyLenderOverlay(id: string): Promise<boolean>;

  // Wholesale Lenders
  getWholesaleLenders(filters?: { status?: string; integrationTier?: string }): Promise<WholesaleLender[]>;
  getWholesaleLender(id: string): Promise<WholesaleLender | undefined>;
  createWholesaleLender(data: InsertWholesaleLender): Promise<WholesaleLender>;
  updateWholesaleLender(id: string, data: Partial<WholesaleLender>): Promise<WholesaleLender | undefined>;

  // Rate Sheets
  getRateSheets(filters?: { lenderId?: string; status?: string }): Promise<RateSheet[]>;
  getActiveRateSheets(): Promise<RateSheet[]>;
  getRateSheet(id: string): Promise<RateSheet | undefined>;
  createRateSheet(data: InsertRateSheet): Promise<RateSheet>;
  updateRateSheet(id: string, data: Partial<RateSheet>): Promise<RateSheet | undefined>;

  // Rate Sheet Products
  getRateSheetProducts(rateSheetId: string): Promise<RateSheetProduct[]>;
  getRateSheetProduct(id: string): Promise<RateSheetProduct | undefined>;
  createRateSheetProduct(data: InsertRateSheetProduct): Promise<RateSheetProduct>;
  updateRateSheetProduct(id: string, data: Partial<RateSheetProduct>): Promise<RateSheetProduct | undefined>;

  // Lender Pricing Adjustments
  getLenderPricingAdjustments(filters?: { lenderId?: string; adjustmentType?: string }): Promise<LenderPricingAdjustment[]>;
  createLenderPricingAdjustment(data: InsertLenderPricingAdjustment): Promise<LenderPricingAdjustment>;
  updateLenderPricingAdjustment(id: string, data: Partial<LenderPricingAdjustment>): Promise<LenderPricingAdjustment | undefined>;

  // Lender Offers
  getLenderOffers(filters?: { applicationId?: string; lenderId?: string; status?: string }): Promise<LenderOffer[]>;
  getLenderOffer(id: string): Promise<LenderOffer | undefined>;
  createLenderOffer(data: InsertLenderOffer): Promise<LenderOffer>;
  updateLenderOffer(id: string, data: Partial<LenderOffer>): Promise<LenderOffer | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(limit: number = 500): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt)).limit(limit);
  }

  async getUsersByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    return await db.select().from(users).where(inArray(users.id, ids));
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Loan Applications
  async createLoanApplication(data: InsertLoanApplication): Promise<LoanApplication> {
    const [application] = await db.insert(loanApplications).values(data).returning();
    return application;
  }

  async getLoanApplication(id: string): Promise<LoanApplication | undefined> {
    const [application] = await db
      .select()
      .from(loanApplications)
      .where(eq(loanApplications.id, id))
      .limit(1);
    return application;
  }

  async getLoanApplicationWithAccess(id: string, userId: string, userRole: string): Promise<LoanApplication | undefined> {
    // Staff roles get unrestricted access
    const isStaff = isStaffRole(userRole);
    
    if (isStaff) {
      // Staff can access any application
      const [application] = await db
        .select()
        .from(loanApplications)
        .where(eq(loanApplications.id, id))
        .limit(1);
      return application;
    }
    
    // Non-staff can only access their own applications - query scoped by userId
    const [application] = await db
      .select()
      .from(loanApplications)
      .where(and(
        eq(loanApplications.id, id),
        eq(loanApplications.userId, userId)
      ))
      .limit(1);
    return application;
  }

  async getLoanApplicationsByUser(userId: string): Promise<LoanApplication[]> {
    return await db
      .select()
      .from(loanApplications)
      .where(eq(loanApplications.userId, userId))
      .orderBy(desc(loanApplications.createdAt));
  }

  async getAllLoanApplications(limit: number = 500): Promise<LoanApplication[]> {
    return await db
      .select()
      .from(loanApplications)
      .orderBy(desc(loanApplications.createdAt))
      .limit(limit);
  }

  async updateLoanApplication(
    id: string,
    data: Partial<LoanApplication>
  ): Promise<LoanApplication | undefined> {
    const [application] = await db
      .update(loanApplications)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(loanApplications.id, id))
      .returning();
    return application;
  }

  // Loan Options
  async createLoanOption(data: InsertLoanOption): Promise<LoanOption> {
    const [option] = await db.insert(loanOptions).values(data).returning();
    return option;
  }

  async getLoanOptionsByApplication(applicationId: string): Promise<LoanOption[]> {
    return await db
      .select()
      .from(loanOptions)
      .where(eq(loanOptions.applicationId, applicationId))
      .orderBy(loanOptions.isRecommended);
  }

  async updateLoanOption(id: string, data: Partial<LoanOption>): Promise<LoanOption | undefined> {
    const [option] = await db
      .update(loanOptions)
      .set(data)
      .where(eq(loanOptions.id, id))
      .returning();
    return option;
  }

  async lockLoanOption(id: string): Promise<LoanOption | undefined> {
    const lockExpiry = new Date();
    lockExpiry.setDate(lockExpiry.getDate() + 30);

    const [option] = await db
      .update(loanOptions)
      .set({
        isLocked: true,
        lockedAt: new Date(),
        lockExpiresAt: lockExpiry,
      })
      .where(eq(loanOptions.id, id))
      .returning();
    return option;
  }

  // Documents
  async createDocument(data: InsertDocument): Promise<Document> {
    const [doc] = await db.insert(documents).values(data).returning();
    return doc;
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    return doc;
  }

  async getDocumentsByUser(userId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt));
  }

  async getDocumentsByApplication(applicationId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.applicationId, applicationId))
      .orderBy(desc(documents.createdAt));
  }

  async updateDocument(id: string, data: Partial<Document>): Promise<Document | undefined> {
    const [doc] = await db
      .update(documents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return doc;
  }

  // Deal Activities
  async createDealActivity(data: InsertDealActivity): Promise<DealActivity> {
    const [activity] = await db.insert(dealActivities).values(data).returning();
    return activity;
  }

  async getDealActivitiesByApplication(applicationId: string): Promise<DealActivity[]> {
    return await db
      .select()
      .from(dealActivities)
      .where(eq(dealActivities.applicationId, applicationId))
      .orderBy(desc(dealActivities.createdAt));
  }

  // Properties
  async createProperty(data: InsertProperty): Promise<Property> {
    const [property] = await db.insert(properties).values(data).returning();
    return property;
  }

  async getProperty(id: string): Promise<Property | undefined> {
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, id))
      .limit(1);
    return property;
  }

  async getAllProperties(filters?: {
    search?: string;
    type?: string;
    minPrice?: number;
    maxPrice?: number;
  }): Promise<Property[]> {
    let query = db.select().from(properties);
    const conditions = [];

    if (filters?.type && filters.type !== "all") {
      conditions.push(eq(properties.propertyType, filters.type));
    }

    if (filters?.minPrice !== undefined) {
      conditions.push(gte(properties.price, filters.minPrice.toString()));
    }

    if (filters?.maxPrice !== undefined) {
      conditions.push(lte(properties.price, filters.maxPrice.toString()));
    }

    if (filters?.search) {
      conditions.push(
        or(
          ilike(properties.address, `%${filters.search}%`),
          ilike(properties.city, `%${filters.search}%`),
          ilike(properties.state, `%${filters.search}%`)
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await query.orderBy(desc(properties.createdAt));
  }

  async saveProperty(userId: string, propertyId: string): Promise<void> {
    await db.insert(savedProperties).values({ userId, propertyId });
  }

  async getSavedProperties(userId: string): Promise<Property[]> {
    const saved = await db
      .select({ property: properties })
      .from(savedProperties)
      .innerJoin(properties, eq(savedProperties.propertyId, properties.id))
      .where(eq(savedProperties.userId, userId));
    return saved.map((s) => s.property);
  }

  // Stats
  async getAdminStats() {
    const [
      [userCount],
      appStats,
      recentAppsWithUsers,
      loanTypeStats,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(users),

      db.select({
        status: loanApplications.status,
        count: sql<number>`count(*)::int`,
        volume: sql<string>`coalesce(sum(purchase_price::numeric), 0)::text`,
      })
        .from(loanApplications)
        .groupBy(loanApplications.status),

      db.select({
        application: loanApplications,
        user: users,
      })
        .from(loanApplications)
        .leftJoin(users, eq(loanApplications.userId, users.id))
        .orderBy(desc(loanApplications.createdAt))
        .limit(10),

      db.select({
        type: loanOptions.loanType,
        count: sql<number>`count(DISTINCT ${loanOptions.applicationId})::int`,
        volume: sql<string>`coalesce(sum(${loanOptions.loanAmount}::numeric), 0)::text`,
      })
        .from(loanOptions)
        .innerJoin(loanApplications, eq(loanOptions.applicationId, loanApplications.id))
        .where(eq(loanOptions.isRecommended, true))
        .groupBy(loanOptions.loanType),
    ]);

    const totalApplications = appStats.reduce((sum, s) => sum + s.count, 0);
    const approvedRow = appStats.find(s => s.status === "approved");
    const approvedCount = approvedRow?.count ?? 0;
    const totalLoanVolume = approvedRow?.volume ?? "0";
    const approvalRate = totalApplications > 0
      ? Math.round((approvedCount / totalApplications) * 100)
      : 0;

    const appsWithUsers = recentAppsWithUsers.map(r => ({
      ...r.application,
      user: r.user,
    }));

    const loansByTypeMap = new Map(loanTypeStats.map(lt => [lt.type, lt]));
    const loansByType = ["conventional", "fha", "va"].map(type => ({
      type,
      count: loansByTypeMap.get(type)?.count ?? 0,
      volume: loansByTypeMap.get(type)?.volume ?? "0",
    }));

    return {
      totalUsers: userCount.count,
      totalApplications,
      totalLoanVolume,
      approvalRate,
      applicationsByStatus: appStats.map(s => ({ status: s.status, count: s.count })),
      loansByType,
      recentApplications: appsWithUsers,
    };
  }

  async getDashboardStats(userId: string) {
    const [appCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(loanApplications)
      .where(eq(loanApplications.userId, userId));

    const [preApproved] = await db
      .select({ total: sql<string>`coalesce(max(pre_approval_amount::numeric), 0)::text` })
      .from(loanApplications)
      .where(
        and(
          eq(loanApplications.userId, userId),
          eq(loanApplications.status, "pre_approved")
        )
      );

    const [pendingDocs] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(
        and(eq(documents.userId, userId), eq(documents.status, "uploaded"))
      );

    return {
      totalApplications: appCount.count,
      preApprovedAmount: preApproved.total,
      pendingDocuments: pendingDocs.count,
    };
  }

  // URLA Personal Info
  async getUrlaPersonalInfo(applicationId: string): Promise<UrlaPersonalInfo | undefined> {
    const [info] = await db
      .select()
      .from(urlaPersonalInfo)
      .where(eq(urlaPersonalInfo.applicationId, applicationId))
      .limit(1);
    return info;
  }

  async upsertUrlaPersonalInfo(data: InsertUrlaPersonalInfo): Promise<UrlaPersonalInfo> {
    const existing = await this.getUrlaPersonalInfo(data.applicationId);
    // Remove any timestamp fields that might have been serialized as strings from frontend
    const { createdAt, updatedAt, id, ...cleanData } = data as any;
    
    if (existing) {
      const [updated] = await db
        .update(urlaPersonalInfo)
        .set({ ...cleanData, updatedAt: new Date() })
        .where(eq(urlaPersonalInfo.applicationId, data.applicationId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(urlaPersonalInfo).values(cleanData).returning();
    return created;
  }

  // Employment History
  async getEmploymentHistory(applicationId: string): Promise<EmploymentHistory[]> {
    return await db
      .select()
      .from(employmentHistory)
      .where(eq(employmentHistory.applicationId, applicationId))
      .orderBy(desc(employmentHistory.createdAt));
  }

  async createEmploymentHistory(data: InsertEmploymentHistory): Promise<EmploymentHistory> {
    const [record] = await db.insert(employmentHistory).values(data).returning();
    return record;
  }

  async updateEmploymentHistory(id: string, data: Partial<EmploymentHistory>): Promise<EmploymentHistory | undefined> {
    // Remove any timestamp/id fields that might have been serialized from frontend
    const { createdAt, updatedAt, id: recordId, ...cleanData } = data as any;
    const [updated] = await db
      .update(employmentHistory)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(employmentHistory.id, id))
      .returning();
    return updated;
  }

  async deleteEmploymentHistory(id: string): Promise<void> {
    await db.delete(employmentHistory).where(eq(employmentHistory.id, id));
  }

  // Other Income Sources
  async getOtherIncomeSources(applicationId: string): Promise<OtherIncomeSource[]> {
    return await db
      .select()
      .from(otherIncomeSources)
      .where(eq(otherIncomeSources.applicationId, applicationId))
      .orderBy(desc(otherIncomeSources.createdAt));
  }

  async createOtherIncomeSource(data: InsertOtherIncomeSource): Promise<OtherIncomeSource> {
    const [record] = await db.insert(otherIncomeSources).values(data).returning();
    return record;
  }

  async deleteOtherIncomeSource(id: string): Promise<void> {
    await db.delete(otherIncomeSources).where(eq(otherIncomeSources.id, id));
  }

  // URLA Assets
  async getUrlaAssets(applicationId: string): Promise<UrlaAsset[]> {
    return await db
      .select()
      .from(urlaAssets)
      .where(eq(urlaAssets.applicationId, applicationId))
      .orderBy(desc(urlaAssets.createdAt));
  }

  async createUrlaAsset(data: InsertUrlaAsset): Promise<UrlaAsset> {
    const [record] = await db.insert(urlaAssets).values(data).returning();
    return record;
  }

  async updateUrlaAsset(id: string, data: Partial<UrlaAsset>): Promise<UrlaAsset | undefined> {
    // Remove any timestamp/id fields that might have been serialized from frontend
    const { createdAt, updatedAt, id: recordId, ...cleanData } = data as any;
    const [updated] = await db
      .update(urlaAssets)
      .set(cleanData)
      .where(eq(urlaAssets.id, id))
      .returning();
    return updated;
  }

  async deleteUrlaAsset(id: string): Promise<void> {
    await db.delete(urlaAssets).where(eq(urlaAssets.id, id));
  }

  // URLA Liabilities
  async getUrlaLiabilities(applicationId: string): Promise<UrlaLiability[]> {
    return await db
      .select()
      .from(urlaLiabilities)
      .where(eq(urlaLiabilities.applicationId, applicationId))
      .orderBy(desc(urlaLiabilities.createdAt));
  }

  async createUrlaLiability(data: InsertUrlaLiability): Promise<UrlaLiability> {
    const [record] = await db.insert(urlaLiabilities).values(data).returning();
    return record;
  }

  async updateUrlaLiability(id: string, data: Partial<UrlaLiability>): Promise<UrlaLiability | undefined> {
    // Remove any timestamp/id fields that might have been serialized from frontend
    const { createdAt, updatedAt, id: recordId, ...cleanData } = data as any;
    const [updated] = await db
      .update(urlaLiabilities)
      .set(cleanData)
      .where(eq(urlaLiabilities.id, id))
      .returning();
    return updated;
  }

  async deleteUrlaLiability(id: string): Promise<void> {
    await db.delete(urlaLiabilities).where(eq(urlaLiabilities.id, id));
  }

  // URLA Property Info
  async getUrlaPropertyInfo(applicationId: string): Promise<UrlaPropertyInfo | undefined> {
    const [info] = await db
      .select()
      .from(urlaPropertyInfo)
      .where(eq(urlaPropertyInfo.applicationId, applicationId))
      .limit(1);
    return info;
  }

  async upsertUrlaPropertyInfo(data: InsertUrlaPropertyInfo): Promise<UrlaPropertyInfo> {
    const existing = await this.getUrlaPropertyInfo(data.applicationId);
    // Remove any timestamp fields that might have been serialized as strings from frontend
    const { createdAt, updatedAt, id, ...cleanData } = data as any;
    
    if (existing) {
      const [updated] = await db
        .update(urlaPropertyInfo)
        .set({ ...cleanData, updatedAt: new Date() })
        .where(eq(urlaPropertyInfo.applicationId, data.applicationId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(urlaPropertyInfo).values(cleanData).returning();
    return created;
  }

  // Borrower Declarations
  async getBorrowerDeclarations(applicationId: string): Promise<BorrowerDeclarations | undefined> {
    const [declarations] = await db
      .select()
      .from(borrowerDeclarations)
      .where(eq(borrowerDeclarations.applicationId, applicationId))
      .limit(1);
    return declarations;
  }

  async upsertBorrowerDeclarations(data: InsertBorrowerDeclarations): Promise<BorrowerDeclarations> {
    const existing = await this.getBorrowerDeclarations(data.applicationId);
    const { createdAt, updatedAt, id, ...cleanData } = data as any;
    
    if (existing) {
      const [updated] = await db
        .update(borrowerDeclarations)
        .set({ ...cleanData, updatedAt: new Date() })
        .where(eq(borrowerDeclarations.applicationId, data.applicationId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(borrowerDeclarations).values(cleanData).returning();
    return created;
  }

  // Get Complete URLA Data
  async getCompleteUrlaData(applicationId: string) {
    const [personalInfo, employment, income, assets, liabilities, propertyInfo, declarations] = await Promise.all([
      this.getUrlaPersonalInfo(applicationId),
      this.getEmploymentHistory(applicationId),
      this.getOtherIncomeSources(applicationId),
      this.getUrlaAssets(applicationId),
      this.getUrlaLiabilities(applicationId),
      this.getUrlaPropertyInfo(applicationId),
      this.getBorrowerDeclarations(applicationId),
    ]);

    return {
      personalInfo,
      employmentHistory: employment,
      otherIncomeSources: income,
      assets,
      liabilities,
      propertyInfo,
      declarations,
    };
  }

  // MISMO Export Data - aggregates all data needed for MISMO 3.4 XML generation
  async getMISMOLoanData(applicationId: string) {
    const application = await this.getLoanApplication(applicationId);
    if (!application) {
      return null;
    }

    const [user, urlaData, loanOpts, docs] = await Promise.all([
      application.userId ? this.getUser(application.userId) : Promise.resolve(undefined),
      this.getCompleteUrlaData(applicationId),
      this.getLoanOptionsByApplication(applicationId),
      this.getDocumentsByApplication(applicationId),
    ]);

    return {
      application,
      user: user || null,
      personalInfo: urlaData.personalInfo || null,
      employment: urlaData.employmentHistory,
      assets: urlaData.assets,
      liabilities: urlaData.liabilities,
      propertyInfo: urlaData.propertyInfo || null,
      declarations: urlaData.declarations || null,
      loanOptions: loanOpts,
      documents: docs,
    };
  }

  // Data Quality Scoring for Broker Dashboard
  async getApplicationDataQuality(applicationId: string) {
    const [application, urlaData, docs, taskList] = await Promise.all([
      this.getLoanApplication(applicationId),
      this.getCompleteUrlaData(applicationId),
      this.getDocumentsByApplication(applicationId),
      this.getTasksByApplication(applicationId),
    ]);

    const sections = [];

    // Personal Information Section
    const personalFields = [
      "firstName", "lastName", "ssn", "dateOfBirth", "email", "cellPhone",
      "currentStreet", "currentCity", "currentState", "currentZip"
    ];
    const personalMissing = personalFields.filter(f => !urlaData.personalInfo?.[f as keyof typeof urlaData.personalInfo]);
    const personalScore = Math.round(((personalFields.length - personalMissing.length) / personalFields.length) * 100);
    sections.push({
      name: "Personal Information",
      score: personalScore,
      missingFields: personalMissing,
      verificationStatus: urlaData.personalInfo?.ssn ? "verified" : "pending",
    });

    // Employment Section
    const hasCurrentEmployment = urlaData.employmentHistory.some(e => e.employmentType === "current");
    const employmentScore = hasCurrentEmployment ? 100 : 0;
    sections.push({
      name: "Employment History",
      score: employmentScore,
      missingFields: hasCurrentEmployment ? [] : ["Current Employment"],
      verificationStatus: hasCurrentEmployment ? "pending_verification" : "incomplete",
    });

    // Assets Section
    const assetsScore = urlaData.assets.length > 0 ? 100 : 0;
    sections.push({
      name: "Assets",
      score: assetsScore,
      missingFields: urlaData.assets.length > 0 ? [] : ["At least one asset account"],
      verificationStatus: urlaData.assets.length > 0 ? "pending_verification" : "incomplete",
    });

    // Liabilities Section
    const liabilitiesScore = urlaData.liabilities.length >= 0 ? 100 : 0;
    sections.push({
      name: "Liabilities",
      score: liabilitiesScore,
      missingFields: [],
      verificationStatus: "complete",
    });

    // Declarations Section
    const declarationFields = [
      "willOccupyAsPrimaryResidence", "hasRelationshipWithSeller", 
      "hasOutstandingJudgments", "hasDeclaredBankruptcy", "isUSCitizen"
    ];
    const declarationsMissing = declarationFields.filter(
      f => urlaData.declarations?.[f as keyof typeof urlaData.declarations] === null || 
           urlaData.declarations?.[f as keyof typeof urlaData.declarations] === undefined
    );
    const declarationsScore = urlaData.declarations 
      ? Math.round(((declarationFields.length - declarationsMissing.length) / declarationFields.length) * 100)
      : 0;
    sections.push({
      name: "Borrower Declarations",
      score: declarationsScore,
      missingFields: declarationsMissing,
      verificationStatus: urlaData.declarations?.declarationsVerifiedAt ? "verified" : "pending",
    });

    // Documents Section
    const requiredDocTypes = ["w2", "pay_stub", "bank_statement", "id"];
    const uploadedTypes = Array.from(new Set(docs.map(d => d.documentType)));
    const docsMissing = requiredDocTypes.filter(t => !uploadedTypes.includes(t));
    const docsVerified = docs.filter(d => d.status === "verified").length;
    const docsScore = Math.round(((requiredDocTypes.length - docsMissing.length) / requiredDocTypes.length) * 100);
    sections.push({
      name: "Documents",
      score: docsScore,
      missingFields: docsMissing,
      verificationStatus: docsVerified === docs.length && docs.length > 0 ? "verified" : "pending_verification",
    });

    // Calculate overall score
    const overallScore = Math.round(sections.reduce((sum, s) => sum + s.score, 0) / sections.length);

    return { overallScore, sections };
  }

  // Tasks
  async createTask(data: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(data).returning();
    return task;
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return task;
  }

  async getTasksByApplication(applicationId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.applicationId, applicationId))
      .orderBy(desc(tasks.createdAt));
  }

  async getTasksByUser(userId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.assignedToUserId, userId))
      .orderBy(desc(tasks.createdAt));
  }

  async getAllTasks(limit: number = 500): Promise<Task[]> {
    return await db.select().from(tasks).orderBy(desc(tasks.createdAt)).limit(limit);
  }

  async updateTask(id: string, data: Partial<Task>): Promise<Task | undefined> {
    const { createdAt, updatedAt, id: taskId, ...cleanData } = data as any;
    const [updated] = await db
      .update(tasks)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(taskDocuments).where(eq(taskDocuments.taskId, id));
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // Task Documents
  async createTaskDocument(data: InsertTaskDocument): Promise<TaskDocument> {
    const [record] = await db.insert(taskDocuments).values(data).returning();
    return record;
  }

  async getTaskDocuments(taskId: string): Promise<(TaskDocument & { document: Document })[]> {
    const results = await db
      .select({
        taskDocument: taskDocuments,
        document: documents,
      })
      .from(taskDocuments)
      .innerJoin(documents, eq(taskDocuments.documentId, documents.id))
      .where(eq(taskDocuments.taskId, taskId))
      .orderBy(desc(taskDocuments.createdAt));
    
    return results.map(r => ({
      ...r.taskDocument,
      document: r.document,
    }));
  }

  async updateTaskDocument(id: string, data: Partial<TaskDocument>): Promise<TaskDocument | undefined> {
    const { createdAt, id: docId, ...cleanData } = data as any;
    const [updated] = await db
      .update(taskDocuments)
      .set(cleanData)
      .where(eq(taskDocuments.id, id))
      .returning();
    return updated;
  }

  async deleteTaskDocument(id: string): Promise<void> {
    await db.delete(taskDocuments).where(eq(taskDocuments.id, id));
  }

  // Document Packages - lender-ready document organization
  async createDocumentPackage(data: InsertDocumentPackage): Promise<DocumentPackage> {
    const [pkg] = await db.insert(documentPackages).values(data).returning();
    return pkg;
  }

  async getDocumentPackage(id: string): Promise<DocumentPackage | undefined> {
    const [pkg] = await db.select().from(documentPackages).where(eq(documentPackages.id, id));
    return pkg;
  }

  async getDocumentPackagesByApplication(applicationId: string): Promise<DocumentPackage[]> {
    return await db
      .select()
      .from(documentPackages)
      .where(eq(documentPackages.applicationId, applicationId))
      .orderBy(desc(documentPackages.createdAt));
  }

  async updateDocumentPackage(id: string, data: Partial<DocumentPackage>): Promise<DocumentPackage | undefined> {
    const [pkg] = await db
      .update(documentPackages)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documentPackages.id, id))
      .returning();
    return pkg;
  }

  async deleteDocumentPackage(id: string): Promise<void> {
    // First delete all items in the package
    await db.delete(documentPackageItems).where(eq(documentPackageItems.packageId, id));
    await db.delete(documentPackages).where(eq(documentPackages.id, id));
  }

  // Document Package Items
  async addDocumentToPackage(data: InsertDocumentPackageItem): Promise<DocumentPackageItem> {
    const [item] = await db.insert(documentPackageItems).values(data).returning();
    return item;
  }

  async getDocumentPackageItems(packageId: string): Promise<(DocumentPackageItem & { document: Document })[]> {
    const items = await db
      .select()
      .from(documentPackageItems)
      .innerJoin(documents, eq(documentPackageItems.documentId, documents.id))
      .where(eq(documentPackageItems.packageId, packageId))
      .orderBy(asc(documentPackageItems.displayOrder));
    
    return items.map(item => ({
      ...item.document_package_items,
      document: item.documents,
    }));
  }

  async updateDocumentPackageItem(id: string, data: Partial<DocumentPackageItem>): Promise<DocumentPackageItem | undefined> {
    const [item] = await db
      .update(documentPackageItems)
      .set(data)
      .where(eq(documentPackageItems.id, id))
      .returning();
    return item;
  }

  async removeDocumentFromPackage(id: string): Promise<void> {
    await db.delete(documentPackageItems).where(eq(documentPackageItems.id, id));
  }

  // Agent Profiles
  async createAgentProfile(data: InsertAgentProfile): Promise<AgentProfile> {
    const [profile] = await db.insert(agentProfiles).values(data).returning();
    return profile;
  }

  async getAgentProfile(id: string): Promise<AgentProfile | undefined> {
    const [profile] = await db
      .select()
      .from(agentProfiles)
      .where(eq(agentProfiles.id, id))
      .limit(1);
    return profile;
  }

  async getAgentProfileByUserId(userId: string): Promise<AgentProfile | undefined> {
    const [profile] = await db
      .select()
      .from(agentProfiles)
      .where(eq(agentProfiles.userId, userId))
      .limit(1);
    return profile;
  }

  async updateAgentProfile(id: string, data: Partial<AgentProfile>): Promise<AgentProfile | undefined> {
    const { createdAt, updatedAt, id: profileId, ...cleanData } = data as any;
    const [updated] = await db
      .update(agentProfiles)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(agentProfiles.id, id))
      .returning();
    return updated;
  }

  async getAllAgentProfiles(): Promise<AgentProfile[]> {
    return await db.select().from(agentProfiles).orderBy(desc(agentProfiles.createdAt));
  }

  async searchAgentProfiles(filters: { location?: string; specialty?: string }): Promise<AgentProfile[]> {
    let query = db.select().from(agentProfiles);
    const conditions = [];
    if (filters.location) {
      conditions.push(sql`${agentProfiles.serviceArea} && ARRAY[${filters.location}]::text[]`);
    }
    if (filters.specialty) {
      conditions.push(sql`${agentProfiles.specialties} && ARRAY[${filters.specialty}]::text[]`);
    }
    if (conditions.length > 0) {
      return await (query as any).where(and(...conditions)).orderBy(desc(agentProfiles.averageRating));
    }
    return await query.orderBy(desc(agentProfiles.averageRating));
  }

  async createAgentReferralRequest(data: InsertAgentReferralRequest): Promise<AgentReferralRequest> {
    const [request] = await db.insert(agentReferralRequests).values(data).returning();
    return request;
  }

  async getAgentReferralRequests(agentId?: string): Promise<AgentReferralRequest[]> {
    if (agentId) {
      return await db.select().from(agentReferralRequests)
        .where(eq(agentReferralRequests.matchedAgentId, agentId))
        .orderBy(desc(agentReferralRequests.createdAt));
    }
    return await db.select().from(agentReferralRequests).orderBy(desc(agentReferralRequests.createdAt));
  }

  async updateAgentReferralRequest(id: string, data: Partial<AgentReferralRequest>): Promise<AgentReferralRequest | undefined> {
    const { id: _id, createdAt, ...cleanData } = data as any;
    const [updated] = await db.update(agentReferralRequests)
      .set(cleanData)
      .where(eq(agentReferralRequests.id, id))
      .returning();
    return updated;
  }

  // Property CRUD extensions
  async updateProperty(id: string, data: Partial<Property>): Promise<Property | undefined> {
    const { createdAt, updatedAt, id: propId, ...cleanData } = data as any;
    const [updated] = await db
      .update(properties)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(properties.id, id))
      .returning();
    return updated;
  }

  async deleteProperty(id: string): Promise<void> {
    await db.delete(savedProperties).where(eq(savedProperties.propertyId, id));
    await db.delete(properties).where(eq(properties.id, id));
  }

  async getPropertiesByAgent(agentId: string): Promise<Property[]> {
    return await db
      .select()
      .from(properties)
      .where(eq(properties.agentId, agentId))
      .orderBy(desc(properties.createdAt));
  }

  // ============================================================================
  // LOAN PIPELINE TRACKING
  // ============================================================================

  // Loan Milestones
  async createLoanMilestone(data: InsertLoanMilestone): Promise<LoanMilestone> {
    const [milestone] = await db.insert(loanMilestones).values(data).returning();
    return milestone;
  }

  async getLoanMilestones(applicationId: string): Promise<LoanMilestone | undefined> {
    const [milestone] = await db
      .select()
      .from(loanMilestones)
      .where(eq(loanMilestones.applicationId, applicationId))
      .limit(1);
    return milestone;
  }

  async updateLoanMilestones(applicationId: string, data: Partial<LoanMilestone>): Promise<LoanMilestone | undefined> {
    const { createdAt, updatedAt, id, ...cleanData } = data as any;
    const [updated] = await db
      .update(loanMilestones)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(loanMilestones.applicationId, applicationId))
      .returning();
    return updated;
  }

  // Loan Conditions
  async createLoanCondition(data: InsertLoanCondition): Promise<LoanCondition> {
    const [condition] = await db.insert(loanConditions).values(data).returning();
    return condition;
  }

  async getLoanCondition(id: string): Promise<LoanCondition | undefined> {
    const [condition] = await db
      .select()
      .from(loanConditions)
      .where(eq(loanConditions.id, id))
      .limit(1);
    return condition;
  }

  async getLoanConditionsByApplication(applicationId: string): Promise<LoanCondition[]> {
    return await db
      .select()
      .from(loanConditions)
      .where(eq(loanConditions.applicationId, applicationId))
      .orderBy(loanConditions.priority, desc(loanConditions.createdAt));
  }

  async updateLoanCondition(id: string, data: Partial<LoanCondition>): Promise<LoanCondition | undefined> {
    const { createdAt, updatedAt, id: condId, ...cleanData } = data as any;
    const [updated] = await db
      .update(loanConditions)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(loanConditions.id, id))
      .returning();
    return updated;
  }

  async deleteLoanCondition(id: string): Promise<void> {
    await db.delete(loanConditions).where(eq(loanConditions.id, id));
  }

  async clearLoanCondition(id: string, userId: string, notes?: string): Promise<LoanCondition | undefined> {
    const [updated] = await db
      .update(loanConditions)
      .set({
        status: "cleared",
        clearedByUserId: userId,
        clearedAt: new Date(),
        clearanceNotes: notes,
        updatedAt: new Date(),
      })
      .where(eq(loanConditions.id, id))
      .returning();
    return updated;
  }

  // Document Requirement Rules
  async createDocumentRequirementRule(data: InsertDocumentRequirementRule): Promise<DocumentRequirementRule> {
    const [rule] = await db.insert(documentRequirementRules).values(data).returning();
    return rule;
  }

  async getDocumentRequirementRule(id: string): Promise<DocumentRequirementRule | undefined> {
    const [rule] = await db
      .select()
      .from(documentRequirementRules)
      .where(eq(documentRequirementRules.id, id))
      .limit(1);
    return rule;
  }

  async getAllDocumentRequirementRules(): Promise<DocumentRequirementRule[]> {
    return await db
      .select()
      .from(documentRequirementRules)
      .where(eq(documentRequirementRules.isActive, true))
      .orderBy(documentRequirementRules.priority);
  }

  async updateDocumentRequirementRule(id: string, data: Partial<DocumentRequirementRule>): Promise<DocumentRequirementRule | undefined> {
    const { createdAt, updatedAt, id: ruleId, ...cleanData } = data as any;
    const [updated] = await db
      .update(documentRequirementRules)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(documentRequirementRules.id, id))
      .returning();
    return updated;
  }

  // Underwriting Snapshots
  async createUnderwritingSnapshot(data: InsertUnderwritingSnapshot): Promise<UnderwritingSnapshot> {
    const [snapshot] = await db.insert(underwritingSnapshots).values(data).returning();
    return snapshot;
  }

  async getUnderwritingSnapshotsByApplication(applicationId: string): Promise<UnderwritingSnapshot[]> {
    return await db
      .select()
      .from(underwritingSnapshots)
      .where(eq(underwritingSnapshots.loanId, applicationId))
      .orderBy(desc(underwritingSnapshots.createdAt));
  }

  async getLatestUnderwritingSnapshot(applicationId: string): Promise<UnderwritingSnapshot | undefined> {
    const [snapshot] = await db
      .select()
      .from(underwritingSnapshots)
      .where(eq(underwritingSnapshots.loanId, applicationId))
      .orderBy(desc(underwritingSnapshots.createdAt))
      .limit(1);
    return snapshot;
  }

  // Application Properties - multi-property support
  async createApplicationProperty(data: InsertApplicationProperty): Promise<ApplicationProperty> {
    // If this is marked as current, unset current on other properties for this application
    if (data.isCurrentProperty) {
      await db
        .update(applicationProperties)
        .set({ isCurrentProperty: false, updatedAt: new Date() })
        .where(eq(applicationProperties.applicationId, data.applicationId));
    }
    const [property] = await db.insert(applicationProperties).values(data).returning();
    return property;
  }

  async getApplicationProperties(applicationId: string): Promise<ApplicationProperty[]> {
    return await db
      .select()
      .from(applicationProperties)
      .where(eq(applicationProperties.applicationId, applicationId))
      .orderBy(desc(applicationProperties.createdAt));
  }

  async getCurrentProperty(applicationId: string): Promise<ApplicationProperty | undefined> {
    const [property] = await db
      .select()
      .from(applicationProperties)
      .where(
        and(
          eq(applicationProperties.applicationId, applicationId),
          eq(applicationProperties.isCurrentProperty, true)
        )
      )
      .limit(1);
    return property;
  }

  async updateApplicationProperty(id: string, data: Partial<ApplicationProperty>): Promise<ApplicationProperty | undefined> {
    const { id: propId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(applicationProperties)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(applicationProperties.id, id))
      .returning();
    return updated;
  }

  async switchToProperty(applicationId: string, propertyId: string): Promise<ApplicationProperty | undefined> {
    // First, unset current on all properties for this application
    await db
      .update(applicationProperties)
      .set({ isCurrentProperty: false, updatedAt: new Date() })
      .where(eq(applicationProperties.applicationId, applicationId));
    
    // Then set the new property as current
    const [updated] = await db
      .update(applicationProperties)
      .set({ isCurrentProperty: true, status: "active", updatedAt: new Date() })
      .where(eq(applicationProperties.id, propertyId))
      .returning();
    return updated;
  }

  async markDealFellThrough(propertyId: string, reason: string): Promise<ApplicationProperty | undefined> {
    const [updated] = await db
      .update(applicationProperties)
      .set({ 
        status: "deal_fell_through", 
        isCurrentProperty: false,
        notes: reason,
        updatedAt: new Date() 
      })
      .where(eq(applicationProperties.id, propertyId))
      .returning();
    return updated;
  }

  // Deal Team Members
  async createDealTeamMember(data: InsertDealTeamMember): Promise<DealTeamMember> {
    const [member] = await db.insert(dealTeamMembers).values(data).returning();
    return member;
  }

  async getDealTeamMembers(applicationId: string): Promise<(DealTeamMember & { user?: User })[]> {
    const members = await db
      .select()
      .from(dealTeamMembers)
      .leftJoin(users, eq(dealTeamMembers.userId, users.id))
      .where(and(
        eq(dealTeamMembers.applicationId, applicationId),
        eq(dealTeamMembers.isActive, true)
      ))
      .orderBy(asc(dealTeamMembers.teamRole));

    return members.map(row => ({
      ...row.deal_team_members,
      user: row.users || undefined,
    }));
  }

  async getDealTeamMember(id: string): Promise<DealTeamMember | undefined> {
    const [member] = await db
      .select()
      .from(dealTeamMembers)
      .where(eq(dealTeamMembers.id, id));
    return member;
  }

  async updateDealTeamMember(id: string, data: Partial<DealTeamMember>): Promise<DealTeamMember | undefined> {
    const [updated] = await db
      .update(dealTeamMembers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(dealTeamMembers.id, id))
      .returning();
    return updated;
  }

  async removeDealTeamMember(id: string): Promise<void> {
    await db
      .update(dealTeamMembers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(dealTeamMembers.id, id));
  }

  async getTeamMembersByUser(userId: string): Promise<(DealTeamMember & { application?: LoanApplication })[]> {
    const members = await db
      .select()
      .from(dealTeamMembers)
      .leftJoin(loanApplications, eq(dealTeamMembers.applicationId, loanApplications.id))
      .where(and(
        eq(dealTeamMembers.userId, userId),
        eq(dealTeamMembers.isActive, true)
      ))
      .orderBy(desc(dealTeamMembers.assignedAt));

    return members.map(row => ({
      ...row.deal_team_members,
      application: row.loan_applications || undefined,
    }));
  }

  // Plaid Verifications
  async createPlaidLinkToken(data: InsertPlaidLinkToken): Promise<PlaidLinkToken> {
    const [token] = await db.insert(plaidLinkTokens).values(data).returning();
    return token;
  }

  async getPlaidLinkToken(id: string): Promise<PlaidLinkToken | undefined> {
    const [token] = await db
      .select()
      .from(plaidLinkTokens)
      .where(eq(plaidLinkTokens.id, id))
      .limit(1);
    return token;
  }

  async updatePlaidLinkToken(id: string, data: Partial<PlaidLinkToken>): Promise<PlaidLinkToken | undefined> {
    const { id: tokenId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(plaidLinkTokens)
      .set(cleanData)
      .where(eq(plaidLinkTokens.id, id))
      .returning();
    return updated;
  }

  async createVerification(data: InsertVerification): Promise<Verification> {
    const [verification] = await db.insert(verifications).values(data).returning();
    return verification;
  }

  async getVerification(id: string): Promise<Verification | undefined> {
    const [verification] = await db
      .select()
      .from(verifications)
      .where(eq(verifications.id, id))
      .limit(1);
    return verification;
  }

  async getVerificationsByApplication(applicationId: string): Promise<Verification[]> {
    return await db
      .select()
      .from(verifications)
      .where(eq(verifications.applicationId, applicationId))
      .orderBy(desc(verifications.createdAt));
  }

  async getVerificationsByUser(userId: string): Promise<Verification[]> {
    return await db
      .select()
      .from(verifications)
      .where(eq(verifications.userId, userId))
      .orderBy(desc(verifications.createdAt));
  }

  async updateVerification(id: string, data: Partial<Verification>): Promise<Verification | undefined> {
    const { id: verId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(verifications)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(verifications.id, id))
      .returning();
    return updated;
  }

  // Content Categories
  async createContentCategory(data: InsertContentCategory): Promise<ContentCategory> {
    const [category] = await db.insert(contentCategories).values(data).returning();
    return category;
  }

  async getContentCategory(id: string): Promise<ContentCategory | undefined> {
    const [category] = await db
      .select()
      .from(contentCategories)
      .where(eq(contentCategories.id, id))
      .limit(1);
    return category;
  }

  async getContentCategoryBySlug(slug: string): Promise<ContentCategory | undefined> {
    const [category] = await db
      .select()
      .from(contentCategories)
      .where(eq(contentCategories.slug, slug))
      .limit(1);
    return category;
  }

  async getAllContentCategories(): Promise<ContentCategory[]> {
    return await db
      .select()
      .from(contentCategories)
      .orderBy(asc(contentCategories.displayOrder));
  }

  async getActiveContentCategories(): Promise<ContentCategory[]> {
    return await db
      .select()
      .from(contentCategories)
      .where(eq(contentCategories.isActive, true))
      .orderBy(asc(contentCategories.displayOrder));
  }

  async updateContentCategory(id: string, data: Partial<ContentCategory>): Promise<ContentCategory | undefined> {
    const { id: catId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(contentCategories)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(contentCategories.id, id))
      .returning();
    return updated;
  }

  async deleteContentCategory(id: string): Promise<void> {
    await db.delete(contentCategories).where(eq(contentCategories.id, id));
  }

  // Articles (Learning Center)
  async createArticle(data: InsertArticle): Promise<Article> {
    const [article] = await db.insert(articles).values(data).returning();
    return article;
  }

  async getArticle(id: string): Promise<Article | undefined> {
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1);
    return article;
  }

  async getArticleBySlug(slug: string): Promise<Article | undefined> {
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.slug, slug))
      .limit(1);
    return article;
  }

  async getAllArticles(): Promise<Article[]> {
    return await db
      .select()
      .from(articles)
      .orderBy(desc(articles.createdAt));
  }

  async getPublishedArticles(): Promise<Article[]> {
    return await db
      .select()
      .from(articles)
      .where(eq(articles.status, "published"))
      .orderBy(desc(articles.publishedAt));
  }

  async getArticlesByCategory(categoryId: string): Promise<Article[]> {
    return await db
      .select()
      .from(articles)
      .where(and(
        eq(articles.categoryId, categoryId),
        eq(articles.status, "published")
      ))
      .orderBy(desc(articles.publishedAt));
  }

  async searchArticles(query: string): Promise<Article[]> {
    const searchTerm = `%${query.toLowerCase()}%`;
    return await db
      .select()
      .from(articles)
      .where(and(
        eq(articles.status, "published"),
        or(
          ilike(articles.title, searchTerm),
          ilike(articles.excerpt, searchTerm),
          ilike(articles.content, searchTerm)
        )
      ))
      .orderBy(desc(articles.publishedAt));
  }

  async updateArticle(id: string, data: Partial<Article>): Promise<Article | undefined> {
    const { id: artId, createdAt, viewCount, ...cleanData } = data as any;
    const [updated] = await db
      .update(articles)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(articles.id, id))
      .returning();
    return updated;
  }

  async incrementArticleViewCount(id: string): Promise<void> {
    await db
      .update(articles)
      .set({ viewCount: sql`${articles.viewCount} + 1` })
      .where(eq(articles.id, id));
  }

  async deleteArticle(id: string): Promise<void> {
    await db.delete(articles).where(eq(articles.id, id));
  }

  // FAQs
  async createFaq(data: InsertFaq): Promise<Faq> {
    const [faq] = await db.insert(faqs).values(data).returning();
    return faq;
  }

  async getFaq(id: string): Promise<Faq | undefined> {
    const [faq] = await db
      .select()
      .from(faqs)
      .where(eq(faqs.id, id))
      .limit(1);
    return faq;
  }

  async getAllFaqs(): Promise<Faq[]> {
    return await db
      .select()
      .from(faqs)
      .orderBy(asc(faqs.displayOrder), desc(faqs.createdAt));
  }

  async getPublishedFaqs(): Promise<Faq[]> {
    return await db
      .select()
      .from(faqs)
      .where(eq(faqs.status, "published"))
      .orderBy(asc(faqs.displayOrder));
  }

  async getPopularFaqs(): Promise<Faq[]> {
    return await db
      .select()
      .from(faqs)
      .where(and(
        eq(faqs.status, "published"),
        eq(faqs.isPopular, true)
      ))
      .orderBy(asc(faqs.displayOrder));
  }

  async getFaqsByCategory(categoryId: string): Promise<Faq[]> {
    return await db
      .select()
      .from(faqs)
      .where(and(
        eq(faqs.categoryId, categoryId),
        eq(faqs.status, "published")
      ))
      .orderBy(asc(faqs.displayOrder));
  }

  async searchFaqs(query: string): Promise<Faq[]> {
    const searchTerm = `%${query.toLowerCase()}%`;
    return await db
      .select()
      .from(faqs)
      .where(and(
        eq(faqs.status, "published"),
        or(
          ilike(faqs.question, searchTerm),
          ilike(faqs.answer, searchTerm)
        )
      ))
      .orderBy(asc(faqs.displayOrder));
  }

  async updateFaq(id: string, data: Partial<Faq>): Promise<Faq | undefined> {
    const { id: faqId, createdAt, viewCount, helpfulCount, notHelpfulCount, ...cleanData } = data as any;
    const [updated] = await db
      .update(faqs)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(faqs.id, id))
      .returning();
    return updated;
  }

  async incrementFaqViewCount(id: string): Promise<void> {
    await db
      .update(faqs)
      .set({ viewCount: sql`${faqs.viewCount} + 1` })
      .where(eq(faqs.id, id));
  }

  async markFaqHelpful(id: string, helpful: boolean): Promise<void> {
    if (helpful) {
      await db
        .update(faqs)
        .set({ helpfulCount: sql`${faqs.helpfulCount} + 1` })
        .where(eq(faqs.id, id));
    } else {
      await db
        .update(faqs)
        .set({ notHelpfulCount: sql`${faqs.notHelpfulCount} + 1` })
        .where(eq(faqs.id, id));
    }
  }

  async deleteFaq(id: string): Promise<void> {
    await db.delete(faqs).where(eq(faqs.id, id));
  }

  // Mortgage Rate Programs
  async createMortgageRateProgram(data: InsertMortgageRateProgram): Promise<MortgageRateProgram> {
    const [program] = await db.insert(mortgageRatePrograms).values(data).returning();
    return program;
  }

  async getMortgageRateProgram(id: string): Promise<MortgageRateProgram | undefined> {
    const [program] = await db
      .select()
      .from(mortgageRatePrograms)
      .where(eq(mortgageRatePrograms.id, id))
      .limit(1);
    return program;
  }

  async getMortgageRateProgramBySlug(slug: string): Promise<MortgageRateProgram | undefined> {
    const [program] = await db
      .select()
      .from(mortgageRatePrograms)
      .where(eq(mortgageRatePrograms.slug, slug))
      .limit(1);
    return program;
  }

  async getAllMortgageRatePrograms(): Promise<MortgageRateProgram[]> {
    return await db
      .select()
      .from(mortgageRatePrograms)
      .orderBy(asc(mortgageRatePrograms.displayOrder));
  }

  async getActiveMortgageRatePrograms(): Promise<MortgageRateProgram[]> {
    return await db
      .select()
      .from(mortgageRatePrograms)
      .where(eq(mortgageRatePrograms.isActive, true))
      .orderBy(asc(mortgageRatePrograms.displayOrder));
  }

  async updateMortgageRateProgram(id: string, data: Partial<MortgageRateProgram>): Promise<MortgageRateProgram | undefined> {
    const { id: programId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(mortgageRatePrograms)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(mortgageRatePrograms.id, id))
      .returning();
    return updated;
  }

  async deleteMortgageRateProgram(id: string): Promise<void> {
    await db.delete(mortgageRatePrograms).where(eq(mortgageRatePrograms.id, id));
  }

  // Mortgage Rates
  async createMortgageRate(data: InsertMortgageRate): Promise<MortgageRate> {
    const [rate] = await db.insert(mortgageRates).values(data).returning();
    return rate;
  }

  async getMortgageRate(id: string): Promise<MortgageRate | undefined> {
    const [rate] = await db
      .select()
      .from(mortgageRates)
      .where(eq(mortgageRates.id, id))
      .limit(1);
    return rate;
  }

  async getMortgageRatesByProgram(programId: string): Promise<MortgageRate[]> {
    return await db
      .select()
      .from(mortgageRates)
      .where(eq(mortgageRates.programId, programId));
  }

  async getMortgageRatesForLocation(state?: string, zipcode?: string): Promise<(MortgageRate & { program: MortgageRateProgram })[]> {
    // Get rates with location matching: zipcode > state > national (null)
    const results = await db
      .select({
        id: mortgageRates.id,
        state: mortgageRates.state,
        zipcode: mortgageRates.zipcode,
        programId: mortgageRates.programId,
        rate: mortgageRates.rate,
        apr: mortgageRates.apr,
        points: mortgageRates.points,
        pointsCost: mortgageRates.pointsCost,
        loanAmount: mortgageRates.loanAmount,
        downPaymentPercent: mortgageRates.downPaymentPercent,
        creditScoreMin: mortgageRates.creditScoreMin,
        isActive: mortgageRates.isActive,
        effectiveDate: mortgageRates.effectiveDate,
        expiresAt: mortgageRates.expiresAt,
        createdBy: mortgageRates.createdBy,
        updatedBy: mortgageRates.updatedBy,
        createdAt: mortgageRates.createdAt,
        updatedAt: mortgageRates.updatedAt,
        program: mortgageRatePrograms,
      })
      .from(mortgageRates)
      .innerJoin(mortgageRatePrograms, eq(mortgageRates.programId, mortgageRatePrograms.id))
      .where(and(
        eq(mortgageRates.isActive, true),
        eq(mortgageRatePrograms.isActive, true)
      ))
      .orderBy(asc(mortgageRatePrograms.displayOrder));

    // Filter by location preference: zipcode > state > national
    const ratesByProgram = new Map<string, typeof results[0]>();
    
    for (const rate of results) {
      const existing = ratesByProgram.get(rate.programId);
      
      // Calculate priority: zipcode match = 3, state match = 2, national = 1
      const getPriority = (r: typeof rate) => {
        if (zipcode && r.zipcode === zipcode) return 3;
        if (state && r.state === state && !r.zipcode) return 2;
        if (!r.state && !r.zipcode) return 1;
        return 0;
      };
      
      const newPriority = getPriority(rate);
      const existingPriority = existing ? getPriority(existing) : 0;
      
      if (newPriority > existingPriority) {
        ratesByProgram.set(rate.programId, rate);
      }
    }
    
    return Array.from(ratesByProgram.values());
  }

  async getAllMortgageRates(): Promise<(MortgageRate & { program: MortgageRateProgram })[]> {
    return await db
      .select({
        id: mortgageRates.id,
        state: mortgageRates.state,
        zipcode: mortgageRates.zipcode,
        programId: mortgageRates.programId,
        rate: mortgageRates.rate,
        apr: mortgageRates.apr,
        points: mortgageRates.points,
        pointsCost: mortgageRates.pointsCost,
        loanAmount: mortgageRates.loanAmount,
        downPaymentPercent: mortgageRates.downPaymentPercent,
        creditScoreMin: mortgageRates.creditScoreMin,
        isActive: mortgageRates.isActive,
        effectiveDate: mortgageRates.effectiveDate,
        expiresAt: mortgageRates.expiresAt,
        createdBy: mortgageRates.createdBy,
        updatedBy: mortgageRates.updatedBy,
        createdAt: mortgageRates.createdAt,
        updatedAt: mortgageRates.updatedAt,
        program: mortgageRatePrograms,
      })
      .from(mortgageRates)
      .innerJoin(mortgageRatePrograms, eq(mortgageRates.programId, mortgageRatePrograms.id))
      .orderBy(asc(mortgageRatePrograms.displayOrder), desc(mortgageRates.createdAt));
  }

  async updateMortgageRate(id: string, data: Partial<MortgageRate>): Promise<MortgageRate | undefined> {
    const { id: rateId, createdAt, createdBy, ...cleanData } = data as any;
    const [updated] = await db
      .update(mortgageRates)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(mortgageRates.id, id))
      .returning();
    return updated;
  }

  async deleteMortgageRate(id: string): Promise<void> {
    await db.delete(mortgageRates).where(eq(mortgageRates.id, id));
  }

  // Broker Referrals & Commissions
  async getBrokerReferrals(brokerId: string): Promise<(LoanApplication & { borrower: User })[]> {
    const referrals = await db
      .select()
      .from(loanApplications)
      .innerJoin(users, eq(loanApplications.userId, users.id))
      .where(eq(loanApplications.referringBrokerId, brokerId))
      .orderBy(desc(loanApplications.createdAt));
    
    return referrals.map(r => ({
      ...r.loan_applications,
      borrower: r.users,
    }));
  }

  async getBrokerReferralStats(brokerId: string): Promise<{
    totalReferrals: number;
    activeReferrals: number;
    closedLoans: number;
    totalLoanVolume: string;
    totalCommissionsEarned: string;
    pendingCommissions: string;
  }> {
    const referrals = await db
      .select()
      .from(loanApplications)
      .where(eq(loanApplications.referringBrokerId, brokerId));
    
    const activeStatuses = ["draft", "submitted", "analyzing", "pre_approved", "verified", "underwriting", "approved"];
    const closedStatuses = ["closed"];
    
    const totalReferrals = referrals.length;
    const activeReferrals = referrals.filter(r => activeStatuses.includes(r.status)).length;
    const closedLoans = referrals.filter(r => closedStatuses.includes(r.status)).length;
    
    const closedLoanVolume = referrals
      .filter(r => closedStatuses.includes(r.status))
      .reduce((sum, r) => sum + Number(r.purchasePrice || 0), 0);
    
    const commissions = await db
      .select()
      .from(brokerCommissions)
      .where(eq(brokerCommissions.brokerId, brokerId));
    
    const paidCommissions = commissions
      .filter(c => c.status === "paid")
      .reduce((sum, c) => sum + Number(c.commissionAmount || 0), 0);
    
    const pendingCommissions = commissions
      .filter(c => c.status === "pending" || c.status === "approved")
      .reduce((sum, c) => sum + Number(c.commissionAmount || 0), 0);
    
    return {
      totalReferrals,
      activeReferrals,
      closedLoans,
      totalLoanVolume: closedLoanVolume.toFixed(2),
      totalCommissionsEarned: paidCommissions.toFixed(2),
      pendingCommissions: pendingCommissions.toFixed(2),
    };
  }

  async createBrokerCommission(data: InsertBrokerCommission): Promise<BrokerCommission> {
    const [commission] = await db
      .insert(brokerCommissions)
      .values(data)
      .returning();
    return commission;
  }

  async getBrokerCommissions(brokerId: string): Promise<(BrokerCommission & { application: LoanApplication })[]> {
    const commissions = await db
      .select()
      .from(brokerCommissions)
      .innerJoin(loanApplications, eq(brokerCommissions.applicationId, loanApplications.id))
      .where(eq(brokerCommissions.brokerId, brokerId))
      .orderBy(desc(brokerCommissions.createdAt));
    
    return commissions.map(c => ({
      ...c.broker_commissions,
      application: c.loan_applications,
    }));
  }

  async getBrokerCommission(id: string): Promise<BrokerCommission | undefined> {
    const [commission] = await db
      .select()
      .from(brokerCommissions)
      .where(eq(brokerCommissions.id, id));
    return commission;
  }

  async updateBrokerCommission(id: string, data: Partial<BrokerCommission>): Promise<BrokerCommission | undefined> {
    const { id: commissionId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(brokerCommissions)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(brokerCommissions.id, id))
      .returning();
    return updated;
  }

  async getAllPendingCommissions(): Promise<(BrokerCommission & { broker: User; application: LoanApplication })[]> {
    const commissions = await db
      .select()
      .from(brokerCommissions)
      .innerJoin(users, eq(brokerCommissions.brokerId, users.id))
      .innerJoin(loanApplications, eq(brokerCommissions.applicationId, loanApplications.id))
      .where(or(eq(brokerCommissions.status, "pending"), eq(brokerCommissions.status, "approved")))
      .orderBy(desc(brokerCommissions.createdAt));
    
    return commissions.map(c => ({
      ...c.broker_commissions,
      broker: c.users,
      application: c.loan_applications,
    }));
  }

  // Calculator Results
  async createCalculatorResult(data: InsertCalculatorResult): Promise<CalculatorResult> {
    const [result] = await db
      .insert(calculatorResults)
      .values(data)
      .returning();
    return result;
  }

  async getCalculatorResultsByUser(userId: string): Promise<CalculatorResult[]> {
    return await db
      .select()
      .from(calculatorResults)
      .where(eq(calculatorResults.userId, userId))
      .orderBy(desc(calculatorResults.createdAt));
  }

  async getLatestCalculatorResult(userId: string, type: string): Promise<CalculatorResult | undefined> {
    const [result] = await db
      .select()
      .from(calculatorResults)
      .where(and(eq(calculatorResults.userId, userId), eq(calculatorResults.calculatorType, type)))
      .orderBy(desc(calculatorResults.createdAt))
      .limit(1);
    return result;
  }

  // Calculator Profiles (Lead Capture)
  async upsertCalculatorProfile(email: string, data: Partial<InsertCalculatorProfile>): Promise<CalculatorProfile> {
    const existing = await this.getCalculatorProfileByEmail(email);
    if (existing) {
      const [updated] = await db
        .update(calculatorProfiles)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(calculatorProfiles.email, email))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(calculatorProfiles)
      .values({ ...data, email } as InsertCalculatorProfile)
      .returning();
    return created;
  }

  async getCalculatorProfileByEmail(email: string): Promise<CalculatorProfile | undefined> {
    const [result] = await db
      .select()
      .from(calculatorProfiles)
      .where(eq(calculatorProfiles.email, email))
      .limit(1);
    return result;
  }

  // Homeownership Goals (Aspiring Owner Journey)
  async getHomeownershipGoal(userId: string): Promise<HomeownershipGoal | undefined> {
    const [goal] = await db
      .select()
      .from(homeownershipGoals)
      .where(eq(homeownershipGoals.userId, userId));
    return goal;
  }

  async createHomeownershipGoal(data: InsertHomeownershipGoal): Promise<HomeownershipGoal> {
    const [goal] = await db
      .insert(homeownershipGoals)
      .values(data)
      .returning();
    return goal;
  }

  async updateHomeownershipGoal(userId: string, data: Partial<HomeownershipGoal>): Promise<HomeownershipGoal | undefined> {
    const { id, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(homeownershipGoals)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(homeownershipGoals.userId, userId))
      .returning();
    return updated;
  }

  // Credit Actions
  async getCreditActions(goalId: string): Promise<CreditAction[]> {
    return await db
      .select()
      .from(creditActions)
      .where(eq(creditActions.goalId, goalId))
      .orderBy(desc(creditActions.priority), asc(creditActions.createdAt));
  }

  async createCreditAction(data: InsertCreditAction): Promise<CreditAction> {
    const [action] = await db
      .insert(creditActions)
      .values(data)
      .returning();
    return action;
  }

  async updateCreditAction(id: string, data: Partial<CreditAction>): Promise<CreditAction | undefined> {
    const { id: actionId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(creditActions)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(creditActions.id, id))
      .returning();
    return updated;
  }

  // Savings Transactions
  async getSavingsTransactions(goalId: string): Promise<SavingsTransaction[]> {
    return await db
      .select()
      .from(savingsTransactions)
      .where(eq(savingsTransactions.goalId, goalId))
      .orderBy(desc(savingsTransactions.createdAt));
  }

  async createSavingsTransaction(data: InsertSavingsTransaction): Promise<SavingsTransaction> {
    const [transaction] = await db
      .insert(savingsTransactions)
      .values(data)
      .returning();
    return transaction;
  }

  // Journey Milestones
  async getJourneyMilestones(goalId: string): Promise<JourneyMilestone[]> {
    return await db
      .select()
      .from(journeyMilestones)
      .where(eq(journeyMilestones.goalId, goalId))
      .orderBy(desc(journeyMilestones.achievedAt));
  }

  async createJourneyMilestone(data: InsertJourneyMilestone): Promise<JourneyMilestone> {
    const [milestone] = await db
      .insert(journeyMilestones)
      .values(data)
      .returning();
    return milestone;
  }

  // Application Invites
  async createApplicationInvite(data: InsertApplicationInvite): Promise<ApplicationInvite> {
    const [invite] = await db
      .insert(applicationInvites)
      .values(data)
      .returning();
    return invite;
  }

  async getApplicationInviteByToken(token: string): Promise<ApplicationInvite | undefined> {
    const [invite] = await db
      .select()
      .from(applicationInvites)
      .where(eq(applicationInvites.token, token));
    return invite;
  }

  async getApplicationInvitesByReferrer(referrerId: string): Promise<ApplicationInvite[]> {
    return await db
      .select()
      .from(applicationInvites)
      .where(eq(applicationInvites.referrerId, referrerId))
      .orderBy(desc(applicationInvites.createdAt));
  }

  async updateApplicationInvite(id: string, data: Partial<ApplicationInvite>): Promise<ApplicationInvite | undefined> {
    const { id: inviteId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(applicationInvites)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(applicationInvites.id, id))
      .returning();
    return updated;
  }

  // ===== RATE LOCKS =====
  async createRateLock(data: InsertRateLock): Promise<RateLock> {
    const [lock] = await db.insert(rateLocks).values(data).returning();
    return lock;
  }

  async getRateLock(id: string): Promise<RateLock | undefined> {
    const [lock] = await db.select().from(rateLocks).where(eq(rateLocks.id, id));
    return lock;
  }

  async getRateLocksByApplication(applicationId: string): Promise<RateLock[]> {
    return await db
      .select()
      .from(rateLocks)
      .where(eq(rateLocks.applicationId, applicationId))
      .orderBy(desc(rateLocks.createdAt));
  }

  async getActiveRateLock(applicationId: string): Promise<RateLock | undefined> {
    const [lock] = await db
      .select()
      .from(rateLocks)
      .where(and(eq(rateLocks.applicationId, applicationId), eq(rateLocks.status, "active")));
    return lock;
  }

  async updateRateLock(id: string, data: Partial<RateLock>): Promise<RateLock | undefined> {
    const { id: lockId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(rateLocks)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(rateLocks.id, id))
      .returning();
    return updated;
  }

  async getExpiringRateLocks(withinDays: number): Promise<RateLock[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
    return await db
      .select()
      .from(rateLocks)
      .where(
        and(
          eq(rateLocks.status, "active"),
          gte(rateLocks.expiresAt, now),
          lte(rateLocks.expiresAt, futureDate)
        )
      )
      .orderBy(asc(rateLocks.expiresAt));
  }

  // ===== CONSENT TEMPLATES =====
  async createConsentTemplate(data: InsertConsentTemplate): Promise<ConsentTemplate> {
    const [template] = await db.insert(consentTemplates).values(data).returning();
    return template;
  }

  async getConsentTemplate(id: string): Promise<ConsentTemplate | undefined> {
    const [template] = await db.select().from(consentTemplates).where(eq(consentTemplates.id, id));
    return template;
  }

  async getActiveConsentTemplates(consentType?: string, state?: string): Promise<ConsentTemplate[]> {
    let query = db.select().from(consentTemplates).where(eq(consentTemplates.isActive, true));
    if (consentType) {
      query = db
        .select()
        .from(consentTemplates)
        .where(and(eq(consentTemplates.isActive, true), eq(consentTemplates.consentType, consentType)));
    }
    return await query.orderBy(desc(consentTemplates.effectiveDate));
  }

  async updateConsentTemplate(id: string, data: Partial<ConsentTemplate>): Promise<ConsentTemplate | undefined> {
    const { id: templateId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(consentTemplates)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(consentTemplates.id, id))
      .returning();
    return updated;
  }

  // ===== BORROWER CONSENTS =====
  async createBorrowerConsent(data: InsertBorrowerConsent): Promise<BorrowerConsent> {
    const [consent] = await db.insert(borrowerConsents).values(data).returning();
    return consent;
  }

  async getBorrowerConsent(id: string): Promise<BorrowerConsent | undefined> {
    const [consent] = await db.select().from(borrowerConsents).where(eq(borrowerConsents.id, id));
    return consent;
  }

  async getBorrowerConsentsByUser(userId: string): Promise<BorrowerConsent[]> {
    return await db
      .select()
      .from(borrowerConsents)
      .where(eq(borrowerConsents.userId, userId))
      .orderBy(desc(borrowerConsents.consentedAt));
  }

  async getBorrowerConsentsByApplication(applicationId: string): Promise<BorrowerConsent[]> {
    return await db
      .select()
      .from(borrowerConsents)
      .where(eq(borrowerConsents.applicationId, applicationId))
      .orderBy(desc(borrowerConsents.consentedAt));
  }

  async getConsentByTypeAndApplication(consentType: string, applicationId: string): Promise<BorrowerConsent | undefined> {
    const [consent] = await db
      .select()
      .from(borrowerConsents)
      .where(
        and(
          eq(borrowerConsents.consentType, consentType),
          eq(borrowerConsents.applicationId, applicationId),
          eq(borrowerConsents.isRevoked, false)
        )
      )
      .orderBy(desc(borrowerConsents.consentedAt))
      .limit(1);
    return consent;
  }

  // ===== PARTNER PROVIDERS =====
  async createPartnerProvider(data: InsertPartnerProvider): Promise<PartnerProvider> {
    const [provider] = await db.insert(partnerProviders).values(data).returning();
    return provider;
  }

  async getPartnerProvider(id: string): Promise<PartnerProvider | undefined> {
    const [provider] = await db.select().from(partnerProviders).where(eq(partnerProviders.id, id));
    return provider;
  }

  async getPartnerProviderByCode(code: string): Promise<PartnerProvider | undefined> {
    const [provider] = await db.select().from(partnerProviders).where(eq(partnerProviders.code, code));
    return provider;
  }

  async getPartnerProvidersByServiceType(serviceType: string): Promise<PartnerProvider[]> {
    return await db
      .select()
      .from(partnerProviders)
      .where(and(eq(partnerProviders.serviceType, serviceType), eq(partnerProviders.isActive, true)));
  }

  async getAllPartnerProviders(): Promise<PartnerProvider[]> {
    return await db.select().from(partnerProviders).orderBy(asc(partnerProviders.name));
  }

  async updatePartnerProvider(id: string, data: Partial<PartnerProvider>): Promise<PartnerProvider | undefined> {
    const { id: providerId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(partnerProviders)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(partnerProviders.id, id))
      .returning();
    return updated;
  }

  // ===== PARTNER ORDERS =====
  async createPartnerOrder(data: InsertPartnerOrder): Promise<PartnerOrder> {
    const [order] = await db.insert(partnerOrders).values(data).returning();
    return order;
  }

  async getPartnerOrder(id: string): Promise<PartnerOrder | undefined> {
    const [order] = await db.select().from(partnerOrders).where(eq(partnerOrders.id, id));
    return order;
  }

  async getPartnerOrdersByApplication(applicationId: string): Promise<PartnerOrder[]> {
    return await db
      .select()
      .from(partnerOrders)
      .where(eq(partnerOrders.applicationId, applicationId))
      .orderBy(desc(partnerOrders.createdAt));
  }

  async getPartnerOrdersByStatus(status: string): Promise<PartnerOrder[]> {
    return await db
      .select()
      .from(partnerOrders)
      .where(eq(partnerOrders.status, status))
      .orderBy(asc(partnerOrders.createdAt));
  }

  async updatePartnerOrder(id: string, data: Partial<PartnerOrder>): Promise<PartnerOrder | undefined> {
    const { id: orderId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(partnerOrders)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(partnerOrders.id, id))
      .returning();
    return updated;
  }

  // ===== APPLICATION MILESTONES =====
  async createApplicationMilestone(data: InsertApplicationMilestone): Promise<ApplicationMilestone> {
    const [milestone] = await db.insert(applicationMilestones).values(data).returning();
    return milestone;
  }

  async getApplicationMilestone(applicationId: string): Promise<ApplicationMilestone | undefined> {
    const [milestone] = await db
      .select()
      .from(applicationMilestones)
      .where(eq(applicationMilestones.applicationId, applicationId));
    return milestone;
  }

  async updateApplicationMilestone(applicationId: string, data: Partial<ApplicationMilestone>): Promise<ApplicationMilestone | undefined> {
    const { id, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(applicationMilestones)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(applicationMilestones.applicationId, applicationId))
      .returning();
    return updated;
  }

  async getOrCreateApplicationMilestone(applicationId: string): Promise<ApplicationMilestone> {
    let milestone = await this.getApplicationMilestone(applicationId);
    if (!milestone) {
      milestone = await this.createApplicationMilestone({
        applicationId,
        applicationReceivedAt: new Date(),
      });
    }
    return milestone;
  }

  // ===== SLA CONFIGURATIONS =====
  async createSlaConfiguration(data: InsertSlaConfiguration): Promise<SlaConfiguration> {
    const [config] = await db.insert(slaConfigurations).values(data).returning();
    return config;
  }

  async getActiveSlaConfiguration(loanType?: string): Promise<SlaConfiguration | undefined> {
    const now = new Date();
    let query;
    if (loanType) {
      query = db
        .select()
        .from(slaConfigurations)
        .where(
          and(
            eq(slaConfigurations.isActive, true),
            lte(slaConfigurations.effectiveDate, now),
            or(eq(slaConfigurations.loanType, loanType), sql`${slaConfigurations.loanType} IS NULL`)
          )
        )
        .orderBy(desc(slaConfigurations.effectiveDate))
        .limit(1);
    } else {
      query = db
        .select()
        .from(slaConfigurations)
        .where(and(eq(slaConfigurations.isActive, true), lte(slaConfigurations.effectiveDate, now)))
        .orderBy(desc(slaConfigurations.effectiveDate))
        .limit(1);
    }
    const [config] = await query;
    return config;
  }

  async getAllSlaConfigurations(): Promise<SlaConfiguration[]> {
    return await db.select().from(slaConfigurations).orderBy(desc(slaConfigurations.effectiveDate));
  }

  async updateSlaConfiguration(id: string, data: Partial<SlaConfiguration>): Promise<SlaConfiguration | undefined> {
    const { id: configId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(slaConfigurations)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(slaConfigurations.id, id))
      .returning();
    return updated;
  }

  // ===== ANALYTICS SNAPSHOTS =====
  async createAnalyticsSnapshot(data: InsertAnalyticsSnapshot): Promise<AnalyticsSnapshot> {
    const [snapshot] = await db.insert(analyticsSnapshots).values(data).returning();
    return snapshot;
  }

  async getLatestAnalyticsSnapshot(): Promise<AnalyticsSnapshot | undefined> {
    const [snapshot] = await db
      .select()
      .from(analyticsSnapshots)
      .orderBy(desc(analyticsSnapshots.snapshotDate))
      .limit(1);
    return snapshot;
  }

  async getAnalyticsSnapshots(days: number): Promise<AnalyticsSnapshot[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return await db
      .select()
      .from(analyticsSnapshots)
      .where(gte(analyticsSnapshots.snapshotDate, startDate))
      .orderBy(asc(analyticsSnapshots.snapshotDate));
  }

  // ===== ANALYTICS COMPUTED =====
  async computePipelineMetrics(): Promise<{
    totalApplications: number;
    byStatus: { status: string; count: number }[];
    avgCycleTimeHours: number | null;
    slaComplianceRate: number | null;
    closedVolume: string;
    fundedVolume: string;
  }> {
    const apps = await db.select().from(loanApplications);
    const byStatus: Record<string, number> = {};
    let closedVolume = 0;
    let fundedVolume = 0;

    for (const app of apps) {
      byStatus[app.status] = (byStatus[app.status] || 0) + 1;
      if (app.status === "closed" || app.status === "funded") {
        const amount = parseFloat(app.preApprovalAmount || "0");
        closedVolume += amount;
        if (app.status === "funded") fundedVolume += amount;
      }
    }

    const milestones = await db
      .select()
      .from(applicationMilestones)
      .where(sql`${applicationMilestones.totalCycleTimeHours} IS NOT NULL`);
    
    let avgCycleTime = null;
    if (milestones.length > 0) {
      const total = milestones.reduce((sum, m) => sum + parseFloat(m.totalCycleTimeHours || "0"), 0);
      avgCycleTime = total / milestones.length;
    }

    const slaMet = milestones.filter(m => m.isSlaMet === true).length;
    const slaComplianceRate = milestones.length > 0 ? (slaMet / milestones.length) * 100 : null;

    return {
      totalApplications: apps.length,
      byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      avgCycleTimeHours: avgCycleTime,
      slaComplianceRate,
      closedVolume: closedVolume.toFixed(2),
      fundedVolume: fundedVolume.toFixed(2),
    };
  }

  async getStaffWorkloadMetrics(): Promise<{
    loansPerLO: { userId: string; count: number }[];
    loansPerProcessor: { userId: string; count: number }[];
    loansPerUnderwriter: { userId: string; count: number }[];
  }> {
    const apps = await db.select().from(loanApplications);
    const loByLO: Record<string, number> = {};
    
    for (const app of apps) {
      if (app.referringBrokerId) {
        loByLO[app.referringBrokerId] = (loByLO[app.referringBrokerId] || 0) + 1;
      }
    }

    return {
      loansPerLO: Object.entries(loByLO).map(([userId, count]) => ({ userId, count })),
      loansPerProcessor: [],
      loansPerUnderwriter: [],
    };
  }

  async getBottleneckAnalysis(): Promise<{
    stage: string;
    avgTimeHours: number;
    count: number;
    atRisk: number;
  }[]> {
    const milestones = await db.select().from(applicationMilestones);
    
    const stages = [
      { name: "Document Collection", start: "applicationReceivedAt", end: "documentCollectionCompletedAt" },
      { name: "Processing", start: "submittedToProcessingAt", end: "processingCompletedAt" },
      { name: "Underwriting", start: "submittedToUnderwritingAt", end: "conditionalApprovalAt" },
      { name: "Closing", start: "clearToCloseAt", end: "closedAt" },
    ];

    const analysis = stages.map(stage => {
      const relevantMilestones = milestones.filter(m => {
        const start = (m as any)[stage.start];
        const end = (m as any)[stage.end];
        return start && end;
      });

      let totalHours = 0;
      for (const m of relevantMilestones) {
        const start = new Date((m as any)[stage.start]).getTime();
        const end = new Date((m as any)[stage.end]).getTime();
        totalHours += (end - start) / (1000 * 60 * 60);
      }

      const inProgress = milestones.filter(m => {
        const start = (m as any)[stage.start];
        const end = (m as any)[stage.end];
        return start && !end;
      });

      return {
        stage: stage.name,
        avgTimeHours: relevantMilestones.length > 0 ? totalHours / relevantMilestones.length : 0,
        count: relevantMilestones.length,
        atRisk: inProgress.length,
      };
    });

    return analysis;
  }

  // ============================================
  // Referral Link System Methods
  // ============================================
  
  async generateReferralCode(userId: string): Promise<string> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");
    
    // If user already has a referral code, return it
    if (user.referralCode) {
      return user.referralCode;
    }
    
    // Generate a unique code based on name and random suffix
    const baseName = `${user.firstName || 'LO'}-${user.lastName || 'USER'}`.toUpperCase().replace(/[^A-Z]/g, '');
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const referralCode = `${baseName.substring(0, 8)}-${suffix}`;
    
    // Save to user
    await db.update(users).set({ referralCode }).where(eq(users.id, userId));
    
    return referralCode;
  }
  
  async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.referralCode, referralCode));
    return user;
  }
  
  async setUserReferredBy(userId: string, referringUserId: string): Promise<void> {
    await db.update(users).set({ referredByUserId: referringUserId }).where(eq(users.id, userId));
  }
  
  async getReferralsByUser(userId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.referredByUserId, userId));
  }
  
  async getReferralStats(userId: string): Promise<{
    totalReferrals: number;
    referralsThisMonth: number;
    activeApplications: number;
    closedLoans: number;
  }> {
    // Get all users referred by this user
    const referredUsers = await this.getReferralsByUser(userId);
    const referredUserIds = referredUsers.map(u => u.id);
    
    if (referredUserIds.length === 0) {
      return { totalReferrals: 0, referralsThisMonth: 0, activeApplications: 0, closedLoans: 0 };
    }
    
    // Count referrals this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const referralsThisMonth = referredUsers.filter(u => 
      u.createdAt && new Date(u.createdAt) >= startOfMonth
    ).length;
    
    // Get applications from referred users
    const applications = await db.select()
      .from(loanApplications)
      .where(sql`${loanApplications.userId} = ANY(${referredUserIds})`);
    
    const activeStatuses = ['draft', 'submitted', 'analyzing', 'pre_approved', 'verified', 'underwriting', 'approved'];
    const activeApplications = applications.filter(a => activeStatuses.includes(a.status)).length;
    const closedLoans = applications.filter(a => a.status === 'closed').length;
    
    return {
      totalReferrals: referredUsers.length,
      referralsThisMonth,
      activeApplications,
      closedLoans,
    };
  }

  // ============================================
  // Team Messaging Methods
  // ============================================
  
  async sendMessage(data: InsertTeamMessage): Promise<TeamMessage> {
    const [message] = await db.insert(teamMessages).values(data).returning();
    return message;
  }
  
  async getMessages(userId: string, otherUserId: string): Promise<TeamMessage[]> {
    return db.select()
      .from(teamMessages)
      .where(
        or(
          and(
            eq(teamMessages.senderId, userId),
            eq(teamMessages.recipientId, otherUserId)
          ),
          and(
            eq(teamMessages.senderId, otherUserId),
            eq(teamMessages.recipientId, userId)
          )
        )
      )
      .orderBy(asc(teamMessages.createdAt));
  }
  
  async getConversations(userId: string): Promise<{
    partnerId: string;
    lastMessage: TeamMessage;
    unreadCount: number;
  }[]> {
    // Get all messages involving the user
    const messages = await db.select()
      .from(teamMessages)
      .where(
        or(
          eq(teamMessages.senderId, userId),
          eq(teamMessages.recipientId, userId)
        )
      )
      .orderBy(desc(teamMessages.createdAt));
    
    // Group by conversation partner
    const conversationMap = new Map<string, { lastMessage: TeamMessage; unreadCount: number }>();
    
    for (const msg of messages) {
      const partnerId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      
      if (!conversationMap.has(partnerId)) {
        // Count unread messages from this partner
        const unreadCount = messages.filter(
          m => m.senderId === partnerId && m.recipientId === userId && !m.isRead
        ).length;
        
        conversationMap.set(partnerId, {
          lastMessage: msg,
          unreadCount,
        });
      }
    }
    
    return Array.from(conversationMap.entries()).map(([partnerId, data]) => ({
      partnerId,
      ...data,
    }));
  }
  
  async markMessagesAsRead(userId: string, senderId: string): Promise<void> {
    await db.update(teamMessages)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(teamMessages.recipientId, userId),
          eq(teamMessages.senderId, senderId),
          eq(teamMessages.isRead, false)
        )
      );
  }
  
  async getUnreadMessageCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(teamMessages)
      .where(
        and(
          eq(teamMessages.recipientId, userId),
          eq(teamMessages.isRead, false)
        )
      );
    return result[0]?.count || 0;
  }
  
  async getStaffUsersForTeamDisplay(): Promise<User[]> {
    // Get all staff users who can be part of a borrower's team
    return db.select()
      .from(users)
      .where(
        or(
          eq(users.role, 'lo'),
          eq(users.role, 'loa'),
          eq(users.role, 'processor'),
          eq(users.role, 'underwriter'),
          eq(users.role, 'closer'),
          eq(users.role, 'admin')
        )
      );
  }
  
  // ============================================
  // Presence Tracking Methods
  // ============================================
  
  async updateUserPresence(userId: string): Promise<void> {
    await db.update(users)
      .set({ lastActiveAt: new Date() })
      .where(eq(users.id, userId));
  }
  
  async getUserPresenceStatus(userId: string): Promise<'online' | 'away' | 'offline'> {
    const [user] = await db.select({ lastActiveAt: users.lastActiveAt })
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user?.lastActiveAt) return 'offline';
    
    const now = new Date();
    const lastActive = new Date(user.lastActiveAt);
    const diffMinutes = (now.getTime() - lastActive.getTime()) / 60000;
    
    if (diffMinutes < 2) return 'online';
    if (diffMinutes < 10) return 'away';
    return 'offline';
  }
  
  async getTeamMembersWithPresence(): Promise<(User & { presenceStatus: 'online' | 'away' | 'offline' })[]> {
    const staffUsers = await this.getStaffUsersForTeamDisplay();
    const now = new Date();
    
    return staffUsers.map(user => {
      let presenceStatus: 'online' | 'away' | 'offline' = 'offline';
      
      if (user.lastActiveAt) {
        const lastActive = new Date(user.lastActiveAt);
        const diffMinutes = (now.getTime() - lastActive.getTime()) / 60000;
        
        if (diffMinutes < 2) presenceStatus = 'online';
        else if (diffMinutes < 10) presenceStatus = 'away';
      }
      
      return { ...user, presenceStatus };
    });
  }
  
  // ============================================
  // Document Request Integration
  // ============================================
  
  async updateDocumentRequestStatus(
    messageId: string, 
    status: 'pending' | 'submitted' | 'approved' | 'rejected',
    documentId?: string
  ): Promise<TeamMessage | null> {
    const [message] = await db.select().from(teamMessages).where(eq(teamMessages.id, messageId));
    
    if (!message || message.messageType !== 'document_request') {
      return null;
    }
    
    const requestData = message.documentRequestData as any;
    if (!requestData) return null;
    
    const updatedData = {
      ...requestData,
      status,
      documentId: documentId || requestData.documentId,
    };
    
    const [updated] = await db.update(teamMessages)
      .set({ documentRequestData: updatedData })
      .where(eq(teamMessages.id, messageId))
      .returning();
    
    return updated;
  }
  
  async getPendingDocumentRequests(userId: string): Promise<TeamMessage[]> {
    const messages = await db.select()
      .from(teamMessages)
      .where(
        and(
          eq(teamMessages.recipientId, userId),
          eq(teamMessages.messageType, 'document_request')
        )
      )
      .orderBy(desc(teamMessages.createdAt));
    
    // Filter to only pending requests
    return messages.filter(msg => {
      const data = msg.documentRequestData as any;
      return data?.status === 'pending';
    });
  }

  // KBA Sessions
  async createKbaSession(data: InsertKbaSession): Promise<KbaSession> {
    const [session] = await db.insert(kbaSessions).values(data).returning();
    return session;
  }

  async getKbaSession(id: string): Promise<KbaSession | undefined> {
    const [session] = await db.select().from(kbaSessions).where(eq(kbaSessions.id, id));
    return session;
  }

  async getKbaSessionsByUser(userId: string): Promise<KbaSession[]> {
    return db.select().from(kbaSessions).where(eq(kbaSessions.userId, userId)).orderBy(desc(kbaSessions.createdAt));
  }

  async updateKbaSession(id: string, data: Partial<KbaSession>): Promise<KbaSession | undefined> {
    const [updated] = await db.update(kbaSessions).set(data).where(eq(kbaSessions.id, id)).returning();
    return updated;
  }

  // KYC/AML Screenings
  async createKycScreening(data: InsertKycScreening): Promise<KycScreening> {
    const [screening] = await db.insert(kycScreenings).values(data).returning();
    return screening;
  }

  async getKycScreening(id: string): Promise<KycScreening | undefined> {
    const [screening] = await db.select().from(kycScreenings).where(eq(kycScreenings.id, id));
    return screening;
  }

  async getKycScreeningByApplication(applicationId: string): Promise<KycScreening | undefined> {
    const [screening] = await db.select().from(kycScreenings)
      .where(eq(kycScreenings.applicationId, applicationId))
      .orderBy(desc(kycScreenings.createdAt))
      .limit(1);
    return screening;
  }

  async getKycScreeningsByUser(userId: string): Promise<KycScreening[]> {
    return db.select().from(kycScreenings).where(eq(kycScreenings.userId, userId)).orderBy(desc(kycScreenings.createdAt));
  }

  async updateKycScreening(id: string, data: Partial<KycScreening>): Promise<KycScreening | undefined> {
    const [updated] = await db.update(kycScreenings).set({ ...data, updatedAt: new Date() }).where(eq(kycScreenings.id, id)).returning();
    return updated;
  }

  // Onboarding Profiles
  async createOnboardingProfile(data: InsertOnboardingProfile): Promise<OnboardingProfile> {
    const [profile] = await db.insert(onboardingProfiles).values({
      ...data,
      completedSteps: data.completedSteps || [],
    } as any).returning();
    return profile;
  }

  async getOnboardingProfile(id: string): Promise<OnboardingProfile | undefined> {
    const [profile] = await db.select().from(onboardingProfiles).where(eq(onboardingProfiles.id, id));
    return profile;
  }

  async getOnboardingProfileByUser(userId: string): Promise<OnboardingProfile | undefined> {
    const [profile] = await db.select().from(onboardingProfiles)
      .where(eq(onboardingProfiles.userId, userId))
      .orderBy(desc(onboardingProfiles.createdAt))
      .limit(1);
    return profile;
  }

  async updateOnboardingProfile(id: string, data: Partial<OnboardingProfile>): Promise<OnboardingProfile | undefined> {
    const [updated] = await db.update(onboardingProfiles).set({ ...data, updatedAt: new Date() }).where(eq(onboardingProfiles.id, id)).returning();
    return updated;
  }

  // Onboarding Feedback
  async createOnboardingFeedback(data: InsertOnboardingFeedback): Promise<OnboardingFeedback> {
    const [feedback] = await db.insert(onboardingFeedback).values(data).returning();
    return feedback;
  }

  async getOnboardingFeedbackByUser(userId: string): Promise<OnboardingFeedback[]> {
    return db.select().from(onboardingFeedback).where(eq(onboardingFeedback.userId, userId)).orderBy(desc(onboardingFeedback.createdAt));
  }

  // Co-Brand Profiles
  async createCoBrandProfile(data: InsertCoBrandProfile): Promise<CoBrandProfile> {
    const [profile] = await db.insert(coBrandProfiles).values(data).returning();
    return profile;
  }

  async getCoBrandProfile(id: string): Promise<CoBrandProfile | undefined> {
    const [profile] = await db.select().from(coBrandProfiles).where(eq(coBrandProfiles.id, id));
    return profile;
  }

  async getCoBrandProfileByUser(userId: string): Promise<CoBrandProfile | undefined> {
    const [profile] = await db.select().from(coBrandProfiles).where(eq(coBrandProfiles.userId, userId)).limit(1);
    return profile;
  }

  async updateCoBrandProfile(id: string, data: Partial<CoBrandProfile>): Promise<CoBrandProfile | undefined> {
    const [updated] = await db.update(coBrandProfiles).set({ ...data, updatedAt: new Date() }).where(eq(coBrandProfiles.id, id)).returning();
    return updated;
  }

  // Deal Desk
  async createDealDeskThread(data: InsertDealDeskThread): Promise<DealDeskThread> {
    const [thread] = await db.insert(dealDeskThreads).values(data).returning();
    return thread;
  }

  async getDealDeskThread(id: string): Promise<DealDeskThread | undefined> {
    const [thread] = await db.select().from(dealDeskThreads).where(eq(dealDeskThreads.id, id));
    return thread;
  }

  async getDealDeskThreadsByUser(userId: string): Promise<DealDeskThread[]> {
    return db.select().from(dealDeskThreads)
      .where(or(eq(dealDeskThreads.agentUserId, userId), eq(dealDeskThreads.loUserId, userId)))
      .orderBy(desc(dealDeskThreads.createdAt));
  }

  async updateDealDeskThread(id: string, data: Partial<DealDeskThread>): Promise<DealDeskThread | undefined> {
    const [updated] = await db.update(dealDeskThreads).set({ ...data, updatedAt: new Date() }).where(eq(dealDeskThreads.id, id)).returning();
    return updated;
  }

  async createDealDeskMessage(data: InsertDealDeskMessage): Promise<DealDeskMessage> {
    const [message] = await db.insert(dealDeskMessages).values(data).returning();
    return message;
  }

  async getDealDeskMessagesByThread(threadId: string): Promise<DealDeskMessage[]> {
    return db.select().from(dealDeskMessages)
      .where(eq(dealDeskMessages.threadId, threadId))
      .orderBy(dealDeskMessages.createdAt);
  }

  // DPA Programs
  async getDpaPrograms(filters?: { state?: string; firstTimeBuyer?: boolean; minCreditScore?: number; maxIncome?: number }): Promise<DpaProgram[]> {
    let query = db.select().from(dpaPrograms).where(eq(dpaPrograms.isActive, true));
    if (filters?.state) {
      query = db.select().from(dpaPrograms).where(
        and(eq(dpaPrograms.isActive, true), or(eq(dpaPrograms.state, filters.state), sql`${dpaPrograms.state} IS NULL`))
      );
    }
    return query.orderBy(dpaPrograms.name);
  }

  async getDpaProgram(id: string): Promise<DpaProgram | undefined> {
    const [program] = await db.select().from(dpaPrograms).where(eq(dpaPrograms.id, id));
    return program;
  }

  // Agent Pipeline Access
  async getAgentPipeline(agentUserId: string): Promise<AgentPipelineAccess[]> {
    return db.select().from(agentPipelineAccess)
      .where(eq(agentPipelineAccess.agentUserId, agentUserId))
      .orderBy(desc(agentPipelineAccess.createdAt));
  }

  async upsertAgentPipelineAccess(data: InsertAgentPipelineAccess): Promise<AgentPipelineAccess> {
    const [result] = await db
      .insert(agentPipelineAccess)
      .values(data)
      .onConflictDoUpdate({
        target: [agentPipelineAccess.agentUserId, agentPipelineAccess.applicationId],
        set: {
          borrowerName: data.borrowerName,
          currentStage: data.currentStage,
          lastMilestone: data.lastMilestone,
          nextStep: data.nextStep,
          estimatedCloseDate: data.estimatedCloseDate,
          loanAmount: data.loanAmount,
          propertyAddress: data.propertyAddress,
          lastUpdatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  // Deal Rescue Escalations
  async getDealRescueEscalations(filters?: { status?: string; reportedByUserId?: string }): Promise<DealRescueEscalation[]> {
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(dealRescueEscalations.status, filters.status));
    }
    if (filters?.reportedByUserId) {
      conditions.push(eq(dealRescueEscalations.reportedByUserId, filters.reportedByUserId));
    }
    if (conditions.length > 0) {
      return db.select().from(dealRescueEscalations)
        .where(and(...conditions))
        .orderBy(desc(dealRescueEscalations.createdAt));
    }
    return db.select().from(dealRescueEscalations)
      .orderBy(desc(dealRescueEscalations.createdAt));
  }

  async createDealRescueEscalation(data: InsertDealRescueEscalation): Promise<DealRescueEscalation> {
    const [escalation] = await db.insert(dealRescueEscalations).values(data).returning();
    return escalation;
  }

  async updateDealRescueEscalation(id: string, data: Partial<DealRescueEscalation>): Promise<DealRescueEscalation | undefined> {
    const [updated] = await db.update(dealRescueEscalations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(dealRescueEscalations.id, id))
      .returning();
    return updated;
  }

  // Strategy Sessions
  async getStrategySessions(agentUserId: string): Promise<StrategySession[]> {
    return db.select().from(strategySessions)
      .where(eq(strategySessions.agentUserId, agentUserId))
      .orderBy(desc(strategySessions.createdAt));
  }

  async createStrategySession(data: InsertStrategySession): Promise<StrategySession> {
    const [session] = await db.insert(strategySessions).values(data).returning();
    return session;
  }

  async updateStrategySession(id: string, data: Partial<StrategySession>): Promise<StrategySession | undefined> {
    const [updated] = await db.update(strategySessions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(strategySessions.id, id))
      .returning();
    return updated;
  }

  // Accelerator Enrollments
  async getAcceleratorEnrollment(userId: string): Promise<AcceleratorEnrollment | undefined> {
    const [enrollment] = await db.select().from(acceleratorEnrollments)
      .where(eq(acceleratorEnrollments.userId, userId))
      .limit(1);
    return enrollment;
  }

  async createAcceleratorEnrollment(data: InsertAcceleratorEnrollment): Promise<AcceleratorEnrollment> {
    const [enrollment] = await db.insert(acceleratorEnrollments).values(data).returning();
    return enrollment;
  }

  async updateAcceleratorEnrollment(id: string, data: Partial<AcceleratorEnrollment>): Promise<AcceleratorEnrollment | undefined> {
    const [updated] = await db.update(acceleratorEnrollments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(acceleratorEnrollments.id, id))
      .returning();
    return updated;
  }

  // Accelerator Milestones
  async getAcceleratorMilestones(enrollmentId: string): Promise<AcceleratorMilestone[]> {
    return db.select().from(acceleratorMilestones)
      .where(eq(acceleratorMilestones.enrollmentId, enrollmentId))
      .orderBy(desc(acceleratorMilestones.createdAt));
  }

  async createAcceleratorMilestone(data: InsertAcceleratorMilestone): Promise<AcceleratorMilestone> {
    const [milestone] = await db.insert(acceleratorMilestones).values(data).returning();
    return milestone;
  }

  async updateAcceleratorMilestone(id: string, data: Partial<AcceleratorMilestone>): Promise<AcceleratorMilestone | undefined> {
    const [updated] = await db.update(acceleratorMilestones)
      .set(data)
      .where(eq(acceleratorMilestones.id, id))
      .returning();
    return updated;
  }

  // Coaching Sessions
  async getCoachingSessions(enrollmentId: string): Promise<CoachingSession[]> {
    return db.select().from(coachingSessions)
      .where(eq(coachingSessions.enrollmentId, enrollmentId))
      .orderBy(desc(coachingSessions.createdAt));
  }

  async createCoachingSession(data: InsertCoachingSession): Promise<CoachingSession> {
    const [session] = await db.insert(coachingSessions).values(data).returning();
    return session;
  }

  async updateCoachingSession(id: string, data: Partial<CoachingSession>): Promise<CoachingSession | undefined> {
    const [updated] = await db.update(coachingSessions)
      .set(data)
      .where(eq(coachingSessions.id, id))
      .returning();
    return updated;
  }

  // Closing Guarantees
  async getAllClosingGuarantees(): Promise<ClosingGuarantee[]> {
    return db.select().from(closingGuarantees)
      .orderBy(desc(closingGuarantees.createdAt));
  }

  async getClosingGuarantees(applicationId: string): Promise<ClosingGuarantee[]> {
    return db.select().from(closingGuarantees)
      .where(eq(closingGuarantees.applicationId, applicationId))
      .orderBy(desc(closingGuarantees.createdAt));
  }

  async createClosingGuarantee(data: InsertClosingGuarantee): Promise<ClosingGuarantee> {
    const [guarantee] = await db.insert(closingGuarantees).values(data).returning();
    return guarantee;
  }

  async updateClosingGuarantee(id: string, data: Partial<ClosingGuarantee>): Promise<ClosingGuarantee | undefined> {
    const [updated] = await db.update(closingGuarantees)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(closingGuarantees.id, id))
      .returning();
    return updated;
  }

  // Homeowner Profiles
  async getHomeownerProfile(userId: string): Promise<HomeownerProfile | undefined> {
    const [profile] = await db.select().from(homeownerProfiles)
      .where(eq(homeownerProfiles.userId, userId))
      .limit(1);
    return profile;
  }

  async createHomeownerProfile(data: InsertHomeownerProfile): Promise<HomeownerProfile> {
    const [profile] = await db.insert(homeownerProfiles).values(data).returning();
    return profile;
  }

  async updateHomeownerProfile(id: string, data: Partial<HomeownerProfile>): Promise<HomeownerProfile | undefined> {
    const [updated] = await db.update(homeownerProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(homeownerProfiles.id, id))
      .returning();
    return updated;
  }

  // Refi Alerts
  async getRefiAlerts(homeownerProfileId: string): Promise<RefiAlert[]> {
    return db.select().from(refiAlerts)
      .where(eq(refiAlerts.homeownerProfileId, homeownerProfileId))
      .orderBy(desc(refiAlerts.createdAt));
  }

  async createRefiAlert(data: InsertRefiAlert): Promise<RefiAlert> {
    const [alert] = await db.insert(refiAlerts).values(data).returning();
    return alert;
  }

  async updateRefiAlert(id: string, data: Partial<RefiAlert>): Promise<RefiAlert | undefined> {
    const [updated] = await db.update(refiAlerts)
      .set(data)
      .where(eq(refiAlerts.id, id))
      .returning();
    return updated;
  }

  // Equity Snapshots
  async getEquitySnapshots(homeownerProfileId: string): Promise<EquitySnapshot[]> {
    return db.select().from(equitySnapshots)
      .where(eq(equitySnapshots.homeownerProfileId, homeownerProfileId))
      .orderBy(desc(equitySnapshots.createdAt));
  }

  async createEquitySnapshot(data: InsertEquitySnapshot): Promise<EquitySnapshot> {
    const [snapshot] = await db.insert(equitySnapshots).values(data).returning();
    return snapshot;
  }

  // Notifications
  async createNotification(data: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values(data).returning();
    return notification;
  }

  async getNotificationsByUser(userId: string, limit: number = 50): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.status, "unread")));
    return Number(result[0]?.count || 0);
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications)
      .set({ status: "read" })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ status: "read" })
      .where(and(eq(notifications.userId, userId), eq(notifications.status, "unread")));
  }

  // Staff Invites
  async createStaffInvite(data: InsertStaffInvite): Promise<StaffInvite> {
    const [invite] = await db.insert(staffInvites).values(data).returning();
    return invite;
  }

  async getStaffInviteByCode(code: string): Promise<StaffInvite | undefined> {
    const [invite] = await db.select().from(staffInvites)
      .where(eq(staffInvites.code, code));
    return invite;
  }

  async getStaffInvites(): Promise<StaffInvite[]> {
    return db.select().from(staffInvites)
      .orderBy(desc(staffInvites.createdAt));
  }

  async redeemStaffInvite(code: string, userId: string): Promise<StaffInvite | undefined> {
    const [updated] = await db.update(staffInvites)
      .set({ usedAt: new Date(), usedBy: userId })
      .where(and(eq(staffInvites.code, code), sql`${staffInvites.usedAt} IS NULL`))
      .returning();
    return updated;
  }

  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values(data).returning();
    return log;
  }

  // AI Coach
  async createCoachConversation(data: InsertCoachConversation): Promise<CoachConversation> {
    const [conv] = await db.insert(coachConversations).values(data).returning();
    return conv;
  }

  async getCoachConversationsByUser(userId: string): Promise<CoachConversation[]> {
    return db.select().from(coachConversations)
      .where(eq(coachConversations.userId, userId))
      .orderBy(desc(coachConversations.updatedAt));
  }

  async getCoachConversation(id: string): Promise<CoachConversation | undefined> {
    const [conv] = await db.select().from(coachConversations)
      .where(eq(coachConversations.id, id)).limit(1);
    return conv;
  }

  async updateCoachConversation(id: string, data: Partial<CoachConversation>): Promise<CoachConversation | undefined> {
    const [conv] = await db.update(coachConversations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(coachConversations.id, id))
      .returning();
    return conv;
  }

  async createCoachMessage(data: InsertCoachMessage): Promise<CoachMessage> {
    const [msg] = await db.insert(coachMessages).values(data).returning();
    return msg;
  }

  async getCoachMessages(conversationId: string): Promise<CoachMessage[]> {
    return db.select().from(coachMessages)
      .where(eq(coachMessages.conversationId, conversationId))
      .orderBy(asc(coachMessages.createdAt));
  }

  async countUserCoachMessagesToday(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const convIds = await db.select({ id: coachConversations.id })
      .from(coachConversations)
      .where(eq(coachConversations.userId, userId));

    if (convIds.length === 0) return 0;

    const [result] = await db.select({ value: count() })
      .from(coachMessages)
      .where(and(
        inArray(coachMessages.conversationId, convIds.map(c => c.id)),
        eq(coachMessages.role, "user"),
        gte(coachMessages.createdAt, today),
      ));

    return result?.value ?? 0;
  }

  // Underwriting Rules DSL
  async getUnderwritingRules(filters?: { category?: string; triggerType?: string; isActive?: boolean }): Promise<UnderwritingRuleDsl[]> {
    const conditions = [];
    if (filters?.category) conditions.push(eq(underwritingRulesDsl.category, filters.category));
    if (filters?.triggerType) conditions.push(eq(underwritingRulesDsl.triggerType, filters.triggerType));
    if (filters?.isActive !== undefined) conditions.push(eq(underwritingRulesDsl.isActive, filters.isActive));

    const query = conditions.length > 0
      ? db.select().from(underwritingRulesDsl).where(and(...conditions))
      : db.select().from(underwritingRulesDsl);

    return query.orderBy(asc(underwritingRulesDsl.priority), asc(underwritingRulesDsl.ruleCode));
  }

  async getUnderwritingRule(id: string): Promise<UnderwritingRuleDsl | undefined> {
    const [rule] = await db.select().from(underwritingRulesDsl).where(eq(underwritingRulesDsl.id, id)).limit(1);
    return rule;
  }

  async getUnderwritingRuleByCode(code: string): Promise<UnderwritingRuleDsl | undefined> {
    const [rule] = await db.select().from(underwritingRulesDsl).where(eq(underwritingRulesDsl.ruleCode, code)).limit(1);
    return rule;
  }

  async createUnderwritingRule(data: InsertUnderwritingRuleDsl): Promise<UnderwritingRuleDsl> {
    const [rule] = await db.insert(underwritingRulesDsl).values(data).returning();
    return rule;
  }

  async updateUnderwritingRule(id: string, data: Partial<UnderwritingRuleDsl>): Promise<UnderwritingRuleDsl | undefined> {
    const [rule] = await db.update(underwritingRulesDsl)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(underwritingRulesDsl.id, id))
      .returning();
    return rule;
  }

  async createRuleExecutionLog(data: InsertRuleExecutionLog): Promise<RuleExecutionLog> {
    const [log] = await db.insert(ruleExecutionLog).values(data).returning();
    return log;
  }

  async getRuleExecutionLogs(snapshotId: string): Promise<RuleExecutionLog[]> {
    return db.select().from(ruleExecutionLog)
      .where(eq(ruleExecutionLog.snapshotId, snapshotId))
      .orderBy(asc(ruleExecutionLog.executedAt));
  }

  // Policy Profiles
  async getPolicyProfiles(filters?: { authority?: string; productType?: string; status?: string }): Promise<PolicyProfile[]> {
    const conditions = [];
    if (filters?.authority) conditions.push(eq(policyProfiles.authority, filters.authority));
    if (filters?.productType) conditions.push(eq(policyProfiles.productType, filters.productType));
    if (filters?.status) conditions.push(eq(policyProfiles.status, filters.status));

    const query = conditions.length > 0
      ? db.select().from(policyProfiles).where(and(...conditions))
      : db.select().from(policyProfiles);

    return query.orderBy(desc(policyProfiles.createdAt));
  }

  async getPolicyProfile(id: string): Promise<PolicyProfile | undefined> {
    const [profile] = await db.select().from(policyProfiles).where(eq(policyProfiles.id, id)).limit(1);
    return profile;
  }

  async createPolicyProfile(data: InsertPolicyProfile): Promise<PolicyProfile> {
    const [profile] = await db.insert(policyProfiles).values(data).returning();
    return profile;
  }

  async updatePolicyProfile(id: string, data: Partial<PolicyProfile>): Promise<PolicyProfile | undefined> {
    const [profile] = await db.update(policyProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(policyProfiles.id, id))
      .returning();
    return profile;
  }

  // Policy Thresholds
  async getPolicyThresholds(policyProfileId: string): Promise<PolicyThreshold[]> {
    return db.select().from(policyThresholds)
      .where(eq(policyThresholds.policyProfileId, policyProfileId))
      .orderBy(asc(policyThresholds.displayOrder), asc(policyThresholds.category));
  }

  async getPolicyThreshold(id: string): Promise<PolicyThreshold | undefined> {
    const [threshold] = await db.select().from(policyThresholds).where(eq(policyThresholds.id, id)).limit(1);
    return threshold;
  }

  async createPolicyThreshold(data: InsertPolicyThreshold): Promise<PolicyThreshold> {
    const [threshold] = await db.insert(policyThresholds).values(data).returning();
    return threshold;
  }

  async updatePolicyThreshold(id: string, data: Partial<PolicyThreshold>): Promise<PolicyThreshold | undefined> {
    const [threshold] = await db.update(policyThresholds)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(policyThresholds.id, id))
      .returning();
    return threshold;
  }

  async deletePolicyThreshold(id: string): Promise<boolean> {
    const result = await db.delete(policyThresholds).where(eq(policyThresholds.id, id)).returning();
    return result.length > 0;
  }

  // Policy Approval Workflow
  async createPolicyApproval(data: InsertPolicyApprovalWorkflow): Promise<PolicyApprovalWorkflow> {
    const [approval] = await db.insert(policyApprovalWorkflow).values(data).returning();
    return approval;
  }

  async getPolicyApprovals(policyProfileId: string): Promise<PolicyApprovalWorkflow[]> {
    return db.select().from(policyApprovalWorkflow)
      .where(eq(policyApprovalWorkflow.policyProfileId, policyProfileId))
      .orderBy(desc(policyApprovalWorkflow.createdAt));
  }

  // Policy Lender Overlays
  async getPolicyLenderOverlays(basePolicyProfileId: string): Promise<PolicyLenderOverlay[]> {
    return db.select().from(policyLenderOverlays)
      .where(eq(policyLenderOverlays.basePolicyProfileId, basePolicyProfileId))
      .orderBy(desc(policyLenderOverlays.createdAt));
  }

  async getPolicyLenderOverlay(id: string): Promise<PolicyLenderOverlay | undefined> {
    const [overlay] = await db.select().from(policyLenderOverlays).where(eq(policyLenderOverlays.id, id)).limit(1);
    return overlay;
  }

  async createPolicyLenderOverlay(data: InsertPolicyLenderOverlay): Promise<PolicyLenderOverlay> {
    const [overlay] = await db.insert(policyLenderOverlays).values(data).returning();
    return overlay;
  }

  async updatePolicyLenderOverlay(id: string, data: Partial<PolicyLenderOverlay>): Promise<PolicyLenderOverlay | undefined> {
    const [overlay] = await db.update(policyLenderOverlays)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(policyLenderOverlays.id, id))
      .returning();
    return overlay;
  }

  async deletePolicyLenderOverlay(id: string): Promise<boolean> {
    const result = await db.delete(policyLenderOverlays).where(eq(policyLenderOverlays.id, id)).returning();
    return result.length > 0;
  }

  // Wholesale Lenders
  async getWholesaleLenders(filters?: { status?: string; integrationTier?: string }): Promise<WholesaleLender[]> {
    const conditions = [];
    if (filters?.status) conditions.push(eq(wholesaleLenders.status, filters.status));
    if (filters?.integrationTier) conditions.push(eq(wholesaleLenders.integrationTier, filters.integrationTier));
    return db.select().from(wholesaleLenders)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(wholesaleLenders.lenderName));
  }

  async getWholesaleLender(id: string): Promise<WholesaleLender | undefined> {
    const [lender] = await db.select().from(wholesaleLenders).where(eq(wholesaleLenders.id, id)).limit(1);
    return lender;
  }

  async createWholesaleLender(data: InsertWholesaleLender): Promise<WholesaleLender> {
    const [lender] = await db.insert(wholesaleLenders).values(data).returning();
    return lender;
  }

  async updateWholesaleLender(id: string, data: Partial<WholesaleLender>): Promise<WholesaleLender | undefined> {
    const [lender] = await db.update(wholesaleLenders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(wholesaleLenders.id, id))
      .returning();
    return lender;
  }

  // Rate Sheets
  async getRateSheets(filters?: { lenderId?: string; status?: string }): Promise<RateSheet[]> {
    const conditions = [];
    if (filters?.lenderId) conditions.push(eq(rateSheets.lenderId, filters.lenderId));
    if (filters?.status) conditions.push(eq(rateSheets.status, filters.status));
    return db.select().from(rateSheets)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(rateSheets.effectiveDate));
  }

  async getActiveRateSheets(): Promise<RateSheet[]> {
    const today = new Date().toISOString().split("T")[0];
    return db.select().from(rateSheets)
      .where(and(
        eq(rateSheets.status, "ACTIVE"),
        lte(rateSheets.effectiveDate, today),
        gte(rateSheets.expirationDate, today)
      ))
      .orderBy(desc(rateSheets.effectiveDate));
  }

  async getRateSheet(id: string): Promise<RateSheet | undefined> {
    const [sheet] = await db.select().from(rateSheets).where(eq(rateSheets.id, id)).limit(1);
    return sheet;
  }

  async createRateSheet(data: InsertRateSheet): Promise<RateSheet> {
    const [sheet] = await db.insert(rateSheets).values(data).returning();
    return sheet;
  }

  async updateRateSheet(id: string, data: Partial<RateSheet>): Promise<RateSheet | undefined> {
    const [sheet] = await db.update(rateSheets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rateSheets.id, id))
      .returning();
    return sheet;
  }

  // Rate Sheet Products
  async getRateSheetProducts(rateSheetId: string): Promise<RateSheetProduct[]> {
    return db.select().from(rateSheetProducts)
      .where(eq(rateSheetProducts.rateSheetId, rateSheetId))
      .orderBy(asc(rateSheetProducts.productCode));
  }

  async getRateSheetProduct(id: string): Promise<RateSheetProduct | undefined> {
    const [product] = await db.select().from(rateSheetProducts).where(eq(rateSheetProducts.id, id)).limit(1);
    return product;
  }

  async createRateSheetProduct(data: InsertRateSheetProduct): Promise<RateSheetProduct> {
    const [product] = await db.insert(rateSheetProducts).values(data).returning();
    return product;
  }

  async updateRateSheetProduct(id: string, data: Partial<RateSheetProduct>): Promise<RateSheetProduct | undefined> {
    const [product] = await db.update(rateSheetProducts)
      .set(data)
      .where(eq(rateSheetProducts.id, id))
      .returning();
    return product;
  }

  // Lender Pricing Adjustments
  async getLenderPricingAdjustments(filters?: { lenderId?: string; adjustmentType?: string }): Promise<LenderPricingAdjustment[]> {
    const conditions = [];
    if (filters?.lenderId) conditions.push(eq(lenderPricingAdjustments.lenderId, filters.lenderId));
    if (filters?.adjustmentType) conditions.push(eq(lenderPricingAdjustments.adjustmentType, filters.adjustmentType));
    const today = new Date().toISOString().split("T")[0];
    conditions.push(lte(lenderPricingAdjustments.effectiveDate, today));
    conditions.push(or(
      sql`${lenderPricingAdjustments.expirationDate} IS NULL`,
      gte(lenderPricingAdjustments.expirationDate, today)
    )!);
    return db.select().from(lenderPricingAdjustments)
      .where(and(...conditions))
      .orderBy(asc(lenderPricingAdjustments.adjustmentType));
  }

  async createLenderPricingAdjustment(data: InsertLenderPricingAdjustment): Promise<LenderPricingAdjustment> {
    const [adj] = await db.insert(lenderPricingAdjustments).values(data).returning();
    return adj;
  }

  async updateLenderPricingAdjustment(id: string, data: Partial<LenderPricingAdjustment>): Promise<LenderPricingAdjustment | undefined> {
    const [adj] = await db.update(lenderPricingAdjustments)
      .set(data)
      .where(eq(lenderPricingAdjustments.id, id))
      .returning();
    return adj;
  }

  // Lender Offers
  async getLenderOffers(filters?: { applicationId?: string; lenderId?: string; status?: string }): Promise<LenderOffer[]> {
    const conditions = [];
    if (filters?.applicationId) conditions.push(eq(lenderOffers.applicationId, filters.applicationId));
    if (filters?.lenderId) conditions.push(eq(lenderOffers.lenderId, filters.lenderId));
    if (filters?.status) conditions.push(eq(lenderOffers.status, filters.status));
    return db.select().from(lenderOffers)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(lenderOffers.createdAt));
  }

  async getLenderOffer(id: string): Promise<LenderOffer | undefined> {
    const [offer] = await db.select().from(lenderOffers).where(eq(lenderOffers.id, id)).limit(1);
    return offer;
  }

  async createLenderOffer(data: InsertLenderOffer): Promise<LenderOffer> {
    const [offer] = await db.insert(lenderOffers).values(data).returning();
    return offer;
  }

  async updateLenderOffer(id: string, data: Partial<LenderOffer>): Promise<LenderOffer | undefined> {
    const [offer] = await db.update(lenderOffers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(lenderOffers.id, id))
      .returning();
    return offer;
  }
}

export const storage = new DatabaseStorage();
