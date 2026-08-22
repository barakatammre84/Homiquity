import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { determineDocumentRequirements, deriveIncomeSources } from "../server/pipelineEngine";
import { INCOME_TYPES, type IncomeType } from "@shared/schema";
import {
  OTHER_INCOME_TYPES,
  OTHER_INCOME_TO_DOCUMENT_TYPE,
  documentIncomeTypeForStoredSource,
} from "@shared/incomeTypes";

/**
 * The defect this pins: document requirements were derived from a SINGLE
 * `employmentType` scalar via one bucket lookup, so a borrower who was
 * self-employed AND held a W-2 job got one set and the other income's documents
 * were never requested — and nobody was told. `pay_stub` also sat in the
 * unconditional base list, above the switch, so every borrower alive was asked
 * for one regardless of how they were paid.
 *
 * Authority for every requirement: docs/fannie-mae/income-documentation-matrix.md,
 * transcribed from the Selling Guide corpus in docs/fannie-mae/selling-guide/.
 */
const baseProfile = {
  employmentType: null as string | null,
  employmentYears: 3,
  annualIncome: 90000,
  creditScore: 720,
  ltvRatio: 90,
  loanPurpose: "purchase",
  propertyType: "single_family",
  isVeteran: false,
  isFirstTimeBuyer: false,
  isSelfEmployed: false,
};

type Evidence = "urla_elected" | "borrower_stated" | "document_derived";
const typesFor = (sources: { type: IncomeType; evidence: Evidence }[]) =>
  determineDocumentRequirements({ ...baseProfile, incomeSources: sources }).map((r) => r.documentType);
const stated = (...types: IncomeType[]) =>
  types.map((type) => ({ type, evidence: "borrower_stated" as const }));

describe("income-source document derivation", () => {
  it("asks a self-employed borrower for business documents — and NOT for a pay stub or W-2", () => {
    const docs = typesFor(stated("self_employed"));
    expect(docs).toEqual(expect.arrayContaining([
      "tax_return", "profit_loss", "business_license", "bank_statement_business",
    ]));
    // The headline defect: documents a self-employed borrower cannot produce.
    expect(docs).not.toContain("pay_stub");
    expect(docs).not.toContain("w2");
  });

  it("asks a borrower who is self-employed AND W-2 for BOTH sets", () => {
    const docs = typesFor(stated("self_employed", "w2"));
    expect(docs).toEqual(expect.arrayContaining(["pay_stub", "w2"]));
    // Silently missing before this change.
    expect(docs).toEqual(expect.arrayContaining([
      "profit_loss", "business_license", "bank_statement_business",
    ]));
  });

  it("asks a W-2-only borrower for a pay stub and W-2, and no business documents", () => {
    const docs = typesFor(stated("w2"));
    expect(docs).toEqual(expect.arrayContaining(["pay_stub", "w2"]));
    expect(docs).not.toContain("profit_loss");
    expect(docs).not.toContain("bank_statement_business");
  });

  it("asks for the right proof per non-employment source", () => {
    expect(typesFor(stated("social_security"))).toContain("social_security_award");
    expect(typesFor(stated("pension"))).toContain("pension_statement");
    expect(typesFor(stated("disability"))).toContain("disability_statement");
    expect(typesFor(stated("investment"))).toEqual(
      expect.arrayContaining(["tax_return", "brokerage_statement"]));
    expect(typesFor(stated("rental"))).toEqual(
      expect.arrayContaining(["lease_agreement", "tax_return"]));
  });

  it("emits base, asset and property documents but no income guess for an empty source set", () => {
    const docs = typesFor([]);
    expect(docs).toEqual(expect.arrayContaining([
      "government_id", "bank_statement", "purchase_contract", "homeowners_insurance",
    ]));
    expect(docs).not.toContain("pay_stub");
    expect(docs).not.toContain("w2");
    expect(docs).not.toContain("tax_return");
  });

  describe("🚨 Reg B — alimony and child support are opt-in (B3-3.4-02)", () => {
    it("emits NOTHING when support income is merely inferred", () => {
      for (const evidence of ["borrower_stated", "document_derived"] as const) {
        const docs = typesFor([
          { type: "alimony", evidence },
          { type: "child_support", evidence },
        ]);
        expect(docs).not.toContain("support_order");
        expect(docs).not.toContain("support_receipt_proof");
      }
    });

    it("emits the decree and 6 months of receipts once the borrower ELECTS it on the URLA", () => {
      const docs = typesFor([{ type: "alimony", evidence: "urla_elected" }]);
      expect(docs).toEqual(expect.arrayContaining(["support_order", "support_receipt_proof"]));
    });
  });

  describe("deriveIncomeSources", () => {
    it("yields BOTH types when the URLA has a W-2 employer and a self-employed employer", () => {
      const sources = deriveIncomeSources({
        employment: [
          { isSelfEmployed: false, employerName: "Acme Corp" },
          { isSelfEmployed: true, employerName: "Side Business LLC" },
        ],
      });
      expect(sources.map((s) => s.type).sort()).toEqual(["self_employed", "w2"]);
    });

    it("treats an other_income_sources row as a URLA election", () => {
      expect(deriveIncomeSources({ otherIncome: [{ incomeType: "child_support" }] }))
        .toEqual([{ type: "child_support", evidence: "urla_elected" }]);
    });

    it("lets document-derived evidence outrank a borrower-stated claim of the same type", () => {
      const sources = deriveIncomeSources({
        employment: [{ isSelfEmployed: true }],
        documentDerived: ["self_employed"],
      });
      expect(sources).toHaveLength(1);
      expect(sources[0].evidence).toBe("document_derived");
    });

    it("ignores an unrecognized income type rather than coercing it", () => {
      expect(deriveIncomeSources({ otherIncome: [{ incomeType: "crypto_mining" }] })).toEqual([]);
    });

    it("falls back to the legacy scalar only when nothing else produced a source", () => {
      expect(deriveIncomeSources({
        profile: { ...baseProfile, employmentType: "self_employed", isSelfEmployed: true },
      }).map((s) => s.type)).toEqual(["self_employed"]);

      expect(deriveIncomeSources({
        employment: [{ isSelfEmployed: false }],
        profile: { ...baseProfile, employmentType: "self_employed", isSelfEmployed: true },
      }).map((s) => s.type)).toEqual(["w2"]);
    });

    it("never falls through an unrecognized employmentType to the W-2 bucket", () => {
      const docs = determineDocumentRequirements({ ...baseProfile, employmentType: "gig_worker" })
        .map((r) => r.documentType);
      expect(docs).not.toContain("w2");
      expect(docs).not.toContain("pay_stub");
      expect(docs).toContain("other");
    });
  });

  describe("no citation, no rule", () => {
    const matrix = readFileSync(
      resolve(__dirname, "../docs/fannie-mae/income-documentation-matrix.md"), "utf-8");

    it("every income type is modelled — the union is closed", () => {
      for (const type of INCOME_TYPES) {
        expect(() => typesFor(stated(type as IncomeType))).not.toThrow();
      }
    });

    it("every income requirement cites a section that appears in the transcribed matrix", () => {
      const seen = new Set<string>();
      for (const type of INCOME_TYPES) {
        const reqs = determineDocumentRequirements({
          ...baseProfile,
          incomeSources: [{ type: type as IncomeType, evidence: "urla_elected" }],
        });
        for (const req of reqs) {
          // Asset/property/credit rules are platform policy, not a Guide rule.
          if (!req.guidelineRef) continue;
          seen.add(req.guidelineRef);
          expect(matrix, `${type}: ${req.documentType} cites ${req.guidelineRef}`)
            .toContain(req.guidelineRef);
        }
      }
      expect(seen.size).toBeGreaterThanOrEqual(8); // not vacuous
    });

    it("records that FHA/VA/USDA are deliberately not covered", () => {
      expect(matrix).toContain("UNVERIFIED — needs the handbook");
    });
  });
});

describe("URLA other-income label → document rule", () => {
  it("maps every catalog type — no unhandled label can reach the engine", () => {
    for (const t of OTHER_INCOME_TYPES) {
      expect(OTHER_INCOME_TO_DOCUMENT_TYPE[t.id], t.id).toBeDefined();
    }
  });

  it("reads the exact label the URLA picker stores", () => {
    expect(documentIncomeTypeForStoredSource("Social Security")).toBe("social_security");
    expect(documentIncomeTypeForStoredSource("Retirement (e.g., Pension, IRA)")).toBe("pension");
    expect(documentIncomeTypeForStoredSource("Interest and Dividends")).toBe("investment");
    expect(documentIncomeTypeForStoredSource("Capital Gains")).toBe("investment");
    expect(documentIncomeTypeForStoredSource("Disability")).toBe("disability");
  });

  it("routes Separate Maintenance to the alimony rule — B3-3.4-02 governs both", () => {
    expect(documentIncomeTypeForStoredSource("Separate Maintenance")).toBe("alimony");
  });

  it("routes an untranscribed type to `other` rather than naming an uncited document", () => {
    expect(documentIncomeTypeForStoredSource("Trust")).toBe("other");
    expect(documentIncomeTypeForStoredSource("Foster Care")).toBe("other");
    expect(documentIncomeTypeForStoredSource("Royalty Payments")).toBe("other");
  });

  it("returns null for anything unrecognized — never a guess, never an opt-in type", () => {
    for (const junk of ["", "   ", "Crypto Mining", "alimony-ish", null, undefined]) {
      expect(documentIncomeTypeForStoredSource(junk as string | null)).toBeNull();
    }
  });
});
