import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  ILLINOIS_DPA_ARTICLES,
  ILLINOIS_DPA_PROGRAMS,
} from "../server/seedData/illinoisDpa";

// The DPA articles are public strings on the pre-license educational surface.
// The Armed Launch Charter's Lane 2 (public-word compliance) bans solicitation
// and approval language on anything a stranger can reach before F1, and the
// ArticleDetail renderer only understands headings, "- " lists, and plain
// paragraphs — these tests keep both constraints from regressing when copy
// is edited.

// Solicitation / approval phrasing banned on pre-F1 public surfaces
// (kb/ARMED_LAUNCH_CHARTER_2026-07-07.md §2 blocker class 2, audit Lane 2).
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
    const sitemap = readFileSync(
      join(__dirname, "..", "client", "public", "sitemap.xml"),
      "utf-8",
    );
    for (const article of ILLINOIS_DPA_ARTICLES) {
      expect(sitemap).toContain(`https://homiquity.com/learn/${article.slug}</loc>`);
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
