import { storage } from "../../storage";
import type { DuFindings, LpaFindings } from "../ausSubmission";

/**
 * Autopilot AUS-findings mapper (Phase 2) — converts DU/LPA output into the
 * right split: borrower-actionable follow-ups vs. lender-internal conditions.
 *
 * The "3 conditions, only 2 borrower-actionable" behavior, deterministically:
 *   - Day 1 Certainty ASSETS not validated  → borrower links/uploads (actionable)
 *   - Day 1 Certainty INCOME  not validated  → borrower uploads pay stubs / W-2
 *   - Day 1 Certainty EMPLOYMENT not validated → the LO orders a VOE (internal)
 *   - structural / eligibility messages (LTV>97%, credit, DTI) → the LO handles
 *     the loan structure (internal)
 *
 * Borrower-actionable conditions become idempotent loan_conditions (same rail as
 * Phase 1 followUps.ts), cited to Day 1 Certainty. Internal conditions are NOT
 * turned into borrower asks — they already ride ausFindings + the commitment
 * letter, where the LO sees them. Homiquity is a broker: none of this is a
 * credit decision, and no messaging claims approval (Reg N).
 */

/** A condition normalized across the DU + LPA legs. */
export interface AusCondition {
  origin: "du" | "lpa";
  kind: "message" | "d1c_assets" | "d1c_income" | "d1c_employment";
  code: string;
  text: string;
}

export interface AusFollowUpPlan {
  category: string;
  title: string;
  description: string;
  requiredDocumentTypes: string[];
  sourceRule: string;
  borrowerActionable: boolean;
}

const AUS_CITATION = "Fannie Mae Day 1 Certainty (DU)";

interface D1cSpec {
  category: string;
  title: string;
  requiredDocumentTypes: string[];
  borrowerActionable: boolean;
  borrowerText: string;
}

const D1C_SPECS: Record<"d1c_assets" | "d1c_income" | "d1c_employment", D1cSpec> = {
  d1c_assets: {
    category: "assets",
    title: "Asset Verification (Day 1 Certainty)",
    requiredDocumentTypes: ["bank_statement"],
    borrowerActionable: true,
    borrowerText:
      "Link your bank/asset accounts or upload recent statements so we can validate your assets for Day 1 Certainty.",
  },
  d1c_income: {
    category: "income",
    title: "Income Verification (Day 1 Certainty)",
    requiredDocumentTypes: ["pay_stub", "w2"],
    borrowerActionable: true,
    borrowerText:
      "Upload your most recent pay stubs and W-2 so we can validate your income for Day 1 Certainty.",
  },
  d1c_employment: {
    // Employment (VOE) is lender-ordered, not a borrower upload — kept internal.
    category: "income",
    title: "Employment Verification (Day 1 Certainty)",
    requiredDocumentTypes: [],
    borrowerActionable: false,
    borrowerText: "Employment is verified directly with the employer.",
  },
};

/** Extract the conditions from a DU (+ optional LPA) result. Pure. */
export function classifyAusConditions(du: DuFindings, lpa?: LpaFindings | null): AusCondition[] {
  const out: AusCondition[] = [];
  const d1c = du.day1Certainty;
  if (!d1c.assets.relief) out.push({ origin: "du", kind: "d1c_assets", code: "D1C-ASSETS", text: d1c.assets.reason });
  if (!d1c.income.relief) out.push({ origin: "du", kind: "d1c_income", code: "D1C-INCOME", text: d1c.income.reason });
  if (!d1c.employment.relief) out.push({ origin: "du", kind: "d1c_employment", code: "D1C-EMPLOYMENT", text: d1c.employment.reason });
  for (const m of du.messages) {
    if (m.severity === "condition") out.push({ origin: "du", kind: "message", code: m.code, text: m.text });
  }
  if (lpa) {
    for (const m of lpa.messages) {
      if (m.severity === "condition") out.push({ origin: "lpa", kind: "message", code: m.code, text: m.text });
    }
  }
  return out;
}

/**
 * Map a normalized AUS condition to its follow-up plan. Pure, unit-testable.
 * `message`-kind conditions are structural/eligibility findings the LO handles —
 * they are NOT turned into borrower asks (borrowerActionable = false).
 */
export function planAusFollowUp(cond: AusCondition): AusFollowUpPlan {
  if (cond.kind === "message") {
    return {
      category: "compliance",
      title: `AUS condition ${cond.code}`,
      description: `${cond.text} (${cond.origin.toUpperCase()} ${cond.code})`,
      requiredDocumentTypes: [],
      sourceRule: `AUTOPILOT_AUS_${cond.code}`,
      borrowerActionable: false,
    };
  }
  const spec = D1C_SPECS[cond.kind];
  return {
    category: spec.category,
    title: spec.title,
    description: `${spec.borrowerText} (${AUS_CITATION})`,
    requiredDocumentTypes: spec.requiredDocumentTypes,
    sourceRule: `AUTOPILOT_AUS_${cond.kind.toUpperCase()}`,
    borrowerActionable: spec.borrowerActionable,
  };
}

export interface AusMaterializeResult {
  /** Titles of borrower follow-ups newly created on this call. */
  created: string[];
  /** Total borrower-actionable conditions found (incl. pre-existing). */
  borrowerActionable: number;
  /** Conditions kept with the lender (VOE, structural). */
  lenderInternal: number;
}

/**
 * Materialize the borrower-actionable AUS conditions as idempotent, cited
 * loan_conditions; count the lender-internal ones for narration. Never throws.
 * Caller gates on isAutopilotEnabled() + canGenerateFollowUps().
 */
export async function materializeAusFollowUps(
  applicationId: string,
  du: DuFindings,
  lpa?: LpaFindings | null,
): Promise<AusMaterializeResult> {
  const created: string[] = [];
  let borrowerActionable = 0;
  let lenderInternal = 0;
  try {
    const conditions = classifyAusConditions(du, lpa);
    const existing = await storage.getLoanConditionsByApplication(applicationId);
    const existingSourceRules = new Set(existing.map((c) => c.sourceRule).filter(Boolean));

    for (const cond of conditions) {
      const plan = planAusFollowUp(cond);
      if (!plan.borrowerActionable) {
        lenderInternal++;
        continue;
      }
      borrowerActionable++;
      if (existingSourceRules.has(plan.sourceRule)) continue;

      await storage.createLoanCondition({
        applicationId,
        category: plan.category,
        title: plan.title,
        description: plan.description,
        priority: "prior_to_docs",
        status: "outstanding",
        requiredDocumentTypes: plan.requiredDocumentTypes,
        isAutoGenerated: true,
        sourceRule: plan.sourceRule,
      });
      existingSourceRules.add(plan.sourceRule);
      created.push(plan.title);
    }
  } catch (err) {
    console.error(`[Autopilot] AUS follow-up materialization failed for ${applicationId} (non-fatal):`, err);
  }
  return { created, borrowerActionable, lenderInternal };
}
