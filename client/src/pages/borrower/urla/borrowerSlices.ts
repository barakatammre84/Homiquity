/**
 * Splitting the server's flat URLA payload into per-borrower slices.
 *
 * Every URLA collection is keyed by borrowerSequenceNumber (1 = primary,
 * 2 = co-borrower). A row with no sequence number is the primary's — legacy
 * rows predate the column, and defaulting them to 2 would silently move a
 * borrower's employment or liabilities onto a co-borrower who may not exist.
 */
import type {
  BorrowerDeclarations,
  EmploymentHistory,
  HmdaDemographics,
  UrlaAsset,
  UrlaLiability,
  UrlaPersonalInfo,
} from "@shared/schema";
import { emptyDemographics, emptySlice, hmdaToState, type BorrowerSlice } from "./types";

/** The subset of the /api/urla response this module reads. */
export interface UrlaSliceSource {
  allPersonalInfo?: UrlaPersonalInfo[];
  employmentHistory?: EmploymentHistory[];
  assets?: UrlaAsset[];
  liabilities?: UrlaLiability[];
  allDeclarations?: BorrowerDeclarations[];
  hmdaDemographics?: HmdaDemographics[];
}

export const seqOf = (r: { borrowerSequenceNumber?: number | null }): number =>
  r.borrowerSequenceNumber ?? 1;

export function buildSlice(source: UrlaSliceSource, seq: number): BorrowerSlice {
  const pi = (source.allPersonalInfo || []).find((p) => seqOf(p) === seq);
  const emp = (source.employmentHistory || []).filter((e) => seqOf(e) === seq);
  const ast = (source.assets || []).filter((a) => seqOf(a) === seq);
  const lia = (source.liabilities || []).filter((l) => seqOf(l) === seq);
  const decl = (source.allDeclarations || []).find((d) => seqOf(d) === seq);
  const hmda = (source.hmdaDemographics || []).find((h) => seqOf(h) === seq);
  return {
    personalInfo: pi || {},
    // One blank row so the section renders an editable form rather than nothing.
    employmentRecords: emp.length ? emp : [{}],
    assets: ast.length ? ast : [{}],
    liabilities: lia.length ? lia : [{}],
    declarations: decl || {},
    demographics: hmda ? hmdaToState(hmda) : emptyDemographics(),
  };
}

/**
 * True when ANY collection carries a row above sequence 1.
 *
 * Checked across all six because a co-borrower can exist on the file with only
 * one section filled in — missing them here would hide their data behind a
 * toggle the borrower never sees, and the next save would omit them entirely.
 */
export function detectCoBorrower(source: UrlaSliceSource): boolean {
  return (
    (source.allPersonalInfo || []).some((p) => seqOf(p) > 1) ||
    (source.employmentHistory || []).some((e) => seqOf(e) > 1) ||
    (source.assets || []).some((a) => seqOf(a) > 1) ||
    (source.liabilities || []).some((l) => seqOf(l) > 1) ||
    (source.allDeclarations || []).some((d) => seqOf(d) > 1) ||
    (source.hmdaDemographics || []).some((h) => seqOf(h) > 1)
  );
}

export function buildBorrowerData(source: UrlaSliceSource): Record<number, BorrowerSlice> {
  return { 1: buildSlice(source, 1), 2: buildSlice(source, 2) };
}

export const emptyBorrowerData = (): Record<number, BorrowerSlice> => ({
  1: emptySlice(),
  2: emptySlice(),
});
