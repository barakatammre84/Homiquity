import { describe, it, expect } from "vitest";
import { fingerprintFileReview } from "../server/services/fileReviewFingerprint";
import { assessFileReview, saveFileReviewSchema } from "@shared/fileReview";

const sources = () => ({ application: [{ id: "a", income: "100000" }], documents: [{ id: "d", status: "uploaded", storagePath: "/private/file-a" }], forms: [], facts: [{ id: "f", value: "3000", humanVerified: false }] });
describe("Core review validity adapted to the existing Homiquity file", () => {
  it("ignores database row order and JSON object key order", () => {
    const a = sources();
    const b = { ...a, application: [{ income: "100000", id: "a" }] };
    expect(fingerprintFileReview(a)).toEqual(fingerprintFileReview(b));
    const docs = [{ id: "2" }, { id: "1" }];
    expect(fingerprintFileReview({ ...a, documents: docs })).toEqual(fingerprintFileReview({ ...a, documents: [...docs].reverse() }));
  });
  it.each(["application", "documents", "forms", "facts"] as const)("invalidates review when %s changes without erasing its history", section => {
    const before = fingerprintFileReview(sources());
    const after = fingerprintFileReview({ ...sources(), [section]: [{ id: "replacement" }] });
    const recorded = structuredClone(before.manifest);
    expect(assessFileReview(recorded, after.manifest).isStale).toBe(true);
    expect(assessFileReview(recorded, after.manifest).staleReasons).toHaveLength(1);
    expect(recorded).toEqual(before.manifest);
  });
  it("invalidates on document acceptance, replacement, deletion and extracted-value correction", () => {
    const a = sources(); const before = fingerprintFileReview(a);
    for (const after of [
      { ...a, documents: [{ ...a.documents[0], status: "verified" }] },
      { ...a, documents: [{ ...a.documents[0], storagePath: "/private/file-b" }] },
      { ...a, documents: [] },
      { ...a, facts: [{ ...a.facts[0], value: "3500" }] },
      { ...a, facts: [{ ...a.facts[0], humanVerified: true }] },
    ]) expect(fingerprintFileReview(after).revision).not.toBe(before.revision);
  });
  it("stores only digests and counts, never borrower values or storage paths", () => {
    const output = JSON.stringify(fingerprintFileReview(sources()));
    expect(output).not.toContain("100000"); expect(output).not.toContain("private/file");
    expect(assessFileReview(fingerprintFileReview(sources()).manifest, fingerprintFileReview(sources()).manifest).isStale).toBe(false);
  });
  it("requires explicit acknowledgment and a server revision, and rejects injected identity", () => {
    const expectedRevision = "a".repeat(64);
    expect(saveFileReviewSchema.safeParse({ expectedRevision, acknowledged: true }).success).toBe(true);
    for (const body of [{ expectedRevision }, { expectedRevision, acknowledged: false }, { expectedRevision, acknowledged: true, userId: "admin" }]) expect(saveFileReviewSchema.safeParse(body).success).toBe(false);
  });
  it("identifies the exact document lineage that changed", () => {
    const recorded = fingerprintFileReview({ ...sources(), documents: [{ id: "old", fingerprintKey: "lineage-1", status: "verified" }] });
    const current = fingerprintFileReview({ ...sources(), documents: [{ id: "new", fingerprintKey: "lineage-1", status: "uploaded" }] });
    const result = assessFileReview(recorded.manifest, current.manifest);
    expect(result.changedItems.documents).toEqual(["lineage-1"]);
    expect(result.changedItems.application).toEqual([]);
  });
});
