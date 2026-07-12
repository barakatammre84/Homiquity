import { describe, it, expect } from "vitest";
import {
  lintOutboundText,
  REG_Z_TRIGGER_LEXICON,
  REG_N_PROMISE_LEXICON,
  REG_Z_ADVERTISING_DISCLOSURE_BLOCK,
} from "../shared/compliance/loCommsLint";
import { buildCommsSnippets } from "../server/routes/comms";

// -----------------------------------------------------------------------------
// LO-5 comms lint — table-driven lexicon tests (Done-when: phrase in ->
// expected tier/action out). The lexicon is deterministic (I1), so these pin
// exact behavior and guard the regexes against over- and under-matching.
// -----------------------------------------------------------------------------

describe("lintOutboundText — Tier 1 (Reg Z §1026.24 trigger terms → BLOCK)", () => {
  const TIER1_BLOCKS: Array<[string, string]> = [
    ["You could put just 5% down on that home", "downpayment"],
    ["With 3.5% down payment you'd be set", "downpayment"],
    ["That's about $20,000 down", "downpayment"],
    ["A down payment of $15,000 works here", "downpayment"],
    ["Your payment would be about $1,850/mo", "payment_amount"],
    ["Roughly $2,000 per month", "payment_amount"],
    ["monthly payment of $1,750", "payment_amount"],
    ["I can get you 6.5% interest", "rate_or_finance_charge"],
    ["the rate is 5.99%", "rate_or_finance_charge"],
    ["APR of 6.8% on that program", "rate_or_finance_charge"],
    ["about 2 points to buy it down", "rate_or_finance_charge"],
    ["it amortizes over 360 payments", "repayment_period"],
  ];

  it.each(TIER1_BLOCKS)("blocks %j (category %s)", (text, category) => {
    const r = lintOutboundText(text);
    expect(r.blocked).toBe(true);
    expect(r.hasTriggerTerms).toBe(true);
    expect(r.triggerMatches.map((m) => m.category)).toContain(category);
    expect(r.triggerMatches.every((m) => m.tier === 1)).toBe(true);
  });

  const TIER1_CLEAN: string[] = [
    "Let's talk about your 30-year fixed option",
    "The 15-year and 30-year products are both available",
    "Can you upload your last two pay stubs?",
    "Your file looks strong — let's schedule a call",
    "We'll need bank statements for the last two months",
    "I sent your Loan Estimate; it has the full terms and APR",
  ];

  it.each(TIER1_CLEAN)("does NOT block a product/logistics message: %j", (text) => {
    const r = lintOutboundText(text);
    expect(r.blocked).toBe(false);
    expect(r.hasTriggerTerms).toBe(false);
  });
});

describe("lintOutboundText — Tier 2 (Reg N §1014.3 promise phrases → WARN)", () => {
  const TIER2_WARNS: Array<[string, string]> = [
    ["Your approval is guaranteed once you apply", "approval_guarantee"],
    ["You're guaranteed to qualify for this", "approval_guarantee"],
    ["We offer assured approval for veterans", "approval_guarantee"],
    ["I'll get you the lowest rate around", "superlative_rate"],
    ["We have the best rates in the state", "superlative_rate"],
    ["There are no fees with this loan", "no_fees"],
    ["Zero closing costs, I promise", "no_fees"],
    ["This loan is government guaranteed", "government_affiliation"],
  ];

  it.each(TIER2_WARNS)("warns on %j (category %s)", (text, category) => {
    const r = lintOutboundText(text);
    expect(r.hasPromisePhrases).toBe(true);
    expect(r.requiresOverride).toBe(true);
    // Tier-2 never hard-blocks on its own.
    expect(r.blocked).toBe(false);
    const match = r.promiseMatches.find((m) => m.category === category);
    expect(match).toBeDefined();
    expect(match!.tier).toBe(2);
    // Every Tier-2 rule carries a compliant rewrite.
    expect(match!.suggestedRewrite && match!.suggestedRewrite.length).toBeTruthy();
  });

  const TIER2_CLEAN: string[] = [
    "Your file looks strong, but final approval depends on underwriting",
    "I'll send the Loan Estimate with the exact fees",
    "FHA is a government program; we're a private broker",
    "Let's review the conditions still open on your file",
  ];

  it.each(TIER2_CLEAN)("does NOT warn on compliant phrasing: %j", (text) => {
    const r = lintOutboundText(text);
    expect(r.hasPromisePhrases).toBe(false);
    expect(r.requiresOverride).toBe(false);
  });
});

describe("lintOutboundText — determinism & structure", () => {
  it("is deterministic: same input → identical result", () => {
    const text = "You're guaranteed 5% down and the lowest rate at $1,800/mo";
    expect(JSON.stringify(lintOutboundText(text))).toBe(JSON.stringify(lintOutboundText(text)));
  });

  it("reports both tiers when a message mixes a trigger term and a promise phrase", () => {
    const r = lintOutboundText("Guaranteed approval, and your rate is 6.25%!");
    expect(r.hasTriggerTerms).toBe(true); // 6.25% rate
    expect(r.hasPromisePhrases).toBe(true); // guaranteed approval
    expect(r.blocked).toBe(true); // Tier-1 dominates the send decision
  });

  it("clears clean text", () => {
    const r = lintOutboundText("Thanks! I'll follow up after underwriting reviews your file.");
    expect(r.blocked).toBe(false);
    expect(r.requiresOverride).toBe(false);
    expect(r.triggerMatches).toEqual([]);
    expect(r.promiseMatches).toEqual([]);
  });

  it("every rule id is unique and carries a citation", () => {
    const all = [...REG_Z_TRIGGER_LEXICON, ...REG_N_PROMISE_LEXICON];
    const ids = all.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(all.every((r) => /CFR/.test(r.citation))).toBe(true);
  });

  it("exposes the §1026.24(d)(2) disclosure block as cited reference text", () => {
    expect(REG_Z_ADVERTISING_DISCLOSURE_BLOCK).toMatch(/1026\.24\(d\)/);
    expect(REG_Z_ADVERTISING_DISCLOSURE_BLOCK).toMatch(/Annual Percentage Rate|APR/);
  });
});

describe("buildCommsSnippets — script library projection", () => {
  it("projects cited talking points from the scenario catalog and compliant rewrites from the lexicon", () => {
    const lib = buildCommsSnippets();
    expect(lib.talkingPoints.length).toBeGreaterThan(0);
    // Every talking-point group carries its scenario + at least one citation + snippet.
    for (const group of lib.talkingPoints) {
      expect(group.scenarioId).toBeTruthy();
      expect(group.snippets.length).toBeGreaterThan(0);
      expect(group.citations.length).toBeGreaterThan(0);
    }
    // Compliant phrasings come from the Reg N lexicon rewrites.
    expect(lib.compliantPhrasings.length).toBeGreaterThan(0);
    expect(lib.compliantPhrasings.every((p) => p.text.length > 0 && /CFR/.test(p.citation))).toBe(true);
  });
});
