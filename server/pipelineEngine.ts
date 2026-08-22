import { storage } from "./storage";
import type {
  LoanApplication,
  LoanCondition,
  LoanMilestone,
  User,
  InsertLoanCondition,
  InsertLoanMilestone,
  Task,
  InsertTask,
} from "@shared/schema";
import { loanConditions, loanMilestones, users, dealActivities } from "@shared/schema";
import { db } from "./db";
import { inArray, desc, eq, max, and, count } from "drizzle-orm";
import { computeFileHealth, daysSince, type FileHealth } from "./services/fileHealth";
import { documentTypesMatch } from "@shared/documentTypes";
import { INCOME_TYPES, type IncomeType } from "@shared/schema";
import {
  documentIncomeTypeForStoredSource,
  type DocumentIncomeType,
} from "@shared/incomeTypes";
import { DOCUMENT_STATUS } from "@shared/documentStatus";
import {
  LOAN_APP_TRANSITIONS,
  isLoanAppStatus,
  isValidLoanAppTransition,
  type LoanAppStatus,
} from "@shared/schema";
import {
  verifyAssets,
  assessLiabilities,
  calculateDTI,
} from "./underwriting";

interface DocumentRequirement {
  documentType: string;
  yearsRequired?: number[];
  description: string;
  priority: "prior_to_approval" | "prior_to_docs" | "prior_to_funding";
  conditionCategory: string;
  conditionTitle: string;
  /**
   * Selling Guide section that requires this document, as printed in the GUIDE
   * BODY (never the URL slug — Fannie's slugs carry stale section numbers).
   * Required on every income-source rule; absent on the asset/property/credit
   * rules, which are platform policy rather than a transcribed Guide rule.
   */
  guidelineRef?: string;
}

/** An income rule may not exist without a citation. See the matrix doc. */
type IncomeDocumentRequirement = DocumentRequirement & { guidelineRef: string };

/**
 * `shared/incomeTypes.ts` restates the income-type union rather than importing
 * it (that module is client-bundled; `@shared/schema` is not). These lines fail
 * the build if the restatement ever drifts from the real union.
 */
type _IncomeUnionForward = DocumentIncomeType extends IncomeType ? true : never;
type _IncomeUnionBack = IncomeType extends DocumentIncomeType ? true : never;
const _incomeUnionsAgree: [_IncomeUnionForward, _IncomeUnionBack] = [true, true];
void _incomeUnionsAgree;

/** How we learned this income source exists. Only `urla_elected` unlocks an opt-in type. */
export type IncomeSourceEvidence = "urla_elected" | "borrower_stated" | "document_derived";

export interface IncomeSourceSignal {
  type: IncomeType;
  evidence: IncomeSourceEvidence;
  /** Free-text label for the condition description, e.g. an employer name. */
  label?: string;
}

/**
 * 🚨 Reg B / ECOA. Selling Guide B3-3.4-02: alimony, child support,
 * equalization or separate-maintenance income may be counted "only if the
 * borrower discloses it on the Uniform Residential Loan Application and
 * requests that it be considered in qualifying for the loan."
 *
 * So a document requirement for these types fires ONLY from the borrower's own
 * URLA election — never from an inferred signal (a document-derived flag, a
 * bank-statement pattern, a liability that looks like support). Asking for a
 * divorce decree off inference is a compliance problem, not a bad ask.
 */
const OPT_IN_INCOME_TYPES: ReadonlySet<IncomeType> = new Set<IncomeType>([
  "alimony",
  "child_support",
]);

interface BorrowerProfile {
  employmentType: string | null;
  employmentYears: number | null;
  annualIncome: number;
  creditScore: number | null;
  ltvRatio: number;
  loanPurpose: string | null;
  propertyType: string | null;
  isVeteran: boolean;
  isFirstTimeBuyer: boolean;
  isSelfEmployed: boolean;
  /**
   * The SET of income sources this borrower actually has. A borrower who is
   * self-employed AND holds a W-2 job has both, and owes both document sets.
   * Optional so pre-URLA callers keep working: when absent,
   * determineDocumentRequirements falls back to the legacy employmentType
   * scalar (see deriveLegacyIncomeSources).
   */
  incomeSources?: IncomeSourceSignal[];
}

const currentYear = new Date().getFullYear();

/**
 * Required of every borrower regardless of how they are paid. `pay_stub` used
 * to live here, which is why a self-employed borrower was asked for one: the
 * base list ran BEFORE the employment switch, so it applied to everyone. It now
 * lives in INCOME_SOURCE_RULES.w2 where it belongs.
 */
const BASE_DOCUMENT_REQUIREMENTS: DocumentRequirement[] = [
  {
    documentType: "government_id",
    description: "Valid government-issued photo ID (driver's license or passport)",
    priority: "prior_to_approval",
    conditionCategory: "compliance",
    conditionTitle: "Valid Government ID Required",
  },
];

/**
 * B3-3.3-02 treats bonus, commission, overtime and tip income identically:
 * Form 1005, or the most recent paystub AND TWO years' W-2s (note: two, where
 * base pay needs only the most recent one), plus a verbal VOE.
 */
function bonusStyleRules(kind: string, label: string): IncomeDocumentRequirement[] {
  return [
    {
      documentType: "w2",
      yearsRequired: [currentYear - 1, currentYear - 2],
      description: `W-2 forms for the past 2 years documenting your ${kind} income`,
      priority: "prior_to_approval",
      conditionCategory: "income",
      conditionTitle: `2-Year W-2s Required (${label} Income)`,
      guidelineRef: "B3-3.3-02",
    },
    {
      documentType: "pay_stub",
      yearsRequired: [currentYear],
      description: `Most recent pay stub showing year-to-date ${kind} earnings`,
      priority: "prior_to_approval",
      conditionCategory: "income",
      conditionTitle: "Recent Pay Stub Required",
      guidelineRef: "B3-3.3-02",
    },
  ];
}

/**
 * B3-3.4-02 — alimony / child support / equalization / separate maintenance.
 * OPT-IN ONLY: never emitted from an inferred signal. See OPT_IN_INCOME_TYPES.
 */
function supportIncomeRules(label: string): IncomeDocumentRequirement[] {
  return [
    {
      documentType: "support_order",
      description: `${label} order: a divorce decree, separation agreement, or other written legal agreement or court decree stating the payment terms`,
      priority: "prior_to_approval",
      conditionCategory: "income",
      conditionTitle: `${label} Order Required`,
      guidelineRef: "B3-3.4-02",
    },
    {
      documentType: "support_receipt_proof",
      description: `Proof you have received ${label.toLowerCase()} for the most recent 6 months — bank statements, cancelled checks, or other evidence of electronic receipt`,
      priority: "prior_to_approval",
      conditionCategory: "income",
      conditionTitle: `6 Months of ${label} Receipts Required`,
      guidelineRef: "B3-3.4-02",
    },
  ];
}

/**
 * Documents required per income SOURCE, keyed on the canonical INCOME_TYPES
 * union. Every entry cites the Selling Guide section that requires it —
 * transcribed in docs/fannie-mae/income-documentation-matrix.md and pinned by
 * tests/incomeSourceRequirements.test.ts. No citation, no rule.
 *
 * Conventional (Fannie) only. FHA / VA / USDA carry their own documentation
 * rules and their handbooks are not in this repo; see the matrix doc.
 *
 * Because the key type is a closed union, an unrecognized income value is a
 * COMPILE error rather than a silent fall-through to the W-2 bucket.
 */
const INCOME_SOURCE_RULES: Record<IncomeType, IncomeDocumentRequirement[]> = {
  w2: [
    {
      documentType: "pay_stub",
      yearsRequired: [currentYear],
      description:
        "Most recent pay stub, dated within 30 days of your application and showing all year-to-date earnings",
      priority: "prior_to_approval",
      conditionCategory: "income",
      conditionTitle: "Recent Pay Stub Required",
      guidelineRef: "B3-3.2-01",
    },
    {
      documentType: "w2",
      yearsRequired: [currentYear - 1, currentYear - 2],
      description: "W-2 forms for the past 2 years",
      priority: "prior_to_approval",
      conditionCategory: "income",
      conditionTitle: "W-2 Forms Required",
      guidelineRef: "B3-3.2-01",
    },
  ],
  self_employed: [
    {
      documentType: "tax_return",
      yearsRequired: [currentYear - 1, currentYear - 2],
      description: "Complete federal tax returns for the past 2 years (all schedules)",
      priority: "prior_to_approval",
      conditionCategory: "income",
      conditionTitle: "2-Year Tax Returns Required (Self-Employed)",
      guidelineRef: "B3-3.5-01",
    },
    {
      documentType: "profit_loss",
      yearsRequired: [currentYear],
      description: "Year-to-date profit and loss statement",
      priority: "prior_to_approval",
      conditionCategory: "income",
      conditionTitle: "YTD Profit & Loss Statement Required",
      guidelineRef: "B3-3.5-01",
    },
    {
      documentType: "business_license",
      description: "Business license or articles of incorporation",
      priority: "prior_to_docs",
      conditionCategory: "income",
      conditionTitle: "Business Documentation Required",
      guidelineRef: "B3-3.2-01",
    },
    {
      documentType: "bank_statement_business",
      description: "3 months of business bank statements",
      priority: "prior_to_approval",
      conditionCategory: "assets",
      conditionTitle: "Business Bank Statements Required",
      guidelineRef: "B3-3.5-01",
    },
  ],
  rental: [
    {
      documentType: "lease_agreement",
      description: "Current signed lease agreement for each rental property",
      priority: "prior_to_approval",
      conditionCategory: "income",
      conditionTitle: "Lease Agreements Required",
      guidelineRef: "B3-3.8-01",
    },
    {
      documentType: "tax_return",
      yearsRequired: [currentYear - 1, currentYear - 2],
      description:
        "Complete federal tax returns for the past 2 years, including Schedule E for rental income",
      priority: "prior_to_approval",
      conditionCategory: "income",
      conditionTitle: "Tax Returns Required (Rental Income)",
      guidelineRef: "B3-3.8-01",
    },
  ],
  bonus: bonusStyleRules("bonus", "Bonus"),
  commission: bonusStyleRules("commission", "Commission"),
  overtime: bonusStyleRules("overtime", "Overtime"),
  social_security: [
    {
      documentType: "social_security_award",
      description:
        "Social Security Administration award letter, SSA-1099, or proof of current receipt",
      priority: "prior_to_approval",
      conditionCategory: "income",
      conditionTitle: "Social Security Documentation Required",
      guidelineRef: "B3-3.4-15",
    },
  ],
  pension: [
    {
      documentType: "pension_statement",
      description:
        "Any one of: a statement from the payer, a retirement award letter or benefit statement, a financial or bank account statement, a signed federal tax return, a W-2, or a 1099",
      priority: "prior_to_approval",
      conditionCategory: "income",
      conditionTitle: "Pension/Retirement Income Verification",
      guidelineRef: "B3-3.4-03",
    },
  ],
  disability: [
    {
      documentType: "disability_statement",
      description:
        "Your disability policy or benefits statement from the payer, showing current eligibility, the payment amount and frequency, and any termination or modification date",
      priority: "prior_to_approval",
      conditionCategory: "income",
      conditionTitle: "Long-Term Disability Documentation Required",
      guidelineRef: "B3-3.4-09",
    },
  ],
  // 🚨 OPT-IN (Reg B). Emitted only on a URLA election — see OPT_IN_INCOME_TYPES.
  alimony: supportIncomeRules("Alimony"),
  child_support: supportIncomeRules("Child support"),
  investment: [
    {
      documentType: "tax_return",
      yearsRequired: [currentYear - 1, currentYear - 2],
      description:
        "Signed federal tax returns for the past 2 years (including Schedule D where capital gains are used)",
      priority: "prior_to_approval",
      conditionCategory: "income",
      conditionTitle: "2-Year Tax Returns Required (Investment Income)",
      guidelineRef: "B3-3.4-08",
    },
    {
      documentType: "brokerage_statement",
      description:
        "Statements evidencing your ownership of the assets that produced the income",
      priority: "prior_to_approval",
      conditionCategory: "assets",
      conditionTitle: "Asset Ownership Verification Required",
      guidelineRef: "B3-3.4-08",
    },
  ],
  /**
   * "Other" names no specific source, so no specific document can be cited.
   * Tax returns are the near-universal artifact by which the source CAN be
   * identified (B3-3.1-02); beyond them this guesses nothing and routes to a
   * human. Trust income, for one, has its own rule at B3-3.4-16.
   */
  other: [
    {
      documentType: "tax_return",
      yearsRequired: [currentYear - 1, currentYear - 2],
      description:
        "Federal tax returns for the past 2 years (documenting 1099, trust, pension, or other non-W-2 income)",
      priority: "prior_to_approval",
      conditionCategory: "income",
      conditionTitle: "2-Year Tax Returns Required (Other Income Type)",
      guidelineRef: "B3-3.1-02",
    },
    {
      documentType: "other",
      description:
        "Documentation for your other income source — your loan officer will confirm exactly what is needed (for example 1099s, K-1s, or trust statements)",
      priority: "prior_to_docs",
      conditionCategory: "income",
      conditionTitle: "Income Documentation Review Required",
      guidelineRef: "B3-3.4-01",
    },
  ],
};

const ASSET_REQUIREMENTS: DocumentRequirement[] = [
  {
    documentType: "bank_statement",
    description: "2 months of bank statements for all accounts",
    priority: "prior_to_approval",
    conditionCategory: "assets",
    conditionTitle: "Bank Statements Required",
  },
];

const LTV_BASED_REQUIREMENTS: { threshold: number; requirements: DocumentRequirement[] }[] = [
  {
    threshold: 80,
    requirements: [
      {
        documentType: "gift_letter",
        description: "Gift letter if using gift funds for down payment",
        priority: "prior_to_docs",
        conditionCategory: "assets",
        conditionTitle: "Gift Fund Documentation (if applicable)",
      },
    ],
  },
  {
    threshold: 95,
    requirements: [
      {
        documentType: "reserves_proof",
        description: "Proof of 2 months PITI reserves",
        priority: "prior_to_docs",
        conditionCategory: "assets",
        conditionTitle: "Reserve Funds Verification",
      },
    ],
  },
];

const PROPERTY_REQUIREMENTS: DocumentRequirement[] = [
  {
    documentType: "purchase_contract",
    description: "Signed purchase contract",
    priority: "prior_to_docs",
    conditionCategory: "property",
    conditionTitle: "Purchase Contract Required",
  },
  {
    documentType: "homeowners_insurance",
    description: "Homeowners insurance binder",
    priority: "prior_to_funding",
    conditionCategory: "insurance",
    conditionTitle: "Homeowners Insurance Required",
  },
];

const CREDIT_BASED_REQUIREMENTS: { minScore: number; maxScore: number; requirements: DocumentRequirement[] }[] = [
  {
    minScore: 0,
    maxScore: 680,
    requirements: [
      {
        documentType: "letter_of_explanation",
        description: "Letter of explanation for any derogatory credit items",
        priority: "prior_to_docs",
        conditionCategory: "credit",
        conditionTitle: "Credit Explanation Letter Required",
      },
    ],
  },
];

/**
 * Legacy fallback: map the single `employmentType` scalar onto income sources.
 * Used only when a caller supplies no `incomeSources` (pre-URLA intake, where
 * the funnel has captured one employment answer and nothing else). Preserves
 * the old behaviour for those files instead of asking for nothing — but note it
 * can only ever produce ONE source, which is the whole defect this replaces.
 */
function deriveLegacyIncomeSources(profile: BorrowerProfile): IncomeSourceSignal[] {
  const t = profile.employmentType;
  if (t === "self_employed" || profile.isSelfEmployed) {
    return [{ type: "self_employed", evidence: "borrower_stated" }];
  }
  if (t === "retired") return [{ type: "pension", evidence: "borrower_stated" }];
  if (t === "employed") return [{ type: "w2", evidence: "borrower_stated" }];
  // "other" (1099, trust, pension) and any UNRECOGNIZED value both land here.
  // Unrecognized used to fall through to the W-2 bucket and silently ask for a
  // document the borrower cannot produce.
  if (t) return [{ type: "other", evidence: "borrower_stated" }];
  return [];
}

function isIncomeType(v: unknown): v is IncomeType {
  return typeof v === "string" && (INCOME_TYPES as readonly string[]).includes(v);
}

/**
 * The set of income sources a borrower actually has, unioned across every place
 * we learn about one. A borrower who is self-employed AND holds a W-2 job
 * yields BOTH — which is the point: the old single-scalar lookup gave one
 * bucket and silently never asked for the other income's documents.
 *
 * Precedence: document-derived evidence outranks borrower-stated for the same
 * type, and a URLA election outranks both (it is the only thing that unlocks an
 * opt-in type).
 */
export function deriveIncomeSources(input: {
  /** urla_employment_history rows — isSelfEmployed is PER EMPLOYER. */
  employment?: { isSelfEmployed?: boolean | null; employerName?: string | null }[];
  /** other_income_sources rows, already classified — the borrower's URLA election. */
  otherIncome?: { incomeType?: string | null }[];
  /** situationProfile flags derived from the actual tax documents. */
  documentDerived?: IncomeType[];
  /** Legacy scalar, used only when nothing above produced a source. */
  profile?: BorrowerProfile;
}): IncomeSourceSignal[] {
  const rank: Record<IncomeSourceEvidence, number> = {
    urla_elected: 3,
    document_derived: 2,
    borrower_stated: 1,
  };
  const best = new Map<IncomeType, IncomeSourceSignal>();
  const add = (sig: IncomeSourceSignal) => {
    const prev = best.get(sig.type);
    if (!prev || rank[sig.evidence] > rank[prev.evidence]) best.set(sig.type, sig);
  };

  for (const e of input.employment ?? []) {
    add({
      type: e.isSelfEmployed ? "self_employed" : "w2",
      evidence: "borrower_stated",
      label: e.employerName ?? undefined,
    });
  }
  for (const o of input.otherIncome ?? []) {
    // Present on the URLA => the borrower elected it. This is what makes an
    // opt-in type (alimony / child support) requestable at all.
    if (isIncomeType(o.incomeType)) add({ type: o.incomeType, evidence: "urla_elected" });
  }
  for (const t of input.documentDerived ?? []) add({ type: t, evidence: "document_derived" });

  if (best.size === 0 && input.profile) {
    for (const sig of deriveLegacyIncomeSources(input.profile)) add(sig);
  }
  return [...best.values()];
}

/**
 * The profile a caller should use once an application exists: identical to
 * getBorrowerProfileFromApplication, plus the SET of income sources read from
 * the URLA.
 *
 * Without this the fan-out is inert — determineDocumentRequirements falls back
 * to the single legacy scalar and the second income's documents are never
 * requested, which is the defect itself.
 */
export async function loadBorrowerProfile(application: LoanApplication): Promise<BorrowerProfile> {
  const base = getBorrowerProfileFromApplication(application);
  try {
    const [employment, otherIncome] = await Promise.all([
      storage.getEmploymentHistory(application.id),
      storage.getOtherIncomeSources(application.id),
    ]);
    const elected: IncomeType[] = [];
    for (const row of otherIncome) {
      // classifyOtherIncomeSource is deliberately non-fuzzy: an unrecognized
      // string yields null and is skipped rather than coerced into a type.
      const mapped = documentIncomeTypeForStoredSource(row.incomeSource);
      if (mapped) elected.push(mapped);
    }
    return {
      ...base,
      incomeSources: deriveIncomeSources({
        employment: employment.map((e) => ({
          isSelfEmployed: e.isSelfEmployed,
          employerName: e.employerName,
        })),
        otherIncome: elected.map((incomeType) => ({ incomeType })),
        profile: base,
      }),
    };
  } catch {
    // A URLA read failure must not strip a borrower's existing requirements
    // down to the base set. Fall back to the legacy scalar, which is what the
    // caller would have used anyway.
    return base;
  }
}

export function determineDocumentRequirements(profile: BorrowerProfile): DocumentRequirement[] {
  const requirements: DocumentRequirement[] = [...BASE_DOCUMENT_REQUIREMENTS];

  const sources = profile.incomeSources ?? deriveLegacyIncomeSources(profile);
  for (const source of sources) {
    // 🚨 Reg B: an opt-in type is requestable only on the borrower's own URLA
    // election. An inferred alimony signal produces NO document requirement.
    if (OPT_IN_INCOME_TYPES.has(source.type) && source.evidence !== "urla_elected") continue;
    requirements.push(...INCOME_SOURCE_RULES[source.type]);
  }

  requirements.push(...ASSET_REQUIREMENTS);

  for (const ltvRule of LTV_BASED_REQUIREMENTS) {
    if (profile.ltvRatio > ltvRule.threshold) {
      requirements.push(...ltvRule.requirements);
    }
  }

  requirements.push(...PROPERTY_REQUIREMENTS);

  if (profile.creditScore) {
    for (const creditRule of CREDIT_BASED_REQUIREMENTS) {
      if (profile.creditScore >= creditRule.minScore && profile.creditScore <= creditRule.maxScore) {
        requirements.push(...creditRule.requirements);
      }
    }
  }

  if (profile.isVeteran) {
    requirements.push({
      documentType: "dd214",
      description: "DD-214 Certificate of Release or Discharge",
      priority: "prior_to_approval",
      conditionCategory: "compliance",
      conditionTitle: "VA Eligibility Documentation Required",
    });
    requirements.push({
      documentType: "coe",
      description: "VA Certificate of Eligibility (COE)",
      priority: "prior_to_approval",
      conditionCategory: "compliance",
      conditionTitle: "VA Certificate of Eligibility Required",
    });
  }

  return dedupeRequirements(requirements);
}

/**
 * Conditions are keyed `DOC_REQ_<TYPE>`, so two sources that both want a tax
 * return must collapse to ONE condition — otherwise the second is dropped
 * silently by the idempotency check and its reason is lost. Collapse here
 * instead, naming every source that drove it and widening yearsRequired to the
 * union.
 */
function dedupeRequirements(requirements: DocumentRequirement[]): DocumentRequirement[] {
  const order = { prior_to_approval: 0, prior_to_docs: 1, prior_to_funding: 2 } as const;
  const byType = new Map<string, DocumentRequirement>();
  for (const req of requirements) {
    const existing = byType.get(req.documentType);
    if (!existing) {
      byType.set(req.documentType, { ...req });
      continue;
    }
    if (existing.description !== req.description) {
      existing.description = `${existing.description}; ${req.description}`;
    }
    if (req.yearsRequired?.length) {
      const years = new Set([...(existing.yearsRequired ?? []), ...req.yearsRequired]);
      existing.yearsRequired = [...years].sort((a, b) => b - a);
    }
    // Keep the earliest gate.
    if (order[req.priority] < order[existing.priority]) existing.priority = req.priority;
  }
  return [...byType.values()];
}

export async function generateConditionsFromRequirements(
  applicationId: string,
  requirements: DocumentRequirement[]
): Promise<LoanCondition[]> {
  const conditions: LoanCondition[] = [];

  // Idempotent by sourceRule (DOC_REQ_<TYPE>): safe to re-run as stated data
  // arrives — Autopilot's proactive needs-list on section save and the intake
  // pipeline init converge on one set instead of duplicating. Returns only the
  // newly-created conditions.
  const existing = await storage.getLoanConditionsByApplication(applicationId);
  const existingSourceRules = new Set(existing.map((c) => c.sourceRule).filter(Boolean));

  for (const req of requirements) {
    const sourceRule = `DOC_REQ_${req.documentType.toUpperCase()}`;
    if (existingSourceRules.has(sourceRule)) continue;

    const conditionData: InsertLoanCondition = {
      applicationId,
      category: req.conditionCategory,
      title: req.conditionTitle,
      description: req.description,
      priority: req.priority,
      status: "outstanding",
      requiredDocumentTypes: [req.documentType],
      isAutoGenerated: true,
      sourceRule,
    };

    const condition = await storage.createLoanCondition(conditionData);
    existingSourceRules.add(sourceRule);
    conditions.push(condition);
  }

  return conditions;
}

export async function generateDocumentTasks(
  applicationId: string,
  userId: string,
  requirements: DocumentRequirement[],
  createdByUserId: string
): Promise<Task[]> {
  const tasks: Task[] = [];

  // Idempotent like the conditions generator above: finalizeIntake is
  // re-drivable (recovery sweep) and the pipeline now initializes for
  // under_review files that may later be approved — a re-run must not hand
  // the borrower a second copy of every upload task. Matching on
  // (taskType, documentCategory) regardless of status: a completed upload
  // task should not resurrect either.
  const existingTasks = await storage.getTasksByApplication(applicationId);
  const existingDocCategories = new Set(
    existingTasks
      .filter((t) => t.taskType === "document_request" && t.documentCategory)
      .map((t) => t.documentCategory as string),
  );

  for (const req of requirements) {
    if (existingDocCategories.has(req.documentType)) continue;
    existingDocCategories.add(req.documentType);
    const yearsDescription = req.yearsRequired 
      ? ` (${req.yearsRequired.join(", ")})`
      : "";

    const taskData: InsertTask = {
      applicationId,
      assignedToUserId: userId,
      createdByUserId,
      title: `Upload: ${req.conditionTitle}`,
      description: req.description + yearsDescription,
      taskType: "document_request",
      documentCategory: req.documentType,
      documentYear: req.yearsRequired?.[0]?.toString(),
      // These tasks are assigned to the borrower (userId = application.userId,
      // the only way this generator is called), so they are BORROWER-owned per
      // deriveDocumentTaskOwnerRole — omitting this inherited the column's
      // PROCESSOR default, hiding every pipeline doc task from the borrower
      // badge/requests panel and polluting the staff processor queue
      // (migration 0035 remapped the existing rows).
      ownerRole: "BORROWER",
      // "OPEN" per TASK_STATUSES — this writer's lowercase "pending" is what
      // split the tasks table into two vocabularies (migration 0033 remapped
      // the existing rows). Priority literals are TASK_PRIORITIES members —
      // the same defect's second axis, unified by migration 0034.
      status: "OPEN",
      priority: req.priority === "prior_to_approval" ? "high" : "normal",
    };

    const task = await storage.createTask(taskData);
    tasks.push(task);
  }

  return tasks;
}

export function getBorrowerProfileFromApplication(app: LoanApplication): BorrowerProfile {
  const purchasePrice = app.purchasePrice ? parseFloat(app.purchasePrice.toString()) : 0;
  const downPayment = app.downPayment ? parseFloat(app.downPayment.toString()) : 0;
  const loanAmount = purchasePrice - downPayment;
  const ltvRatio = purchasePrice > 0 ? (loanAmount / purchasePrice) * 100 : 0;
  const annualIncome = app.annualIncome ? parseFloat(app.annualIncome.toString()) : 0;

  return {
    employmentType: app.employmentType,
    employmentYears: app.employmentYears,
    annualIncome,
    creditScore: app.creditScore,
    ltvRatio,
    loanPurpose: app.loanPurpose,
    propertyType: app.propertyType,
    isVeteran: app.isVeteran || false,
    isFirstTimeBuyer: app.isFirstTimeBuyer || false,
    isSelfEmployed: app.employmentType === "self_employed",
  };
}

export async function initializeLoanPipeline(
  application: LoanApplication,
  createdByUserId: string
): Promise<{
  milestones: any;
  conditions: LoanCondition[];
  tasks: Task[];
}> {
  // One milestone row per application — a re-drive reuses it.
  const milestone =
    (await storage.getLoanMilestones(application.id)) ??
    (await storage.createLoanMilestone({
      applicationId: application.id,
      submittedAt: new Date(),
    }));

  const profile = await loadBorrowerProfile(application);
  const requirements = determineDocumentRequirements(profile);

  const conditions = await generateConditionsFromRequirements(application.id, requirements);

  const tasks = await generateDocumentTasks(
    application.id,
    application.userId,
    requirements,
    createdByUserId
  );

  return { milestones: milestone, conditions, tasks };
}

/**
 * Zero-touch intake: when a borrower uploads a document, match its type
 * against the application's outstanding conditions and move matches to
 * "submitted" (ready for underwriter review — clearing remains a human
 * judgment, never automated). Active deal-team staff get one notification
 * per upload event so nothing sits unnoticed.
 */
export async function matchUploadedDocumentToConditions(args: {
  applicationId: string;
  documentType: string;
  fileName: string;
  uploadedBy: string;
}): Promise<{ matchedConditionIds: string[] }> {
  const { applicationId, documentType, fileName, uploadedBy } = args;

  const conditions = await storage.getLoanConditionsByApplication(applicationId);
  // Alias-aware match: the borrower checklist uploads finer-grained types
  // ("paystub", "bank_statement_checking") than conditions require
  // ("pay_stub", "bank_statement") — shared/documentTypes.ts bridges them.
  const matches = conditions.filter(
    (c) =>
      c.status === "outstanding" &&
      (c.requiredDocumentTypes ?? []).some((rt) => documentTypesMatch(rt, documentType)),
  );
  if (matches.length === 0) return { matchedConditionIds: [] };

  for (const condition of matches) {
    await storage.updateLoanCondition(condition.id, { status: "submitted" });
    await storage.createDealActivity({
      applicationId,
      activityType: "note",
      title: `Condition ready for review: ${condition.title}`,
      description: `${fileName} (${documentType.replace(/_/g, " ")}) was uploaded — the condition moved to "submitted" and awaits underwriter review.`,
      performedBy: uploadedBy,
    });
  }

  try {
    const team = await storage.getDealTeamMembers(applicationId);
    const activeStaff = team.filter(
      (m): m is typeof m & { userId: string } =>
        m.isActive === true && !!m.userId && m.userId !== uploadedBy,
    );
    for (const member of activeStaff) {
      await storage.createNotification({
        userId: member.userId,
        type: "document_review",
        title: `${matches.length} condition${matches.length === 1 ? "" : "s"} ready for review`,
        body: `${fileName} was uploaded and matched: ${matches.map((c) => c.title).join("; ")}.`,
        entityType: "loan_application",
        entityId: applicationId,
        metadata: { documentType, conditionIds: matches.map((c) => c.id) },
      });
    }
  } catch (notifyErr) {
    console.error("[PipelineEngine] Condition-match notification failed (non-fatal):", notifyErr);
  }

  console.log(
    `[pipeline] ${fileName} (${documentType}) matched ${matches.length} condition(s) on ${applicationId} → submitted`,
  );
  return { matchedConditionIds: matches.map((c) => c.id) };
}

/**
 * Which submitted conditions must fall back to "outstanding" after a document
 * of the given type is rejected. Pure so the decision is unit-testable: a
 * condition reverts only when it matched the rejected type AND no other
 * non-rejected document on the file still satisfies it (alias-aware on both
 * sides via shared/documentTypes.ts).
 */
export function conditionsToRevertAfterRejection(input: {
  conditions: Array<Pick<LoanCondition, "id" | "status" | "requiredDocumentTypes">>;
  documents: Array<{ documentType: string; status: string | null }>;
  rejectedDocumentType: string;
}): string[] {
  const { conditions, documents, rejectedDocumentType } = input;
  return conditions
    .filter(
      (c) =>
        c.status === "submitted" &&
        (c.requiredDocumentTypes ?? []).some((rt) => documentTypesMatch(rt, rejectedDocumentType)),
    )
    .filter(
      (c) =>
        !documents.some(
          (d) =>
            d.status !== DOCUMENT_STATUS.REJECTED &&
            (c.requiredDocumentTypes ?? []).some((rt) => documentTypesMatch(rt, d.documentType)),
        ),
    )
    .map((c) => c.id);
}

/**
 * Review-loop counterpart of matchUploadedDocumentToConditions: when a human
 * reviewer REJECTS a document, any condition that had moved to "submitted" on
 * the strength of that upload falls back to "outstanding" — otherwise the
 * matcher (which only considers outstanding conditions) could never re-arm
 * when the borrower uploads a replacement. Clearing/waiving stays a human
 * decision; this only un-submits. Call AFTER the document row is marked
 * rejected so the still-satisfied check sees the final state.
 */
export async function revertConditionsForRejectedDocument(args: {
  applicationId: string;
  documentType: string;
  fileName: string;
  rejectedBy: string;
}): Promise<{ revertedConditionIds: string[] }> {
  const { applicationId, documentType, fileName, rejectedBy } = args;

  const [conditions, documents] = await Promise.all([
    storage.getLoanConditionsByApplication(applicationId),
    storage.getDocumentsByApplication(applicationId),
  ]);

  const revertIds = conditionsToRevertAfterRejection({
    conditions,
    documents: documents.map((d) => ({ documentType: d.documentType, status: d.status })),
    rejectedDocumentType: documentType,
  });
  if (revertIds.length === 0) return { revertedConditionIds: [] };

  const byId = new Map(conditions.map((c) => [c.id, c]));
  for (const conditionId of revertIds) {
    await storage.updateLoanCondition(conditionId, { status: "outstanding" });
    await storage.createDealActivity({
      applicationId,
      activityType: "note",
      title: `Condition back to outstanding: ${byId.get(conditionId)?.title ?? conditionId}`,
      description: `${fileName} (${documentType.replace(/_/g, " ")}) was rejected on review — a replacement document is needed.`,
      performedBy: rejectedBy,
    });
  }

  console.log(
    `[pipeline] rejection of ${fileName} (${documentType}) reverted ${revertIds.length} condition(s) on ${applicationId} → outstanding`,
  );
  return { revertedConditionIds: revertIds };
}

/**
 * Thrown when a caller asks for a stage move the transition table forbids.
 * Carries the allowed targets so endpoints can return them — staff UIs can
 * grey out impossible moves instead of discovering them by error.
 */
export class PipelineTransitionError extends Error {
  constructor(
    public readonly fromStage: string,
    public readonly toStage: string,
    public readonly allowed: readonly LoanAppStatus[],
  ) {
    super(
      `Invalid stage transition from '${fromStage}' to '${toStage}'. Allowed from '${fromStage}': ${allowed.length ? allowed.join(", ") : "none (terminal state)"}`,
    );
    this.name = "PipelineTransitionError";
  }
}

/**
 * THE single writer for loanApplications.status. Every status change — staff
 * endpoints, borrower withdraw, automated analysis — funnels through here so
 * milestones, HMDA codes, task-engine events, the borrower state machine, and
 * homeowner graduation can never drift apart. Direct storage.updateLoanApplication
 * calls with a status field are forbidden (see tests/statusVocabulary.test.ts).
 */
export async function updatePipelineStage(
  applicationId: string,
  newStage: LoanAppStatus,
  options?: {
    denialReasons?: string[];
    /** Admin escape hatch: skip transition validation (still runs all side effects). */
    force?: boolean;
  }
): Promise<void> {
  const now = new Date();

  if (!isLoanAppStatus(newStage)) {
    throw new PipelineTransitionError("unknown", newStage, []);
  }

  const application = await storage.getLoanApplication(applicationId);
  if (!application) {
    throw new Error(`Application not found: ${applicationId}`);
  }
  const previousStage = application.status;

  // Idempotent: re-asserting the current stage is a no-op, not an error.
  if (previousStage === newStage) return;

  if (!options?.force && isLoanAppStatus(previousStage) && !isValidLoanAppTransition(previousStage, newStage)) {
    throw new PipelineTransitionError(previousStage, newStage, LOAN_APP_TRANSITIONS[previousStage]);
  }

  const milestoneUpdate: Record<string, any> = {};
  
  switch (newStage) {
    case "pre_approved":
      milestoneUpdate.preApprovedAt = now;
      break;
    case "doc_collection":
      milestoneUpdate.docCollectionStartedAt = now;
      break;
    case "processing":
      milestoneUpdate.processingStartedAt = now;
      break;
    case "underwriting":
      milestoneUpdate.underwritingStartedAt = now;
      break;
    case "conditional":
      milestoneUpdate.conditionalApprovedAt = now;
      break;
    case "clear_to_close":
      milestoneUpdate.clearToCloseAt = now;
      break;
    case "closing":
      milestoneUpdate.closingScheduledAt = now;
      break;
    case "funded":
      milestoneUpdate.fundedAt = now;
      milestoneUpdate.actualCloseDate = now;
      // Lifecycle graduation: funding a loan lights up the Homeowner Hub
      // automatically (profile + welcome notification). Non-fatal.
      try {
        const { graduateClosedLoan } = await import("./services/lifecycleEngine");
        await graduateClosedLoan(applicationId);
      } catch (gradErr) {
        console.error("[PipelineEngine] Homeowner graduation failed (non-fatal):", gradErr);
      }
      break;
    case "denied":
      milestoneUpdate.deniedAt = now;
      break;
  }

  if (Object.keys(milestoneUpdate).length > 0) {
    await storage.updateLoanMilestones(applicationId, milestoneUpdate);
  }

  // Populate HMDA Reg C "action taken" codes for the Loan Application Register.
  // "funded" is the correct point to record code 1 (loan originated); "denied"
  // records code 3 along with the denial reasons required for LAR reporting —
  // but only when reasons are supplied (staff decision paths always supply
  // them; the automated analysis path must NOT fabricate a LAR entry, its
  // "denied" is finalized through the formal adverse-action flow). "withdrawn"
  // records code 4 regardless of who initiated it (staff or borrower).
  const applicationUpdate: Record<string, any> = { status: newStage };
  if (newStage === "funded") {
    applicationUpdate.hmdaActionTaken = "1";
  } else if (newStage === "denied" && options?.denialReasons && options.denialReasons.length > 0) {
    applicationUpdate.hmdaActionTaken = "3";
    applicationUpdate.hmdaDenialReasons = options.denialReasons;
  } else if (newStage === "withdrawn") {
    applicationUpdate.hmdaActionTaken = "4";
  }

  await storage.updateLoanApplication(applicationId, applicationUpdate);

  // Record the pipeline-stage timestamp for the outcomes/analytics tables
  // (conversion funnel, estimate accuracy, cycle-time dashboards). Upserts the
  // loanOutcomes row; best-effort by design — an analytics write must never
  // block or fail a stage transition. This is the wiring that populates
  // loanOutcomes (previously the writers had zero callers, so those dashboards
  // rendered off an always-empty table — F-002).
  try {
    const { recordStageTimestamp } = await import("./services/outcomeTracker");
    await recordStageTimestamp(applicationId, newStage);
  } catch (outcomeErr) {
    console.warn("[PipelineEngine] Outcome timestamp record failed (non-fatal):", outcomeErr);
  }

  // Keep the borrower journey state machine in lockstep with the pipeline —
  // previously synced only at creation, which froze Intelligence surfaces at
  // pre-qualification for any loan that progressed. Best-effort by design.
  try {
    const { syncApplicationStatusToStateMachine } = await import("./services/optimizationEngine");
    await syncApplicationStatusToStateMachine(application.userId, applicationId, newStage);
  } catch (syncErr) {
    console.warn("[PipelineEngine] State-machine sync failed (non-fatal):", syncErr);
  }
  
  // Emit workflow event for Task Engine integration
  try {
    const { taskEventEmitter } = await import("./services/taskEventEmitter");
    
    // Map stage to event type
    const stageEventMap: Record<string, string> = {
      "pre_approved": "APPLICATION_PRE_APPROVED",
      "doc_collection": "STAGE_DOC_COLLECTION",
      "processing": "STAGE_PROCESSING",
      "underwriting": "STAGE_UNDERWRITING",
      "conditional": "STAGE_CONDITIONAL",
      "clear_to_close": "STAGE_CLEAR_TO_CLOSE",
      "closing": "STAGE_CLOSING",
      "funded": "STAGE_FUNDED",
      "denied": "APPLICATION_DENIED",
    };
    
    const eventType = stageEventMap[newStage];
    if (eventType) {
      await taskEventEmitter.emitWorkflowEvent(eventType as any, {
        applicationId,
        previousStage,
        newStage,
      });
    }
  } catch (error) {
    console.error("[PipelineEngine] Failed to emit workflow event:", error);
    // Don't fail the stage update if event emission fails
  }
}

export async function checkPipelineProgress(applicationId: string): Promise<{
  currentStage: string;
  conditions: {
    total: number;
    outstanding: number;
    cleared: number;
    categories: Record<string, { total: number; cleared: number }>;
  };
  readyForNextStage: boolean;
  blockers: string[];
}> {
  const application = await storage.getLoanApplication(applicationId);
  if (!application) {
    throw new Error("Application not found");
  }

  const conditions = await storage.getLoanConditionsByApplication(applicationId);
  
  const conditionStats = {
    total: conditions.length,
    outstanding: conditions.filter(c => c.status === "outstanding").length,
    cleared: conditions.filter(c => c.status === "cleared").length,
    categories: {} as Record<string, { total: number; cleared: number }>,
  };

  for (const condition of conditions) {
    if (!conditionStats.categories[condition.category]) {
      conditionStats.categories[condition.category] = { total: 0, cleared: 0 };
    }
    conditionStats.categories[condition.category].total++;
    if (condition.status === "cleared") {
      conditionStats.categories[condition.category].cleared++;
    }
  }

  const blockers: string[] = [];
  let readyForNextStage = true;

  const currentStage = application.status || "draft";

  switch (currentStage) {
    case "pre_approved":
    case "doc_collection":
      const priorToApproval = conditions.filter(c => 
        c.priority === "prior_to_approval" && c.status !== "cleared" && c.status !== "waived"
      );
      if (priorToApproval.length > 0) {
        readyForNextStage = false;
        blockers.push(`${priorToApproval.length} prior-to-approval conditions outstanding`);
      }
      break;

    case "processing":
    case "underwriting":
      const priorToDocs = conditions.filter(c => 
        (c.priority === "prior_to_approval" || c.priority === "prior_to_docs") && 
        c.status !== "cleared" && c.status !== "waived"
      );
      if (priorToDocs.length > 0) {
        readyForNextStage = false;
        blockers.push(`${priorToDocs.length} conditions must be cleared before docs`);
      }
      break;

    case "conditional":
    case "clear_to_close":
      const allOutstanding = conditions.filter(c => 
        c.status !== "cleared" && c.status !== "waived" && c.status !== "not_applicable"
      );
      if (allOutstanding.length > 0) {
        readyForNextStage = false;
        blockers.push(`${allOutstanding.length} conditions still outstanding`);
      }
      break;
  }

  return {
    currentStage,
    conditions: conditionStats,
    readyForNextStage,
    blockers,
  };
}

export interface PipelineSummary {
  applicationId: string;
  borrowerName: string;
  currentStage: string;
  daysInPipeline: number;
  targetCloseDate: Date | null;
  conditionsOutstanding: number;
  conditionsTotal: number;
  percentComplete: number;
  nextAction: string;
  priority: "normal" | "high" | "urgent";
  /** Most recent touch on the file: latest deal activity or application update. */
  lastActivityAt: Date | null;
  /** Whole days since lastActivityAt; null when no timestamp exists. */
  daysIdle: number | null;
  /** Deterministic green/yellow/red No-Stall signal (services/fileHealth). */
  fileHealth: FileHealth;
}

function resolveBorrowerName(user: User | undefined): string {
  return user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Unknown"
    : "Unknown";
}

/**
 * Pure assembly of a PipelineSummary from already-fetched rows. Kept separate
 * from data access so it can be shared by the single-application path
 * (getPipelineSummary) and the batched path (getPipelineSummaries) without
 * duplicating the stage/priority logic.
 */
function buildPipelineSummary(
  application: LoanApplication,
  milestones: LoanMilestone | undefined,
  conditions: LoanCondition[],
  borrowerName: string,
  latestActivityAt: Date | null,
  /** Open income-review workbench items (UAL P5) — tints the No-Stall light. */
  openReviewItems = 0,
): PipelineSummary {
  const submittedAt = milestones?.submittedAt || application.createdAt;
  const daysInPipeline = submittedAt
    ? Math.floor((Date.now() - new Date(submittedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const conditionsOutstanding = conditions.filter(c => c.status === "outstanding").length;
  const conditionsTotal = conditions.length;
  const clearedCount = conditions.filter(c => c.status === "cleared" || c.status === "waived").length;
  const percentComplete = conditionsTotal > 0 ? Math.round((clearedCount / conditionsTotal) * 100) : 0;

  let nextAction = "Submit application";
  let priority: "normal" | "high" | "urgent" = "normal";

  const currentStage = application.status || "draft";

  switch (currentStage) {
    case "draft":
      nextAction = "Complete and submit application";
      break;
    case "submitted":
    case "analyzing":
      nextAction = "Awaiting pre-approval decision";
      break;
    case "pre_approved":
    case "doc_collection":
      nextAction = conditionsOutstanding > 0 
        ? `Upload ${conditionsOutstanding} required document(s)` 
        : "All documents uploaded - awaiting review";
      priority = conditionsOutstanding > 3 ? "high" : "normal";
      break;
    case "processing":
      nextAction = "Documents being reviewed";
      break;
    case "underwriting":
      nextAction = "In underwriting review";
      priority = "high";
      break;
    case "conditional":
      nextAction = conditionsOutstanding > 0 
        ? `Clear ${conditionsOutstanding} condition(s)` 
        : "Ready for clear-to-close";
      priority = "high";
      break;
    case "clear_to_close":
      nextAction = "Schedule closing";
      priority = "urgent";
      break;
    case "closing":
      nextAction = "Closing scheduled";
      priority = "urgent";
      break;
    case "funded":
      nextAction = "Loan funded - complete";
      break;
    case "denied":
      nextAction = "Application denied";
      break;
  }

  if (daysInPipeline > 30 && currentStage !== "funded" && currentStage !== "denied") {
    priority = "urgent";
  }

  // "Last touch" is the freshest of the activity log and the application row
  // itself, so status flips that never write an activity still reset the
  // idle clock.
  const updatedAt = application.updatedAt ? new Date(application.updatedAt) : null;
  let lastActivityAt = latestActivityAt;
  if (updatedAt && (!lastActivityAt || updatedAt > lastActivityAt)) {
    lastActivityAt = updatedAt;
  }
  const daysIdle = daysSince(lastActivityAt);

  const fileHealth = computeFileHealth({
    status: currentStage,
    daysIdle,
    daysInPipeline,
    conditionsOutstanding,
    preApprovalAmount: application.preApprovalAmount,
    purchasePrice: application.purchasePrice,
    openReviewItems,
  });

  return {
    applicationId: application.id,
    borrowerName,
    currentStage,
    daysInPipeline,
    targetCloseDate: milestones?.targetCloseDate || null,
    conditionsOutstanding,
    conditionsTotal,
    percentComplete,
    nextAction,
    priority,
    lastActivityAt,
    daysIdle,
    fileHealth,
  };
}

export async function getPipelineSummary(applicationId: string): Promise<PipelineSummary | null> {
  const application = await storage.getLoanApplication(applicationId);
  if (!application) return null;

  const [milestones, conditions, user, [latestActivity]] = await Promise.all([
    storage.getLoanMilestones(applicationId),
    storage.getLoanConditionsByApplication(applicationId),
    storage.getUser(application.userId),
    db
      .select({ last: max(dealActivities.createdAt) })
      .from(dealActivities)
      .where(eq(dealActivities.applicationId, applicationId)),
  ]);

  const { countOpenReviewItems } = await import("./services/income/reviewTriage");
  const openReviewItems = await countOpenReviewItems(applicationId).catch(() => 0);

  return buildPipelineSummary(
    application,
    milestones,
    conditions,
    resolveBorrowerName(user),
    latestActivity?.last ?? null,
    openReviewItems,
  );
}

/**
 * Batched equivalent of mapping getPipelineSummary over a set of applications.
 * Fetches milestones, conditions, and borrowers in one inArray-batched query
 * each (three round trips total) instead of the 4×N serial round trips the
 * per-application path would incur, then assembles every PipelineSummary in
 * memory. Mirrors the batching pattern used by the /api/dashboard endpoint.
 */
export async function getPipelineSummaries(
  applications: LoanApplication[],
): Promise<PipelineSummary[]> {
  if (applications.length === 0) return [];

  const appIds = applications.map(a => a.id);
  const userIds = Array.from(
    new Set(applications.map(a => a.userId).filter((id): id is string => !!id)),
  );

  const [milestoneRows, conditionRows, userRows, activityRows] = await Promise.all([
    db.select().from(loanMilestones).where(inArray(loanMilestones.applicationId, appIds)),
    db
      .select()
      .from(loanConditions)
      .where(inArray(loanConditions.applicationId, appIds))
      // Match storage.getLoanConditionsByApplication's ordering so per-app
      // condition slices line up with the single-application path.
      .orderBy(loanConditions.priority, desc(loanConditions.createdAt)),
    userIds.length > 0
      ? db.select().from(users).where(inArray(users.id, userIds))
      : Promise.resolve([] as User[]),
    db
      .select({
        applicationId: dealActivities.applicationId,
        last: max(dealActivities.createdAt),
      })
      .from(dealActivities)
      .where(inArray(dealActivities.applicationId, appIds))
      .groupBy(dealActivities.applicationId),
  ]);

  // One milestone row per application; keep the first if duplicates exist.
  const milestoneByApp = new Map<string, LoanMilestone>();
  for (const m of milestoneRows) {
    if (!milestoneByApp.has(m.applicationId)) milestoneByApp.set(m.applicationId, m);
  }

  const conditionsByApp = new Map<string, LoanCondition[]>();
  for (const c of conditionRows) {
    const bucket = conditionsByApp.get(c.applicationId);
    if (bucket) bucket.push(c);
    else conditionsByApp.set(c.applicationId, [c]);
  }

  const userById = new Map<string, User>();
  for (const u of userRows) userById.set(u.id, u);

  const latestActivityByApp = new Map<string, Date>();
  for (const row of activityRows) {
    if (row.last) latestActivityByApp.set(row.applicationId, row.last);
  }

  // One grouped query for the P5 workbench counts (keeps the inArray batching
  // pattern — no per-app round trips). Best-effort: health signals never break
  // the pipeline list.
  const openReviewByApp = new Map<string, number>();
  try {
    const { reviewItems } = await import("@shared/schema");
    const countRows = await db
      .select({ applicationId: reviewItems.applicationId, n: count() })
      .from(reviewItems)
      .where(and(inArray(reviewItems.applicationId, applications.map(a => a.id)), eq(reviewItems.status, "open")))
      .groupBy(reviewItems.applicationId);
    for (const row of countRows) {
      if (row.applicationId) openReviewByApp.set(row.applicationId, Number(row.n));
    }
  } catch {
    // non-fatal
  }

  return applications.map(app => {
    const user = app.userId ? userById.get(app.userId) : undefined;
    return buildPipelineSummary(
      app,
      milestoneByApp.get(app.id),
      conditionsByApp.get(app.id) ?? [],
      resolveBorrowerName(user),
      latestActivityByApp.get(app.id) ?? null,
      openReviewByApp.get(app.id) ?? 0,
    );
  });
}
