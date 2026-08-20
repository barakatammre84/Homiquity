import { z } from "zod";
import { INCOME_PATH_IDS } from "./incomePaths";

/**
 * SituationProfile — the Situation Identification Engine's output (UAL P2c):
 * what kind of borrower just uploaded documents, which income paths apply,
 * and which documents are still missing. Deterministic rules over resolved
 * entities + tie-out results; structural FACTS only — every threshold-style
 * judgment (declining-income treatment, liquidity adequacy, program
 * eligibility) belongs to the cited calculators and policy scalars, and the
 * profile says so instead of judging.
 *
 * This is a processing/readiness signal for staff and the borrower's own
 * view. It is NEVER an underwriting input, a prequalification, or a product
 * offer (Reg N framing; L2 I1).
 */

export const SITUATION_FLAG_IDS = [
  "self_employed",
  "multi_entity_self_employed",
  "k1_income_present",
  "rental_income_present",
  "business_loss_present",
  "business_income_declined_yoy",
  "c_corp_owner",
  "w2_income_present",
  "capital_gains_present",
  "extraction_variances_open",
] as const;
export type SituationFlagId = (typeof SITUATION_FLAG_IDS)[number];

// Re-exported, not re-declared. This list was a second copy of the canonical
// one in `shared/incomePaths.ts`; the two agreed by luck, and a sixth path
// added there would have left this file's z.enum silently rejecting it — so a
// newly-supported path would vanish from the profile that tells the LO which
// paths apply. Re-exported BY NAME (never `export *`) to keep the client
// bundle boundary explicit. Pinned by tests/incomeTypes.test.ts.
export { INCOME_PATH_IDS, type IncomePathId } from "./incomePaths";

const situationFlagSchema = z.object({
  id: z.enum(SITUATION_FLAG_IDS),
  label: z.string(),
  detail: z.string(),
  /** Human-checkable provenance: entity names, form types, check ids. */
  evidence: z.array(z.string()).default([]),
});
export type SituationFlag = z.infer<typeof situationFlagSchema>;

const incomePathSignalSchema = z.object({
  pathId: z.enum(INCOME_PATH_IDS),
  /** "applicable" = evidence exists; "candidate" = evidence exists but the
   * path's qualification math is gated (e.g. non-QM program reference not yet
   * in-repo); "not_indicated" = no evidence in the file. Never "eligible" —
   * eligibility is the deterministic engine's word, not the classifier's. */
  signal: z.enum(["applicable", "candidate", "not_indicated"]),
  reason: z.string(),
});
export type IncomePathSignal = z.infer<typeof incomePathSignalSchema>;

const documentRequestSchema = z.object({
  id: z.string(),
  description: z.string(),
  reason: z.string(),
  taxYear: z.number().nullable().default(null),
  entityName: z.string().nullable().default(null),
});
export type SituationDocumentRequest = z.infer<typeof documentRequestSchema>;

export const situationProfileSchema = z.object({
  version: z.literal(1),
  summary: z.string(),
  taxYears: z.array(z.number()),
  entityCount: z.number(),
  /**
   * UAL P7: borrower-declared intake answer ("Do you require financing that
   * avoids interest?"). A funder-ROUTING signal only — never an underwriting
   * input, never a faith classification. null = not asked/answered (also the
   * value for profiles persisted before this field existed).
   */
  halalNeed: z.boolean().nullable().default(null),
  flags: z.array(situationFlagSchema),
  incomePaths: z.array(incomePathSignalSchema),
  documentRequests: z.array(documentRequestSchema),
  tieOutSummary: z.object({
    pass: z.number(),
    variance: z.number(),
    notEvaluable: z.number(),
    info: z.number(),
  }),
});
export type SituationProfile = z.infer<typeof situationProfileSchema>;
