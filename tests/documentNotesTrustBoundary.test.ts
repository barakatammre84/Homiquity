import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * F-027 regression guard — the documents.notes trust boundary.
 *
 * The vulnerability: a borrower-supplied `description` (free text, 500 chars)
 * from the upload dialog was written into documents.notes, the same column the
 * extraction routes use for their JSON lineage record. borrowerGraph and the AI
 * coach then JSON.parse'd that column with no schema and treated the result as
 * trusted machine output — forging `trust: "tier1"` income/assets, and feeding
 * a verbatim-interpolated `issues` array into a tool-enabled prompt headed
 * "DOCUMENT-VERIFIED DATA (HIGHEST TRUST) ... overrides EVERYTHING else".
 *
 * Two invariants keep it closed, and each is one careless edit from reverting:
 *   1. WRITE — nothing borrower-controlled may be written to `notes`.
 *   2. READ  — no consumer may pull extracted VALUES out of `notes`, and the
 *      one field still read (`confidence`) must be enum-validated, because
 *      JSON.parse returns `any` and legacy rows may still hold borrower text.
 *
 * These are source assertions (the F-014 class, which cannot prove behaviour).
 * They are still worth having: the defect they guard was a DELETION, and a
 * deletion is exactly what a source check can detect being undone. The
 * behavioural half — a forged blob produces no tier-1 records — needs a DB and
 * belongs in the integration suite.
 */

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("F-027: borrower input never reaches documents.notes (write side)", () => {
  it("the upload route writes the borrower description to its own column, not notes", () => {
    const src = read("server/routes/lending/documents.ts");
    expect(src).toMatch(/borrowerDescription:\s*description/);
    // The exact regression: `notes: description`. Any reintroduction fails here.
    expect(src).not.toMatch(/notes:\s*description/);
  });

  it("no server route writes a request-body field into notes", () => {
    for (const file of [
      "server/routes/lending/documents.ts",
      "server/routes/documents.ts",
    ]) {
      const src = read(file);
      expect(src, `${file} must not write req.body into notes`).not.toMatch(
        /notes:\s*(req\.body|body\.|description\b)/,
      );
    }
  });
});

describe("F-027: notes consumers read lineage only, never values (read side)", () => {
  // Value keys no extractor in this repo has ever written to `notes` — see
  // F-028. Their presence in a consumer means someone re-added a branch that
  // is unreachable for real data and reachable only for forged data.
  const FORGEABLE_VALUE_KEYS = [
    "grossIncome",
    "adjustedGrossIncome",
    "grossPay",
    "netPay",
    "closingBalance",
    "totalDeposits",
    "employeeName",
    "issues",
  ];

  for (const file of [
    "server/services/borrowerGraph.ts",
    "server/routes/coach.ts",
  ]) {
    it(`${file} pulls no extracted values out of the parsed notes blob`, () => {
      const src = read(file);
      for (const key of FORGEABLE_VALUE_KEYS) {
        // Matches `parsed.grossIncome`, `lineage.issues`, `n.employeeName`, etc.
        expect(src, `${file} must not read ${key} from a parsed notes blob`).not.toMatch(
          new RegExp(`\\b(parsed|lineage|n)\\.${key}\\b`),
        );
      }
    });
  }

  it("the coach enum-validates confidence instead of trusting the parsed value", () => {
    const src = read("server/routes/coach.ts");
    // The narrowed primitive the security review caught: checking that the KEY
    // exists is not enough, because the VALUE is interpolated verbatim into a
    // tool-enabled prompt.
    expect(src).toMatch(/EXTRACTION_CONFIDENCE_LEVELS/);
    expect(src).not.toMatch(/if\s*\(\s*lineage\.confidence\s*\)\s*extractionConfidence\s*=/);
  });

  it("borrowerGraph enum-validates confidence rather than accepting any truthy value", () => {
    const src = read("server/services/borrowerGraph.ts");
    expect(src).not.toMatch(/lineage\.confidence\s*&&\s*lineage\.confidence\s*!==\s*"low"/);
    expect(src).toMatch(/lineage\.confidence === "high"/);
  });

  it("the lender manifest anchors extraction lineage on the server-written hash column", () => {
    const src = read("server/services/incomeAnalysisPackage.ts");
    // wasMachineRead must derive from extractionResponseHash (a real column only
    // the server writes), not from notes content — otherwise a forged blob rides
    // an outbound wholesale-lender package labelled "machine-read".
    expect(src).toMatch(/const wasMachineRead = !!responseHash/);
    expect(src).not.toMatch(/responseHash\s*\?\?\s*n\.responseHash/);
  });
});
