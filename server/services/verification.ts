import { storage } from "../storage";
import { recalculateDecision } from "./decisionEngine";

// =============================================================================
// VERIFICATION ROLL-UP
//
// Fact-based lending requires knowing WHICH figures are verified, not just a
// single flag. Income, assets, and credit are verified independently (by a
// document review, a credit pull, or — later — Plaid/Argyle/The Work Number).
// When all three are verified, the application's financialDataProvenance
// auto-promotes to "verified", which is what the decision gate requires for a
// binding outcome. Each change also triggers a decision recalc.
// =============================================================================

export type VerificationDimension = "income" | "assets" | "credit";

const FIELD: Record<VerificationDimension, "incomeVerified" | "assetsVerified" | "creditVerified"> = {
  income: "incomeVerified",
  assets: "assetsVerified",
  credit: "creditVerified",
};

export async function markDimensionVerified(
  applicationId: string,
  dimension: VerificationDimension,
  verifiedBy?: string,
): Promise<void> {
  const app = await storage.getLoanApplication(applicationId);
  if (!app) return;

  await storage.updateLoanApplication(applicationId, { [FIELD[dimension]]: true });

  const income = dimension === "income" ? true : app.incomeVerified;
  const assets = dimension === "assets" ? true : app.assetsVerified;
  const credit = dimension === "credit" ? true : app.creditVerified;

  if (income && assets && credit && app.financialDataProvenance !== "verified") {
    await storage.updateLoanApplication(applicationId, {
      financialDataProvenance: "verified",
      financialDataVerifiedAt: new Date(),
      ...(verifiedBy ? { financialDataVerifiedBy: verifiedBy } : {}),
    });
    await recalculateDecision(applicationId, "verified");
  } else {
    await recalculateDecision(applicationId, `${dimension}_verified`);
  }
}
