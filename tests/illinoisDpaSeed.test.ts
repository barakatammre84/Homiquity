import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  ILLINOIS_DPA_ARTICLES,
  ILLINOIS_DPA_PROGRAMS,
} from "../server/seedData/illinoisDpa";
import { buildSitemapXml } from "../shared/seo/routeMeta";
import { SITE_URL } from "../shared/seo/schema";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

// The DPA articles are public strings on the pre-license educational surface.
// The Armed Launch Charter's Lane 2 (public-word compliance) bans solicitation
// and approval language on anything a stranger can reach before F1, and the
// ArticleDetail renderer only understands headings, "- " lists, and plain
// paragraphs — these tests keep both constraints from regressing when copy
// is edited.

// Solicitation / approval phrasing banned on pre-F1 public surfaces
// (knowledge-base/governance/ARMED_LAUNCH_CHARTER_2026-07-07.md §2 blocker class 2, audit Lane 2).
const BANNED_PHRASES = [
  "pre-approv",
  "preapprov",
  "get approved",
  "apply now",
  "apply today",
  "apply with",
  "start your application",
  "apr",
  "interest rate of",
];

// Values ProgramTypeBadge in DownPaymentWizard.tsx knows how to render.
const WIZARD_ASSISTANCE_TYPES = [
  "grant",
  "forgivable_loan",
  "deferred_loan",
  "second_mortgage",
  "matched_savings",
];

describe("Illinois DPA seed articles", () => {
  it("have unique slugs and are published under an existing category", () => {
    const slugs = ILLINOIS_DPA_ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const article of ILLINOIS_DPA_ARTICLES) {
      expect(article.status).toBe("published");
      expect(article.categoryId).toBe("cat-getting-started");
      expect(article.publishedAt).toBeInstanceOf(Date);
    }
  });

  it("contain no solicitation or approval language (charter Lane 2)", () => {
    for (const article of ILLINOIS_DPA_ARTICLES) {
      const haystack = [
        article.title,
        article.excerpt ?? "",
        article.content,
        article.metaTitle ?? "",
        article.metaDescription ?? "",
      ]
        .join("\n")
        .toLowerCase();
      for (const phrase of BANNED_PHRASES) {
        // Word-ish match so "apr" doesn't trip on words containing it.
        const pattern = new RegExp(`(^|[^a-z])${phrase}`, "i");
        expect(
          pattern.test(haystack),
          `"${phrase}" found in article "${article.slug}"`,
        ).toBe(false);
      }
    }
  });

  it("stay renderer-safe: no markdown links, bold, or tables", () => {
    for (const article of ILLINOIS_DPA_ARTICLES) {
      expect(article.content).not.toContain("](");
      expect(article.content).not.toContain("**");
      expect(article.content).not.toContain("|--");
    }
  });

  it("each carry a verify-current-terms disclaimer", () => {
    for (const article of ILLINOIS_DPA_ARTICLES) {
      expect(article.content).toContain("educational information current as of");
      expect(article.content.toLowerCase()).toContain("hud-approved housing counselor");
    }
  });

  it("are all listed in the public sitemap", () => {
    // /sitemap.xml is DB-driven: every published article is fed through
    // buildSitemapXml (the "published" status these seeds carry is asserted
    // above). Run the seed slugs through the real generator to pin the
    // /learn/<slug> URL shape and catch XML/URL-unsafe slugs.
    const sitemap = buildSitemapXml(
      ILLINOIS_DPA_ARTICLES.map((a) => ({ slug: a.slug })),
    );
    for (const article of ILLINOIS_DPA_ARTICLES) {
      expect(sitemap).toContain(`<loc>${SITE_URL}/learn/${article.slug}</loc>`);
    }
  });
});

describe("Illinois DPA seed programs", () => {
  it("use assistance types the wizard badge can render", () => {
    for (const program of ILLINOIS_DPA_PROGRAMS) {
      expect(
        WIZARD_ASSISTANCE_TYPES,
        `assistanceType "${program.assistanceType}" on "${program.name}"`,
      ).toContain(program.assistanceType);
    }
  });

  it("are Illinois programs with unique names and parseable amounts", () => {
    const names = ILLINOIS_DPA_PROGRAMS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    for (const program of ILLINOIS_DPA_PROGRAMS) {
      expect(program.state).toBe("IL");
      expect(program.isActive).toBe(true);
      expect(Number(program.maxAssistanceAmount)).toBeGreaterThan(0);
      expect(program.applicationUrl).toMatch(/^https:\/\//);
      // Every entry must date its facts so staleness is visible in the UI.
      expect(program.eligibilityNotes ?? "").toContain("as of July 2026");
    }
  });
});

// Source-text pins on the wizard page and its API route, added by the
// 2026-08-04 renter-incubation adjudication (§3.1–§3.4, §3.6): the wizard is a
// public, indexable, pre-license surface, so its copy may not carry unbacked
// market claims or promise money-math the platform doesn't perform, and its
// honesty must not depend on the directory happening to be Illinois-only.
describe("DownPaymentWizard public copy (renter-incubation adjudication §3)", () => {
  const wizardSource = read("client/src/pages/education/DownPaymentWizard.tsx");

  it("carries no unbacked market or eligibility-likelihood claims", () => {
    expect(wizardSource).not.toMatch(/\$?\d+\s*billion/i);
    expect(wizardSource).not.toMatch(/available nationwide/i);
    expect(wizardSource).not.toMatch(/most first-time buyers qualify/i);
  });

  it("does not promise automatic DPA handling in pre-approval", () => {
    // DPA touches zero money math (loanCosts/LE/pricing are DPA-clean);
    // the CTA may not promise otherwise.
    expect(wizardSource).not.toMatch(/we'?ll factor/i);
    expect(wizardSource).not.toMatch(/automatically/i);
  });

  it("frames the licensed footprint instead of relying on empty non-IL data", () => {
    expect(wizardSource).toContain("unlicensedStateMessage");
    expect(wizardSource).toContain("card-unlicensed-state-notice");
    expect(wizardSource).toMatch(/educational information/i);
  });

  it("hides the income filter until sourced income-limit data exists", () => {
    // Self-releasing pin: the seeded rows carry no maxIncome, so an income
    // input can only imply eligibility screening that never happens. The day
    // sourced income-limit data lands, this assertion stops applying.
    if (!ILLINOIS_DPA_PROGRAMS.some((p) => p.maxIncome != null)) {
      expect(wizardSource).not.toContain("input-income");
    }
  });

  it("keeps the DPA route validated (no untyped filters)", () => {
    const routeSource = read("server/routes/borrower/onboarding.ts");
    expect(routeSource).toContain("dpaProgramsQuerySchema.safeParse");
    expect(routeSource).not.toContain("filters: any");
  });
});
