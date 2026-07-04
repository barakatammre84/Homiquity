/**
 * Fannie Mae Special Feature Codes (SFCs) for single-family loan delivery.
 *
 * Source of truth: docs/fannie-mae/"Special Feature Codes updated
 * 05-06-26.pdf" (published list, 2026-05-06 edition). Codes, names,
 * delivery types, auto-derived flags, and conjunction requirements below are
 * transcribed from that document — never add or alter a code from memory.
 *
 * Delivery rules from the document:
 *  - Up to TEN SFCs may be reported at delivery on an individual loan.
 *  - "Auto-derived" codes may be omitted from the Loan Delivery submission
 *    because Loan Delivery derives them from the delivered loan data; we still
 *    derive them locally so the pre-delivery report shows the full picture.
 *  - "Negotiated" codes require a negotiated contract/variance with Fannie
 *    Mae before a loan carrying the feature may be delivered.
 */

export const MAX_SFCS_PER_LOAN = 10;

export type SfcDeliveryType = "Both" | "Negotiated";
export type SfcExecution = "Both" | "WholeLoan" | "MBS";

export interface SpecialFeatureCode {
  code: string;
  name: string;
  /** Whole Loan / MBS applicability. */
  execution: SfcExecution;
  /** "Negotiated" = requires a negotiated contract with Fannie Mae. */
  deliveryType: SfcDeliveryType;
  /** Loan Delivery derives this code automatically from delivered data. */
  autoDerived: boolean;
  /** Other SFCs this code must be delivered in conjunction with (any-of groups are nested arrays). */
  requiresCodes?: (string | string[])[];
  /** Acquisition currently suspended per the document. */
  suspended?: boolean;
  description: string;
}

export const SPECIAL_FEATURE_CODES: SpecialFeatureCode[] = [
  { code: "001", name: "Recourse", execution: "Both", deliveryType: "Negotiated", autoDerived: false, description: "Any mortgage that has a type of recourse, unless a negotiated contract specifies a different SFC." },
  { code: "003", name: "Cash-Out Refinance", execution: "Both", deliveryType: "Both", autoDerived: true, description: "Cash-out refinance transaction as defined in the Selling Guide." },
  { code: "007", name: "Limited Cash-Out/No Cash-Out Refinance", execution: "Both", deliveryType: "Both", autoDerived: true, description: "Limited cash-out refinance transaction as defined in the Selling Guide." },
  { code: "009", name: "Moderate Interest Rate Buydown", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Temporary buydown with a 2% or less note-rate/bought-down-rate difference or a buydown period of 2 years or less." },
  { code: "013", name: "Relocation Mortgage", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Owner-occupied purchase money loan under an established employer relocation program." },
  { code: "014", name: "Significant Interest Rate Buydown", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Temporary buydown with more than a 2% rate difference or a buydown period greater than two years." },
  { code: "019", name: "Lender-Purchased Mortgage Insurance", execution: "Both", deliveryType: "Both", autoDerived: true, description: "Lender (rather than borrower) purchased the mortgage insurance coverage." },
  { code: "033", name: "Indemnification", execution: "Both", deliveryType: "Negotiated", autoDerived: false, description: "Lender agrees to reimburse/indemnify Fannie Mae for losses under a negotiated agreement." },
  { code: "036", name: "Fixed-Rate Resale of Converted ARM", execution: "WholeLoan", deliveryType: "Both", autoDerived: false, description: "Converted ARM repurchased from an MBS pool and redelivered as a fixed-rate whole loan." },
  { code: "037", name: "Convertible ARM—Take-Out Option", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Post-conversion disposition option resulting in redelivery of a converted ARM to Fannie Mae." },
  { code: "038", name: "Convertible ARM—Market Rate Option", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Post-conversion disposition option where the lender takes the interest-rate risk on a converted ARM." },
  { code: "054", name: "Community Land Trust Mortgage", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Secured by improvements purchased from a nonprofit community land trust plus a ground lease." },
  { code: "076", name: "Recast Mortgage", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Re-amortized after a borrower principal curtailment to recast and reduce the payment before delivery." },
  { code: "087", name: "RD-Guaranteed Mortgage—Special Servicing Option", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Non-recourse mortgage guaranteed by Rural Development under the RD 502 Loan Program." },
  { code: "118", name: "Community Seconds", execution: "Both", deliveryType: "Both", autoDerived: true, description: "First mortgage that is part of a Community Seconds transaction." },
  { code: "127", name: "Desktop Underwriter (DU) Loan", execution: "Both", deliveryType: "Both", autoDerived: true, description: "All mortgage loans underwritten through DU." },
  { code: "151", name: "Conversion of Single-Closing Construction-to-Permanent Financing", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Permanent loan converted from single-closing interim construction financing." },
  { code: "155", name: "Attorney Title Opinion Letter", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Delivered with an attorney title opinion letter in lieu of a title insurance policy." },
  { code: "162", name: "SSN Positively Validated through SSA", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Lender validated the borrower SSN through the Social Security Administration after a discrepancy." },
  { code: "165", name: "Unit Number—Bypass Loan Delivery Edit", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Bypass the USPS unit-number Loan Delivery edit after verifying delivered data accuracy." },
  { code: "168", name: "Inter Vivos Revocable Trust", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Loan with an inter vivos revocable trust as a borrower." },
  { code: "170", name: "Flood Insurance—Special Flood Hazard Area", execution: "Both", deliveryType: "Both", autoDerived: true, description: "Structure in an SFHA with flood insurance coverage in place." },
  { code: "173", name: "PACE", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Eligible limited cash-out refinance where the PACE loan remains in place." },
  { code: "175", name: "Flood Insurance—Not a Special Flood Hazard Area", execution: "Both", deliveryType: "Both", autoDerived: true, description: "No structure in an SFHA but flood insurance coverage is in place." },
  { code: "176", name: "Shared Appreciation", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Loan associated with a shared appreciation Community Seconds program." },
  { code: "177", name: "Model Deed Restriction Form", execution: "Both", deliveryType: "Both", autoDerived: false, requiresCodes: ["630"], description: "Shared equity loan using the 2021 model deed restriction form; must be used with SFC 630." },
  { code: "180", name: "No Flood Insurance—Not a Special Flood Hazard Area", execution: "Both", deliveryType: "Both", autoDerived: true, description: "No structure in an SFHA and no flood insurance coverage in place." },
  { code: "181", name: "Private Transfer Fee", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Shared equity loan with a private transfer fee covenant." },
  { code: "184", name: "$500 Housing Counseling LLPA Credit", execution: "Both", deliveryType: "Both", autoDerived: false, description: "LLPA credit for HomeReady loans where the borrower completed qualifying housing counseling." },
  { code: "202", name: "HUD Section 184 and 184A Mortgage", execution: "Both", deliveryType: "Both", autoDerived: false, description: "HUD-guaranteed Section 184 or 184A mortgage." },
  { code: "211", name: "Correspondent Third-Party Origination", execution: "Both", deliveryType: "Both", autoDerived: true, description: "Originated by a lender correspondent and sold to a mortgage loan seller." },
  { code: "212", name: "Broker Third-Party Origination", execution: "Both", deliveryType: "Both", autoDerived: true, description: "Originated through a broker who receives a commission for bringing borrower and lender together." },
  { code: "215", name: "HomeStyle Renovation Mortgage with Recourse", execution: "Both", deliveryType: "Negotiated", autoDerived: false, description: "HomeStyle Renovation loan delivered before renovation completion (recourse until completion)." },
  { code: "220", name: "RD Section 502 Leveraged (Blended) Loan Program", execution: "Both", deliveryType: "Both", autoDerived: false, requiresCodes: ["118"], description: "Conventional first with an eligible RD Section 502 subordinate lien; SFC 118 must also be reported." },
  { code: "221", name: "Native American Conventional Lending Initiative (NACLI)", execution: "Both", deliveryType: "Negotiated", autoDerived: false, description: "Conventional first to a Native American borrower on trust or restricted land (approved tribe)." },
  { code: "235", name: "Manufactured Home", execution: "Both", deliveryType: "Both", autoDerived: true, description: "Secured by a manufactured home on a permanent chassis and foundation, classified as real property." },
  { code: "279", name: "HomeStyle Renovation Mortgage without Recourse", execution: "Both", deliveryType: "Both", autoDerived: false, description: "HomeStyle Renovation loan with renovation complete at time of delivery." },
  { code: "281", name: "Financed Mortgage Insurance", execution: "Both", deliveryType: "Both", autoDerived: true, description: "Borrower-paid MI premium financed in whole or in part into the loan amount." },
  { code: "304", name: "Texas Section 50(a)(6) Mortgage", execution: "Both", deliveryType: "Both", autoDerived: true, requiresCodes: [["003", "007"]], description: "Originated under Article XVI, Section 50(a)(6) of the Texas Constitution; used with SFC 003 or 007." },
  { code: "343", name: "DU Recommendation Override", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Originally DU-underwritten, subsequently manually underwritten due to erroneous credit report data." },
  { code: "375", name: "HomeStyle Energy Improvement", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Finances energy-related improvements meeting Fannie Mae's energy improvement feature." },
  { code: "416", name: "SF Disaster Response Refinance", execution: "Both", deliveryType: "Both", autoDerived: false, requiresCodes: ["007"], description: "Limited cash-out refi in a FEMA-designated disaster area (Individual Assistance); used with SFC 007." },
  { code: "508", name: "eMortgage", execution: "Both", deliveryType: "Both", autoDerived: true, description: "Loan delivered as an eMortgage." },
  { code: "588", name: "Detached Condominium Unit", execution: "Both", deliveryType: "Both", autoDerived: true, description: "Detached unit in an attached or detached condominium project." },
  { code: "630", name: "Resale Restrictions Terminate at Foreclosure", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Resale restrictions expire at foreclosure/deed-in-lieu; LTV based on market value. Not for community land trusts." },
  { code: "631", name: "Resale Restrictions Survive at Foreclosure", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Resale restrictions remain in place after foreclosure/deed-in-lieu. Not for community land trusts." },
  { code: "679", name: "HomePath Property with an Eligible Exception", execution: "Both", deliveryType: "Both", autoDerived: false, description: "HomePath property where multiple-financed-property and/or interested-party-contribution exceptions apply." },
  { code: "707", name: "Employment Contract", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Income/employment documented with an enforceable employment contract; delivered before start date." },
  { code: "754", name: "Military Owner Occupancy", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Principal residence where a service member cannot occupy due to active-duty military service." },
  { code: "773", name: "ENERGY STAR-Certified Improvement", execution: "Both", deliveryType: "Both", autoDerived: false, requiresCodes: ["375"], description: "HomeStyle Renovation/Energy loan financing ENERGY STAR-certified improvements; used with SFC 375." },
  { code: "774", name: "Value Acceptance + Property Data", execution: "Both", deliveryType: "Both", autoDerived: false, description: "DU loan where eligibility was determined from third-party-collected property data (no appraisal)." },
  { code: "777", name: "Approved Vendor Tool: SEI", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Rep-and-warrant relief on self-employment income calculated via an approved vendor tool." },
  { code: "784", name: "ENERGY STAR Green Building Certification for Green Bonds", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Property with an ENERGY STAR green building certification for residential new construction." },
  { code: "785", name: "ARM with Fallback Language", execution: "Both", deliveryType: "Both", autoDerived: false, description: "ARM originated with updated note/rider fallback language (not applicable to SOFR ARMs)." },
  { code: "791", name: "Single-Width Manufactured Home", execution: "Both", deliveryType: "Both", autoDerived: true, description: "Secured by a single-width manufactured home classified as real property." },
  { code: "792", name: "Certified Shared Equity Program List", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Loan associated with a program on the Certified Shared Equity Program List." },
  { code: "798", name: "FHA Higher Balance Mortgage Loan", execution: "Both", deliveryType: "Negotiated", autoDerived: false, description: "Certain higher-balance FHA loans." },
  { code: "801", name: "Value Acceptance", execution: "Both", deliveryType: "Both", autoDerived: false, description: "DU loan where the lender exercised a value acceptance (appraisal waiver) offer." },
  { code: "807", name: "High LTV Refinance Value Acceptance", execution: "Both", deliveryType: "Both", autoDerived: true, requiresCodes: ["007", "839"], suspended: true, description: "High-LTV refinance with value acceptance; used with SFCs 007 and 839. Acquisition suspended." },
  { code: "808", name: "High-Balance Conventional Mortgage Loan", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Original loan amount above the general conforming limit, up to the high-cost area limit." },
  { code: "818", name: "HomeReady \"Thin File\"", execution: "Both", deliveryType: "Both", autoDerived: false, requiresCodes: ["900"], description: "HomeReady loan with sub-620 score attributable to a thin file supplemented with nontraditional credit; used with SFC 900." },
  { code: "839", name: "High LTV Refinance Option—Standard", execution: "Both", deliveryType: "Both", autoDerived: true, requiresCodes: ["007"], suspended: true, description: "Refinance meeting the high-LTV refinance option; used with SFC 007. Acquisition suspended." },
  { code: "840", name: "High LTV Refinance—Alternative Qualification Path", execution: "Both", deliveryType: "Both", autoDerived: false, requiresCodes: ["007"], suspended: true, description: "Manually underwritten high-LTV refinance under the Alternative Qualification Path; used with SFC 007. Acquisition suspended." },
  { code: "841", name: "Student Loan Cash-Out Refinance", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Property equity used to pay off student debt as part of a cash-out refinance." },
  { code: "859", name: "MH Advantage", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Property meets MH Advantage requirements (CHOICEHome-stickered homes are treated as equivalent)." },
  { code: "861", name: "Remote Notarization", execution: "Both", deliveryType: "Both", autoDerived: true, description: "Security instrument notarized via audio-visual technology as an electronic notarization." },
  { code: "868", name: "RefiNow", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Originated under the RefiNow eligibility requirements." },
  { code: "871", name: "HomePath LLPA Credit", execution: "Both", deliveryType: "Both", autoDerived: false, description: "LLPA credit for a HomePath property when an appraisal is obtained (per Selling Guide criteria)." },
  { code: "874", name: "DTS LLPA Waiver", execution: "Both", deliveryType: "Both", autoDerived: true, description: "LLPA waiver for eligible Duty to Serve loans at or below 100% of area median income." },
  { code: "877", name: "Address Confidentiality Program", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Borrower enrolled (or unenrolled) in a state Address Confidentiality Program; alternate mailing address required." },
  { code: "880", name: "Lender SPCP", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Originated under a lender's Special Purpose Credit Program meeting standard guidelines or a variance." },
  { code: "881", name: "Zero Energy Ready Home Certification for Green Bonds", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Property with a DOE Zero Energy Ready Home green building certification." },
  { code: "884", name: "HomeReady VLIP LLPA Credit", execution: "Both", deliveryType: "Both", autoDerived: false, description: "HomeReady very low-income purchase loan with lender-provided down payment/closing cost assistance." },
  { code: "886", name: "First-Generation Homebuyer Loan", execution: "Both", deliveryType: "Both", autoDerived: false, description: "All borrowers meet the first-generation homebuyer requirements." },
  { code: "887", name: "Builder Standby Commitment with Permanent Buydown", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Builder standby (forward) commitment used to reduce the borrower's interest rate." },
  { code: "888", name: "WaterSense Certification", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Property with the EPA WaterSense certification, eligible for Single-Family Green MBS." },
  { code: "892", name: "HomeStyle Refresh", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Delivered as a HomeStyle Refresh mortgage." },
  { code: "900", name: "HomeReady Mortgage", execution: "Both", deliveryType: "Both", autoDerived: false, description: "HomeReady mortgage loan." },
  { code: "918", name: "Cryptocurrency Reserves", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Borrower uses cryptocurrency as part of qualifying reserves." },
  { code: "919", name: "COVID-19 Forbearance Plan", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Loan entered forbearance after closing and before sale to Fannie Mae due to a COVID-19 hardship." },
  { code: "920", name: "Remote Ink-Signed Notarization (RIN)", execution: "Both", deliveryType: "Both", autoDerived: false, description: "Manual notarization to a paper document performed over audio-video technology (COVID-19 flexibility)." },
];

const SFC_BY_CODE = new Map(SPECIAL_FEATURE_CODES.map(s => [s.code, s]));

export function getSpecialFeatureCode(code: string): SpecialFeatureCode | undefined {
  return SFC_BY_CODE.get(code);
}

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

/**
 * Loan attributes the derivation rules read. Every field is optional: an
 * absent field means "not known", and no SFC is derived from it. Callers must
 * not fabricate values — leave unknown fields undefined.
 */
export interface SfcDerivationInput {
  /** Refinance classification per the Selling Guide. */
  refinanceCashOutType?: "cash_out" | "limited_cash_out" | null;
  /** Underwritten through Desktop Underwriter. */
  underwrittenThroughDu?: boolean;
  /** DU loan subsequently manually underwritten due to erroneous credit data. */
  duRecommendationOverride?: boolean;
  /** Temporary buydown: note rate minus bought-down rate, in percent. */
  buydownRateDifferencePercent?: number | null;
  /** Temporary buydown period in years. */
  buydownPeriodYears?: number | null;
  lenderPurchasedMi?: boolean;
  financedMi?: boolean;
  communitySeconds?: boolean;
  sharedAppreciationCommunitySeconds?: boolean;
  singleClosingConstructionToPerm?: boolean;
  ssnValidatedThroughSsa?: boolean;
  interVivosRevocableTrust?: boolean;
  /** Property flood status; both fields must be known to derive 170/175/180. */
  inSpecialFloodHazardArea?: boolean;
  floodInsuranceInPlace?: boolean;
  originationChannel?: "retail" | "correspondent" | "broker" | null;
  manufacturedHome?: boolean;
  singleWidthManufacturedHome?: boolean;
  mhAdvantage?: boolean;
  texas50a6?: boolean;
  eMortgage?: boolean;
  detachedCondoUnit?: boolean;
  /** Original loan amount vs. the applicable conforming baseline limit. */
  originalLoanAmount?: number | null;
  conformingLoanLimit?: number | null;
  homeReady?: boolean;
  studentLoanCashOut?: boolean;
  remoteOnlineNotarization?: boolean;
  refiNow?: boolean;
  communityLandTrust?: boolean;
  relocationProgram?: boolean;
  recastBeforeDelivery?: boolean;
  employmentContractIncome?: boolean;
  militaryUnableToOccupy?: boolean;
  cryptocurrencyReserves?: boolean;
  firstGenerationHomebuyer?: boolean;
  lenderSpcp?: boolean;
  addressConfidentialityProgram?: boolean;
}

export interface DerivedSfc {
  code: string;
  name: string;
  autoDerived: boolean;
  deliveryType: SfcDeliveryType;
  /** Which input attribute triggered the derivation. */
  basis: string;
}

/**
 * Deterministically derive the SFC set from known loan attributes. Unknown
 * attributes contribute nothing — this function never guesses. The returned
 * list is sorted by code for stable output.
 */
export function deriveSpecialFeatureCodes(input: SfcDerivationInput): DerivedSfc[] {
  const derived = new Map<string, string>(); // code -> basis
  const add = (code: string, basis: string) => {
    if (!derived.has(code)) derived.set(code, basis);
  };

  if (input.refinanceCashOutType === "cash_out") add("003", "refinanceCashOutType=cash_out");
  if (input.refinanceCashOutType === "limited_cash_out") add("007", "refinanceCashOutType=limited_cash_out");
  if (input.underwrittenThroughDu) add("127", "underwrittenThroughDu");
  if (input.duRecommendationOverride) add("343", "duRecommendationOverride");

  // Buydown: SFC 014 when the rate difference exceeds 2% OR the period
  // exceeds 2 years; otherwise SFC 009 for any temporary buydown.
  const diff = input.buydownRateDifferencePercent;
  const period = input.buydownPeriodYears;
  const hasBuydown = (diff != null && diff > 0) || (period != null && period > 0);
  if (hasBuydown) {
    const significant = (diff != null && diff > 2) || (period != null && period > 2);
    add(significant ? "014" : "009", "buydown terms");
  }

  if (input.lenderPurchasedMi) add("019", "lenderPurchasedMi");
  if (input.financedMi) add("281", "financedMi");
  if (input.communitySeconds || input.sharedAppreciationCommunitySeconds) add("118", "communitySeconds");
  if (input.sharedAppreciationCommunitySeconds) add("176", "sharedAppreciationCommunitySeconds");
  if (input.singleClosingConstructionToPerm) add("151", "singleClosingConstructionToPerm");
  if (input.ssnValidatedThroughSsa) add("162", "ssnValidatedThroughSsa");
  if (input.interVivosRevocableTrust) add("168", "interVivosRevocableTrust");

  if (input.inSpecialFloodHazardArea !== undefined && input.floodInsuranceInPlace !== undefined) {
    if (input.inSpecialFloodHazardArea && input.floodInsuranceInPlace) add("170", "flood status");
    else if (!input.inSpecialFloodHazardArea && input.floodInsuranceInPlace) add("175", "flood status");
    else if (!input.inSpecialFloodHazardArea && !input.floodInsuranceInPlace) add("180", "flood status");
    // SFHA with no coverage derives nothing: that loan is ineligible, and the
    // eligibility failure belongs to underwriting, not SFC assignment.
  }

  if (input.originationChannel === "correspondent") add("211", "originationChannel=correspondent");
  if (input.originationChannel === "broker") add("212", "originationChannel=broker");

  if (input.manufacturedHome || input.singleWidthManufacturedHome || input.mhAdvantage) add("235", "manufactured home");
  if (input.singleWidthManufacturedHome) add("791", "singleWidthManufacturedHome");
  if (input.mhAdvantage) add("859", "mhAdvantage");

  if (input.texas50a6) add("304", "texas50a6");
  if (input.eMortgage) add("508", "eMortgage");
  if (input.detachedCondoUnit) add("588", "detachedCondoUnit");

  if (
    input.originalLoanAmount != null &&
    input.conformingLoanLimit != null &&
    input.originalLoanAmount > input.conformingLoanLimit
  ) {
    add("808", "originalLoanAmount above conforming baseline limit");
  }

  if (input.homeReady) add("900", "homeReady");
  if (input.studentLoanCashOut) {
    add("841", "studentLoanCashOut");
    add("003", "studentLoanCashOut implies cash-out refinance");
  }
  if (input.remoteOnlineNotarization) add("861", "remoteOnlineNotarization");
  if (input.refiNow) add("868", "refiNow");
  if (input.communityLandTrust) add("054", "communityLandTrust");
  if (input.relocationProgram) add("013", "relocationProgram");
  if (input.recastBeforeDelivery) add("076", "recastBeforeDelivery");
  if (input.employmentContractIncome) add("707", "employmentContractIncome");
  if (input.militaryUnableToOccupy) add("754", "militaryUnableToOccupy");
  if (input.cryptocurrencyReserves) add("918", "cryptocurrencyReserves");
  if (input.firstGenerationHomebuyer) add("886", "firstGenerationHomebuyer");
  if (input.lenderSpcp) add("880", "lenderSpcp");
  if (input.addressConfidentialityProgram) add("877", "addressConfidentialityProgram");

  return Array.from(derived.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, basis]) => {
      const def = SFC_BY_CODE.get(code)!;
      return { code, name: def.name, autoDerived: def.autoDerived, deliveryType: def.deliveryType, basis };
    });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface SfcValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a combined SFC set against the published delivery rules: known
 * codes only, at most ten, conjunction requirements satisfied, mutually
 * exclusive refinance codes not combined, and negotiated/suspended codes
 * surfaced as warnings for contract review.
 */
export function validateSfcSet(codes: string[]): SfcValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const unique = Array.from(new Set(codes));

  if (unique.length !== codes.length) {
    warnings.push("Duplicate SFCs were removed; Loan Delivery expects each code at most once");
  }
  if (unique.length > MAX_SFCS_PER_LOAN) {
    errors.push(`${unique.length} SFCs assigned; at most ${MAX_SFCS_PER_LOAN} may be reported at delivery`);
  }

  const set = new Set(unique);
  for (const code of unique) {
    const def = SFC_BY_CODE.get(code);
    if (!def) {
      errors.push(`SFC ${code} is not on the published Special Feature Codes list (2026-05-06 edition)`);
      continue;
    }
    for (const req of def.requiresCodes ?? []) {
      if (Array.isArray(req)) {
        if (!req.some(r => set.has(r))) {
          errors.push(`SFC ${code} (${def.name}) must be delivered with one of: ${req.map(r => `SFC ${r}`).join(", ")}`);
        }
      } else if (!set.has(req)) {
        errors.push(`SFC ${code} (${def.name}) must be delivered in conjunction with SFC ${req}`);
      }
    }
    if (def.deliveryType === "Negotiated") {
      warnings.push(`SFC ${code} (${def.name}) requires a negotiated contract with Fannie Mae before delivery`);
    }
    if (def.suspended) {
      warnings.push(`SFC ${code} (${def.name}): acquisition of these loans is currently suspended`);
    }
  }

  // A transaction is either a cash-out or a limited cash-out refinance.
  if (set.has("003") && set.has("007")) {
    errors.push("SFC 003 (Cash-Out Refinance) and SFC 007 (Limited Cash-Out Refinance) are mutually exclusive");
  }

  return { valid: errors.length === 0, errors, warnings };
}
