import { z } from "zod";

export const DOCUMENT_SUBJECT_TYPES = ["application", "borrower", "business", "property"] as const;
export type DocumentSubjectType = (typeof DOCUMENT_SUBJECT_TYPES)[number];

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

export const updateDocumentLineageSchema = z.object({
  subjectType: z.enum(DOCUMENT_SUBJECT_TYPES),
  subjectId: z.string().min(1).max(100),
  periodStart: dateOnly.nullable().optional(),
  periodEnd: dateOnly.nullable().optional(),
  taxYear: z.number().int().min(1900).max(2200).nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.periodStart && value.periodEnd && value.periodStart > value.periodEnd) {
    context.addIssue({ code: "custom", path: ["periodEnd"], message: "The period end must be on or after the period start" });
  }
});

export type UpdateDocumentLineage = z.infer<typeof updateDocumentLineageSchema>;

export type DocumentSubjectOption = {
  type: DocumentSubjectType;
  id: string;
  label: string;
};

export type DocumentLineageView = {
  lineageId: string;
  versionNumber: number;
  replacesDocumentId: string | null;
  contentFingerprintRecorded: boolean;
  subjectType: DocumentSubjectType | null;
  subjectId: string | null;
  subjectLabel: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  taxYear: number | null;
  needsAssignment: boolean;
  changedSinceLatestReview: boolean;
  history: Array<{
    documentId: string;
    versionNumber: number;
    fileName: string;
    uploadedAt: string | null;
    isCurrent: boolean;
  }>;
};
