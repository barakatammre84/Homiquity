// The borrower-facing readiness setter must not be able to grant tier-1 trust.
//
// PUT /api/intelligence/readiness/:fieldName took fieldName, verificationStatus
// AND the lineage triple (sourceTable/sourceField/sourceRecordId) straight from
// the request with no validation of any of them. So a borrower could assert
// `manually_verified` — tier 1, meaning "a human checked it" — about their own
// record, and point sourceRecordId at any document id, forging the provenance
// of their own readiness row.
//
// That directly undoes the upload → extract → verify ladder that document
// presence credit depends on: an upload is deliberately only tier 3, and tier 1
// is supposed to be earned by an event the SERVER observed.
//
// Blast radius when found: readiness feeds a re-engagement email threshold and
// the borrower's own display; `readinessDetail` is built in borrowerGraph and
// currently read by nothing. So this was an integrity defect rather than a
// decisioning one — but the vocabulary has to mean what it says, or the ladder
// is decorative.
//
// Kept in its own file because extractionReadinessWiring.test.ts mocks
// intentTracker wholesale; these assertions need the real module.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  READINESS_FIELD_NAMES,
  BORROWER_ASSERTABLE_STATUSES,
} from "../server/services/intentTracker";

const routeSrc = readFileSync(
  resolve(__dirname, "..", "server/routes/intelligence.ts"),
  "utf8",
);

/** Just the PUT handler, so assertions can't drift onto a neighbouring route. */
function readinessPutHandler(): string {
  const start = routeSrc.indexOf('app.put("/api/intelligence/readiness/:fieldName"');
  expect(start).toBeGreaterThan(-1);
  const rest = routeSrc.slice(start);
  const next = rest.indexOf("\n  app.", 1);
  return next > 0 ? rest.slice(0, next) : rest;
}

describe("readiness self-attestation is bounded", () => {
  it("lets a borrower assert only self_reported / not_collected", () => {
    expect([...BORROWER_ASSERTABLE_STATUSES].sort()).toEqual(["not_collected", "self_reported"]);
  });

  it("excludes every tier-1 status from what a borrower may claim", () => {
    // These mean a model read it, a vendor confirmed it, or a human checked it.
    // None of them is a thing the subject of the record gets to declare.
    for (const earned of ["document_extracted", "third_party_verified", "manually_verified"]) {
      expect(BORROWER_ASSERTABLE_STATUSES).not.toContain(earned as any);
    }
  });

  it("exposes the seeded field vocabulary, including the two that had no writer", () => {
    expect(READINESS_FIELD_NAMES).toContain("w2_forms");
    expect(READINESS_FIELD_NAMES).toContain("government_id");
    expect(READINESS_FIELD_NAMES.length).toBeGreaterThan(20);
  });

  it("has no duplicate field names — a dupe would make one row unreachable", () => {
    expect(new Set(READINESS_FIELD_NAMES).size).toBe(READINESS_FIELD_NAMES.length);
  });
});

describe("the readiness PUT route enforces those bounds", () => {
  it("rejects an unknown field name", () => {
    expect(readinessPutHandler()).toMatch(/READINESS_FIELD_NAMES\.includes\(fieldName\)/);
  });

  it("rejects a status the borrower may not assert", () => {
    expect(readinessPutHandler()).toMatch(
      /BORROWER_ASSERTABLE_STATUSES\.includes\(verificationStatus\)/,
    );
  });

  it("stamps lineage server-side instead of accepting it from the body", () => {
    const handler = readinessPutHandler();
    // The forgeable read that used to be here.
    expect(handler).not.toMatch(/sourceRecordId\s*\}\s*=\s*req\.body/);
    expect(handler).not.toMatch(/sourceTable\s*,/);
    expect(handler).toMatch(/sourceTable: "self_attested"/);
    expect(handler).toMatch(/sourceRecordId: user\.id/);
  });
});
