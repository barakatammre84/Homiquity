import { describe, expect, it } from "vitest";
import { COMPANY_IDENTITY, contactPhoneTel } from "../shared/companyIdentity";
import {
  gatedPrerenderMeta,
  PRELAUNCH_DESCRIPTION,
  PRELAUNCH_TITLE,
  SITEMAP_STATIC_PATHS,
  STATIC_ROUTE_META,
} from "../shared/seo/routeMeta";

// Launch-surface invariants:
// 1. The public contact channels derive from COMPANY_IDENTITY — the tel: href
//    can never drift from the displayed number.
// 2. While the prelaunch gate is up, the bot prerender must not advertise
//    metadata for routes humans are redirected away from (the /rates* pages
//    carried full rate-advertising descriptions to crawlers while every human
//    was sent to the Waitlist), and the launch-safe copy itself must stay free
//    of Reg Z trigger-term and Reg N approval language.

describe("contactPhoneTel", () => {
  it("emits a tel: href derived from the displayed contactPhone", () => {
    const tel = contactPhoneTel();
    expect(tel).toMatch(/^tel:\+1\d{10}$/);
    expect(tel.replace(/\D/g, "").slice(-10)).toBe(
      COMPANY_IDENTITY.contactPhone.replace(/\D/g, ""),
    );
  });
});

describe("prelaunch head copy is launch-safe", () => {
  it("carries no rate, payment, percent, dollar, or approval language", () => {
    for (const copy of [PRELAUNCH_TITLE, PRELAUNCH_DESCRIPTION]) {
      expect(copy).not.toMatch(/%|\$/);
      expect(copy).not.toMatch(/approv|guarantee|rate|payment|apr\b/i);
    }
  });
});

describe("gatedPrerenderMeta", () => {
  it("serves indexable waitlist copy at the root", () => {
    const decision = gatedPrerenderMeta("/");
    expect(decision).not.toBeNull();
    expect(decision!.noindex).toBe(false);
    expect(decision!.meta.title).toBe(PRELAUNCH_TITLE);
    expect(decision!.meta.description).toBe(PRELAUNCH_DESCRIPTION);
    expect(decision!.meta.canonicalPath).toBe("/");
  });

  it("replaces every gated registry route (the /rates* pages) with noindexed launch-safe copy", () => {
    const gatedRegistryPaths = Object.keys(STATIC_ROUTE_META).filter(
      (p) => p !== "/" && !SITEMAP_STATIC_PATHS.includes(p),
    );
    // The registry's gated subset today is exactly the six rate pages; if this
    // shrinks to zero the guard below stops testing anything — fail loudly.
    expect(gatedRegistryPaths.length).toBeGreaterThan(0);
    for (const path of gatedRegistryPaths) {
      const decision = gatedPrerenderMeta(path);
      expect(decision, path).not.toBeNull();
      expect(decision!.noindex, path).toBe(true);
      expect(decision!.meta.title, path).toBe(PRELAUNCH_TITLE);
      expect(decision!.meta.description, path).toBe(PRELAUNCH_DESCRIPTION);
    }
  });

  it("noindexes the client-gated routes that never had registry entries", () => {
    for (const path of [
      "/refinance",
      "/va-loans",
      "/self-employed",
      "/first-time-buyer",
      "/apply",
      "/approval-strength",
      "/afford",
      "/learn/first-time-buyer",
    ]) {
      const decision = gatedPrerenderMeta(path);
      expect(decision, path).not.toBeNull();
      expect(decision!.noindex, path).toBe(true);
    }
  });

  it("leaves the ungated public routes and published articles alone", () => {
    for (const path of SITEMAP_STATIC_PATHS.filter((p) => p !== "/")) {
      expect(gatedPrerenderMeta(path), path).toBeNull();
    }
    expect(gatedPrerenderMeta("/learn/what-is-escrow")).toBeNull();
  });

  it("normalizes trailing slashes before deciding", () => {
    expect(gatedPrerenderMeta("/rates/")).not.toBeNull();
    expect(gatedPrerenderMeta("/rates/")!.noindex).toBe(true);
    expect(gatedPrerenderMeta("/calculators/")).toBeNull();
  });
});
