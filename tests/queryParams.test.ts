import { describe, it, expect } from "vitest";
import { firstQueryValue } from "../server/routes/queryParams";

// The literal shapes below mirror what Express's qs-based query parser
// actually produces for each query string:
//   ?x=a        → "a"
//   ?x=a&x=b    → ["a", "b"]
//   ?x[]=a      → ["a"]
//   ?x[a]=b     → { a: "b" }
//   ?x[][a]=b   → [{ a: "b" }]
// The `as string` casts this helper replaces threw TypeErrors on the array
// and object shapes (e.g. `(req.query.input as string || "").trim()`) —
// attacker-triggerable 500s on unauthenticated routes like /api/geocode/*.

describe("firstQueryValue", () => {
  it("passes plain scalars through unchanged", () => {
    expect(firstQueryValue("hello")).toBe("hello");
    expect(firstQueryValue("")).toBe("");
    expect(firstQueryValue("  padded  ")).toBe("  padded  ");
  });

  it("returns undefined for a missing param", () => {
    expect(firstQueryValue(undefined)).toBeUndefined();
  });

  it("takes the first element of a repeated key (?x=a&x=b)", () => {
    expect(firstQueryValue(["a", "b"])).toBe("a");
  });

  it("unwraps single-element bracket arrays (?x[]=a)", () => {
    expect(firstQueryValue(["a"])).toBe("a");
  });

  it("returns undefined for an empty array", () => {
    expect(firstQueryValue([])).toBeUndefined();
  });

  it("returns undefined for bracket objects (?x[a]=b)", () => {
    expect(firstQueryValue({ a: "b" })).toBeUndefined();
  });

  it("returns undefined when the first array element is nested (?x[][a]=b)", () => {
    expect(firstQueryValue([{ a: "b" }])).toBeUndefined();
  });

  it("returns undefined for other non-string values", () => {
    expect(firstQueryValue(null)).toBeUndefined();
    expect(firstQueryValue(42)).toBeUndefined();
  });

  it("keeps the route idioms working without throwing", () => {
    // (req.query.mode as string || "address").trim() — scalar unchanged…
    expect((firstQueryValue("location") || "address").trim()).toBe("location");
    // …and the shapes that used to throw now degrade gracefully:
    // previously ["location","x"].trim() → TypeError.
    expect((firstQueryValue(["location", "x"]) || "address").trim()).toBe("location");
    expect((firstQueryValue({ evil: "1" }) || "address").trim()).toBe("address");
    // parseInt(firstQueryValue(x) ?? "") preserves parseInt-on-missing → NaN.
    expect(Number.isNaN(parseInt(firstQueryValue(undefined) ?? "", 10))).toBe(true);
  });
});
