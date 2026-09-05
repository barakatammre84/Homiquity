import { createHash } from "node:crypto";
import { FILE_REVIEW_SECTIONS, type FileReviewManifest, type FileReviewSection } from "@shared/fileReview";

// Stable object key ordering; preserve meaningful array order within a record.
const compareKeys = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => compareKeys(a, b)).map(([key, item]) => [key, canonical(item)]),
  );
  return value;
}
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
type FingerprintRow = { id: string; fingerprintKey?: string };
function material(row: FingerprintRow) {
  const { fingerprintKey: _key, ...rest } = row;
  return rest;
}
export function fingerprintFileReview(sources: Record<FileReviewSection, FingerprintRow[]>) {
  const manifest = Object.fromEntries(FILE_REVIEW_SECTIONS.map(section => {
    const sorted = [...sources[section]].sort((a, b) => compareKeys(a.id, b.id));
    return [section, {
      count: sorted.length,
      digest: digest(sorted.map(material)),
      items: Object.fromEntries(sorted.map(row => [row.fingerprintKey ?? row.id, digest(material(row))])),
    }];
  })) as FileReviewManifest;
  // Item digests add precision while the revision keeps the original
  // count/digest contract used by Phase-1 checkpoints.
  const revisionBasis = Object.fromEntries(FILE_REVIEW_SECTIONS.map(section => [section, {
    count: manifest[section].count,
    digest: manifest[section].digest,
  }]));
  return { manifest, revision: digest(revisionBasis) };
}
