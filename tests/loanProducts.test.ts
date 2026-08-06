import { describe, it, expect } from "vitest";
import {
  DOC_METHODS,
  LOAN_PRODUCT_FAMILIES,
  TRANSACTION_PURPOSES,
  articleTaxonomyIssues,
  isDocMethodValidForFamily,
  normalizeProductFamily,
  parseDocMethods,
  parseProductFamilies,
  parseTransactionPurposes,
} from "../shared/loanProducts";
import { insertArticleSchema } from "../shared/schema";

describe("loan product taxonomy — vocabulary", () => {
  it("keeps the three axes disjoint", () => {
    // The whole point of the split: a qualification method is not a product
    // family. If these ever overlap, the flat-list mistake has crept back.
    const families = new Set<string>(LOAN_PRODUCT_FAMILIES);
    for (const m of DOC_METHODS) expect(families.has(m), `${m} leaked into families`).toBe(false);
    for (const p of TRANSACTION_PURPOSES) expect(families.has(p), `${p} leaked into families`).toBe(false);
  });

  it("nests qualification methods under the families that offer them", () => {
    expect(isDocMethodValidForFamily("dscr", "non_qm")).toBe(true);
    expect(isDocMethodValidForFamily("dscr", "fha")).toBe(false);
    expect(isDocMethodValidForFamily("asset_depletion", "jumbo")).toBe(true);
    // full_doc is the universal one — every family supports it.
    for (const f of LOAN_PRODUCT_FAMILIES) {
      expect(isDocMethodValidForFamily("full_doc", f), f).toBe(true);
    }
  });

  it("normalizes the historical spellings onto one vocabulary", () => {
    // Uppercase from wholesale_lenders.capabilities.productTypes.
    expect(normalizeProductFamily("CONVENTIONAL")).toBe("conventional");
    expect(normalizeProductFamily("FHA")).toBe("fha");
    // Lowercase from mortgage_rate_programs.loanType.
    expect(normalizeProductFamily("va")).toBe("va");
    // Aliases in circulation.
    expect(normalizeProductFamily("HELOC")).toBe("home_equity");
    expect(normalizeProductFamily("non-qm")).toBe("non_qm");
    // Unknown returns null rather than guessing a bucket.
    expect(normalizeProductFamily("banana")).toBeNull();
    expect(normalizeProductFamily(null)).toBeNull();
  });

  it("drops unknown values when parsing stored arrays", () => {
    expect(parseProductFamilies(["fha", "banana", "va"])).toEqual(["fha", "va"]);
    expect(parseDocMethods(["dscr", "nope"])).toEqual(["dscr"]);
    expect(parseTransactionPurposes(["purchase", "nope"])).toEqual(["purchase"]);
    expect(parseProductFamilies(null)).toEqual([]);
  });
});

describe("articleTaxonomyIssues — cross-axis coherence", () => {
  it("accepts an unclassified article", () => {
    // NULL is a real answer: not every article is about a product.
    expect(articleTaxonomyIssues({})).toEqual([]);
    expect(articleTaxonomyIssues({ loanProductFamilies: [] })).toEqual([]);
  });

  it("accepts a coherent classification", () => {
    expect(
      articleTaxonomyIssues({ loanProductFamilies: ["non_qm"], docMethods: ["dscr", "bank_statement"] }),
    ).toEqual([]);
    expect(
      articleTaxonomyIssues({ loanProductFamilies: ["va"], transactionPurposes: ["streamline_refi"] }),
    ).toEqual([]);
  });

  it("rejects a qualification method the family does not offer", () => {
    const issues = articleTaxonomyIssues({ loanProductFamilies: ["fha"], docMethods: ["dscr"] });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/DSCR/);
    expect(issues[0]).toMatch(/Non-QM/);
  });

  it("accepts a method valid for ANY of the listed families", () => {
    // An article covering both non-QM and conventional may discuss DSCR.
    expect(
      articleTaxonomyIssues({ loanProductFamilies: ["conventional", "non_qm"], docMethods: ["dscr"] }),
    ).toEqual([]);
  });

  it("rejects a streamline refinance on a non-government loan", () => {
    const issues = articleTaxonomyIssues({
      loanProductFamilies: ["conventional"],
      transactionPurposes: ["streamline_refi"],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/government/i);
  });
});

describe("insertArticleSchema", () => {
  const base = { title: "t", slug: "s", content: "c" };

  it("rejects a value outside the vocabulary", () => {
    expect(insertArticleSchema.safeParse({ ...base, loanProductFamilies: ["banana"] }).success).toBe(false);
    expect(insertArticleSchema.safeParse({ ...base, docMethods: ["nope"] }).success).toBe(false);
  });

  it("accepts valid classification and an unclassified article", () => {
    expect(insertArticleSchema.safeParse({ ...base, loanProductFamilies: ["fha"] }).success).toBe(true);
    expect(insertArticleSchema.safeParse(base).success).toBe(true);
  });

  it("stays derivable with .omit().partial() for the PATCH route", () => {
    // Regression guard. Expressing the coherence rules as a zod .superRefine on
    // this schema type-checks fine but makes zod 4 THROW here at runtime
    // (".omit() cannot be used on object schemas containing refinements"),
    // breaking PATCH /api/admin/articles. The rules live in
    // articleTaxonomyIssues precisely so this keeps working.
    expect(() => insertArticleSchema.omit({ authorId: true }).partial()).not.toThrow();
    const patch = insertArticleSchema.omit({ authorId: true }).partial();
    expect(patch.safeParse({ title: "only a title" }).success).toBe(true);
  });
});
