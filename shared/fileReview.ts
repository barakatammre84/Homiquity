import { z } from "zod";
import { validityFromReasons } from "./core/reviewValidity";
import type { DocumentLineageView, DocumentSubjectOption } from "./documentLineage";

export const FILE_REVIEW_SECTIONS = ["application", "documents", "forms", "facts"] as const;
export type FileReviewSection = typeof FILE_REVIEW_SECTIONS[number];
export const FILE_REVIEW_LABELS: Record<FileReviewSection, string> = {
  application: "Application summary", documents: "Uploaded documents", forms: "Extracted forms", facts: "Extracted values",
};
export type FileReviewManifest = Record<FileReviewSection, {
  count: number;
  digest: string;
  /** One-way item digests keyed by record or document-lineage id. */
  items?: Record<string, string>;
}>;
export const saveFileReviewSchema = z.object({
  expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
  acknowledged: z.literal(true),
}).strict();
export type FileReviewCheckpoint = {
  id: string; version: number; reviewedAt: string; reviewedBy: string;
  isStale: boolean; staleReasons: string[];
  changedDocumentLineageIds: string[];
};
export type FileReviewWorkspace = {
  applicationId: string; revision: string; manifest: FileReviewManifest;
  documents: Array<{
    id: string;
    name: string;
    documentType: string;
    status: string;
    reviewedAt: string | null;
    lineage: DocumentLineageView;
  }>;
  subjectOptions: DocumentSubjectOption[];
  unreviewedDocumentCount: number; unreviewedFactCount: number;
  checkpoints: FileReviewCheckpoint[];
  canSave: boolean; saveBlockedReason: string | null;
};
export function assessFileReview(recorded: FileReviewManifest, current: FileReviewManifest) {
  const validity = validityFromReasons(FILE_REVIEW_SECTIONS.flatMap(section =>
    recorded[section]?.digest === current[section].digest ? [] : [`${FILE_REVIEW_LABELS[section]} changed after this review.`],
  ));
  const changedItems = Object.fromEntries(FILE_REVIEW_SECTIONS.map(section => {
    const before = recorded[section]?.items;
    const after = current[section]?.items;
    if (!before || !after) return [section, []];
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [section, [...keys].filter(key => before[key] !== after[key])];
  })) as Record<FileReviewSection, string[]>;
  return { ...validity, changedItems };
}
