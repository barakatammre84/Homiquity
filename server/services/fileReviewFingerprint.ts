import { createHash } from "node:crypto";
import { FILE_REVIEW_SECTIONS, type FileReviewManifest, type FileReviewSection } from "@shared/fileReview";

// Stable object key ordering; preserve meaningful array order within a record.
function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]),
  );
  return value;
}
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
export function fingerprintFileReview(sources: Record<FileReviewSection, { id: string }[]>) {
  const manifest = Object.fromEntries(FILE_REVIEW_SECTIONS.map(section => [section, {
    count: sources[section].length,
    digest: digest([...sources[section]].sort((a, b) => a.id.localeCompare(b.id))),
  }])) as FileReviewManifest;
  return { manifest, revision: digest(manifest) };
}
