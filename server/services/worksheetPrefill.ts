import {
  selfEmploymentWorksheetSchema,
  type SelfEmploymentWorksheet,
} from "@shared/schema";
import { normalizeEntityName } from "@shared/taxFormExtraction";
import {
  getLatestInstancesForUser,
  type PublicTaxFormInstance,
} from "./taxDocumentIntelligence";
import { resolveBusinessEntities, type ResolvedEntity } from "./borrowerEntityResolution";

/**
 * Self-employment worksheet smart-fill (UAL P5 — the accuracy loop's intake
 * side, the program's Workstream B2).
 *
 * Builds a DRAFT SelfEmploymentWorksheet per resolved business entity from the
 * borrower's validated document extractions (P2). Doctrine:
 *  - The draft source is the DOCUMENT EXTRACTION, never tax_insights (that
 *    table is marketing/readiness signals only — an import-boundary test
 *    enforces the separation).
 *  - Drafts are NEVER persisted. The Zod-validated worksheet PUT endpoint
 *    remains the only write path; the borrower reviews field-by-field and the
 *    confirm action stamps confirmedByBorrowerAt. Only then does the cited
 *    Form 1084 calculator see the values (MR-2 / L2 I1).
 *  - Every proposed field carries provenance: which form instance it was read
 *    from, the model's confidence, and an honest "not readable" marker for
 *    anything the extraction could not see (proposed 0 + confirm-required,
 *    never a silent default).
 */

export interface PrefillFieldProvenance {
  /** Worksheet path, e.g. "scheduleC.currentYear.depreciation". */
  field: string;
  value: number;
  source:
    | {
        kind: "extracted";
        logicalDocumentId: string;
        formType: string;
        taxYear: number | null;
        extractedField: string;
        confidence: number;
      }
    | {
        kind: "derived";
        formula: string;
        components: Array<{ extractedField: string; value: number; confidence: number }>;
        logicalDocumentId: string;
      }
    | { kind: "not_readable"; reason: string };
}

export interface SeWorksheetDraft {
  entity: {
    identityKey: string;
    name: string | null;
    entityType: ResolvedEntity["entityType"];
    einLast4: string | null;
  };
  /** Schema-valid draft ready to render into the worksheet UI. */
  worksheet: SelfEmploymentWorksheet;
  provenance: PrefillFieldProvenance[];
  warnings: string[];
}

const num = (i: PublicTaxFormInstance, field: string): number | undefined => {
  const v = i.fields[field]?.value;
  return typeof v === "number" ? v : undefined;
};
const conf = (i: PublicTaxFormInstance, field: string): number =>
  i.fields[field]?.confidence ?? 0;

function extracted(
  field: string,
  i: PublicTaxFormInstance,
  extractedField: string,
  value: number,
): PrefillFieldProvenance {
  return {
    field,
    value,
    source: {
      kind: "extracted",
      logicalDocumentId: i.logicalDocumentId,
      formType: i.formType,
      taxYear: i.taxYear,
      extractedField,
      confidence: conf(i, extractedField),
    },
  };
}

function notReadable(field: string, reason: string): PrefillFieldProvenance {
  return { field, value: 0, source: { kind: "not_readable", reason } };
}

// --- Schedule C mapping (worksheet ← P2 catalog fields) ----------------------

function scheduleCYearDraft(
  prefix: string,
  i: PublicTaxFormInstance,
  provenance: PrefillFieldProvenance[],
  warnings: string[],
) {
  const map = (wkField: string, exField: string): number => {
    const v = num(i, exField);
    if (v !== undefined) {
      provenance.push(extracted(`${prefix}.${wkField}`, i, exField, v));
      return v;
    }
    provenance.push(
      notReadable(`${prefix}.${wkField}`, `Not readable from the ${i.taxYear ?? ""} Schedule C — confirm or enter manually.`),
    );
    return 0;
  };

  const net = map("netProfitOrLoss", "netProfitOrLoss");
  const depreciation = map("depreciation", "depreciationAndSection179");
  const depletion = map("depletion", "depletion");
  const businessUseOfHome = map("businessUseOfHome", "businessUseOfHomeExpenses");
  const mealsExclusion = map("mealsExclusion", "deductibleMeals");

  // amortizationOrCasualtyLoss is the SUM of two Part V detail items — a
  // derived draft, flagged as such.
  const amort = num(i, "amortizationInOtherExpenses");
  const casualty = num(i, "casualtyLossInOtherExpenses");
  let amortizationOrCasualtyLoss = 0;
  if (amort !== undefined || casualty !== undefined) {
    amortizationOrCasualtyLoss = (amort ?? 0) + (casualty ?? 0);
    provenance.push({
      field: `${prefix}.amortizationOrCasualtyLoss`,
      value: amortizationOrCasualtyLoss,
      source: {
        kind: "derived",
        formula: "amortizationInOtherExpenses + casualtyLossInOtherExpenses",
        logicalDocumentId: i.logicalDocumentId,
        components: [
          ...(amort !== undefined
            ? [{ extractedField: "amortizationInOtherExpenses", value: amort, confidence: conf(i, "amortizationInOtherExpenses") }]
            : []),
          ...(casualty !== undefined
            ? [{ extractedField: "casualtyLossInOtherExpenses", value: casualty, confidence: conf(i, "casualtyLossInOtherExpenses") }]
            : []),
        ],
      },
    });
  } else {
    provenance.push(
      notReadable(`${prefix}.amortizationOrCasualtyLoss`, "No amortization/casualty items readable in Part V other expenses."),
    );
  }

  // Non-recurring income is not on the extraction catalog (it requires reading
  // the return's narrative) — always an explicit confirm.
  provenance.push(
    notReadable(`${prefix}.nonRecurringIncome`, "Non-recurring income cannot be read automatically — the borrower identifies it."),
  );
  warnings.push(
    `${i.taxYear ?? "Year"} Schedule C: non-recurring income defaults to 0 and MUST be confirmed by the borrower.`,
  );

  return {
    taxYear: i.taxYear ?? undefined,
    netProfitOrLoss: net,
    depreciation: Math.max(0, depreciation),
    depletion: Math.max(0, depletion),
    amortizationOrCasualtyLoss: Math.max(0, amortizationOrCasualtyLoss),
    businessUseOfHome: Math.max(0, businessUseOfHome),
    mealsExclusion: Math.max(0, mealsExclusion),
    nonRecurringIncome: 0,
  };
}

// --- K-1 mapping --------------------------------------------------------------

function k1YearDraft(
  prefix: string,
  i: PublicTaxFormInstance,
  provenance: PrefillFieldProvenance[],
) {
  const map = (wkField: string, exField: string, floor0 = false): number => {
    const v = num(i, exField);
    if (v !== undefined) {
      provenance.push(extracted(`${prefix}.${wkField}`, i, exField, v));
      return floor0 ? Math.max(0, v) : v;
    }
    provenance.push(notReadable(`${prefix}.${wkField}`, `Not readable from the ${i.taxYear ?? ""} K-1.`));
    return 0;
  };
  return {
    taxYear: i.taxYear ?? undefined,
    ordinaryBusinessIncome: map("ordinaryBusinessIncome", "ordinaryBusinessIncomeOrLoss"),
    netRentalRealEstateIncome: map("netRentalRealEstateIncome", "netRentalRealEstateIncomeOrLoss"),
    otherNetRentalIncome: map("otherNetRentalIncome", "otherNetRentalIncomeOrLoss"),
    guaranteedPayments: map("guaranteedPayments", "guaranteedPayments", true),
    distributionsReceived: map("distributionsReceived", "distributionsTotal", true),
  };
}

/**
 * Liquidity components from the entity's business return Schedule L. The
 * worksheet wants currentAssets/inventory/currentLiabilities; Schedule L
 * captures components, so the draft SUMS them and marks the sums as derived —
 * the borrower (or their accountant) confirms the classification.
 */
function liquidityDraft(
  parentReturn: PublicTaxFormInstance,
  provenance: PrefillFieldProvenance[],
  warnings: string[],
): { currentAssets: number; currentLiabilities: number; inventory: number } | undefined {
  const cash = num(parentReturn, "scheduleLCashEndOfYear");
  const recv = num(parentReturn, "scheduleLReceivablesEndOfYear");
  const inv = num(parentReturn, "scheduleLInventoriesEndOfYear");
  const ap = num(parentReturn, "scheduleLAccountsPayableEndOfYear");
  const std = num(parentReturn, "scheduleLShortTermDebtEndOfYear");
  const ocl = num(parentReturn, "scheduleLOtherCurrentLiabilitiesEndOfYear");

  const assetParts = [cash, recv, inv].filter((v): v is number => v !== undefined);
  const liabParts = [ap, std, ocl].filter((v): v is number => v !== undefined);
  if (assetParts.length === 0 || liabParts.length === 0) return undefined;

  const currentAssets = assetParts.reduce((s, v) => s + v, 0);
  const currentLiabilities = liabParts.reduce((s, v) => s + v, 0);
  const inventory = inv ?? 0;

  provenance.push({
    field: "k1.liquidity.currentAssets",
    value: currentAssets,
    source: {
      kind: "derived",
      formula: "Schedule L: cash + receivables + inventories (end of year)",
      logicalDocumentId: parentReturn.logicalDocumentId,
      components: [
        ...(cash !== undefined ? [{ extractedField: "scheduleLCashEndOfYear", value: cash, confidence: conf(parentReturn, "scheduleLCashEndOfYear") }] : []),
        ...(recv !== undefined ? [{ extractedField: "scheduleLReceivablesEndOfYear", value: recv, confidence: conf(parentReturn, "scheduleLReceivablesEndOfYear") }] : []),
        ...(inv !== undefined ? [{ extractedField: "scheduleLInventoriesEndOfYear", value: inv, confidence: conf(parentReturn, "scheduleLInventoriesEndOfYear") }] : []),
      ],
    },
  });
  provenance.push({
    field: "k1.liquidity.currentLiabilities",
    value: currentLiabilities,
    source: {
      kind: "derived",
      formula: "Schedule L: accounts payable + short-term debt + other current liabilities (end of year)",
      logicalDocumentId: parentReturn.logicalDocumentId,
      components: [
        ...(ap !== undefined ? [{ extractedField: "scheduleLAccountsPayableEndOfYear", value: ap, confidence: conf(parentReturn, "scheduleLAccountsPayableEndOfYear") }] : []),
        ...(std !== undefined ? [{ extractedField: "scheduleLShortTermDebtEndOfYear", value: std, confidence: conf(parentReturn, "scheduleLShortTermDebtEndOfYear") }] : []),
        ...(ocl !== undefined ? [{ extractedField: "scheduleLOtherCurrentLiabilitiesEndOfYear", value: ocl, confidence: conf(parentReturn, "scheduleLOtherCurrentLiabilitiesEndOfYear") }] : []),
      ],
    },
  });
  warnings.push(
    "Liquidity current assets/liabilities are SUMS of Schedule L components — the classification is a draft; the borrower or their accountant confirms it (B3-3.6-07 ratio runs only on confirmed figures).",
  );

  return { currentAssets, currentLiabilities, inventory };
}

/** Pure core: build one entity's draft from its form instances. */
export function buildEntityWorksheetDraft(
  entity: ResolvedEntity,
  instances: PublicTaxFormInstance[],
): SeWorksheetDraft | null {
  const provenance: PrefillFieldProvenance[] = [];
  const warnings: string[] = [];
  const entityNorm = entity.name ? normalizeEntityName(entity.name) : null;
  const ofEntity = (type: string) =>
    instances
      .filter(
        (i) =>
          i.formType === type &&
          i.entityName &&
          entityNorm !== null &&
          normalizeEntityName(i.entityName) === entityNorm,
      )
      .sort((a, b) => (b.taxYear ?? 0) - (a.taxYear ?? 0));

  const isScheduleC =
    entity.entityType === "sole_proprietorship" || entity.entityType === "single_member_llc";
  const isK1 = entity.entityType === "partnership" || entity.entityType === "s_corporation";
  if (!isScheduleC && !isK1) return null; // C-corp: no SE worksheet applies

  let worksheet: SelfEmploymentWorksheet;

  if (isScheduleC) {
    const years = ofEntity("schedule_c");
    if (years.length === 0) return null;
    const [current, prior] = years;
    worksheet = {
      version: 1,
      businessStructure: entity.entityType,
      scheduleC: {
        currentYear: scheduleCYearDraft("scheduleC.currentYear", current, provenance, warnings),
        ...(prior
          ? { priorYear: scheduleCYearDraft("scheduleC.priorYear", prior, provenance, warnings) }
          : {}),
      },
    } as SelfEmploymentWorksheet;
    if (!prior) {
      warnings.push(
        "Only one tax year of this business is extracted — the calculator's trend analysis needs the prior-year return.",
      );
    }
  } else {
    const k1Years = ofEntity("schedule_k1");
    if (k1Years.length === 0) return null;
    const [current, prior] = k1Years;
    const parentType =
      entity.entityType === "s_corporation" ? "business_tax_return_1120s" : "business_tax_return_1065";
    const [parentReturn] = ofEntity(parentType).filter((p) => p.taxYear === current.taxYear);
    const liquidity = parentReturn
      ? liquidityDraft(parentReturn, provenance, warnings)
      : undefined;
    if (!parentReturn) {
      warnings.push(
        "The entity's business return is not in the file — liquidity components cannot be drafted (the K-1 income usability test needs them or documented distributions).",
      );
    }
    const ownership = entity.ownershipPercent ?? undefined;
    if (ownership !== undefined) {
      provenance.push({
        field: "ownershipPercent",
        value: ownership,
        source: {
          kind: "extracted",
          logicalDocumentId: current.logicalDocumentId,
          formType: current.formType,
          taxYear: current.taxYear,
          extractedField: "ownershipPercentEndOfYear",
          confidence: conf(current, "ownershipPercentEndOfYear"),
        },
      });
    }
    worksheet = {
      version: 1,
      businessStructure: entity.entityType,
      ...(ownership !== undefined ? { ownershipPercent: ownership } : {}),
      k1: {
        currentYear: k1YearDraft("k1.currentYear", current, provenance),
        ...(prior ? { priorYear: k1YearDraft("k1.priorYear", prior, provenance) } : {}),
        hasTwoYearGuaranteedPayments: false,
        ...(liquidity ? { liquidity } : {}),
        w2FromBusiness: 0,
      },
    } as SelfEmploymentWorksheet;
    warnings.push(
      "hasTwoYearGuaranteedPayments defaults to false — the borrower attests the two-year history; the draft cannot.",
    );
  }

  // The draft must be exactly what the write path would accept.
  const parsed = selfEmploymentWorksheetSchema.safeParse(worksheet);
  if (!parsed.success) {
    // A draft that fails its own schema is a bug — surface loudly.
    throw new Error(
      `worksheetPrefill produced a schema-invalid draft for ${entity.identityKey}: ${parsed.error.message}`,
    );
  }

  return {
    entity: {
      identityKey: entity.identityKey,
      name: entity.name,
      entityType: entity.entityType,
      einLast4: entity.einLast4,
    },
    worksheet: parsed.data,
    provenance,
    warnings,
  };
}

/** IO: drafts for every SE-type entity resolved from the user's latest extractions. */
export async function buildSeWorksheetDrafts(userId: string): Promise<SeWorksheetDraft[]> {
  const instances = await getLatestInstancesForUser(userId);
  const entities = resolveBusinessEntities(instances);
  const drafts: SeWorksheetDraft[] = [];
  for (const entity of entities) {
    const draft = buildEntityWorksheetDraft(entity, instances);
    if (draft) drafts.push(draft);
  }
  return drafts;
}
