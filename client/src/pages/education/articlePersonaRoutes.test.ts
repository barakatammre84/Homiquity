import { describe, expect, it } from "vitest";
import { personaRoutesForArticle } from "./articlePersonaRoutes";

describe("personaRoutesForArticle", () => {
  it("maps a VA-classified article to the VA persona page", () => {
    expect(personaRoutesForArticle(["va"], null)).toEqual([
      expect.objectContaining({ href: "/va-loans" }),
    ]);
  });

  it("maps non-QM to the self-employed persona page", () => {
    expect(personaRoutesForArticle(["non_qm"], [])).toEqual([
      expect.objectContaining({ href: "/self-employed" }),
    ]);
  });

  it("maps every refinance purpose variant to the refinance persona page", () => {
    for (const purpose of ["rate_term_refi", "cash_out_refi", "streamline_refi"]) {
      expect(personaRoutesForArticle(null, [purpose])).toEqual([
        expect.objectContaining({ href: "/refinance" }),
      ]);
    }
  });

  it("returns nothing for generic purchase content — conventional/fha+purchase would match nearly every article", () => {
    expect(personaRoutesForArticle(["conventional", "fha"], ["purchase"])).toEqual([]);
  });

  it("tolerates null/undefined classification (unclassified is the expected editor state)", () => {
    expect(personaRoutesForArticle(null, undefined)).toEqual([]);
  });

  it("can return multiple targets for a cross-classified article", () => {
    const routes = personaRoutesForArticle(["va"], ["rate_term_refi"]);
    expect(routes.map((r) => r.href)).toEqual(["/va-loans", "/refinance"]);
  });
});
