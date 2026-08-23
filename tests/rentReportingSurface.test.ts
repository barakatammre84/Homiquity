import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { lintOutboundText } from "../shared/compliance/loCommsLint";

/**
 * Source-text compliance pins for the public rent-reporting page.
 *
 * Same shape as tests/illinoisDpaSeed.test.ts: assert against the file's text so a
 * copy edit that reintroduces a barred claim fails the build rather than the audit.
 *
 * The page is public, indexable, and pre-license, so three rails apply at once —
 * Reg Z trigger terms, Reg N §1014.3(q) approval language, and (new for this surface)
 * no credit-improvement promise. It also must state plainly that nothing is being
 * reported yet, because the pitch's revenue model depended on users not knowing that.
 */

const ROOT = path.resolve(__dirname, "..");
const PAGE = path.join(ROOT, "client/src/pages/public/RentReporting.tsx");
const src = fs.readFileSync(PAGE, "utf8");

/**
 * The page minus its comments.
 *
 * The header comment discusses the very phrases the lint bans ("approval-likelihood",
 * "credit repair", "UDAAP"), so linting the raw file would flag the explanation of why
 * the copy is safe. Stripping comments leaves the JSX copy — what a visitor actually
 * reads — which is the thing under test.
 */
const visibleCopy = src
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

describe("the page states it is not reporting yet, on the surface", () => {
  it("says so in the alert, not a footnote", () => {
    expect(src).toMatch(/not reporting to the credit\s*\n?\s*bureaus yet/i);
    expect(src).toContain('data-testid="alert-not-yet-reporting"');
  });

  it("says nothing is for sale and no one is charged", () => {
    expect(visibleCopy).toMatch(/nothing is for sale/i);
    expect(visibleCopy).toMatch(/will not be charged/i);
  });
});

describe("nothing is sold on this page", () => {
  it("carries no price, pricing card, or checkout", () => {
    // The pitch specified "$5/mo — Monthly Reporting" and "$49 One-Time — Report Past
    // 24 Months" cards. The first cannot be charged before a tradeline exists; the
    // second would furnish history we never observed. Neither may appear.
    expect(visibleCopy).not.toMatch(/\$\s?\d/);
    expect(visibleCopy).not.toMatch(/\b\d+\s*\/\s*mo\b/i);
    expect(visibleCopy).not.toMatch(/\b(checkout|subscribe|per month|one-time)\b/i);
  });

  it("does not offer retroactive reporting of past rent", () => {
    expect(visibleCopy).not.toMatch(/past\s+24\s+months|report.{0,20}history you|backdat/i);
  });
});

describe("no credit-improvement promise", () => {
  it("avoids boost/raise/increase-your-score claims", () => {
    expect(visibleCopy).not.toMatch(/\b(boost|raise|increase|improve|build)\b[^.!?]{0,30}\bscore\b/i);
    expect(visibleCopy).not.toMatch(/\bpoints?\b[^.!?]{0,20}\b(gain|add|higher)\b/i);
  });

  it("discloses that results vary and that late payments are reported too", () => {
    expect(visibleCopy).toMatch(/results vary/i);
    expect(visibleCopy).toMatch(/late or missed payments/i);
    // JSX wraps this across a line, so match across whitespace rather than a literal space.
    expect(visibleCopy).toMatch(/not credit\s+repair/i);
  });

  it("says Homiquity does not decide qualification", () => {
    expect(visibleCopy).toMatch(/does not decide whether you qualify/i);
  });
});

describe("Reg Z / Reg N lexicons", () => {
  it("the visible copy is clean under lintOutboundText", () => {
    const result = lintOutboundText(visibleCopy);
    const describe = (ms: typeof result.triggerMatches) =>
      ms.map((m) => `${m.ruleId}: ${m.matchedText}`);
    // Assert the match arrays, not just `blocked` — a Tier-2 promise phrase sets
    // requiresOverride rather than blocked, and there is no human here to override it.
    expect(describe(result.triggerMatches), "Reg Z trigger term in public copy").toEqual([]);
    expect(describe(result.promiseMatches), "Reg N promise phrase in public copy").toEqual([]);
    expect(describe(result.hardBlockMatches)).toEqual([]);
    expect(result.blocked).toBe(false);
    expect(result.requiresOverride).toBe(false);
  });

  it("carries no rate, APR, or payment-term trigger language", () => {
    expect(visibleCopy).not.toMatch(/\bAPR\b|\binterest rate\b|%\s*(rate|apr)/i);
  });
});

describe("capture path", () => {
  it("posts to the email-capture endpoint, not the consumer mortgage lead intake", () => {
    // /api/leads mandates a TrustedForm certificate we cannot mint on our own page and
    // fires speed-to-lead outreach. A waitlist signup is not a mortgage inquiry.
    //
    // Matches the ENDPOINT, not the transport that calls it. This used to pin
    // `fetch("/api/email-capture"` and broke when the page moved onto apiRequest
    // (so a rejected signup stops rendering as a success). The compliance claim
    // is about which endpoint receives the address — asserting the caller's
    // spelling made a transport refactor look like a compliance regression.
    expect(src).toContain('"/api/email-capture"');
    // Checked against the comment-stripped source: the header comment names /api/leads
    // precisely to record why it is NOT used, and that explanation must not fail its own test.
    expect(visibleCopy).not.toContain("/api/leads");
  });

  it("collects no phone number — TCPA governs calls and texts, so we don't ask", () => {
    // Assert the absence of an input CONTROL, not of the word: the copy says "we don't
    // ask for your phone", which is the disclosure, not a violation.
    expect(src).not.toMatch(/type="tel"/i);
    expect(src).not.toMatch(/autoComplete="tel"/i);
    expect(src).not.toMatch(/id="[^"]*phone[^"]*"/i);
  });

  it("carries the honeypot the server silently drops", () => {
    expect(src).toMatch(/honeypot/i);
    expect(src).toContain("website");
  });

  it("tags the capture with its own source so the waitlist is separable", () => {
    expect(src).toContain('source: "rent_reporting_waitlist"');
  });
});

describe("design system", () => {
  it("uses semantic tokens — no raw palette or bare white/black utilities", () => {
    // The pitch asked for "indigo focus rings" and a Stripe aesthetic. This repo routes
    // all color through the "Mint & Flare" tokens (scripts/design-token-guard.cjs).
    expect(src).not.toMatch(
      /\b(bg|text|border|ring|from|to|via)-(indigo|slate|gray|emerald|blue|amber|violet)-\d{2,3}\b/,
    );
    expect(src).not.toMatch(/\b(bg|text|border)-(white|black)\b/);
  });
});
