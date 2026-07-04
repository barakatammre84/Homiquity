/**
 * UCD-supported enumerations by Closing Disclosure section.
 *
 * Source of truth: docs/fannie-mae/"UCD Joint GSE Job Aid Guide Fees updated
 * 09-06-23.pdf", Appendix "UCD Supported Enumerations by CD Section"
 * (pages 12–17), supplemented by the recording-fee lists in "UCD Job Aid
 * Taxes and Other Government Fees updated 09-06-23.pdf". Transcribed
 * verbatim — never extend these lists from memory; when a fee type is
 * missing here, the MISMO-compliant escape hatch is FeeType="Other" with an
 * OtherDescription (see the job aid's @DisplayLabelText guidance).
 *
 * Edit severities per the Guide Fees job aid: fee-type-vs-section
 * enforcement is critical/fatal for sections A (Origination Charges) and
 * E (Taxes and Other Government Fees), warning severity for B, C, and H.
 */

export type IntegratedDisclosureSection =
  | "OriginationCharges" // A
  | "ServicesBorrowerDidNotShopFor" // B
  | "ServicesBorrowerDidShopFor" // C
  | "TaxesAndOtherGovernmentFees" // E
  | "Prepaids" // F
  | "InitialEscrowPaymentAtClosing" // G
  | "OtherCosts"; // H

/** A. Origination Charges — valid Fee Type enumerations. */
export const SECTION_A_FEE_TYPES: readonly string[] = [
  "203KArchitecturalAndEngineeringFee", "203KConsultantFee", "203KDiscountOnRepairs", "203KInspectionFee",
  "203KPermits", "203KSupplementalOriginationFee", "AmortizationFee", "ApplicationFee", "AppraisalDeskReviewFee",
  "AppraisalFee", "AppraisalFieldReviewFee", "AppraisalManagementCompanyFee", "AssumptionFee",
  "AutomatedUnderwritingFee", "AVMFee", "BondFee", "CertificationFee", "CommitmentFee", "CopyOrFaxFee",
  "CourierFee", "CreditReportFee", "DisasterInspectionFee", "DocumentPreparationFee",
  "ElectronicDocumentDeliveryFee", "EscrowServiceFee", "EscrowWaiverFee", "FilingFee",
  "HighCostMortgageCounselingFee", "LendersAttorneyFee", "LoanDiscountPoints", "LoanLevelPriceAdjustment",
  "LoanOriginationFee", "LoanOriginatorCompensation", "ManualUnderwritingFee", "MERSRegistrationFee",
  "ModificationFee", "MortgageBrokerFee", "NewLoanAdministrationFee", "NotaryFee", "Other",
  "PowerOfAttorneyPreparationFee", "PowerOfAttorneyRecordingFee", "PreclosingVerificationControlFee",
  "ProcessingFee", "PropertyInspectionWaiverFee", "PropertyTaxStatusResearchFee", "RateLockFee", "RedrawFee",
  "ReinspectionFee", "SettlementFee", "SubordinationFee", "TaxRelatedServiceFee",
  "TemporaryBuydownAdministrationFee", "TemporaryBuydownPoints", "UnderwritingFee",
  "USDARuralDevelopmentGuaranteeFee", "VerificationOfAssetsFee", "VerificationOfEmploymentFee",
  "VerificationOfIncomeFee", "VerificationOfResidencyStatusFee", "VerificationOfTaxpayerIdentificationFee",
  "VerificationOfTaxReturnFee", "WireTransferFee",
];

/** B. Services Borrower Did NOT Shop For — valid Fee Type enumerations. */
export const SECTION_B_FEE_TYPES: readonly string[] = [
  "203KArchitecturalAndEngineeringFee", "203KConsultantFee", "203KInspectionFee", "203KPermits",
  "203KTitleUpdate", "ApplicationFee", "AppraisalDeskReviewFee", "AppraisalFee", "AppraisalFieldReviewFee",
  "AppraisalManagementCompanyFee", "AsbestosInspectionFee", "AssignmentFee", "AssumptionFee", "AttorneyFee",
  "AutomatedUnderwritingFee", "AVMFee", "BondFee", "BondReviewFee", "CertificationFee", "CopyOrFaxFee",
  "CourierFee", "CreditReportFee", "DeedPreparationFee", "DisasterInspectionFee", "DocumentPreparationFee",
  "DryWallInspectionFee", "ElectricalInspectionFee", "ElectronicDocumentDeliveryFee",
  "EnvironmentalInspectionFee", "EscrowServiceFee", "EscrowWaiverFee", "FilingFee", "FloodCertification",
  "FoundationInspectionFee", "HeatingCoolingInspectionFee", "HighCostMortgageCounselingFee",
  "HomeInspectionFee", "LeadInspectionFee", "LendersAttorneyFee", "ManualUnderwritingFee",
  "MERSRegistrationFee", "MIInitialPremium", "MIUpfrontPremium", "MoldInspectionFee",
  "MunicipalLienCertificateFee", "NotaryFee", "Other", "PestInspectionFee", "PlumbingInspectionFee",
  "PowerOfAttorneyPreparationFee", "PowerOfAttorneyRecordingFee", "PreclosingVerificationControlFee",
  "ProcessingFee", "PropertyInspectionWaiverFee", "PropertyTaxStatusResearchFee", "RadonInspectionFee",
  "ReconveyanceFee", "ReinspectionFee", "RoofInspectionFee", "SepticInspectionFee", "SettlementFee",
  "SigningAgentFee", "SmokeDetectorInspectionFee", "StateTitleInsuranceFee", "StructuralInspectionFee",
  "SubordinationFee", "SurveyFee", "TaxRelatedServiceFee", "TemporaryBuydownAdministrationFee",
  "TitleCertificationFee", "TitleClosingFee", "TitleClosingProtectionLetterFee", "TitleDocumentPreparationFee",
  "TitleEndorsementFee", "TitleExaminationFee", "TitleFinalPolicyShortFormFee", "TitleInsuranceBinderFee",
  "TitleInsuranceFee", "TitleLendersCoveragePremium", "TitleNotaryFee", "TitleServicesFeeTotal",
  "TitleServicesSalesTax", "TitleUnderwritingIssueResolutionFee", "UnderwritingFee",
  "USDARuralDevelopmentGuaranteeFee", "VAFundingFee", "VerificationOfAssetsFee",
  "VerificationOfEmploymentFee", "VerificationOfIncomeFee", "VerificationOfResidencyStatusFee",
  "VerificationOfTaxpayerIdentificationFee", "VerificationOfTaxReturnFee", "WaterTestingFee",
  "WellInspectionFee", "WireTransferFee",
];

/** C. Services Borrower DID Shop For — valid Fee Type enumerations. */
export const SECTION_C_FEE_TYPES: readonly string[] = [
  "203KArchitecturalAndEngineeringFee", "203KConsultantFee", "203KInspectionFee", "203KPermits",
  "203KTitleUpdate", "ApplicationFee", "AppraisalDeskReviewFee", "AppraisalFee", "AppraisalFieldReviewFee",
  "AppraisalManagementCompanyFee", "AsbestosInspectionFee", "AssumptionFee", "AttorneyFee",
  "AutomatedUnderwritingFee", "AVMFee", "BondFee", "CertificationFee", "CopyOrFaxFee", "CourierFee",
  "CreditReportFee", "DeedPreparationFee", "DisasterInspectionFee", "DocumentPreparationFee",
  "DryWallInspectionFee", "ElectricalInspectionFee", "ElectronicDocumentDeliveryFee",
  "EnvironmentalInspectionFee", "EscrowServiceFee", "EscrowWaiverFee", "FilingFee", "FloodCertification",
  "FoundationInspectionFee", "HeatingCoolingInspectionFee", "HighCostMortgageCounselingFee",
  "HomeInspectionFee", "LeadInspectionFee", "LendersAttorneyFee", "ManualUnderwritingFee",
  "MERSRegistrationFee", "MIUpfrontPremium", "MoldInspectionFee", "MunicipalLienCertificateFee", "NotaryFee",
  "Other", "PestInspectionFee", "PlumbingInspectionFee", "PowerOfAttorneyPreparationFee",
  "PowerOfAttorneyRecordingFee", "PreclosingVerificationControlFee", "ProcessingFee",
  "PropertyInspectionWaiverFee", "PropertyTaxStatusResearchFee", "RadonInspectionFee", "ReconveyanceFee",
  "ReinspectionFee", "RoofInspectionFee", "SepticInspectionFee", "SettlementFee", "SigningAgentFee",
  "SmokeDetectorInspectionFee", "StateTitleInsuranceFee", "StructuralInspectionFee", "SubordinationFee",
  "SurveyFee", "TaxRelatedServiceFee", "TemporaryBuydownAdministrationFee", "TitleCertificationFee",
  "TitleClosingFee", "TitleClosingProtectionLetterFee", "TitleDocumentPreparationFee", "TitleEndorsementFee",
  "TitleExaminationFee", "TitleFinalPolicyShortFormFee", "TitleInsuranceBinderFee", "TitleInsuranceFee",
  "TitleLendersCoveragePremium", "TitleNotaryFee", "TitleOwnersCoveragePremium", "TitleServicesFeeTotal",
  "TitleServicesSalesTax", "TitleUnderwritingIssueResolutionFee", "UnderwritingFee",
  "VerificationOfAssetsFee", "VerificationOfEmploymentFee", "VerificationOfIncomeFee",
  "VerificationOfResidencyStatusFee", "VerificationOfTaxpayerIdentificationFee", "VerificationOfTaxReturnFee",
  "WaterTestingFee", "WellInspectionFee", "WireTransferFee",
];

/** E. Taxes and Other Government Fees — valid Fee Type enumerations. */
export const SECTION_E_FEE_TYPES: readonly string[] = [
  "DocumentaryStampFee", "FilingFee", "MortgageSurchargeCountyOrParish", "MortgageSurchargeMunicipal",
  "MortgageSurchargeState", "MunicipalLienCertificateFee", "Other", "PowerOfAttorneyRecordingFee",
  "RecordingFeeForAssignment", "RecordingFeeForDeed", "RecordingFeeForMortgage",
  "RecordingFeeForMunicipalLienCertificate", "RecordingFeeForRelease", "RecordingFeeForSubordination",
  "RecordingFeeTotal", "TaxStampForCityDeed", "TaxStampForCityMortgage", "TaxStampForCountyDeed",
  "TaxStampForCountyMortgage", "TaxStampForStateDeed", "TaxStampForStateMortgage", "TransferTaxTotal",
];

/**
 * Section E recording fees that are accepted only when itemized on the CD;
 * otherwise their amounts fold into RecordingFeeTotal (Taxes job aid).
 */
export const SECTION_E_ITEMIZED_ONLY_RECORDING_FEES: readonly string[] = [
  "PowerOfAttorneyRecordingFee", "RecordingFeeForAssignment", "RecordingFeeForMunicipalLienCertificate",
  "RecordingFeeForRelease", "RecordingFeeForSubordination",
];

/** F. Prepaids — valid Prepaid Item Type enumerations. */
export const SECTION_F_PREPAID_ITEM_TYPES: readonly string[] = [
  "BoroughPropertyTax", "CityPropertyTax", "CondominiumAssociationDues",
  "CondominiumAssociationSpecialAssessment", "CooperativeAssociationDues",
  "CooperativeAssociationSpecialAssessment", "CountyPropertyTax", "DistrictPropertyTax",
  "EarthquakeInsurancePremium", "FloodInsurancePremium", "HailInsurancePremium", "HazardInsurancePremium",
  "HomeownersAssociationDues", "HomeownersAssociationSpecialAssessment", "HomeownersInsurancePremium",
  "MortgageInsurancePremium", "Other", "PrepaidInterest", "StatePropertyTax", "TownPropertyTax",
  "VolcanoInsurancePremium", "WindAndStormInsurancePremium",
];

/** G. Initial Escrow Payment at Closing — valid Escrow Item Type enumerations. */
export const SECTION_G_ESCROW_ITEM_TYPES: readonly string[] = [
  "AssessmentTax", "CityBondTax", "CityPropertyTax", "CondominiumAssociationDues",
  "CondominiumAssociationSpecialAssessment", "ConstructionCompletionFunds", "CooperativeAssociationDues",
  "CooperativeAssociationSpecialAssessment", "CountyBondTax", "CountyPropertyTax", "DistrictPropertyTax",
  "EarthquakeInsurance", "EnergyEfficientImprovementFunds", "FloodInsurance", "HailInsurancePremium",
  "HazardInsurance", "HomeownersAssociationDues", "HomeownersAssociationSpecialAssessment",
  "HomeownersInsurance", "MortgageInsurance", "Other", "ParishTax", "PestInsurance", "RehabilitationFunds",
  "SchoolPropertyTax", "StatePropertyTax", "TownPropertyTax", "TownshipPropertyTax", "VillagePropertyTax",
  "VolcanoInsurance", "WindstormInsurance",
];

/** H. Other — valid Fee Type enumerations. */
export const SECTION_H_FEE_TYPES: readonly string[] = [
  "203KTitleUpdate", "AsbestosInspectionFee", "AssignmentFee", "AttorneyFee", "BankruptcyMonitoringFee",
  "BondFee", "CertificationFee", "CLOAccessFee", "CondominiumAssociationDues",
  "CondominiumAssociationSpecialAssessment", "CooperativeAssociationDues", "CopyOrFaxFee", "CourierFee",
  "CreditDisabilityInsurancePremium", "CreditLifeInsurancePremium", "CreditPropertyInsurancePremium",
  "CreditUnemploymentInsurancePremium", "DebtCancellationInsurancePremium", "DebtSuspensionInsurancePremium",
  "DisasterInspectionFee", "DocumentPreparationFee", "DryWallInspectionFee", "ElectricalInspectionFee",
  "EnvironmentalInspectionFee", "EscrowServiceFee", "FilingFee", "FoundationInspectionFee",
  "GeneralCounselFee", "HeatingCoolingInspectionFee", "HomeInspectionFee", "HomeownersAssociationDues",
  "HomeownersAssociationSpecialAssessment", "HomeWarrantyFee", "LeadInspectionFee",
  "ManufacturedHousingInspectionFee", "MoldInspectionFee", "MunicipalLienCertificateFee", "NotaryFee",
  "Other", "PayoffRequestFee", "PestInspectionFee", "PlumbingInspectionFee",
  "PowerOfAttorneyPreparationFee", "RadonInspectionFee", "RealEstateCommissionBuyersBroker",
  "RealEstateCommissionSellersBroker", "ReconveyanceFee", "RepairsFee", "RoofInspectionFee",
  "SepticInspectionFee", "SettlementFee", "SigningAgentFee", "SmokeDetectorInspectionFee",
  "StructuralInspectionFee", "SurveyFee", "TitleOwnersCoveragePremium", "WaterTestingFee",
  "WellInspectionFee", "WireTransferFee",
];

const FEE_TYPE_SECTIONS: Partial<Record<IntegratedDisclosureSection, readonly string[]>> = {
  OriginationCharges: SECTION_A_FEE_TYPES,
  ServicesBorrowerDidNotShopFor: SECTION_B_FEE_TYPES,
  ServicesBorrowerDidShopFor: SECTION_C_FEE_TYPES,
  TaxesAndOtherGovernmentFees: SECTION_E_FEE_TYPES,
  OtherCosts: SECTION_H_FEE_TYPES,
};

/**
 * Fee-type-vs-section enforcement severity per the Guide Fees job aid:
 * sections A and E are critical/fatal; B, C, and H are warnings.
 */
export const FATAL_FEE_TYPE_SECTIONS: readonly IntegratedDisclosureSection[] = [
  "OriginationCharges",
  "TaxesAndOtherGovernmentFees",
];

export function isFeeTypeValidForSection(
  feeType: string,
  section: IntegratedDisclosureSection,
): boolean | null {
  const list = FEE_TYPE_SECTIONS[section];
  if (!list) return null; // F and G are not fee sections
  return list.includes(feeType);
}

export function isPrepaidItemTypeValid(itemType: string): boolean {
  return SECTION_F_PREPAID_ITEM_TYPES.includes(itemType);
}

export function isEscrowItemTypeValid(itemType: string): boolean {
  return SECTION_G_ESCROW_ITEM_TYPES.includes(itemType);
}
