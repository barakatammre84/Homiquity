import { z } from "zod";
import { validityFromReasons } from "./core/reviewValidity";

export const FILE_REVIEW_SECTIONS = ["application", "documents", "forms", "facts"] as const;
export type FileReviewSection = typeof FILE_REVIEW_SECTIONS[number];
export const FILE_REVIEW_LABELS: Record<FileReviewSection, string> = {
  application: "Application summary", documents: "Uploaded documents", forms: "Extracted forms", facts: "Extracted values",
};
export type FileReviewManifest = Record<FileReviewSection, { count: number; digest: string }>;
export const saveFileReviewSchema = z.object({
  expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
  acknowledged: z.literal(true),
}).strict();
export type FileReviewCheckpoint = {
  id: string; version: number; reviewedAt: string; reviewedBy: string;
  isStale: boolean; staleReasons: string[];
};
export type FileReviewWorkspace = {
  applicationId: string; revision: string; manifest: FileReviewManifest;
  documents: { id: string; name: string; documentType: string; status: string; reviewedAt: string | null }[];
  unreviewedDocumentCount: number; unreviewedFactCount: number;
  checkpoints: FileReviewCheckpoint[];
  canSave: boolean; saveBlockedReason: string | null;
};
export function assessFileReview(recorded: FileReviewManifest, current: FileReviewManifest) {
  return validityFromReasons(FILE_REVIEW_SECTIONS.flatMap(section =>
    recorded[section]?.digest === current[section].digest ? [] : [`${FILE_REVIEW_LABELS[section]} changed after this review.`],
  ));
}
