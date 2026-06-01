/**
 * MISMO 3.4 Reference Model TypeScript Types
 * 
 * Implements the hierarchical container structure for mortgage loan data exchange
 * following the Mortgage Industry Standards Maintenance Organization (MISMO) 3.4 specification.
 * 
 * Supports ULDD Phase 5 requirements effective July 28, 2025
 */

export const MISMO_NAMESPACE = "http://www.mismo.org/residential/2009/schemas";
export const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";
export const XSI_NAMESPACE = "http://www.w3.org/2001/XMLSchema-instance";

export interface MISMOMessage {
  aboutVersions?: AboutVersions;
  dealSets: DealSets;
}

export interface AboutVersions {
  aboutVersion: AboutVersion[];
}

export interface AboutVersion {
  createdDatetime?: string;
  dataVersionIdentifier?: string;
  dataVersionName?: string;
}

export interface DealSets {
  dealSet: DealSet[];
}

export interface DealSet {
  deals: Deals;
  parties?: Parties;
}

export interface Deals {
  deal: Deal[];
}

export interface Deal {
  collaterals?: Collaterals;
  loans: Loans;
  parties: Parties;
  assets?: Assets;
  liabilities?: Liabilities;
  services?: Services;
}

export interface Collaterals {
  collateral: Collateral[];
}

export interface Collateral {
  subjectProperty: SubjectProperty;
  propertyValuation?: PropertyValuation;
}

export interface SubjectProperty {
  address: Address;
  propertyDetail: PropertyDetail;
  salesContractDetail?: SalesContractDetail;
  legalDescriptions?: LegalDescriptions;
}

export interface Address {
  addressLineText?: string;
  addressUnitIdentifier?: string;
  cityName: string;
  countryCode?: string;
  countyName?: string;
  postalCode: string;
  stateCode: string;
  addressType?: string;
}

export interface PropertyDetail {
  propertyEstimatedValueAmount?: number;
  propertyCurrentUsageType?: string;
  propertyUsageType: PropertyUsageType;
  constructionMethodType?: string;
  propertyExistingCleanEnergyLienIndicator?: boolean;
  attachmentType?: string;
  projectDesignType?: string;
  propertyStructureBuiltYear?: number;
  financeEntitlementEndorsedByVAIndicator?: boolean;
  nativeAmericanLandsType?: string;
}

export type PropertyUsageType = 
  | "PrimaryResidence"
  | "SecondHome"
  | "Investment";

export interface SalesContractDetail {
  salesContractAmount?: number;
  realPropertyAmount?: number;
  personalPropertyIncludedIndicator?: boolean;
  personalPropertyAmount?: number;
}

export interface LegalDescriptions {
  legalDescription: LegalDescription[];
}

export interface LegalDescription {
  legalDescriptionText: string;
  legalDescriptionType?: string;
}

export interface PropertyValuation {
  propertyValuationDetail: PropertyValuationDetail;
  propertyDeferredMaintenanceDetail?: PropertyDeferredMaintenanceDetail;
}

export interface PropertyValuationDetail {
  appraisalIdentifier?: string;
  propertyValuationAmount?: number;
  propertyValuationMethodType?: string;
  appraisalCompletedDate?: string;
}

export interface PropertyDeferredMaintenanceDetail {
  propertyDeferredMaintenanceCostAmount?: number;
}

export interface Loans {
  loan: Loan[];
}

export interface Loan {
  loanIdentifiers: LoanIdentifiers;
  loanDetail: LoanDetail;
  termsOfLoan: TermsOfLoan;
  amortization?: Amortization;
  adjustment?: Adjustment;
  buydown?: Buydown;
  closingInformation?: ClosingInformation;
  construction?: Construction;
  documentSpecificDataSets?: DocumentSpecificDataSets;
  escrow?: Escrow;
  foreclosurePrevention?: ForeclosurePrevention;
  governmentLoan?: GovernmentLoan;
  hmdaLoan?: HmdaLoan;
  housingExpenses?: HousingExpenses;
  integratedDisclosure?: IntegratedDisclosure;
  interestOnly?: InterestOnly;
  lateChargeRules?: LateChargeRules;
  loanLevelCredit?: LoanLevelCredit;
  loanProductData?: LoanProductData;
  loanPrograms?: LoanPrograms;
  loanState?: LoanState;
  maturityRule?: MaturityRule;
  mersRegistration?: MersRegistration;
  miDataDetail?: MiDataDetail;
  negativAmortization?: NegativeAmortization;
  originationSystems?: OriginationSystems;
  payment?: Payment;
  prepaymentPenalty?: PrepaymentPenalty;
  qualification?: Qualification;
  rateLock?: RateLock;
  refinance?: Refinance;
  reverseMortgage?: ReverseMortgage;
  servicing?: Servicing;
  underwriting?: Underwriting;
  extension?: MISMOExtension;
}

export interface LoanIdentifiers {
  loanIdentifier: LoanIdentifier[];
}

export interface LoanIdentifier {
  loanIdentifier: string;
  loanIdentifierType: LoanIdentifierType;
}

export type LoanIdentifierType = 
  | "LenderLoan"
  | "MERS_MIN"
  | "UniversalLoanIdentifier"
  | "SellerLoan"
  | "InvestorLoan"
  | "AgencyCase";

export interface LoanDetail {
  applicationReceivedDate?: string;
  balloonIndicator?: boolean;
  balloonPaymentAmount?: number;
  belowMarketSubordinateFinancingIndicator?: boolean;
  buydownTemporarySubsidyFundingIndicator?: boolean;
  constructionLoanIndicator?: boolean;
  constructionToPermanentClosingType?: string;
  conversionOfContractForDeedIndicator?: boolean;
  energyRelatedImprovementsIndicator?: boolean;
  escrowAbsenceReasonType?: string;
  assumabilityIndicator?: boolean;
  loanMaturityDate?: string;
  loanMaturityPeriodCount?: number;
  loanMaturityPeriodType?: string;
  lienPriorityType?: LienPriorityType;
  loanPurposeType: LoanPurposeType;
  mortgageType: MortgageType;
  noteAmount: number;
  noteDate?: string;
  noteRatePercent?: number;
  totalSubordinateFinancingAmount?: number;
}

export type LienPriorityType = 
  | "FirstLien"
  | "SecondLien"
  | "ThirdLien"
  | "FourthLien"
  | "Other";

export type LoanPurposeType = 
  | "Purchase"
  | "Refinance"
  | "ConstructionOnly"
  | "ConstructionToPermanent"
  | "NoCashOutRefinance"
  | "CashOutRefinance"
  | "Other";

export type MortgageType = 
  | "Conventional"
  | "FHA"
  | "USDA"
  | "VA"
  | "Other";

export interface TermsOfLoan {
  baseLoanAmount: number;
  loanAmortizationType: LoanAmortizationType;
  loanAmortizationPeriodCount?: number;
  loanAmortizationPeriodType?: string;
  discountPointsTotalAmount?: number;
  interestRatePercent?: number;
  lenderPaidMortgageInsuranceIndicator?: boolean;
  mortgageInsurancePremiumSourceType?: string;
  notePaymentAmount?: number;
  prorationItemType?: string;
  requestedInterestRatePercent?: number;
  weightedAverageInterestRatePercent?: number;
}

export type LoanAmortizationType = 
  | "Fixed"
  | "AdjustableRate"
  | "GEM"
  | "GPM"
  | "Other";

export interface Amortization {
  amortizationRule: AmortizationRule;
}

export interface AmortizationRule {
  loanAmortizationType: LoanAmortizationType;
  loanAmortizationPeriodCount?: number;
  loanAmortizationPeriodType?: string;
}

export interface Adjustment {
  interestRateAdjustment?: InterestRateAdjustment;
  principalAndInterestPaymentAdjustment?: PrincipalAndInterestPaymentAdjustment;
}

export interface InterestRateAdjustment {
  indexRules?: IndexRules;
  interestRateLifetimeAdjustmentRule?: InterestRateLifetimeAdjustmentRule;
  interestRatePerChangeAdjustmentRules?: InterestRatePerChangeAdjustmentRules;
}

export interface IndexRules {
  indexRule: IndexRule[];
}

export interface IndexRule {
  indexType: string;
  indexMarginPercent?: number;
  indexLeadDaysCount?: number;
  indexLookbackType?: string;
  indexCurrentValuePercent?: number;
}

export interface InterestRateLifetimeAdjustmentRule {
  ceilingRatePercent?: number;
  floorRatePercent?: number;
  firstRateChangeMonthsCount?: number;
  subsequentRateChangeMonthsCount?: number;
}

export interface InterestRatePerChangeAdjustmentRules {
  interestRatePerChangeAdjustmentRule: InterestRatePerChangeAdjustmentRule[];
}

export interface InterestRatePerChangeAdjustmentRule {
  adjustmentRuleType: string;
  perChangeMaximumIncreaseRatePercent?: number;
  perChangeMinimumDecreaseRatePercent?: number;
}

export interface PrincipalAndInterestPaymentAdjustment {
  paymentAdjustmentLifetimeCapAmount?: number;
  paymentAdjustmentLifetimeCapPercent?: number;
}

export interface Buydown {
  buydownOccurrences?: BuydownOccurrences;
  buydownRule?: BuydownRule;
}

export interface BuydownOccurrences {
  buydownOccurrence: BuydownOccurrence[];
}

export interface BuydownOccurrence {
  buydownAdjustedNoteRatePercent?: number;
  buydownChangeFrequencyMonthsCount?: number;
  buydownDurationMonthsCount?: number;
  buydownIncreaseRatePercent?: number;
  buydownInitialEffectiveInterestRatePercent?: number;
}

export interface BuydownRule {
  buydownTemporarySubsidyIndicator?: boolean;
  buydownPermanentIndicator?: boolean;
  buydownContributorType?: string;
  buydownInitialEffectiveInterestRatePercent?: number;
}

export interface ClosingInformation {
  closingInstructionDetail?: ClosingInstructionDetail;
  closingCostFunds?: ClosingCostFunds;
}

export interface ClosingInstructionDetail {
  closingAgentOrderNumberIdentifier?: string;
  closingDate?: string;
  closingType?: string;
  disbursementDate?: string;
  scheduledClosingDate?: string;
}

export interface ClosingCostFunds {
  closingCostFund: ClosingCostFund[];
}

export interface ClosingCostFund {
  fundsAmount?: number;
  fundsSourceType?: string;
  fundsType?: string;
}

export interface Construction {
  constructionLoanTotalTermMonthsCount?: number;
  constructionPeriodNumberOfMonthsCount?: number;
  landAcquiredDate?: string;
  landOriginalCostAmount?: number;
  landscapingNewImprovementsAmount?: number;
  lotAcquiredDate?: string;
  lotOriginalCostAmount?: number;
  structuralAlterationsConversionRenovationsAmount?: number;
}

export interface DocumentSpecificDataSets {
  documentSpecificDataSet: DocumentSpecificDataSet[];
}

export interface DocumentSpecificDataSet {
  ucd?: UCD;
  urla?: URLA;
}

export interface UCD {
  // Uniform Closing Dataset fields
}

export interface URLA {
  // Uniform Residential Loan Application fields
}

export interface Escrow {
  escrowItems?: EscrowItems;
  escrowDetail?: EscrowDetail;
}

export interface EscrowItems {
  escrowItem: EscrowItem[];
}

export interface EscrowItem {
  escrowItemType: string;
  escrowMonthlyPaymentAmount?: number;
  escrowFirstPaymentDate?: string;
}

export interface EscrowDetail {
  escrowIndicator?: boolean;
  escrowWaiverIndicator?: boolean;
}

export interface ForeclosurePrevention {
  // Foreclosure prevention details
}

export interface GovernmentLoan {
  fhaLoan?: FHALoan;
  usdaLoan?: USDALoan;
  vaLoan?: VALoan;
}

export interface FHALoan {
  fhaCaseIdentifier?: string;
  fhaLoanPurposeType?: string;
  fhaEnergyRelatedRepairsOrImprovementsAmount?: number;
  fhaInsuranceProgramType?: string;
  fhaRefinanceAuthorizationType?: string;
  fhaUpfrontMIPremiumAmount?: number;
  fha203kLimitedRepairMonthlyPaymentAmount?: number;
  fha203kRepairEscrowAccountIndicator?: boolean;
  fhaMIPremiumRefundAmount?: number;
  fhaRefinanceAuthorizedApprovedAmount?: number;
}

export interface USDALoan {
  guaranteeFeeAddedToLoanIndicator?: boolean;
  guaranteeFeePercent?: number;
  usdaGuaranteeFeeAmount?: number;
  usdaProgramType?: string;
  usdaSectionOfActType?: string;
}

export interface VALoan {
  vaCaseIdentifier?: string;
  vaEntitlementAmount?: number;
  vaLoanCode?: string;
  vaLoanProcedureType?: string;
  vaResidualIncomeAmount?: number;
  vaBorrowerCoBorrowerMarriedIndicator?: boolean;
  vaFundingFeeExemptIndicator?: boolean;
  vaMaintenanceExpenseMonthlyAmount?: number;
  vaUtilityExpenseMonthlyAmount?: number;
}

export interface HmdaLoan {
  hmdaHoepaStatusType?: string;
  hmdaLoanPurposeType?: string;
  hmdaPreapprovalStatusType?: string;
  hmdaActionType?: string;
  hmdaActionTakenDate?: string;
  hmdaApplicationSubmissionType?: string;
  hmdaConstructionMethodType?: string;
  hmdaDenialReasonType?: string;
  hmdaInitiallyPayableToYourInstitutionIndicator?: boolean;
  hmdaManufacturedHomeLandPropertyInterestType?: string;
  hmdaManufacturedHomeSecuredPropertyType?: string;
  hmdaMultifamilyAffordableUnitsCount?: number;
  hmdaNegativeAmortizationIndicator?: boolean;
  hmdaOtherNonAmortizingFeaturesIndicator?: boolean;
  hmdaRateSpreadPercent?: number;
  hmdaTotalLoanCostsAmount?: number;
  hmdaTotalPointsAndFeesAmount?: number;
}

export interface HousingExpenses {
  housingExpense: HousingExpense[];
}

export interface HousingExpense {
  housingExpensePaymentAmount: number;
  housingExpenseTimingType: string;
  housingExpenseType: string;
}

export interface IntegratedDisclosure {
  integratedDisclosureSectionSummaries?: IntegratedDisclosureSectionSummaries;
  integratedDisclosureDetail?: IntegratedDisclosureDetail;
}

export interface IntegratedDisclosureSectionSummaries {
  integratedDisclosureSectionSummary: IntegratedDisclosureSectionSummary[];
}

export interface IntegratedDisclosureSectionSummary {
  integratedDisclosureSectionTotalAmount?: number;
  integratedDisclosureSectionType?: string;
  integratedDisclosureSubsectionPayments?: IntegratedDisclosureSubsectionPayments;
}

export interface IntegratedDisclosureSubsectionPayments {
  integratedDisclosureSubsectionPayment: IntegratedDisclosureSubsectionPayment[];
}

export interface IntegratedDisclosureSubsectionPayment {
  integratedDisclosureSubsectionPaymentAmount?: number;
  integratedDisclosureSubsectionType?: string;
  paymentPaidByType?: string;
}

export interface IntegratedDisclosureDetail {
  closingDisclosureExpirationDate?: string;
  closingDisclosureIndicator?: boolean;
  firstPaymentDateAfterInterestOnlyPeriod?: string;
  initialEscrowPaymentClosingAmount?: number;
  loanEstimateExpirationDate?: string;
  totalPaymentsMIPFundingFeeFinancedAmount?: number;
}

export interface InterestOnly {
  interestOnlyTermMonthsCount?: number;
}

export interface LateChargeRules {
  lateChargeRule: LateChargeRule[];
}

export interface LateChargeRule {
  lateChargeAmount?: number;
  lateChargeGracePeriodDaysCount?: number;
  lateChargeRatePercent?: number;
  lateChargeType?: string;
}

export interface LoanLevelCredit {
  loanLevelCreditDetail?: LoanLevelCreditDetail;
  creditScoreModels?: CreditScoreModels;
}

export interface LoanLevelCreditDetail {
  creditRepositorySourceIndicator?: boolean;
  creditReportIdentifier?: string;
  creditReportFirstIssuedDate?: string;
  creditReportOrderedDate?: string;
}

export interface CreditScoreModels {
  creditScoreModel: CreditScoreModel[];
}

export interface CreditScoreModel {
  creditScoreModelNameType?: string;
  creditScoreCategoryScoredType?: string;
  creditScoreValue?: number;
}

export interface LoanProductData {
  loanProductDataDetail?: LoanProductDataDetail;
  loanFeatures?: LoanFeatures;
}

export interface LoanProductDataDetail {
  loanProductNameDescription?: string;
  disclosedFullyIndexedRatePercent?: number;
}

export interface LoanFeatures {
  loanFeature: LoanFeature[];
}

export interface LoanFeature {
  loanFeatureType?: string;
  loanFeatureValue?: string;
}

export interface LoanPrograms {
  loanProgram: LoanProgram[];
}

export interface LoanProgram {
  loanProgramName?: string;
  loanProgramType?: string;
}

export interface LoanState {
  loanStateType?: string;
  loanStateDate?: string;
}

export interface MaturityRule {
  loanMaturityPeriodCount?: number;
  loanMaturityPeriodType?: string;
}

export interface MersRegistration {
  mersMinIdentifier: string;
  mersOrganizationIdentifier: string;
  mersRegistrationStatusType?: string;
}

export interface MiDataDetail {
  miCertificateIdentifier?: string;
  miCompanyNameType?: string;
  miCoveragePercent?: number;
  miPremiumAmount?: number;
  miPremiumRatePercent?: number;
  miPremiumSourceType?: string;
  miPremiumPaymentType?: string;
  miScheduledTerminationDate?: string;
  miInitialPremiumAmount?: number;
  miInitialPremiumAtClosingType?: string;
}

export interface NegativeAmortization {
  negativeAmortizationType?: string;
  negativeAmortizationLimitPercent?: number;
  negativeAmortizationMaximumLoanBalanceAmount?: number;
}

export interface OriginationSystems {
  originationSystem: OriginationSystem[];
}

export interface OriginationSystem {
  loanOriginationSystemName?: string;
  loanOriginationSystemVersion?: string;
}

export interface Payment {
  paymentRule?: PaymentRule;
}

export interface PaymentRule {
  initialPrincipalAndInterestPaymentAmount?: number;
  paymentFrequencyType?: string;
  finalPaymentAmount?: number;
  firstPaymentDate?: string;
  fullyIndexedInitialPrincipalAndInterestPaymentAmount?: number;
  partialPaymentAllowedIndicator?: boolean;
  paymentOptionIndicator?: boolean;
  scheduledFirstPaymentDate?: string;
}

export interface PrepaymentPenalty {
  prepaymentPenaltyExpirationDate?: string;
  prepaymentPenaltyExpirationMonthsCount?: number;
  prepaymentPenaltyIndicator?: boolean;
  prepaymentPenaltyMaximumLifeOfLoanAmount?: number;
  prepaymentPenaltyType?: string;
}

export interface Qualification {
  qualificationDetail?: QualificationDetail;
}

export interface QualificationDetail {
  proposedMonthlyPaymentIncludingTaxesAndInsuranceAmount?: number;
  totalMonthlyProposedHousingExpenseAmount?: number;
  combinedLoanToValueRatioPercent?: number;
  loanToValueRatioPercent?: number;
  debtIncomeRatioPercent?: number;
  housingExpenseToIncomeRatioPercent?: number;
  totalMortgageMonthlyPaymentAmount?: number;
  totalNonMortgageMonthlyPaymentAmount?: number;
}

export interface RateLock {
  rateLockDetail?: RateLockDetail;
}

export interface RateLockDetail {
  rateLockAgreementRequestedIndicator?: boolean;
  rateLockExpirationDate?: string;
  rateLockInterestRatePercent?: number;
}

export interface Refinance {
  refinanceCashOutDeterminationType?: string;
  refinancePrimaryPurposeType?: string;
  refinanceSameLenderIndicator?: boolean;
  constructionRefinanceIndicator?: boolean;
  refinancingCreditorType?: string;
  refinanceProgramType?: string;
}

export interface ReverseMortgage {
  // Reverse mortgage specific fields
}

export interface Servicing {
  servicerLoanIdentifier?: string;
}

export interface Underwriting {
  underwritingDetail?: UnderwritingDetail;
  automatedUnderwritings?: AutomatedUnderwritings;
}

export interface UnderwritingDetail {
  underwritingDecisionType?: string;
  underwritingMethodType?: string;
  underwriterName?: string;
  underwritingDecisionDate?: string;
}

export interface AutomatedUnderwritings {
  automatedUnderwriting: AutomatedUnderwriting[];
}

export interface AutomatedUnderwriting {
  automatedUnderwritingResultType?: string;
  automatedUnderwritingSystemType?: string;
  automatedUnderwritingCaseIdentifier?: string;
}

export interface Parties {
  party: Party[];
}

export interface Party {
  individual?: Individual;
  legalEntity?: LegalEntity;
  addresses?: PartyAddresses;
  roles: Roles;
  taxpayerIdentifiers?: TaxpayerIdentifiers;
  contacts?: Contacts;
}

export interface Individual {
  name: Name;
  contactPoints?: ContactPoints;
}

export interface Name {
  firstNameText: string;
  middleNameText?: string;
  lastNameText: string;
  suffixText?: string;
  fullName?: string;
}

export interface ContactPoints {
  contactPoint: ContactPoint[];
}

export interface ContactPoint {
  contactPointEmailValue?: string;
  contactPointTelephoneValue?: string;
  contactPointRoleType?: string;
}

export interface LegalEntity {
  legalEntityDetail?: LegalEntityDetail;
}

export interface LegalEntityDetail {
  fullName: string;
  legalEntityType?: string;
}

export interface PartyAddresses {
  address: PartyAddress[];
}

export interface PartyAddress extends Address {
  addressType?: string;
  borrowerResidencyBasisType?: string;
  borrowerResidencyDurationMonthsCount?: number;
  borrowerResidencyDurationYearsCount?: number;
  borrowerResidencyType?: string;
}

export interface Roles {
  role: Role[];
}

export interface Role {
  borrower?: Borrower;
  roleDetail: RoleDetail;
  lender?: Lender;
  broker?: Broker;
  appraiser?: Appraiser;
  titleHolder?: TitleHolder;
}

export interface Borrower {
  borrowerDetail?: BorrowerDetail;
  currentIncome?: CurrentIncome;
  declaration?: Declaration;
  dependents?: Dependents;
  employers?: Employers;
  governmentMonitoring?: GovernmentMonitoring;
  militaryServices?: MilitaryServices;
  residences?: Residences;
  creditScores?: CreditScores;
}

export interface BorrowerDetail {
  borrowerBirthDate?: string;
  borrowerMailToAddressSameAsPropertyIndicator?: boolean;
  borrowerSSNIdentifier?: string;
  borrowerClassificationType?: BorrowerClassificationType;
  creditReportAuthorizationIndicator?: boolean;
  domesticRelationshipIndicator?: boolean;
  homeownerPastThreeYearsType?: string;
  intentToOccupyType?: string;
  jointAssetLiabilityReportingType?: string;
  maritalStatusType?: MaritalStatusType;
  priorPropertyTitleType?: string;
  priorPropertyUsageType?: string;
  selfDeclaredMilitaryServiceIndicator?: boolean;
  unmarriedAddendumRequiredIndicator?: boolean;
}

export type BorrowerClassificationType = 
  | "Primary"
  | "Secondary"
  | "CoMaker";

export type MaritalStatusType = 
  | "Married"
  | "Separated"
  | "Unmarried";

export interface CurrentIncome {
  currentIncomeItems?: CurrentIncomeItems;
}

export interface CurrentIncomeItems {
  currentIncomeItem: CurrentIncomeItem[];
}

export interface CurrentIncomeItem {
  currentIncomeMonthlyTotalAmount?: number;
  employmentIncomeIndicator?: boolean;
  incomeType: string;
}

export interface Declaration {
  alimonyChildSupportObligationIndicator?: boolean;
  bankruptcyIndicator?: boolean;
  borrowedDownPaymentIndicator?: boolean;
  coSignerUndisclosedLoanIndicator?: boolean;
  homeownerPastThreeYearsIndicator?: boolean;
  intentToOccupyIndicator?: boolean;
  judgmentAgainstIndicator?: boolean;
  loanForeclosureIndicator?: boolean;
  otherLoanOnPropertyIndicator?: boolean;
  outstandingJudgmentsIndicator?: boolean;
  partyToLawsuitIndicator?: boolean;
  presentDelinquentCreditIndicator?: boolean;
  priorPropertyForeclosureCompletedIndicator?: boolean;
  priorPropertyShortSaleCompletedIndicator?: boolean;
  priorPropertyDeedInLieuCompletedIndicator?: boolean;
  propertyProposedCleanEnergyLienIndicator?: boolean;
  undisclosedBorrowedFundsIndicator?: boolean;
  undisclosedMortgageApplicationIndicator?: boolean;
  undisclosedCreditApplicationIndicator?: boolean;
  undisclosedComakerOfNoteIndicator?: boolean;
  usCitizenIndicator?: boolean;
  permanentResidentAlienIndicator?: boolean;
}

export interface Dependents {
  dependentCount?: number;
  dependentAgeYearsCount?: number[];
}

export interface Employers {
  employer: Employer[];
}

export interface Employer {
  employerName?: string;
  employerTelephoneNumber?: string;
  employerType?: string;
  address?: Address;
  employment?: Employment;
}

export interface Employment {
  employmentBorrowerSelfEmployedIndicator?: boolean;
  employmentClassificationType?: string;
  employmentMonthlyIncomeAmount?: number;
  employmentPositionDescription?: string;
  employmentStartDate?: string;
  employmentEndDate?: string;
  employmentStatusType?: string;
  employmentTimeInLineOfWorkMonthsCount?: number;
  employmentTimeInLineOfWorkYearsCount?: number;
  specialBorrowerEmployerRelationshipIndicator?: boolean;
  ownershipInterestType?: string;
}

export interface GovernmentMonitoring {
  hmdaEthnicityType?: string;
  hmdaGenderType?: string;
  hmdaRaceType?: string;
  governmentMonitoringDetail?: GovernmentMonitoringDetail;
}

export interface GovernmentMonitoringDetail {
  hmadEthnicityCollectedBasedOnVisualObservationOrSurnameIndicator?: boolean;
  hmdaRaceCollectedBasedOnVisualObservationOrSurnameIndicator?: boolean;
  hmdaGenderCollectedBasedOnVisualObservationIndicator?: boolean;
}

export interface MilitaryServices {
  militaryService: MilitaryService[];
}

export interface MilitaryService {
  militaryServiceExpectedCompletionDate?: string;
  militaryStatusType?: string;
  branchOfServiceType?: string;
}

export interface Residences {
  residence: Residence[];
}

export interface Residence {
  residenceAddress?: Address;
  residenceDetail?: ResidenceDetail;
}

export interface ResidenceDetail {
  borrowerResidencyBasisType?: string;
  borrowerResidencyDurationMonthsCount?: number;
  borrowerResidencyDurationYearsCount?: number;
  borrowerResidencyType?: string;
}

export interface CreditScores {
  creditScore: CreditScore[];
}

export interface CreditScore {
  creditReportIdentifier?: string;
  creditScoreCategoryType?: string;
  creditScoreDate?: string;
  creditScoreModelNameType?: string;
  creditScoreValue?: number;
}

export interface RoleDetail {
  partyRoleType: PartyRoleType;
  partyRoleIdentifier?: string;
}

export type PartyRoleType = 
  | "Borrower"
  | "NotePayTo"
  | "Originator"
  | "SellTo"
  | "Servicer"
  | "TitleHolder"
  | "Appraiser"
  | "ClosingAgent"
  | "Investor";

export interface Lender {
  lenderDetail?: LenderDetail;
}

export interface LenderDetail {
  lenderNMLSIdentifier?: string;
  lenderName?: string;
}

export interface Broker {
  brokerDetail?: BrokerDetail;
}

export interface BrokerDetail {
  brokerNMLSIdentifier?: string;
  brokerName?: string;
}

export interface Appraiser {
  appraiserDetail?: AppraiserDetail;
}

export interface AppraiserDetail {
  appraiserLicenseIdentifier?: string;
  appraiserLicenseStateCode?: string;
  appraiserName?: string;
}

export interface TitleHolder {
  // Title holder specific fields
}

export interface TaxpayerIdentifiers {
  taxpayerIdentifier: TaxpayerIdentifier[];
}

export interface TaxpayerIdentifier {
  taxpayerIdentifierType?: string;
  taxpayerIdentifierValue: string;
}

export interface Contacts {
  contact: Contact[];
}

export interface Contact {
  contactEmail?: string;
  contactPhone?: string;
  contactType?: string;
}

export interface Assets {
  asset: Asset[];
}

export interface Asset {
  assetDetail: AssetDetail;
  assetHolder?: AssetHolder;
}

export interface AssetDetail {
  assetAccountIdentifier?: string;
  assetCashOrMarketValueAmount: number;
  assetDescription?: string;
  assetType: AssetType;
}

export type AssetType = 
  | "CheckingAccount"
  | "SavingsAccount"
  | "MoneyMarketFund"
  | "CertificateOfDepositTimeDeposit"
  | "MutualFund"
  | "Stock"
  | "StockOptions"
  | "Bond"
  | "RetirementFund"
  | "BridgeLoanNotDeposited"
  | "TrustAccount"
  | "IndividualDevelopmentAccount"
  | "CashValueOfLifeInsurance"
  | "GiftsTotal"
  | "GiftOfEquity"
  | "EmployerAssistedHousing"
  | "RelocationFunds"
  | "Other"
  | "ProceedsFromSecuredLoan"
  | "ProceedsFromUnsecuredLoan"
  | "ProceedsFromSaleOfNonRealEstateAsset"
  | "ProceedsFromRealEstateProperty"
  | "Automobile"
  | "RealEstateOwned";

export interface AssetHolder {
  name?: Name;
  address?: Address;
}

export interface Liabilities {
  liability: Liability[];
}

export interface Liability {
  liabilityDetail: LiabilityDetail;
  liabilityHolder?: LiabilityHolder;
}

export interface LiabilityDetail {
  liabilityAccountIdentifier?: string;
  liabilityMonthlyPaymentAmount?: number;
  liabilityPayoffStatusIndicator?: boolean;
  liabilitySecuredBySubjectPropertyIndicator?: boolean;
  liabilityType: LiabilityType;
  liabilityUnpaidBalanceAmount?: number;
  liabilityPaymentIncludesTaxesInsuranceIndicator?: boolean;
  liabilityExclusionIndicator?: boolean;
}

export type LiabilityType = 
  | "Revolving"
  | "Installment"
  | "Open"
  | "Mortgage"
  | "CollectionsJudgmentsLiens"
  | "LeasePayments"
  | "Taxes"
  | "ChildCare"
  | "Alimony"
  | "ChildSupport"
  | "SeparateMaintenanceExpense"
  | "JobRelatedExpenses"
  | "Other";

export interface LiabilityHolder {
  name?: Name;
  address?: Address;
}

export interface Services {
  service: Service[];
}

export interface Service {
  serviceDetail: ServiceDetail;
}

export interface ServiceDetail {
  serviceType: string;
  serviceAmount?: number;
  serviceProviderName?: string;
}

export interface MISMOExtension {
  [key: string]: unknown;
}

export interface ULDDDataPoint {
  sortId: string;
  dataPointName: string;
  xpath: string;
  required: boolean;
  enumerations?: string[];
  format?: string;
  maxLength?: number;
  phase?: number;
}

export const ULDD_PHASE_5_DATA_POINTS: ULDDDataPoint[] = [
  { sortId: "1", dataPointName: "NoteAmount", xpath: "DEAL/LOANS/LOAN/LOAN_DETAIL/NoteAmount", required: true },
  { sortId: "2", dataPointName: "NoteDate", xpath: "DEAL/LOANS/LOAN/LOAN_DETAIL/NoteDate", required: true, format: "YYYY-MM-DD" },
  { sortId: "3", dataPointName: "NoteRatePercent", xpath: "DEAL/LOANS/LOAN/LOAN_DETAIL/NoteRatePercent", required: true },
  { sortId: "4", dataPointName: "LoanPurposeType", xpath: "DEAL/LOANS/LOAN/LOAN_DETAIL/LoanPurposeType", required: true, enumerations: ["Purchase", "Refinance", "ConstructionOnly", "ConstructionToPermanent", "NoCashOutRefinance", "CashOutRefinance", "Other"] },
  { sortId: "5", dataPointName: "MortgageType", xpath: "DEAL/LOANS/LOAN/LOAN_DETAIL/MortgageType", required: true, enumerations: ["Conventional", "FHA", "USDA", "VA", "Other"] },
  { sortId: "6", dataPointName: "LienPriorityType", xpath: "DEAL/LOANS/LOAN/LOAN_DETAIL/LienPriorityType", required: true, enumerations: ["FirstLien", "SecondLien", "ThirdLien", "FourthLien", "Other"] },
  { sortId: "7", dataPointName: "BaseLoanAmount", xpath: "DEAL/LOANS/LOAN/TERMS_OF_LOAN/BaseLoanAmount", required: true },
  { sortId: "8", dataPointName: "LoanAmortizationType", xpath: "DEAL/LOANS/LOAN/TERMS_OF_LOAN/LoanAmortizationType", required: true, enumerations: ["Fixed", "AdjustableRate", "GEM", "GPM", "Other"] },
  { sortId: "9", dataPointName: "LoanAmortizationPeriodCount", xpath: "DEAL/LOANS/LOAN/TERMS_OF_LOAN/LoanAmortizationPeriodCount", required: false },
  { sortId: "10", dataPointName: "InterestRatePercent", xpath: "DEAL/LOANS/LOAN/TERMS_OF_LOAN/InterestRatePercent", required: true },
  { sortId: "49.1", dataPointName: "FNMCondominiumProjectManagerCertificationIdentifier", xpath: "DEAL/LOANS/LOAN/CONDOMINIUM_PROJECT/FNMCondominiumProjectManagerCertificationIdentifier", required: false, phase: 5 },
  { sortId: "49.2", dataPointName: "FNMCondominiumProjectManagerPhaseIdentifier", xpath: "DEAL/LOANS/LOAN/CONDOMINIUM_PROJECT/FNMCondominiumProjectManagerPhaseIdentifier", required: false, phase: 5 },
  { sortId: "251.1", dataPointName: "CreditScoreModelNameType", xpath: "DEAL/PARTIES/PARTY/ROLES/ROLE/BORROWER/CREDIT_SCORES/CREDIT_SCORE/CreditScoreModelNameType", required: false, phase: 5 },
  { sortId: "251.2", dataPointName: "CreditScoreValue", xpath: "DEAL/PARTIES/PARTY/ROLES/ROLE/BORROWER/CREDIT_SCORES/CREDIT_SCORE/CreditScoreValue", required: false, phase: 5 },
  { sortId: "590.1", dataPointName: "TemporaryBuydownAmount", xpath: "DEAL/LOANS/LOAN/BUYDOWN/BuydownAmount", required: false, phase: 5 },
];
