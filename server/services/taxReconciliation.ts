import { db } from "../db";
import { eq } from "drizzle-orm";
import { borrowerBusinessEntities, type BorrowerBusinessEntity } from "@shared/schema";
import { normalizeEntityName, type TaxFormType } from "@shared/taxFormExtraction";
import {
  getLatestInstancesForUser,
  type PublicTaxFormInstance,
} from "./taxDocumentIntelligence";

/**
 * Cross-form tie-out engine (UAL P2b) — the deterministic accuracy layer on
 * top of AI extraction. A tax package must reconcile against ITSELF: what
 * Schedule C says it sent to Schedule 1, Schedule 1 must show; what the K-1s
 * sum to, the parent 1065 must show. A variance means the extraction (or the
 * document) is wrong somewhere, and a human looks — variances are review
 * flags, never auto-decisions.
 *
 * AUTHORITY: every check cites a transcribed carry relationship (C1–C10) in
 * docs/irs-forms/README.md — verified against the official IRS PDFs in that
 * directory. No relationship is checked from memory (L2 I2). Checks whose
 * relationship is not yet transcribed there (1120-S/K-1, 8825, Schedule B/D,
 * 4562) are NOT implemented yet.
 *
 * TOLERANCES are pure arithmetic, not policy: IRS returns are whole-dollar
 * rounded, so a sum of n independently-rounded components can differ from the
 * separately-rounded total by at most 0.5×(n+1) — we allow ceil of that.
 * Materiality judgments beyond rounding belong to policy scalars + humans
 * (P5), not this engine.
 */

export interface TieOutSourceRef {
  formType: TaxFormType;
  logicalDocumentId: string;
  fieldName: string;
}

export type TieOutStatus = "pass" | "variance" | "not_evaluable" | "info";

export interface TieOutCheck {
  checkId:
    | "schedule_c_to_schedule_1"
    | "schedule_e_to_schedule_1"
    | "schedule_1_to_1040"
    | "form_1040_total_income"
    | "k1_sum_to_1065"
    | "k1_share_of_1065"
    | "form_1065_internal"
    | "yoy_business_net";
  taxYear: number;
  entityName?: string | null;
  status: TieOutStatus;
  expected?: number;
  actual?: number;
  varianceAmount?: number;
  tolerance?: number;
  /** Human-readable sentence: what was compared and what it means. */
  detail: string;
  /** Carry-map anchor(s) in docs/irs-forms/README.md. */
  authority: string;
  sourceRefs: TieOutSourceRef[];
}

export interface TaxReconciliationReport {
  userId: string;
  generatedAt: string;
  taxYears: number[];
  formCount: number;
  entities: Array<
    Pick<
      BorrowerBusinessEntity,
      | "id"
      | "identityKey"
      | "entityType"
      | "name"
      | "einLast4"
      | "ownershipPercent"
      | "firstTaxYear"
      | "lastTaxYear"
      | "sourceFormCount"
      | "resolutionNotes"
      | "autoResolved"
    >
  >;
  checks: TieOutCheck[];
  summary: { pass: number; variance: number; notEvaluable: number; info: number };
}

/** Whole-dollar rounding bound for a sum of n rounded components vs a rounded total. */
export function roundingTolerance(componentCount: number): number {
  return Math.ceil(0.5 * (componentCount + 1));
}

const num = (i: PublicTaxFormInstance, field: string): number | undefined => {
  const v = i.fields[field]?.value;
  return typeof v === "number" ? v : undefined;
};

const ref = (i: PublicTaxFormInstance, fieldName: string): TieOutSourceRef => ({
  formType: i.formType,
  logicalDocumentId: i.logicalDocumentId,
  fieldName,
});

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function compare(
  base: Omit<TieOutCheck, "status" | "expected" | "actual" | "varianceAmount" | "tolerance" | "detail">,
  expected: number,
  actual: number,
  tolerance: number,
  passDetail: string,
  varianceDetail: string,
): TieOutCheck {
  const varianceAmount = actual - expected;
  const pass = Math.abs(varianceAmount) <= tolerance;
  return {
    ...base,
    status: pass ? "pass" : "variance",
    expected,
    actual,
    varianceAmount,
    tolerance,
    detail: pass ? passDetail : varianceDetail,
  };
}

/**
 * Pure tie-out core — deterministic for a given instance list.
 * Checks are grouped per tax year (and per entity where applicable) and
 * returned in a stable order.
 */
export function runTieOuts(instances: PublicTaxFormInstance[]): TieOutCheck[] {
  const checks: TieOutCheck[] = [];
  const years = [...new Set(instances.map((i) => i.taxYear).filter((y): y is number => y !== null))]
    .sort((a, b) => b - a);

  const ofYear = (year: number, type: TaxFormType) =>
    instances.filter((i) => i.taxYear === year && i.formType === type);

  for (const year of years) {
    const schCs = ofYear(year, "schedule_c");
    const [sch1] = ofYear(year, "schedule_1");
    const [schE] = ofYear(year, "schedule_e");
    const [f1040] = ofYear(year, "tax_return_1040");

    // --- Schedule C → Schedule 1 (C1, C2) --------------------------------
    {
      const nets = schCs
        .map((c) => ({ c, net: num(c, "netProfitOrLoss") }))
        .filter((x): x is { c: PublicTaxFormInstance; net: number } => x.net !== undefined);
      const sch1Biz = sch1 ? num(sch1, "businessIncomeOrLoss") : undefined;
      const base = {
        checkId: "schedule_c_to_schedule_1" as const,
        taxYear: year,
        authority: "docs/irs-forms/README.md C1, C2",
        sourceRefs: [
          ...nets.map((x) => ref(x.c, "netProfitOrLoss")),
          ...(sch1 ? [ref(sch1, "businessIncomeOrLoss")] : []),
        ],
      };
      if (nets.length > 0 && sch1Biz !== undefined) {
        const sum = nets.reduce((s, x) => s + x.net, 0);
        checks.push(
          compare(
            base,
            sum,
            sch1Biz,
            roundingTolerance(nets.length),
            `${nets.length} Schedule C net profit/(loss) figure(s) totaling ${money(sum)} tie to Schedule 1's business income line.`,
            `Schedule 1 reports ${money(sch1Biz)} of business income but the ${nets.length} extracted Schedule C(s) total ${money(sum)} — an extraction error or a Schedule C missing from the upload.`,
          ),
        );
      } else if (nets.length > 0 || sch1Biz !== undefined) {
        checks.push({
          ...base,
          status: "not_evaluable",
          detail:
            nets.length === 0
              ? "Schedule 1 shows business income but no Schedule C net profit/(loss) was extracted — the Schedule C pages may be missing or unreadable."
              : "Schedule C(s) extracted but no Schedule 1 business-income figure — the Schedule 1 page may be missing or unreadable.",
        });
      }
    }

    // --- Schedule E (+K-1 line) → Schedule 1 (C3, C4, C5) ----------------
    if (schE || (sch1 && num(sch1, "rentalRealEstatePartnershipsSCorpsIncomeOrLoss") !== undefined)) {
      const partI = schE ? num(schE, "netRentalRealEstateIncomeOrLoss") : undefined;
      const partII = schE ? num(schE, "partnershipSCorpIncomeOrLossTotal") : undefined;
      const sch1Rental = sch1
        ? num(sch1, "rentalRealEstatePartnershipsSCorpsIncomeOrLoss")
        : undefined;
      const base = {
        checkId: "schedule_e_to_schedule_1" as const,
        taxYear: year,
        authority: "docs/irs-forms/README.md C3, C4, C5",
        sourceRefs: [
          ...(schE
            ? [ref(schE, "netRentalRealEstateIncomeOrLoss"), ref(schE, "partnershipSCorpIncomeOrLossTotal")]
            : []),
          ...(sch1 ? [ref(sch1, "rentalRealEstatePartnershipsSCorpsIncomeOrLoss")] : []),
        ],
      };
      if (partI !== undefined && partII !== undefined && sch1Rental !== undefined) {
        checks.push(
          compare(
            base,
            partI + partII,
            sch1Rental,
            roundingTolerance(2),
            `Schedule E Part I (${money(partI)}) + Part II (${money(partII)}) tie to Schedule 1's rental/partnership line.`,
            `Schedule 1's rental/partnership line shows ${money(sch1Rental)} vs ${money(partI + partII)} from Schedule E Parts I+II. Note: this line also carries royalties/estates/REMIC (Parts III–V, not captured) — the difference may be legitimate, but a human should confirm.`,
          ),
        );
      } else {
        checks.push({
          ...base,
          status: "not_evaluable",
          detail:
            "Schedule E Part I and Part II totals plus the Schedule 1 rental/partnership line are all required for this tie-out; at least one was not extracted.",
        });
      }
    }

    // --- Schedule 1 → Form 1040 (C6, C7) ----------------------------------
    if (sch1 || f1040) {
      const sch1Total = sch1 ? num(sch1, "additionalIncomeTotal") : undefined;
      const f1040Addl = f1040 ? num(f1040, "additionalIncomeFromSchedule1") : undefined;
      const base = {
        checkId: "schedule_1_to_1040" as const,
        taxYear: year,
        authority: "docs/irs-forms/README.md C6, C7",
        sourceRefs: [
          ...(sch1 ? [ref(sch1, "additionalIncomeTotal")] : []),
          ...(f1040 ? [ref(f1040, "additionalIncomeFromSchedule1")] : []),
        ],
      };
      if (sch1Total !== undefined && f1040Addl !== undefined) {
        checks.push(
          compare(
            base,
            sch1Total,
            f1040Addl,
            roundingTolerance(1),
            `Schedule 1's additional-income total (${money(sch1Total)}) matches the Form 1040 carry line.`,
            `Form 1040 carries ${money(f1040Addl)} of additional income but Schedule 1 totals ${money(sch1Total)} — one of the two was misread, or the pages belong to different filings.`,
          ),
        );
      } else if (f1040Addl !== undefined && !sch1) {
        checks.push({
          ...base,
          status: "not_evaluable",
          detail: `Form 1040 carries ${money(f1040Addl)} of additional income from Schedule 1, but no Schedule 1 was found in the file — request it.`,
        });
      } else if (sch1 && f1040) {
        checks.push({
          ...base,
          status: "not_evaluable",
          detail: "Both forms are present but one of the carry figures was not extracted.",
        });
      }
    }

    // --- Form 1040 total income coverage (C8) ------------------------------
    if (f1040) {
      const total = num(f1040, "totalIncome");
      const components: Array<[string, number | undefined]> = [
        ["wagesSalariesTips", num(f1040, "wagesSalariesTips")],
        ["taxableInterest", num(f1040, "taxableInterest")],
        ["ordinaryDividends", num(f1040, "ordinaryDividends")],
        ["capitalGainOrLoss", num(f1040, "capitalGainOrLoss")],
        ["additionalIncomeFromSchedule1", num(f1040, "additionalIncomeFromSchedule1")],
      ];
      const captured = components.filter((c): c is [string, number] => c[1] !== undefined);
      if (total !== undefined && captured.length > 0) {
        const sum = captured.reduce((s, [, v]) => s + v, 0);
        const tol = roundingTolerance(captured.length);
        const base = {
          checkId: "form_1040_total_income" as const,
          taxYear: year,
          authority: "docs/irs-forms/README.md C8",
          sourceRefs: [ref(f1040, "totalIncome"), ...captured.map(([f]) => ref(f1040, f))],
        };
        if (sum > total + tol) {
          checks.push({
            ...base,
            status: "variance",
            expected: total,
            actual: sum,
            varianceAmount: sum - total,
            tolerance: tol,
            detail: `Captured income components sum to ${money(sum)}, EXCEEDING the return's total income of ${money(total)} — impossible on a consistent return; an extraction error is likely.`,
          });
        } else if (Math.abs(sum - total) <= tol) {
          checks.push({
            ...base,
            status: "pass",
            expected: total,
            actual: sum,
            varianceAmount: sum - total,
            tolerance: tol,
            detail: `Captured components fully explain the return's total income of ${money(total)}.`,
          });
        } else {
          checks.push({
            ...base,
            status: "info",
            expected: total,
            actual: sum,
            varianceAmount: sum - total,
            tolerance: tol,
            detail: `Captured components explain ${money(sum)} of the ${money(total)} total income; the remainder is in components the extractor does not capture (e.g. IRA, pension, Social Security lines) — informational, not a variance.`,
          });
        }
      }
    }

    // --- K-1s ↔ parent Form 1065, per entity (C9, C10) ---------------------
    const parents1065 = ofYear(year, "business_tax_return_1065");
    for (const parent of parents1065) {
      const parentName = parent.entityName ? normalizeEntityName(parent.entityName) : null;
      const k1s = ofYear(year, "schedule_k1").filter((k) => {
        const kn = k.entityName ? normalizeEntityName(k.entityName) : null;
        const kEin = k.fields.entityEinLast4?.value;
        const pEin = parent.fields.entityEinLast4?.value;
        const einMatch = typeof kEin === "string" && typeof pEin === "string" && kEin === pEin;
        return (kn !== null && kn === parentName) || einMatch;
      });
      const parentOrdinary = num(parent, "ordinaryBusinessIncomeOrLoss");
      const attachedCount = num(parent, "numberOfSchedulesK1Attached");
      const k1Ordinaries = k1s
        .map((k) => ({ k, v: num(k, "ordinaryBusinessIncomeOrLoss") }))
        .filter((x): x is { k: PublicTaxFormInstance; v: number } => x.v !== undefined);

      const base = {
        checkId: "k1_sum_to_1065" as const,
        taxYear: year,
        entityName: parent.entityName,
        authority: "docs/irs-forms/README.md C9, C10",
        sourceRefs: [
          ref(parent, "ordinaryBusinessIncomeOrLoss"),
          ...k1Ordinaries.map((x) => ref(x.k, "ordinaryBusinessIncomeOrLoss")),
        ],
      };
      if (parentOrdinary === undefined) {
        checks.push({
          ...base,
          status: "not_evaluable",
          detail: "The Form 1065 ordinary business income figure was not extracted.",
        });
      } else if (attachedCount !== undefined && k1Ordinaries.length < attachedCount) {
        checks.push({
          ...base,
          status: "not_evaluable",
          detail: `The return reports ${attachedCount} Schedule(s) K-1 attached but only ${k1Ordinaries.length} K-1(s) for this entity are in the file — request the missing K-1(s) before the partner shares can be reconciled.`,
        });
      } else if (k1Ordinaries.length > 0 && attachedCount !== undefined && k1Ordinaries.length === attachedCount) {
        const sum = k1Ordinaries.reduce((s, x) => s + x.v, 0);
        checks.push(
          compare(
            base,
            parentOrdinary,
            sum,
            roundingTolerance(k1Ordinaries.length),
            `All ${attachedCount} K-1 ordinary-income shares (${money(sum)}) tie to the Form 1065 ordinary business income.`,
            `The ${k1Ordinaries.length} K-1 shares total ${money(sum)} but Form 1065 reports ${money(parentOrdinary)} — an extraction error or a mismatched K-1.`,
          ),
        );
      }

      // Pro-rata share per K-1: informational only — special allocations can
      // legitimately differ from the ownership percentage.
      for (const { k, v } of k1Ordinaries) {
        const pct = num(k, "ownershipPercentEndOfYear");
        if (pct === undefined || parentOrdinary === undefined) continue;
        const expected = (pct / 100) * parentOrdinary;
        // Precision bound: ownership % is printed to 2dp → max pro-rata error
        // is |parent| × 0.00005, plus $1 whole-dollar rounding.
        const tol = Math.ceil(Math.abs(parentOrdinary) * 0.00005) + 1;
        const matches = Math.abs(v - expected) <= tol;
        checks.push({
          checkId: "k1_share_of_1065",
          taxYear: year,
          entityName: parent.entityName,
          status: matches ? "pass" : "info",
          expected: Math.round(expected),
          actual: v,
          varianceAmount: Math.round(v - expected),
          tolerance: tol,
          detail: matches
            ? `K-1 ordinary income (${money(v)}) matches the pro-rata ${pct}% share of the entity's ordinary income.`
            : `K-1 ordinary income (${money(v)}) differs from the pro-rata ${pct}% share (${money(Math.round(expected))}). Partnership agreements may allocate non-pro-rata (special allocations) — informational, confirm against the K-1.`,
          authority: "docs/irs-forms/README.md C9, C10",
          sourceRefs: [
            ref(parent, "ordinaryBusinessIncomeOrLoss"),
            ref(k, "ordinaryBusinessIncomeOrLoss"),
            ref(k, "ownershipPercentEndOfYear"),
          ],
        });
      }

      // 1065 internal identity: total income − total deductions = ordinary (C9).
      const totalIncome = num(parent, "totalIncome");
      const totalDeductions = num(parent, "totalDeductions");
      if (totalIncome !== undefined && totalDeductions !== undefined && parentOrdinary !== undefined) {
        checks.push(
          compare(
            {
              checkId: "form_1065_internal",
              taxYear: year,
              entityName: parent.entityName,
              authority: "docs/irs-forms/README.md C9",
              sourceRefs: [
                ref(parent, "totalIncome"),
                ref(parent, "totalDeductions"),
                ref(parent, "ordinaryBusinessIncomeOrLoss"),
              ],
            },
            totalIncome - totalDeductions,
            parentOrdinary,
            roundingTolerance(2),
            `Form 1065 internal math checks out: total income − total deductions = ordinary business income.`,
            `Form 1065 total income (${money(totalIncome)}) − total deductions (${money(totalDeductions)}) = ${money(totalIncome - totalDeductions)}, but the ordinary business income line reads ${money(parentOrdinary)} — a misread somewhere on page 1.`,
          ),
        );
      }
    }
  }

  // --- Year-over-year business trend (informational; no thresholds — the
  // cited declining-income judgment lives in the Fannie-1084 calculator) ----
  const entityYearNets = new Map<string, Map<number, { net: number; inst: PublicTaxFormInstance }>>();
  for (const i of instances) {
    if (i.formType !== "schedule_c" && i.formType !== "business_tax_return_1065") continue;
    if (i.taxYear === null || !i.entityName) continue;
    const net = num(i, i.formType === "schedule_c" ? "netProfitOrLoss" : "ordinaryBusinessIncomeOrLoss");
    if (net === undefined) continue;
    const key = normalizeEntityName(i.entityName);
    const yearMap = entityYearNets.get(key) ?? new Map();
    yearMap.set(i.taxYear, { net, inst: i });
    entityYearNets.set(key, yearMap);
  }
  for (const yearMap of entityYearNets.values()) {
    const yrs = [...yearMap.keys()].sort((a, b) => b - a);
    for (let i = 0; i + 1 < yrs.length; i++) {
      const cur = yearMap.get(yrs[i])!;
      const prior = yearMap.get(yrs[i + 1])!;
      const delta = cur.net - prior.net;
      const pct = prior.net !== 0 ? Math.round((delta / Math.abs(prior.net)) * 100) : null;
      checks.push({
        checkId: "yoy_business_net",
        taxYear: yrs[i],
        entityName: cur.inst.entityName,
        status: "info",
        expected: prior.net,
        actual: cur.net,
        varianceAmount: delta,
        detail: `${cur.inst.entityName}: net ${money(prior.net)} (${yrs[i + 1]}) → ${money(cur.net)} (${yrs[i]})${pct !== null ? `, ${delta >= 0 ? "+" : ""}${pct}%` : ""}. Trend qualification judgment is made by the cited self-employment income calculator, not here.`,
        authority: "informational (no carry relationship)",
        sourceRefs: [
          ref(prior.inst, prior.inst.formType === "schedule_c" ? "netProfitOrLoss" : "ordinaryBusinessIncomeOrLoss"),
          ref(cur.inst, cur.inst.formType === "schedule_c" ? "netProfitOrLoss" : "ordinaryBusinessIncomeOrLoss"),
        ],
      });
    }
  }

  // Stable ordering: newest year first, then check id, then entity.
  return checks.sort(
    (a, b) =>
      b.taxYear - a.taxYear ||
      a.checkId.localeCompare(b.checkId) ||
      (a.entityName ?? "").localeCompare(b.entityName ?? ""),
  );
}

/** IO wrapper: latest instances + persisted entities → full reconciliation report. */
export async function buildTaxReconciliation(userId: string): Promise<TaxReconciliationReport> {
  const instances = await getLatestInstancesForUser(userId);
  const checks = runTieOuts(instances);
  const entities = await db
    .select({
      id: borrowerBusinessEntities.id,
      identityKey: borrowerBusinessEntities.identityKey,
      entityType: borrowerBusinessEntities.entityType,
      name: borrowerBusinessEntities.name,
      einLast4: borrowerBusinessEntities.einLast4,
      ownershipPercent: borrowerBusinessEntities.ownershipPercent,
      firstTaxYear: borrowerBusinessEntities.firstTaxYear,
      lastTaxYear: borrowerBusinessEntities.lastTaxYear,
      sourceFormCount: borrowerBusinessEntities.sourceFormCount,
      resolutionNotes: borrowerBusinessEntities.resolutionNotes,
      autoResolved: borrowerBusinessEntities.autoResolved,
    })
    .from(borrowerBusinessEntities)
    .where(eq(borrowerBusinessEntities.userId, userId));

  return {
    userId,
    generatedAt: new Date().toISOString(),
    taxYears: [...new Set(instances.map((i) => i.taxYear).filter((y): y is number => y !== null))].sort(
      (a, b) => b - a,
    ),
    formCount: instances.length,
    entities,
    checks,
    summary: {
      pass: checks.filter((c) => c.status === "pass").length,
      variance: checks.filter((c) => c.status === "variance").length,
      notEvaluable: checks.filter((c) => c.status === "not_evaluable").length,
      info: checks.filter((c) => c.status === "info").length,
    },
  };
}
