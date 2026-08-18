import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { SITEMAP_STATIC_PATHS, STATIC_ROUTE_META } from "../shared/seo/routeMeta";

/**
 * The rent surfaces' inbound paths, pinned.
 *
 * The 2026-08-17 audit found both routes shipped as ORPHANS: `/my-lease` had exactly
 * one reference in the codebase (its route registration) and `/rent-reporting` was in
 * no nav, no footer, no sitemap, no routeMeta. A funnel with no entrance is dark, and
 * nothing red happens when a link is deleted — it just stops being reachable. These
 * assertions make that deletion loud, the same class as tests/cronSchedules.test.ts.
 *
 * Source-text on the nav components rather than a render: the sidebar renders
 * per-role, so a render test would pin one role's view; the registry entries are what
 * every view derives from.
 */

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("/my-lease is reachable", () => {
  it("has a RenterHome toolkit tile — the renter persona's front door", () => {
    const src = read("client/src/pages/borrower/RenterHome.tsx");
    expect(src).toContain('href: "/my-lease"');
    expect(src).toContain("renter-tool-my-lease");
  });

  it("has a borrower sidebar entry", () => {
    const src = read("client/src/components/app-sidebar.tsx");
    expect(src).toContain('href: "/my-lease"');
    expect(src).toContain("link-my-lease");
  });
});

describe("/rent-reporting is reachable and crawlable", () => {
  it("has a footer link on every public page", () => {
    const src = read("client/src/components/Footer.tsx");
    expect(src).toContain('href="/rent-reporting"');
    expect(src).toContain("link-footer-rent-reporting");
  });

  it("has a STATIC_ROUTE_META entry that mirrors the page's SEOHead verbatim", () => {
    const meta = STATIC_ROUTE_META["/rent-reporting"];
    expect(meta, "no routeMeta entry — crawlers and shared links get generic copy").toBeTruthy();
    // The documented failure mode of routeMeta.ts is silent drift from the page.
    const page = read("client/src/pages/public/RentReporting.tsx");
    expect(page).toContain(`title="${meta.title}"`);
    expect(page).toContain(`description="${meta.description}"`);
  });

  it("is in the sitemap", () => {
    expect(SITEMAP_STATIC_PATHS).toContain("/rent-reporting");
  });
});
