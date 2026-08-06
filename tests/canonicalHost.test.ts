import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

import { COMPANY_IDENTITY } from "../shared/companyIdentity";
import { SITE_URL, absoluteUrl } from "../shared/seo/schema";

// -----------------------------------------------------------------------------
// One canonical host, asserted across every surface that hardcodes it.
//
// This pins the 2026-08-06 defect. The site's public host is declared in FOUR
// independent places, and two of them had silently drifted apart:
//
//   shared/companyIdentity.ts  siteUrl  -> https://homiquity.com   (apex)
//   server/config/company.ts   baseUrl  -> https://www.homiquity.com
//   client/index.html          og:/JSON-LD literals
//   client/public/robots.txt   Sitemap: line
//
// siteUrl feeds every canonical tag, og:url, JSON-LD @id/url and sitemap entry.
// baseUrl feeds customer-facing links. So the entire crawlable surface pointed
// at the apex while real traffic used www — and the apex has NO DNS record,
// because Railway serves this app through `CNAME www -> *.up.railway.app` and
// accepts an apex domain only via CNAME flattening or a dynamic ALIAS record,
// neither of which Squarespace DNS offers.
//
// The failure mode is why this is a test and not a comment: nothing breaks in
// CI, nothing 500s, no page looks wrong to a human. It is invisible until a
// crawler or a social scraper follows one of those absolute URLs into a host
// that does not resolve. A string constant with no consumer assertion is
// exactly the kind of thing that drifts back.
//
// If the apex is ever pointed at the app (moving nameservers to a provider with
// CNAME flattening), the correct change is to update EVERY surface below
// together — which is what this test forces.
// -----------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");
const INDEX_HTML = readFileSync(path.join(ROOT, "client/index.html"), "utf8");
const ROBOTS = readFileSync(path.join(ROOT, "client/public/robots.txt"), "utf8");

/** Every absolute homiquity URL literal in a file, deduped, host part only. */
function hostsIn(source: string): string[] {
  const matches = source.match(/https?:\/\/[a-z0-9.-]*homiquity\.com/gi) ?? [];
  return [...new Set(matches.map((m) => m.toLowerCase()))];
}

describe("canonical host", () => {
  it("is the www host, not the apex — the apex has no DNS record", () => {
    expect(COMPANY_IDENTITY.siteUrl).toBe("https://www.homiquity.com");
  });

  it("has no trailing slash, so absoluteUrl() cannot emit a double slash", () => {
    expect(COMPANY_IDENTITY.siteUrl.endsWith("/")).toBe(false);
    expect(absoluteUrl("/learn")).toBe("https://www.homiquity.com/learn");
    // Callers pass paths both with and without the leading slash.
    expect(absoluteUrl("learn")).toBe("https://www.homiquity.com/learn");
  });

  it("is what the SEO schema module actually exports", () => {
    expect(SITE_URL).toBe(COMPANY_IDENTITY.siteUrl);
  });

  it("matches every absolute URL literal in client/index.html", () => {
    const hosts = hostsIn(INDEX_HTML);
    // Guards against the test passing vacuously if the literals are ever
    // removed or renamed out of the regex's reach.
    expect(hosts.length).toBeGreaterThan(0);
    expect(hosts).toEqual([COMPANY_IDENTITY.siteUrl]);
  });

  it("matches the Sitemap host advertised by robots.txt", () => {
    const sitemapLine = ROBOTS.split("\n").find((l) =>
      l.toLowerCase().startsWith("sitemap:"),
    );
    expect(sitemapLine).toBeDefined();
    expect(sitemapLine!.trim()).toBe(
      `Sitemap: ${COMPANY_IDENTITY.siteUrl}/sitemap.xml`,
    );
  });

  it("agrees with the server's default request base URL", async () => {
    // server/config/company.ts resolves APP_BASE_URL first, so this asserts the
    // committed DEFAULT — the value prod falls back to if the var is ever unset.
    const source = readFileSync(
      path.join(ROOT, "server/config/company.ts"),
      "utf8",
    );
    const hosts = hostsIn(source);
    expect(hosts).toEqual([COMPANY_IDENTITY.siteUrl]);
  });
});
