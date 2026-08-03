import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

import {
  RATE_LOAN_TYPES,
  isRateLoanType,
  rateMatchesLoanType,
  rateLoanTypeIncludesUnclassified,
} from "@shared/rateLoanTypes";

// -----------------------------------------------------------------------------
// A rate advertised under a product heading must be that product.
//
// /rates/heloc shipped without the narrowing its five sibling pages each did in
// their own render path, so "HELOC rates today" listed six conventional
// programs, an FHA loan and a VA loan. Nothing failed — the invariant lived in
// a `.filter()` a page could simply not write.
//
// The narrowing now happens once, in SQL, off the requested loanType. These
// tests pin both halves: the vocabulary that decides what may appear under a
// heading, and the requirement that every product page actually asks for one.
// -----------------------------------------------------------------------------

const RATES_PAGES_DIR = join(__dirname, "..", "client", "src", "pages", "rates");

/**
 * Pages that intentionally request every product. Key = filename, value = why.
 * Anything else must send a loanType, or it advertises the whole catalog under
 * whatever heading it happens to print.
 */
const ALL_PRODUCT_PAGES: Record<string, string> = {
  "MortgageRates.tsx":
    "/rates is the all-rates comparison page — it labels each card with its own product (FHA/VA badges), so showing every product IS the page",
};

describe("rate loan-type vocabulary", () => {
  it("accepts only the loan types a program can actually have", () => {
    expect([...RATE_LOAN_TYPES]).toEqual(["conventional", "fha", "va", "heloc"]);
  });

  it("rejects transaction purposes — they are not products", () => {
    // The rate pages talk about purchase/refinance/cash-out, but those are
    // reasons to borrow, not things a program can be. Each resolves to a
    // product client-side; the wire vocabulary stays honest.
    for (const purpose of ["purchase", "refinance", "cashout", "cash-out"]) {
      expect(isRateLoanType(purpose), `${purpose} must not be a loan type`).toBe(false);
    }
  });

  it("rejects unknown values rather than widening to everything", () => {
    for (const bogus of ["", "BOGUS", "conventional ", "heloc,va", undefined, null, 7]) {
      expect(isRateLoanType(bogus)).toBe(false);
    }
  });

  it("never advertises a government or equity product it cannot substantiate", () => {
    // A program with no loan_type set is not evidence that the VA backs it or
    // that it is secured by equity. This is the assertion that keeps a
    // half-configured admin row off /rates/va, /rates/heloc and FHA surfaces.
    for (const claimed of ["fha", "va", "heloc"] as const) {
      expect(rateLoanTypeIncludesUnclassified(claimed)).toBe(false);
      expect(rateMatchesLoanType(null, claimed)).toBe(false);
      expect(rateMatchesLoanType(undefined, claimed)).toBe(false);
    }
  });

  it("treats an unclassified program as a conforming first mortgage", () => {
    // Preserves what purchase/refinance/cash-out have always shown.
    expect(rateMatchesLoanType(null, "conventional")).toBe(true);
    expect(rateMatchesLoanType("conventional", "conventional")).toBe(true);
  });

  it("never lets one product match another", () => {
    for (const requested of RATE_LOAN_TYPES) {
      for (const actual of RATE_LOAN_TYPES) {
        expect(rateMatchesLoanType(actual, requested)).toBe(actual === requested);
      }
    }
  });
});

describe("public rate pages request their own product", () => {
  const pages = readdirSync(RATES_PAGES_DIR).filter((f) => f.endsWith(".tsx") && !f.includes(".test."));

  it("finds the rate pages", () => {
    expect(pages.length).toBeGreaterThan(1);
  });

  it("sends a loanType from every single-product page", () => {
    const offenders = pages.filter((page) => {
      if (page in ALL_PRODUCT_PAGES) return false;
      const source = readFileSync(join(RATES_PAGES_DIR, page), "utf8");
      return !/params\.append\(\s*["']loanType["']/.test(source);
    });

    expect(
      offenders,
      "A /rates page that doesn't send loanType receives every product and " +
        "prints all of them under its own heading — the /rates/heloc bug. Send " +
        "the product, or document the page in ALL_PRODUCT_PAGES in this test.",
    ).toEqual([]);
  });

  it("requests a loan type the server will accept", () => {
    const bad: string[] = [];
    for (const page of pages) {
      if (page in ALL_PRODUCT_PAGES) continue;
      const source = readFileSync(join(RATES_PAGES_DIR, page), "utf8");
      // Either an inline literal or the page's RATE_LOAN_TYPE constant.
      const inline = source.match(/params\.append\(\s*["']loanType["']\s*,\s*["']([^"']+)["']/);
      const viaConst = source.match(/const RATE_LOAN_TYPE\s*=\s*["']([^"']+)["']/);
      const requested = inline?.[1] ?? viaConst?.[1];
      if (!requested || !isRateLoanType(requested)) {
        bad.push(`${page} → ${requested ?? "(not found)"}`);
      }
    }

    expect(
      bad,
      "The server 400s an unrecognized loanType, so this page would render its " +
        "error state instead of rates. Use one of: " + RATE_LOAN_TYPES.join(", "),
    ).toEqual([]);
  });

  it("keeps the all-products exemption honest", () => {
    // Stops the exemption from outliving the page it was written for.
    const stale = Object.keys(ALL_PRODUCT_PAGES).filter((f) => !pages.includes(f));
    expect(stale, "these exempt pages no longer exist").toEqual([]);
  });

  it("leaves no client-side loanType filter behind", () => {
    // A leftover render-path filter is the thing that made this invariant
    // opt-in. If one comes back, the server narrowing has a silent competitor.
    const offenders = pages.filter((page) => {
      if (page in ALL_PRODUCT_PAGES) return false;
      const source = readFileSync(join(RATES_PAGES_DIR, page), "utf8");
      return /\.filter\(\s*(?:\(?\s*\w+\s*\)?)\s*=>[^)]*program\.loanType/s.test(source);
    });

    expect(
      offenders,
      "Filtering belongs in SQL now (shared/rateLoanTypes.ts). A second filter " +
        "here means two places can disagree about what the heading promises.",
    ).toEqual([]);
  });
});
