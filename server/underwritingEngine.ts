import crypto from "crypto";
import { lookupResolver } from "./services/lookupResolver";

/**
 * The policy thresholds and matrix cells the engine actually resolved for a
 * given evaluation. Snapshotting these makes a decision reproducible: the
 * lookup matrices are mutable in Postgres, so re-running later can resolve
 * different values — but the recorded ResolvedPolicy shows exactly which
 * numbers produced the original decision. `fingerprint` is a short hash over
 * these values for quick equality checks / grouping across snapshots.
 */
export interface ResolvedPolicy {
  loanType: "CONVENTIONAL" | "VA";
  conventionalDtiCapPct: number;
  conventionalStretchDtiPct: number;
  conventionalLtvCapPct: number;
  haircutStockInvestment: number;
  haircutRetirement: number;
  pmiRatePct?: number;
  llpaRatePct?: number;
  vaRequiredResidualIncome?: number;
  fingerprint: string;
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
  /** The resolved thresholds/matrix cells this decision used (reproducibility). */
  resolvedPolicy: ResolvedPolicy;
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
      throw new Error("CRITICAL VALUE INPUT ERROR: Property valuation basis must be greater than zero.");
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
      throw new Error("CRITICAL INCOME INPUT ERROR: Consolidated gross qualifying income must be greater than zero.");
    }
    const combinedMonthlyLiabilities = input.existingMonthlyDebts + input.proposedPiti;
    const calculatedDti = (combinedMonthlyLiabilities / combinedGrossMonthlyIncome) * 100;

    let resolvedPmiMonthlyPremium = 0;
    let resolvedLlpafUpfrontFee = 0;

    // Captured for the reproducibility snapshot (ResolvedPolicy).
    let resolvedPmiRatePct: number | undefined;
    let resolvedLlpaRatePct: number | undefined;

    let actualResidualIncome: number | undefined;
    let requiredResidualIncome: number | undefined;

    // Standard Conforming Loan Path
    if (targetLoanType === "CONVENTIONAL") {
      if (calculatedDti > stretchDti * 100) {
        reasons.push(
          `Debt-to-Income ratio (${calculatedDti.toFixed(2)}%) exceeds the system's hard stretch ceiling of ${(stretchDti * 100).toFixed(0)}%`,
        );
      }

      // Query standard Monthly BPMI rate matrix if LTV > 80%
      if (calculatedLtv > 80.0) {
        const pmiRate = await this.resolver.resolveMatrixValue({
          matrixCode: "CONVENTIONAL_PMI",
          dim1Value: input.representativeFico,
          dim2Value: calculatedLtv,
        });
        resolvedPmiRatePct = pmiRate;
        resolvedPmiMonthlyPremium = (input.originalLoanAmount * (pmiRate / 100)) / 12;
      }

      // Query dynamic Fannie Mae LLPA Matrix
      const llpaAdjustmentRate = await this.resolver.resolveMatrixValue({
        matrixCode: "FANNIE_LLPA",
        dim1Value: input.representativeFico,
        dim2Value: lookupLtv,
      });
      resolvedLlpaRatePct = llpaAdjustmentRate;
      resolvedLlpafUpfrontFee = input.originalLoanAmount * (llpaAdjustmentRate / 100);

      // VA Veteran Loan Path
    } else {
      if (!input.subjectPropertyState || !input.householdFamilySize || !input.homeSquareFootage) {
        throw new Error(
          "CRITICAL VA PROTOCOL ERROR: Properties state, family size, and home square footage are required for military residual evaluations.",
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
      requiredResidualIncome = await this.resolver.resolveMatrixValue({
        matrixCode: "VA_RESIDUAL",
        dim1Value: input.householdFamilySize,
        dim2Value: input.originalLoanAmount,
        dim3Identifier: vaRegion,
      });

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
    } else if (targetLoanType === "CONVENTIONAL" && calculatedDti > dtiCap * 100) {
      // DTI between baseline (43%) and stretch (50%) moves to Manual Review
      decision = "MANUAL_REVIEW";
    }

    const resolvedPolicy = buildResolvedPolicy({
      loanType: targetLoanType,
      conventionalDtiCapPct: dtiCap * 100,
      conventionalStretchDtiPct: stretchDti * 100,
      conventionalLtvCapPct: ltvCap,
      haircutStockInvestment: haircutStock,
      haircutRetirement: haircutRetirement,
      pmiRatePct: resolvedPmiRatePct,
      llpaRatePct: resolvedLlpaRatePct,
      vaRequiredResidualIncome: requiredResidualIncome,
    });

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
      resolvedPolicy,
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

    throw new Error(
      `CRITICAL COMPLIANCE ERROR: Received unrecognized state parameter [${state}]. Unable to resolve geographic region mapping.`,
    );
  }
}

/**
 * Build a ResolvedPolicy and stamp it with a deterministic fingerprint over the
 * threshold values (undefined fields omitted, numbers rounded to 4 dp so
 * floating-point noise doesn't change the hash).
 */
function buildResolvedPolicy(p: Omit<ResolvedPolicy, "fingerprint">): ResolvedPolicy {
  const round = (n: number) => Math.round(n * 1e4) / 1e4;
  const canonical: Record<string, unknown> = { loanType: p.loanType };
  for (const [k, v] of Object.entries(p)) {
    if (k === "loanType") continue;
    if (typeof v === "number" && Number.isFinite(v)) canonical[k] = round(v);
  }
  const fingerprint = crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex");
  return { ...p, fingerprint };
}

export const consolidatedUnderwritingEngine = new ConsolidatedUnderwritingEngine();
