import { sql } from "drizzle-orm";
import { db } from "../db";

// =============================================================================
// FAIR-LENDING DISPARATE-IMPACT ANALYSIS (MR-7)
//
// Decision-support report, NOT an automated compliance ruling. It applies the
// standard four-fifths (80%) rule to the deterministic engine's outcomes across
// the protected classes collected in hmda_demographics: for each protected
// dimension it computes each group's selection (approval) rate and the adverse-
// impact ratio (AIR) versus the most-favoured group, flagging AIR < 0.80.
//
// Output is aggregate only (group counts/rates) — no individual-level data —
// and the route that exposes it is admin-gated. A flag means "investigate",
// not "violation": small samples, legitimate underwriting factors, and data
// gaps all matter and are surfaced (insufficientData, not a rate).
//
// Legal basis note (2026-07-21): Regulation B no longer recognizes
// disparate-impact ("effects test") liability (see data/regulatory/regulatory-ledger.json
// reg-b-2026-disparate-impact). This monitoring is retained deliberately as
// internal risk management — HMDA is unaffected and state fair-lending laws
// still recognize effects-based claims. Do not present its output as a Reg B
// requirement.
// =============================================================================

export type DecisionOutcome = "APPROVED" | "REJECTED" | "MANUAL_REVIEW";

export interface AnalysisRecord {
  /** The application's latest decision outcome. */
  outcome: DecisionOutcome;
  /** Protected-group memberships, e.g. { race: ["Black"], sex: ["Female"] }. */
  dimensions: Record<string, string[]>;
}

export interface GroupResult {
  group: string;
  approved: number;
  decided: number; // APPROVED + REJECTED (MANUAL_REVIEW excluded from the rate)
  manualReview: number;
  selectionRate: number | null; // approved / decided
  adverseImpactRatio: number | null; // selectionRate / referenceRate
  flagged: boolean; // AIR < threshold with a sufficient sample
  insufficientData: boolean; // decided < minSampleSize
}

export interface DimensionResult {
  dimension: string;
  referenceGroup: string | null; // most-favoured group with a sufficient sample
  referenceRate: number | null;
  groups: GroupResult[];
  flaggedGroups: string[];
}

export interface DisparateImpactReport {
  generatedAt: string;
  minSampleSize: number;
  threshold: number;
  totalApplications: number;
  dimensions: DimensionResult[];
  flaggedCount: number;
  notes: string[];
}

export interface DisparateImpactOptions {
  minSampleSize?: number; // groups below this are reported as insufficientData
  threshold?: number; // four-fifths rule default
}

/**
 * Pure four-fifths computation over pre-bucketed records. No DB access — the DB
 * wrapper below feeds it, and the unit tests exercise it directly.
 */
export function computeDisparateImpact(
  records: AnalysisRecord[],
  options: DisparateImpactOptions = {},
): DisparateImpactReport {
  const minSampleSize = options.minSampleSize ?? 30;
  const threshold = options.threshold ?? 0.8;

  // Collect group memberships per dimension.
  const dimensionGroups = new Map<string, Map<string, { approved: number; decided: number; manualReview: number }>>();
  for (const rec of records) {
    for (const [dim, groups] of Object.entries(rec.dimensions)) {
      if (!dimensionGroups.has(dim)) dimensionGroups.set(dim, new Map());
      const groupMap = dimensionGroups.get(dim)!;
      for (const group of groups) {
        if (!groupMap.has(group)) groupMap.set(group, { approved: 0, decided: 0, manualReview: 0 });
        const g = groupMap.get(group)!;
        if (rec.outcome === "APPROVED") { g.approved++; g.decided++; }
        else if (rec.outcome === "REJECTED") { g.decided++; }
        else { g.manualReview++; }
      }
    }
  }

  const dimensions: DimensionResult[] = [];
  let flaggedCount = 0;

  for (const [dim, groupMap] of dimensionGroups) {
    const raw = Array.from(groupMap.entries()).map(([group, g]) => ({
      group,
      ...g,
      selectionRate: g.decided > 0 ? g.approved / g.decided : null,
      insufficientData: g.decided < minSampleSize,
    }));

    // Reference = highest selection rate among groups with a sufficient sample.
    const eligible = raw.filter((r) => !r.insufficientData && r.selectionRate !== null);
    const reference = eligible.reduce<typeof eligible[number] | null>(
      (best, r) => (best === null || (r.selectionRate as number) > (best.selectionRate as number) ? r : best),
      null,
    );
    const referenceRate = reference?.selectionRate ?? null;

    const groups: GroupResult[] = raw.map((r) => {
      const air =
        referenceRate && referenceRate > 0 && r.selectionRate !== null && !r.insufficientData
          ? r.selectionRate / referenceRate
          : null;
      const flagged = air !== null && air < threshold;
      if (flagged) flaggedCount++;
      return {
        group: r.group,
        approved: r.approved,
        decided: r.decided,
        manualReview: r.manualReview,
        selectionRate: r.selectionRate,
        adverseImpactRatio: air,
        flagged,
        insufficientData: r.insufficientData,
      };
    });

    dimensions.push({
      dimension: dim,
      referenceGroup: reference?.group ?? null,
      referenceRate,
      groups: groups.sort((a, b) => (b.selectionRate ?? -1) - (a.selectionRate ?? -1)),
      flaggedGroups: groups.filter((g) => g.flagged).map((g) => g.group),
    });
  }

  const notes: string[] = [
    "Selection rate = APPROVED / (APPROVED + REJECTED). MANUAL_REVIEW is pending and excluded from the rate.",
    "Adverse-impact ratio compares each group to the most-favoured group with a sufficient sample (four-fifths rule).",
    "A flag means investigate, not a violation — legitimate underwriting factors and small samples must be reviewed.",
    "HMDA race/ethnicity are multi-select; an application counts toward every group it reported.",
  ];

  return {
    generatedAt: new Date().toISOString(),
    minSampleSize,
    threshold,
    totalApplications: records.length,
    dimensions: dimensions.sort((a, b) => a.dimension.localeCompare(b.dimension)),
    flaggedCount,
    notes,
  };
}

interface DecisionDemographicRow {
  decision: DecisionOutcome;
  ethnicity_hispanic_latino: boolean | null;
  ethnicity_not_hispanic_latino: boolean | null;
  race_american_indian: boolean | null;
  race_asian: boolean | null;
  race_black: boolean | null;
  race_native_hawaiian: boolean | null;
  race_white: boolean | null;
  sex_female: boolean | null;
  sex_male: boolean | null;
  age: number | null;
}

/** Bucket one application's HMDA row into protected-group memberships. */
function toDimensions(row: DecisionDemographicRow): Record<string, string[]> {
  const dims: Record<string, string[]> = {};

  const ethnicity: string[] = [];
  if (row.ethnicity_hispanic_latino) ethnicity.push("Hispanic or Latino");
  if (row.ethnicity_not_hispanic_latino) ethnicity.push("Not Hispanic or Latino");
  if (ethnicity.length) dims.ethnicity = ethnicity;

  const race: string[] = [];
  if (row.race_american_indian) race.push("American Indian or Alaska Native");
  if (row.race_asian) race.push("Asian");
  if (row.race_black) race.push("Black or African American");
  if (row.race_native_hawaiian) race.push("Native Hawaiian or Other Pacific Islander");
  if (row.race_white) race.push("White");
  if (race.length) dims.race = race;

  const sex: string[] = [];
  if (row.sex_female) sex.push("Female");
  if (row.sex_male) sex.push("Male");
  if (sex.length) dims.sex = sex;

  // Age 62+ is a protected class under ECOA.
  if (row.age !== null && row.age !== undefined) {
    dims.age = [row.age >= 62 ? "62 or older" : "Under 62"];
  }

  return dims;
}

/**
 * Build the disparate-impact report from live data: the latest decided outcome
 * per application (from decision_snapshots) joined to the primary borrower's
 * HMDA demographics.
 */
export async function runDisparateImpactAnalysis(
  options: DisparateImpactOptions = {},
): Promise<DisparateImpactReport> {
  // Latest snapshot per application that reached a concrete decision.
  const result = await db.execute(sql`
    WITH latest AS (
      SELECT DISTINCT ON (application_id) application_id, decision
      FROM decision_snapshots
      WHERE decision IN ('APPROVED', 'REJECTED', 'MANUAL_REVIEW')
      ORDER BY application_id, created_at DESC
    )
    SELECT
      latest.decision,
      h.ethnicity_hispanic_latino, h.ethnicity_not_hispanic_latino,
      h.race_american_indian, h.race_asian, h.race_black, h.race_native_hawaiian, h.race_white,
      h.sex_female, h.sex_male, h.age
    FROM latest
    JOIN hmda_demographics h
      ON h.application_id = latest.application_id
     AND COALESCE(h.borrower_sequence_number, 1) = 1
  `);

  const rows: DecisionDemographicRow[] = (result as any).rows ?? (result as any) ?? [];
  const records: AnalysisRecord[] = rows.map((row) => ({
    outcome: row.decision,
    dimensions: toDimensions(row),
  }));

  return computeDisparateImpact(records, options);
}
