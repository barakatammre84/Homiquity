import { lookupResolver, type LookupQuery } from "./services/lookupResolver";

/**
 * Classifies why an underwriting evaluation could not complete, so the caller
 * can turn a thrown error into the *right* outcome instead of masking every
 * failure as "needs more info":
 *
 *  - INPUT_INCOMPLETE : a required input was not supplied (e.g. VA family size).
 *                       Genuinely resolvable by collecting more information.
 *  - INPUT_INVALID    : an input was supplied but is not usable (non-positive
 *                       valuation/income, unrecognized state). A data problem.
 *  - POLICY_OUT_OF_BAND : the borrower's coordinates fell outside the automated
 *                       pricing/eligibility matrices (e.g. sub-floor FICO,
 *                       uncovered family size). NOT a gap in the borrower's
 *                       file — it is a decision the automated path cannot make,
 *                       so it must route to a human, never loop for documents.
 *
 * `publicMessage` is a borrower-safe explanation; `message` keeps the internal
 * audit detail. Missing/expired *policy scalar* matrices are a system
 * misconfiguration, not an underwriting condition — those still throw a plain
 * Error so they surface as a real 500 rather than a borrower-facing outcome.
 */
export type UnderwritingErrorKind =
  | "INPUT_INCOMPLETE"
  | "INPUT_INVALID"
  | "POLICY_OUT_OF_BAND";

export class UnderwritingError extends Error {
  constructor(
    public readonly kind: UnderwritingErrorKind,
    /** Internal, audit-grade detail. */
    message: string,
    /** Borrower-safe explanation surfaced by the orchestrator. */
    public readonly publicMessage: string,
  ) {
    super(message);
    this.name = "UnderwritingError";
  }
}

export interface AssetProfile {
  type: "CHECKING_SAVINGS" | "STOCK_INVESTMENT" | "RETIREMENT_IRA_401K";
  balance: number;
}

export interface UnderwritingInput {
  isVeteran: boolean;
  isActiveDuty?: boolean;
  hasExchangeAccess?: boolean; // Commissary eligibility discount
  baseMonthlyIncome: number;
  bonusMonthlyIncome: number;
  existingMonthlyDebts: number;
  originalLoanAmount: number;
  contractSalesPrice: number;
  appraisalValue: number;
  representativeFico: number;
  proposedPiti: number;
  assets: AssetProfile[];
  homeSquareFootage?: number;
  subjectPropertyState?: string;
  householdFamilySize?: number;
}

export interface UnderwritingResult {
  decision: "APPROVED" | "REJECTED" | "MANUAL_REVIEW";
  loanType: "CONVENTIONAL" | "VA";
  calculatedLtv: number;
  lookupLtv: number; // Rounded LTV used for pricing lookups
  calculatedDti: number;
  resolvedPmiMonthlyPremium: number;
  resolvedLlpafUpfrontFee: number;
  calculatedLiquidAssets: number;
  actualResidualIncome?: number;
  requiredResidualIncome?: number;
  rejectionReasons: string[];
}

/**
 * ConsolidatedUnderwritingEngine
 *
 * Deterministic, rules-based decision engine. It is intentionally isolated from
 * any external/AI decisioning path (Fair Lending / Reg B). Every threshold,
 * grid value, and residual requirement is resolved at runtime from the dynamic
 * lookup matrices in Postgres via LookupResolverService — there are no
 * hardcoded fallbacks.
 */
export class ConsolidatedUnderwritingEngine {
  // Use the process-wide shared resolver so a lifecycle mutation invalidated via
  // LookupResolverService.invalidate() also clears the cache this engine reads.
  private resolver = lookupResolver;

  public async evaluate(input: UnderwritingInput): Promise<UnderwritingResult> {
    const reasons: string[] = [];
    const targetLoanType = input.isVeteran ? "VA" : "CONVENTIONAL";

    // Step 1: Process dynamic values from Postgres lookup tables
    const dtiCap = (await this.resolver.getPolicyScalar("CONVENTIONAL_DTI_CAP")) / 100;
    const stretchDti = (await this.resolver.getPolicyScalar("CONVENTIONAL_STRETCH_DTI")) / 100;
    const ltvCap = await this.resolver.getPolicyScalar("CONVENTIONAL_LTV_CAP");
    const haircutStock = (await this.resolver.getPolicyScalar("HAIRCUT_STOCK_INVESTMENT")) / 100;
    const haircutRetirement = (await this.resolver.getPolicyScalar("HAIRCUT_RETIREMENT")) / 100;

    // Step 2: Calculate Loan-to-Value (LTV)
    const propertyBasisValue = Math.min(input.contractSalesPrice, input.appraisalValue);
    if (propertyBasisValue <= 0) {
      throw new UnderwritingError(
        "INPUT_INVALID",
        "CRITICAL VALUE INPUT ERROR: Property valuation basis must be greater than zero.",
        "We need a valid purchase price and property value to evaluate this loan.",
      );
    }
    const rawLtvFraction = (input.originalLoanAmount / propertyBasisValue) * 100;

    // Truncate calculated LTV to 2 decimal places
    const calculatedLtv = Math.floor(rawLtvFraction * 100) / 100;

    // Round up to the nearest whole percentage point for matrix lookups
    const lookupLtv = Math.ceil(calculatedLtv);

    // Step 3: Enforce maximum LTV ceiling
    if (calculatedLtv > ltvCap) {
      reasons.push(`Calculated LTV of ${calculatedLtv.toFixed(2)}% exceeds policy ceiling of ${ltvCap}%`);
    }

    // Step 4: Process and aggregate assets using haircuts to determine verified reserves
    let calculatedLiquidAssets = 0;
    for (const asset of input.assets) {
      if (asset.type === "CHECKING_SAVINGS") {
        calculatedLiquidAssets += asset.balance;
      } else if (asset.type === "STOCK_INVESTMENT") {
        calculatedLiquidAssets += asset.balance * haircutStock;
      } else if (asset.type === "RETIREMENT_IRA_401K") {
        calculatedLiquidAssets += asset.balance * haircutRetirement;
      }
    }

    // Step 5: Process standard Debt-to-Income (DTI)
    const combinedGrossMonthlyIncome = input.baseMonthlyIncome + input.bonusMonthlyIncome;
    if (combinedGrossMonthlyIncome <= 0) {
      throw new UnderwritingError(
        "INPUT_INVALID",
        "CRITICAL INCOME INPUT ERROR: Consolidated gross qualifying income must be greater than zero.",
        "We need verifiable qualifying income to evaluate this loan.",
      );
    }
    const combinedMonthlyLiabilities = input.existingMonthlyDebts + input.proposedPiti;
    const calculatedDti = (combinedMonthlyLiabilities / combinedGrossMonthlyIncome) * 100;

    let resolvedPmiMonthlyPremium = 0;
    let resolvedLlpafUpfrontFee = 0;

    let actualResidualIncome: number | undefined;
    let requiredResidualIncome: number | undefined;

    // Set when a conventional loan exceeds the conforming limit: it is not a
    // credit decline (a jumbo product may fit), so it routes to human review
    // rather than a rejection or an APPROVED conforming decision it isn't.
    let exceedsConformingLimit = false;

    // Standard Conforming Loan Path
    if (targetLoanType === "CONVENTIONAL") {
      // Eligibility floor: a credit score below the conventional minimum is a
      // decline, not a pricing gap. Enforce it BEFORE any matrix lookup — the
      // PMI grid's lowest band starts at the floor, so an ineligible score would
      // otherwise miss a cell and surface as a generic out-of-band review
      // instead of a specific, adverse-action-grade credit rejection.
      const conventionalFicoFloor = await this.resolver.getPolicyScalar("CONVENTIONAL_FICO_FLOOR");
      if (input.representativeFico < conventionalFicoFloor) {
        reasons.push(
          `Representative credit score of ${input.representativeFico} is below the conventional minimum of ${conventionalFicoFloor}`,
        );
      }

      // Conforming loan-limit awareness: this engine prices the conforming
      // product, so a loan above the limit cannot be decisioned as conforming.
      // Flag it for jumbo routing (handled at the decision step) instead of
      // silently approving it on the conforming grids.
      const conformingLimit = await this.resolver.getPolicyScalar("CONFORMING_LOAN_LIMIT");
      if (input.originalLoanAmount > conformingLimit) {
        exceedsConformingLimit = true;
      }

      if (calculatedDti > stretchDti * 100) {
        reasons.push(
          `Debt-to-Income ratio (${calculatedDti.toFixed(2)}%) exceeds the system's hard stretch ceiling of ${(stretchDti * 100).toFixed(0)}%`,
        );
      }

      // Price only an eligible file. If any rejection reason is already present
      // (LTV over the ceiling, sub-floor credit, or a stretch-DTI breach), skip
      // the PMI/LLPA matrices — they intentionally do not cover out-of-policy
      // coordinates, so querying them would throw and lose the rejection we
      // already have. The decline is returned cleanly below.
      if (reasons.length === 0) {
        // Query standard Monthly BPMI rate matrix if LTV > 80%
        if (calculatedLtv > 80.0) {
          const pmiRate = await this.resolveOrOutOfBand(
            {
              matrixCode: "CONVENTIONAL_PMI",
              dim1Value: input.representativeFico,
              dim2Value: calculatedLtv,
            },
            "mortgage-insurance pricing",
          );
          resolvedPmiMonthlyPremium = (input.originalLoanAmount * (pmiRate / 100)) / 12;
        }

        // Query dynamic Fannie Mae LLPA Matrix
        const llpaAdjustmentRate = await this.resolveOrOutOfBand(
          {
            matrixCode: "FANNIE_LLPA",
            dim1Value: input.representativeFico,
            dim2Value: lookupLtv,
          },
          "risk-based pricing",
        );
        resolvedLlpafUpfrontFee = input.originalLoanAmount * (llpaAdjustmentRate / 100);
      }

      // VA Veteran Loan Path
    } else {
      if (!input.subjectPropertyState || !input.householdFamilySize || !input.homeSquareFootage) {
        throw new UnderwritingError(
          "INPUT_INCOMPLETE",
          "CRITICAL VA PROTOCOL ERROR: Properties state, family size, and home square footage are required for military residual evaluations.",
          "To evaluate a VA loan we need the subject property state, household size, and home square footage.",
        );
      }

      // Map subject property state to VA regional zone
      const vaRegion = this.resolveVaRegion(input.subjectPropertyState);

      // VA Square-Foot Utility Rule
      const estimatedUtilityCosts = input.homeSquareFootage * 0.14;

      // Deduct estimated taxes, shelter costs, and utilities to isolate residual take-home pay
      const estimatedTaxesWithholding = combinedGrossMonthlyIncome * 0.18; // Standard 18% tax deduction model

      actualResidualIncome =
        combinedGrossMonthlyIncome -
        estimatedTaxesWithholding -
        input.proposedPiti -
        input.existingMonthlyDebts -
        estimatedUtilityCosts;

      // Select dynamic minimum residual threshold matching regional guidelines
      requiredResidualIncome = await this.resolveOrOutOfBand(
        {
          matrixCode: "VA_RESIDUAL",
          dim1Value: input.householdFamilySize,
          dim2Value: input.originalLoanAmount,
          dim3Identifier: vaRegion,
        },
        "VA residual-income requirement",
      );

      // Implement Active-Duty Commissary Facility Discount
      if (input.isActiveDuty && input.hasExchangeAccess) {
        requiredResidualIncome = requiredResidualIncome * 0.95;
      }

      // Implement the 20% Cushion Rule for High DTI profiles
      if (calculatedDti > 41.0) {
        const highDtiTarget = requiredResidualIncome * 1.2;
        if (actualResidualIncome < highDtiTarget) {
          reasons.push(
            `High DTI (${calculatedDti.toFixed(2)}% > 41.00%) requires residual income buffer of $${highDtiTarget.toFixed(2)}. Current residual is $${actualResidualIncome.toFixed(2)}`,
          );
        }
      } else {
        if (actualResidualIncome < requiredResidualIncome) {
          reasons.push(
            `Actual residual income of $${actualResidualIncome.toFixed(2)} falls below the standard regional requirement of $${requiredResidualIncome.toFixed(2)}`,
          );
        }
      }
    }

    // Evaluate standard pre-approval metrics
    let decision: "APPROVED" | "REJECTED" | "MANUAL_REVIEW" = "APPROVED";

    if (reasons.length > 0) {
      decision = "REJECTED";
    } else if (exceedsConformingLimit) {
      // Above the conforming limit: route to the jumbo desk, not an auto-approve.
      decision = "MANUAL_REVIEW";
    } else if (targetLoanType === "CONVENTIONAL" && calculatedDti > dtiCap * 100) {
      // DTI between baseline (43%) and stretch (50%) moves to Manual Review
      decision = "MANUAL_REVIEW";
    }

    return {
      decision,
      loanType: targetLoanType,
      calculatedLtv,
      lookupLtv,
      calculatedDti,
      resolvedPmiMonthlyPremium,
      resolvedLlpafUpfrontFee,
      calculatedLiquidAssets,
      actualResidualIncome,
      requiredResidualIncome,
      rejectionReasons: reasons,
    };
  }

  /**
   * Evaluates state code parameters and returns official regional groups.
   */
  private resolveVaRegion(state: string): "NORTHEAST" | "MIDWEST" | "SOUTH" | "WEST" {
    const st = state.toUpperCase().trim();

    const regions = {
      NORTHEAST: ["CT", "MA", "ME", "NH", "NJ", "NY", "PA", "RI", "VT"],
      MIDWEST: ["IL", "IN", "IA", "KS", "MI", "MN", "MO", "NE", "ND", "OH", "SD", "WI"],
      SOUTH: ["AL", "AR", "DE", "DC", "FL", "GA", "KY", "LA", "MD", "MS", "NC", "OK", "PR", "SC", "TN", "TX", "VA", "WV"],
      WEST: ["AK", "AZ", "CA", "CO", "HI", "ID", "MT", "NV", "NM", "OR", "UT", "WA", "WY"],
    };

    if (regions.NORTHEAST.includes(st)) return "NORTHEAST";
    if (regions.MIDWEST.includes(st)) return "MIDWEST";
    if (regions.SOUTH.includes(st)) return "SOUTH";
    if (regions.WEST.includes(st)) return "WEST";

    throw new UnderwritingError(
      "INPUT_INVALID",
      `CRITICAL COMPLIANCE ERROR: Received unrecognized state parameter [${state}]. Unable to resolve geographic region mapping.`,
      "We could not recognize the subject property state. Please provide a valid two-letter state code.",
    );
  }

  /**
   * Resolves a borrower-coordinate matrix value, converting a "no cell matches"
   * miss into a POLICY_OUT_OF_BAND {@link UnderwritingError}. A missing/expired
   * *matrix* (system misconfiguration) is re-thrown unchanged so it surfaces as
   * a real error, not an underwriting outcome.
   */
  private async resolveOrOutOfBand(query: LookupQuery, priceable: string): Promise<number> {
    try {
      return await this.resolver.resolveMatrixValue(query);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // The resolver distinguishes a coordinate miss ("...fell outside permitted
      // compliance intervals...") from a missing matrix. Only the former is an
      // out-of-band borrower profile; the latter is an infrastructure fault.
      if (message.includes("fell outside permitted compliance intervals")) {
        throw new UnderwritingError(
          "POLICY_OUT_OF_BAND",
          message,
          "This loan profile is outside our automated pricing coverage and needs a manual review by your loan team.",
        );
      }
      throw err;
    }
  }
}

export const consolidatedUnderwritingEngine = new ConsolidatedUnderwritingEngine();
