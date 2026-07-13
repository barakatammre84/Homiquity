import { describe, expect, it } from "vitest";
import {
  COACH_LINT_SAFE_MESSAGE,
  applyCoachLintFilter,
  findStreamingHardBlock,
} from "../server/services/coachingService";

// The coach's deterministic compliance rail: Reg N hard-blocks (guaranteed /
// assured approval) REPLACE the reply; Reg Z trigger terms and non-hard-block
// Tier-2 phrases are LOG-ONLY (full Tier-1 blocking would gut ordinary
// coaching language like "20% down" — flagged founder/compliance decision).

describe("applyCoachLintFilter — full-reply post-filter", () => {
  it("replaces an affirmative approval guarantee (Reg N §1014.3(q) hard block)", () => {
    const result = applyCoachLintFilter(
      "Great news! Based on these numbers your approval is guaranteed once we verify your documents.",
    );
    expect(result.replaced).toBe(true);
    expect(result.text).toBe(COACH_LINT_SAFE_MESSAGE);
    expect(result.hit?.citations.join(" ")).toContain("1014.3(q)");
  });

  it("passes the compliant negated form untouched", () => {
    const result = applyCoachLintFilter(
      "To be clear, approval is not guaranteed before underwriting review.",
    );
    expect(result.replaced).toBe(false);
  });

  it("still blocks a neighboring-clause dodge (negation must be in the SAME clause)", () => {
    const result = applyCoachLintFilter("I won't lie — your approval is guaranteed.");
    expect(result.replaced).toBe(true);
  });

  it("logs-but-keeps Reg Z trigger terms like a downpayment percentage", () => {
    const result = applyCoachLintFilter(
      "Many buyers put 20% down to avoid mortgage insurance, but smaller amounts are possible.",
    );
    expect(result.replaced).toBe(false);
    expect(result.flaggedCategories).toContain("downpayment");
  });

  it("logs-but-keeps a Tier-2 superlative (non-hard-block)", () => {
    const result = applyCoachLintFilter("We'll help you find the best rate for your profile.");
    expect(result.replaced).toBe(false);
    expect(result.flaggedCategories).toContain("superlative_rate");
  });

  it("the safe replacement message itself passes the filter (self-consistency)", () => {
    const result = applyCoachLintFilter(COACH_LINT_SAFE_MESSAGE);
    expect(result.replaced).toBe(false);
  });
});

describe("findStreamingHardBlock — incremental sentence-bounded guard", () => {
  it("never judges a half-written sentence", () => {
    // No sentence terminator yet — a trailing "…not guaranteed" could still arrive.
    expect(findStreamingHardBlock("Your approval is guaranteed")).toBeNull();
  });

  it("fires once the offending sentence is complete", () => {
    const hit = findStreamingHardBlock("Your approval is guaranteed. Next, let's");
    expect(hit).not.toBeNull();
    expect(hit?.categories).toContain("approval_guarantee");
  });

  it("stays silent when the completed sentence negates the phrase", () => {
    expect(
      findStreamingHardBlock("Your approval is not guaranteed before underwriting. Next,"),
    ).toBeNull();
  });

  it("treats a newline as a sentence boundary", () => {
    expect(findStreamingHardBlock("Approval guaranteed\n")).not.toBeNull();
  });

  it("ignores clean coaching text", () => {
    expect(
      findStreamingHardBlock("Let's collect your income details next. A rough estimate works."),
    ).toBeNull();
  });
});
