// Pure assembly for the batched complete-URLA read. No database import, so the
// reduction below is unit-testable without a live connection — the SQL half
// lives in ./urla.ts (getCompleteUrlaDataBatch).
//
// This exists because the batched loader must produce inputs IDENTICAL to the
// single-application loader: the URLA completeness validator scores GSE
// delivery readiness from them, and a file mis-scored either way is either a
// rejected delivery or a gap nobody was shown.
import type {
  UrlaPersonalInfo,
  EmploymentHistory,
  OtherIncomeSource,
  UrlaAsset,
  UrlaLiability,
  UrlaPropertyInfo,
  BorrowerDeclarations,
  RealEstateOwned,
  HmdaDemographics,
} from "@shared/schema";
import { groupRowsByKeyDense, indexRowsByKey } from "./batchGroup";

/**
 * Everything the URLA completeness validator reads for one application.
 *
 * Named (rather than inferred) so the single-application loader and the batched
 * one are held to the SAME shape by the compiler — the batch path exists to
 * produce identical inputs, and a silently-drifting inferred type is how that
 * guarantee would rot.
 */
export interface CompleteUrlaData {
  personalInfo: UrlaPersonalInfo | undefined;
  allPersonalInfo: UrlaPersonalInfo[];
  employmentHistory: EmploymentHistory[];
  otherIncomeSources: OtherIncomeSource[];
  assets: UrlaAsset[];
  liabilities: UrlaLiability[];
  propertyInfo: UrlaPropertyInfo | undefined;
  declarations: BorrowerDeclarations | undefined;
  allDeclarations: BorrowerDeclarations[];
  realEstateOwned: RealEstateOwned[];
  hmdaDemographics: HmdaDemographics[];
}

/** The flat, already-ordered row sets one batched read returns. */
export interface UrlaBatchRows {
  /** SSN masking must already be applied — this module never sees ciphertext. */
  personal: UrlaPersonalInfo[];
  employment: EmploymentHistory[];
  income: OtherIncomeSource[];
  assets: UrlaAsset[];
  liabilities: UrlaLiability[];
  property: UrlaPropertyInfo[];
  declarations: BorrowerDeclarations[];
  realEstateOwned: RealEstateOwned[];
  hmda: HmdaDemographics[];
}

/** URLA treats a missing borrowerSequenceNumber as the primary borrower. */
const isPrimary = (seq: number | null | undefined) => (seq ?? 1) === 1;

/**
 * Split flat batched rows into one CompleteUrlaData per requested application.
 *
 * `personalInfo` / `declarations` are the borrowerSequenceNumber-1 rows taken
 * from the all-borrower arrays rather than two extra round trips. The
 * single-application loader gets them with `where seq = 1 limit 1`; the
 * all-borrower query orders ascending by sequence, so the first seq-1 row is
 * the same row. (Both pick arbitrarily if duplicate seq-1 rows ever existed —
 * the upserts prevent that, identically for either path.)
 *
 * Every requested id gets an entry — including ids with no URLA rows at all,
 * which is the normal state of an early-stage file and must be scored (with
 * its gaps listed) rather than skipped.
 */
export function assembleCompleteUrlaDataBatch(
  applicationIds: readonly string[],
  rows: UrlaBatchRows,
): Map<string, CompleteUrlaData> {
  const byApp = <T extends { applicationId: string | null }>(list: T[]) =>
    groupRowsByKeyDense(applicationIds, list, (row) => row.applicationId!);

  const personalByApp = byApp(rows.personal);
  const employmentByApp = byApp(rows.employment);
  const incomeByApp = byApp(rows.income);
  const assetsByApp = byApp(rows.assets);
  const liabilitiesByApp = byApp(rows.liabilities);
  const declarationsByApp = byApp(rows.declarations);
  const reoByApp = byApp(rows.realEstateOwned);
  const hmdaByApp = byApp(rows.hmda);
  // Single-row-per-application: first wins, matching the single loader's limit(1).
  const propertyByApp = indexRowsByKey(rows.property, (row) => row.applicationId!);

  const assembled = new Map<string, CompleteUrlaData>();
  for (const applicationId of applicationIds) {
    const allPersonalInfo = personalByApp.get(applicationId) ?? [];
    const allDeclarations = declarationsByApp.get(applicationId) ?? [];
    assembled.set(applicationId, {
      personalInfo: allPersonalInfo.find((p) => isPrimary(p.borrowerSequenceNumber)),
      allPersonalInfo,
      employmentHistory: employmentByApp.get(applicationId) ?? [],
      otherIncomeSources: incomeByApp.get(applicationId) ?? [],
      assets: assetsByApp.get(applicationId) ?? [],
      liabilities: liabilitiesByApp.get(applicationId) ?? [],
      propertyInfo: propertyByApp.get(applicationId),
      declarations: allDeclarations.find((d) => isPrimary(d.borrowerSequenceNumber)),
      allDeclarations,
      realEstateOwned: reoByApp.get(applicationId) ?? [],
      hmdaDemographics: hmdaByApp.get(applicationId) ?? [],
    });
  }
  return assembled;
}
