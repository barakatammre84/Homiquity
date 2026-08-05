/**
 * Shaping the save payload for POST /api/urla/:id/save.
 *
 * The filters here decide what reaches the loan file. Blank rows exist only so
 * each section renders an editable form (see buildSlice) — persisting them
 * would put empty employers and $0 accounts on a 1003. A row counts as real
 * once it carries either of its two identifying fields.
 */
import type { OtherIncomeSource, UrlaPropertyInfo } from "@shared/schema";
import {
  demographicsToPayload,
  emptySlice,
  type BorrowerSlice,
  type SectionsPayload,
  type UrlaSavePayload,
} from "./types";

export function buildSectionsPayload(s: BorrowerSlice): SectionsPayload {
  return {
    personalInfo: s.personalInfo,
    employmentHistory: s.employmentRecords
      .filter(emp => emp.employerName || emp.positionTitle)
      // employmentType drives which URLA employment block a record lands in;
      // "current" is the form's default rather than a guess about the borrower.
      .map(emp => ({ ...emp, employmentType: emp.employmentType || "current" })),
    assets: s.assets.filter(asset => asset.accountType || asset.financialInstitution),
    liabilities: s.liabilities.filter(liability => liability.liabilityType || liability.creditorName),
    declarations: s.declarations,
    demographics: demographicsToPayload(s.demographics),
  };
}

export function buildPayload({
  borrowerData,
  otherIncomes,
  propertyInfo,
  hasCoBorrower,
}: {
  borrowerData: Record<number, BorrowerSlice>;
  otherIncomes: Partial<OtherIncomeSource>[];
  propertyInfo: Partial<UrlaPropertyInfo>;
  hasCoBorrower: boolean;
}): UrlaSavePayload {
  const cleanedOtherIncomes = otherIncomes.filter(income => income.incomeSource && income.monthlyAmount);
  const primary = buildSectionsPayload(borrowerData[1] ?? emptySlice());

  const payload: UrlaSavePayload = {
    ...primary,
    otherIncomeSources: cleanedOtherIncomes,
    propertyInfo,
  };

  // coApplicants is omitted entirely (not sent empty) when there is no
  // co-borrower — the server treats its presence as the co-borrower roster.
  if (hasCoBorrower) {
    payload.coApplicants = [buildSectionsPayload(borrowerData[2] ?? emptySlice())];
  }

  return payload;
}
