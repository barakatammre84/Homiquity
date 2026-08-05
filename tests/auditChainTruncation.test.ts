import { describe, expect, it } from "vitest";
import { computeAuditEntryHash, verifyHashChain } from "../server/services/encryptionService";

/**
 * F-038 — the tamper-evident audit chain detected only mid-chain deletion.
 *
 * The linkage check was guarded by `if (i > 0 …)`, so `entries[0].previousEntryHash`
 * was never examined. Entry 0 was allowed to point at a predecessor that was not
 * present, which meant ANY contiguous window of a valid chain verified as a
 * valid chain:
 *
 *   - lop off the first K entries      → valid
 *   - lop off the last K entries       → valid
 *   - keep any window in the middle    → valid
 *   - keep ONE mid-chain entry         → valid (the loop body's linkage check
 *                                        never runs when there is one entry)
 *
 * Every case below is asserted BOTH ways: the intact chain verifies, and the
 * tampered chain does not. A one-sided assertion would pass against a verifier
 * that simply rejects everything.
 *
 * Tail truncation is deliberately absent from this file. Nothing inside a chain
 * can detect the removal of its own end — the remainder is genuinely
 * self-consistent — so it is caught by the external chain tip instead, and
 * tested against the database fake in tests/mcpAudit.test.ts.
 */

type Entry = {
  entryHash: string;
  previousEntryHash: string | null;
  applicationId: string | null;
  userId: string | null;
  action: string;
  actionDetails: Record<string, any> | null;
  timestamp: Date;
  sequenceNumber?: number | null;
};

/** Build a well-formed chain of N entries, hashed exactly as the writer does. */
function buildChain(n: number): Entry[] {
  const entries: Entry[] = [];
  let previousEntryHash: string | null = null;
  for (let i = 0; i < n; i++) {
    const timestamp = new Date(Date.UTC(2026, 0, 1, 0, 0, i));
    const base = {
      applicationId: "app-1",
      userId: "borrower-1",
      action: `action_${i}`,
      actionDetails: { step: i },
      timestamp,
    };
    const entryHash = computeAuditEntryHash({ ...base, previousEntryHash });
    entries.push({ ...base, entryHash, previousEntryHash, sequenceNumber: i + 1 });
    previousEntryHash = entryHash;
  }
  return entries;
}

/** Renumber a window 1..N, as an attacker covering their tracks would. */
function renumber(entries: Entry[]): Entry[] {
  return entries.map((e, i) => ({ ...e, sequenceNumber: i + 1 }));
}

describe("F-038: an intact chain still verifies", () => {
  it("accepts a full chain", () => {
    const result = verifyHashChain(buildChain(6));
    expect(result.valid).toBe(true);
    expect(result.coverage.headAnchored).toBe(true);
    expect(result.coverage.sequenceCoverage).toBe("verified");
  });

  it("accepts an empty scope", () => {
    expect(verifyHashChain([]).valid).toBe(true);
  });

  it("accepts a chain of exactly one genuine genesis entry", () => {
    // Must stay accepted: a scope's first-ever entry is a legitimate one-entry
    // chain. The bug was accepting one entry from the MIDDLE, not one entry.
    expect(verifyHashChain(buildChain(1)).valid).toBe(true);
  });
});

describe("F-038: truncation and windowing are now detected", () => {
  it("rejects head truncation", () => {
    const chain = buildChain(6);
    const truncated = renumber(chain.slice(2));
    expect(verifyHashChain(chain).valid).toBe(true);
    const result = verifyHashChain(truncated);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(0);
    expect(result.coverage.headAnchored).toBe(false);
    expect(result.reason).toMatch(/head/i);
  });

  it("rejects an arbitrary mid-chain window", () => {
    const chain = buildChain(8);
    const result = verifyHashChain(renumber(chain.slice(3, 6)));
    expect(result.valid).toBe(false);
    expect(result.coverage.headAnchored).toBe(false);
  });

  it("rejects a SINGLE surviving mid-chain entry", () => {
    // The starkest case: one entry, every other entry destroyed. The old
    // verifier's loop ran once, checked the entry's own hash, skipped linkage
    // because i === 0, and returned valid.
    const chain = buildChain(10);
    const result = verifyHashChain(renumber([chain[7]]));
    expect(result.valid).toBe(false);
    expect(result.coverage.headAnchored).toBe(false);
  });

  it("rejects a mid-chain deletion even when the survivors are renumbered", () => {
    // Removing entries 3-4 breaks the hash linkage, so this was already caught.
    // Asserted anyway: it is the one case the old verifier DID detect, and a fix
    // that traded it away for the new cases would be no fix at all.
    const chain = buildChain(8);
    const gapped = renumber([...chain.slice(0, 3), ...chain.slice(5)]);
    const result = verifyHashChain(gapped);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(3);
  });

  it("rejects a sequence gap that leaves the hash links intact", () => {
    // Sequence numbers are not hashed, so they can disagree with the links.
    // A gap means rows are missing regardless of what the hashes say.
    const chain = buildChain(5);
    const gapped = chain.map((e, i) => (i >= 3 ? { ...e, sequenceNumber: e.sequenceNumber! + 2 } : e));
    const result = verifyHashChain(gapped);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(3);
    expect(result.reason).toMatch(/sequence/i);
  });
});

describe("F-038: content tampering is still detected", () => {
  it("rejects a mutated entry body", () => {
    const chain = buildChain(5);
    const tampered = chain.map((e, i) => (i === 2 ? { ...e, action: "something_else" } : e));
    const result = verifyHashChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(2);
    expect(result.reason).toMatch(/hash mismatch/i);
  });

  it("rejects a rewritten link", () => {
    const chain = buildChain(5);
    const tampered = chain.map((e, i) =>
      i === 3 ? { ...e, previousEntryHash: "0".repeat(64) } : e,
    );
    expect(verifyHashChain(tampered).valid).toBe(false);
  });
});

describe("F-038: coverage is reported, not implied", () => {
  it("reports sequence coverage as unavailable when a sequence number is missing", () => {
    // Legacy rows predate sequence numbering (the column is nullable). The
    // check must degrade to 'unavailable' rather than fail an honest old chain
    // — and must NOT silently report the same {valid:true} as a fully covered
    // chain, which is the ambiguity the coverage flags exist to remove.
    const chain = buildChain(4).map((e, i) => (i === 1 ? { ...e, sequenceNumber: null } : e));
    const result = verifyHashChain(chain);
    expect(result.valid).toBe(true);
    expect(result.coverage.sequenceCoverage).toBe("unavailable");
  });

  it("reports sequence coverage as verified when every entry carries one", () => {
    expect(verifyHashChain(buildChain(4)).coverage.sequenceCoverage).toBe("verified");
  });

  it("a chain with no sequence numbers at all is still head-anchored and link-checked", () => {
    const chain = buildChain(4).map((e) => ({ ...e, sequenceNumber: null }));
    expect(verifyHashChain(chain).valid).toBe(true);
    // …but truncating it is still caught, by the head anchor rather than the
    // sequence check. The two mechanisms are independent on purpose.
    const truncated = chain.slice(1);
    expect(verifyHashChain(truncated).valid).toBe(false);
  });
});
