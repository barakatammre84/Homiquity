import { describe, it, expect } from "vitest";
import { getSourceContext } from "./sourceContext";

// A non-null result here is auto-sent to the coach on arrival, so these cases
// pin what a borrower gets recorded as having asked before they type anything.

describe("getSourceContext — persona routes", () => {
  it("recognises VA from any of source, type or context", () => {
    for (const qs of ["?source=va", "?type=va", "?context=va"]) {
      expect(getSourceContext(qs)?.banner, qs).toBe("VA Loan Guidance");
    }
  });

  it("recognises refinance from source or type, but not context", () => {
    // Asymmetry preserved from the original: refinance has no context branch.
    expect(getSourceContext("?source=refinance")?.banner).toBe("Refinance Guidance");
    expect(getSourceContext("?type=refinance")?.banner).toBe("Refinance Guidance");
    expect(getSourceContext("?context=refinance")).toBeNull();
  });

  it("recognises first-time and investor from source or context, but not type", () => {
    expect(getSourceContext("?source=first-time")?.banner).toBe("First-Time Buyer");
    expect(getSourceContext("?context=first-time")?.banner).toBe("First-Time Buyer");
    expect(getSourceContext("?type=first-time")).toBeNull();

    expect(getSourceContext("?source=investor")?.banner).toBe("Investment Property");
    expect(getSourceContext("?context=investor")?.banner).toBe("Investment Property");
    expect(getSourceContext("?type=investor")).toBeNull();
  });

  it("checks personas in a fixed order when several match", () => {
    // VA wins over first-time; determinism matters because the loser's
    // message would open a different conversation entirely.
    expect(getSourceContext("?source=va&context=first-time")?.banner).toBe("VA Loan Guidance");
    expect(getSourceContext("?source=first-time&type=refinance")?.banner).toBe("First-Time Buyer");
  });
});

describe("getSourceContext — property analysis", () => {
  it("includes the decoded address and a thousands-separated price", () => {
    const ctx = getSourceContext("?propertyPrice=450000&propertyAddress=123%20Main%20St%2C%20Austin");
    expect(ctx?.banner).toBe("Property Analysis");
    expect(ctx?.autoMessage).toContain("123 Main St, Austin");
    expect(ctx?.autoMessage).toContain("$450,000");
  });

  it("falls back to a price-only message with no address", () => {
    const ctx = getSourceContext("?propertyPrice=450000");
    expect(ctx?.banner).toBe("Property Analysis");
    expect(ctx?.autoMessage).toContain("$450,000");
    expect(ctx?.autoMessage).toContain("priced at");
  });

  it("ignores an address with no price", () => {
    expect(getSourceContext("?propertyAddress=123%20Main%20St")).toBeNull();
  });

  it("lets a persona outrank a property price", () => {
    expect(getSourceContext("?source=va&propertyPrice=450000")?.banner).toBe("VA Loan Guidance");
  });

  it("PINNED: an unparseable price yields '$NaN' in the message", () => {
    // parseFloat("abc") is NaN and NaN.toLocaleString() is "NaN", so the
    // coach is asked about a home "priced at $NaN". Only reachable by hand-
    // editing the URL, and preserved rather than fixed — but pinned so the
    // behaviour is known rather than discovered in a transcript.
    expect(getSourceContext("?propertyPrice=abc")?.autoMessage).toContain("$NaN");
  });
});

describe("getSourceContext — no match", () => {
  it("returns null for an empty or unrelated query string", () => {
    expect(getSourceContext("")).toBeNull();
    expect(getSourceContext("?utm_campaign=spring")).toBeNull();
    expect(getSourceContext("?source=unknown")).toBeNull();
  });
});
