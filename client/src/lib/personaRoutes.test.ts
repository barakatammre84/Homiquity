import { describe, expect, it } from "vitest";
import { PERSONA_ROUTES, personaForArticle } from "./personaRoutes";

describe("personaForArticle", () => {
  it("routes VA-family content to the VA persona", () => {
    expect(personaForArticle({ loanProductFamilies: ["va"] })).toBe("va");
  });

  it("VA wins over other axes — a VA cash-out guide is VA content first", () => {
    expect(
      personaForArticle({
        loanProductFamilies: ["va"],
        transactionPurposes: ["cash_out_refi"],
      }),
    ).toBe("va");
  });

  it("routes non-QM family content to the self-employed persona", () => {
    expect(personaForArticle({ loanProductFamilies: ["non_qm"] })).toBe("self-employed");
  });

  it("routes alternative-doc methods to the self-employed persona", () => {
    expect(
      personaForArticle({ loanProductFamilies: ["non_qm"], docMethods: ["bank_statement"] }),
    ).toBe("self-employed");
  });

  it("full_doc alone does not imply self-employed", () => {
    expect(
      personaForArticle({
        loanProductFamilies: ["conventional"],
        transactionPurposes: ["purchase"],
        docMethods: ["full_doc"],
      }),
    ).toBe("first-time-buyer");
  });

  it.each(["rate_term_refi", "cash_out_refi", "streamline_refi"] as const)(
    "routes %s content to the refinance persona",
    (purpose) => {
      expect(
        personaForArticle({
          loanProductFamilies: ["conventional"],
          transactionPurposes: [purpose],
        }),
      ).toBe("refinance");
    },
  );

  it("a purchase-and-refi article goes to refinance (the narrower intent)", () => {
    expect(
      personaForArticle({ transactionPurposes: ["purchase", "rate_term_refi"] }),
    ).toBe("refinance");
  });

  it("routes purchase content to the first-time-buyer persona", () => {
    expect(personaForArticle({ transactionPurposes: ["purchase"] })).toBe("first-time-buyer");
  });

  it("routes FHA content to the first-time-buyer persona even without a purpose", () => {
    expect(personaForArticle({ loanProductFamilies: ["fha"] })).toBe("first-time-buyer");
  });

  it("jumbo and home-equity purchase content has no persona page", () => {
    expect(
      personaForArticle({ loanProductFamilies: ["jumbo"], transactionPurposes: ["purchase"] }),
    ).toBeNull();
    expect(personaForArticle({ loanProductFamilies: ["home_equity"] })).toBeNull();
  });

  it("a home-equity article explicitly tagged as a refi still goes to refinance", () => {
    expect(
      personaForArticle({
        loanProductFamilies: ["home_equity"],
        transactionPurposes: ["cash_out_refi"],
      }),
    ).toBe("refinance");
  });

  it("unclassified content gets no persona — the caller keeps the generic CTA", () => {
    expect(personaForArticle({})).toBeNull();
    expect(
      personaForArticle({ loanProductFamilies: null, transactionPurposes: null, docMethods: null }),
    ).toBeNull();
    expect(personaForArticle({ loanProductFamilies: ["conventional"] })).toBeNull();
  });

  it("ignores unknown strings instead of misrouting", () => {
    expect(
      personaForArticle({
        loanProductFamilies: ["CONVENTIONAL", "not-a-family"],
        transactionPurposes: ["refi"],
      }),
    ).toBeNull();
  });

  it("every persona key resolves to a route with an href and a label", () => {
    for (const route of Object.values(PERSONA_ROUTES)) {
      expect(route.href).toMatch(/^\//);
      expect(route.ctaLabel.length).toBeGreaterThan(0);
    }
  });
});
