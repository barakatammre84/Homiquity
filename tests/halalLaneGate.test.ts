import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { TARGET_LENDERS } from "../server/seedData/wholesaleLenderTargets";

/**
 * UAL P7 — the mechanical gates for the halal lane (funder-agnostic slice).
 *
 * The program spec authorizes ONLY the funder-agnostic build until the two
 * founder calls (CMG-or-alternative wholesale AE; Ijara-CDC partnerships)
 * and the §5 counsel register come back. These tests are those gates in
 * executable form, mirroring tests/nonQmProgramGate.test.ts:
 *  1. the MISMO delivery route (MortgageType="Other") must be VERIFIED
 *     against the in-repo authority, never asserted from memory (I3);
 *  2. no halal funder enters the catalog without its program-reference docs
 *     in-repo (the P4 "no citation, no implementation" form);
 *  3. the translation math stays consumer-less until wiring is authorized —
 *     the PR that wires it must consciously update this gate.
 * Pure in-process — no HTTP server, no database.
 */

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("halal lane gate: MortgageType=\"Other\" is verified in-repo, not invented", () => {
  it("the MISMO 3.0 base XSD enumerates 'Other' for MortgageTypeEnumerated", () => {
    const xsd = read("docs/fannie-mae/schemas/uldd-phase5-extension/MISMO_3_0.xsd");
    const block = xsd.match(/name="MortgageTypeEnumerated"[\s\S]*?<\/xsd:simpleType>/);
    expect(block, "MortgageTypeEnumerated missing from the base XSD").toBeTruthy();
    expect(block![0]).toContain('enumeration value="Other"');
  });

  it("the ULDD data-point catalog carries 'Other' among MortgageType enumerations", () => {
    const mismo = read("shared/mismo.ts");
    const row = mismo.match(/dataPointName: "MortgageType".*$/m);
    expect(row, "MortgageType row missing from the ULDD catalog").toBeTruthy();
    expect(row![0]).toContain('"Other"');
  });
});

describe("halal lane gate: no funder without in-repo program authority", () => {
  const HALAL_MARKERS = /halal|ijara|islamic|shariah|sharia|musharaka|murabaha/i;

  it("any halal-lane catalog entry requires docs/lender-programs/<id>/ to exist", () => {
    for (const lender of TARGET_LENDERS) {
      const isHalalLane = HALAL_MARKERS.test(lender.lenderId) || HALAL_MARKERS.test(lender.specialty);
      if (!isHalalLane) continue;
      const dir = path.join(ROOT, "docs", "lender-programs", lender.lenderId);
      expect(
        fs.existsSync(dir),
        `${lender.lenderId} is a halal-lane funder but has no program-reference docs at docs/lender-programs/${lender.lenderId}/ ` +
          "— the founder calls + transcribed program docs are the gate (UAL program §P7)",
      ).toBe(true);
    }
  });

  it("today the gate is CLOSED: the catalog carries no halal-lane funder yet", () => {
    // This assertion documents the current state. When a founder call comes
    // back "yes" and the program docs land, replace this with assertions on
    // the real entry (per the extensibility contract: one docs dir + one
    // catalog entry + P6 package shaping — no schema rewrite).
    const halalEntries = TARGET_LENDERS.filter(
      (l) => HALAL_MARKERS.test(l.lenderId) || HALAL_MARKERS.test(l.specialty),
    );
    expect(halalEntries).toHaveLength(0);
  });
});

describe("halal lane gate: translation math is funder-agnostic and consumer-less", () => {
  it("structureTranslation is not yet wired into pricing/underwriting/packaging", () => {
    // The equivalent-rate translator exists (cited, tested) but nothing may
    // consume it until the founder-call gates open. The wiring PR must
    // update this list consciously — that is the point of the gate.
    const consumers = [
      "server/underwritingEngine.ts",
      "server/services/decisionEngine.ts",
      "server/services/loanEstimate.ts",
      "server/services/lenderSubmission.ts",
      "server/services/incomeAnalysisPackage.ts",
      "server/services/income/orchestrator.ts",
      "server/pricing.ts",
    ];
    for (const rel of consumers) {
      expect(
        read(rel).includes("structureTranslation"),
        `${rel} imports structureTranslation before the P7 business gates opened`,
      ).toBe(false);
    }
  });
});
