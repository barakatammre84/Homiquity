import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { describe, it, expect } from "vitest";

// -----------------------------------------------------------------------------
// Every authenticated client call must go through apiRequest.
//
// apiRequest is the only place the 401 → /login redirect is wired (see
// client/src/lib/queryClient.ts). A raw fetch() to an auth-gated endpoint
// bypasses it: when the session expires the component just renders an error or
// an empty state while the user is actually logged out, and whether they get
// bounced to /login depends on which endpoint happened to notice first.
//
// This guard makes every raw fetch to /api/ a deliberate, documented decision
// rather than something that creeps back in. Adding one is fine — add it here
// with the reason it must not go through apiRequest.
// -----------------------------------------------------------------------------

const CLIENT_SRC = join(__dirname, "..", "client", "src");

/**
 * Raw-fetch sites that are correct as they are. Key = repo-relative path,
 * value = why apiRequest is the wrong tool there.
 */
const ALLOWED_RAW_FETCH: Record<string, string> = {
  // queryClient.ts is deliberately absent: apiRequest/getQueryFn fetch a
  // variable URL, so they never match the literal "/api/" this scan looks for.

  // Must never trigger the session-expiry redirect.
  "client/src/hooks/useActivityTracker.ts":
    "public /api/track, fire-and-forget analytics — a 401 here must not navigate the user",
  "client/src/lib/errorReporter.ts":
    "public /api/client-errors — routing error reporting through the thing that throws risks a loop",
  "client/src/components/Navigation.tsx":
    "POST /api/auth/logout — session teardown; a 401 is the expected end state, not an expiry",
  "client/src/components/app-sidebar.tsx":
    "POST /api/auth/logout — session teardown (see Navigation.tsx)",

  // Public endpoints: no session to expire, and each owns error copy that
  // apiRequest's "<status>: <body>" throw would replace.
  "client/src/components/AddressInput.tsx": "public /api/geocode/* autocomplete",
  "client/src/components/EmailCaptureModal.tsx": "public /api/email-capture",
  "client/src/pages/public/Waitlist.tsx": "public /api/email-capture",
  "client/src/pages/public/PartnerWaitlist.tsx": "public /api/partner-waitlist",
  "client/src/pages/public/RedeemInvite.tsx":
    "public /api/staff-invites/validate/:code (the authenticated redeem call uses apiRequest)",
  "client/src/pages/agent-broker/ApplyInvite.tsx": "public /api/application-invites/validate/:token",
  "client/src/pages/agent-broker/FindAnAgent.tsx": "public /api/agents/search",
  "client/src/pages/education/FAQ.tsx": "public /api/faqs",
  "client/src/pages/education/ArticleDetail.tsx": "public /api/articles/:slug",
  "client/src/pages/education/LearningCenter.tsx": "public /api/articles",
  "client/src/pages/calculators/RentToOwnReadiness.tsx": "public /api/calculators/extract-lease",
  "client/src/pages/rates/MortgageRates.tsx": "public /api/mortgage-rates",
  "client/src/pages/rates/PurchaseRates.tsx": "public /api/mortgage-rates",
  "client/src/pages/rates/RefinanceRates.tsx": "public /api/mortgage-rates",
  "client/src/pages/rates/CashOutRates.tsx": "public /api/mortgage-rates",
  "client/src/pages/rates/HelocRates.tsx": "public /api/mortgage-rates",
  "client/src/pages/rates/VaRates.tsx": "public /api/mortgage-rates",
};

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** `fetch(` not preceded by a word char or dot — skips `refetch(`, `x.fetch(`. */
const RAW_FETCH = /(?<![\w.$])fetch\s*\(/;

function rawApiFetchSites(): Array<{ file: string; line: number; text: string }> {
  const hits: Array<{ file: string; line: number; text: string }> = [];
  for (const file of sourceFiles(CLIENT_SRC)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (!RAW_FETCH.test(line)) return;
      // The URL is usually on the same line; allow a two-line lookahead for
      // calls that wrap after `fetch(`.
      const window = [line, lines[i + 1] ?? "", lines[i + 2] ?? ""].join(" ");
      if (!window.includes("/api/")) return;
      hits.push({
        file: relative(join(__dirname, ".."), file),
        line: i + 1,
        text: line.trim(),
      });
    });
  }
  return hits;
}

describe("client → API transport convergence", () => {
  it("routes every authenticated call through apiRequest", () => {
    const offenders = rawApiFetchSites().filter((h) => !(h.file in ALLOWED_RAW_FETCH));

    expect(
      offenders.map((o) => `${o.file}:${o.line}  ${o.text}`),
      "Raw fetch() to /api/ bypasses apiRequest's 401 → /login redirect. Use " +
        "apiRequest(method, url, data?), or add the file to ALLOWED_RAW_FETCH " +
        "in this test with the reason it must stay raw.",
    ).toEqual([]);
  });

  it("keeps the allowlist honest — every entry still has a raw fetch", () => {
    // Stops the allowlist from rotting into a list of files that were cleaned
    // up long ago, which would silently re-permit a future raw fetch there.
    const filesWithRawFetch = new Set(rawApiFetchSites().map((h) => h.file));
    const stale = Object.keys(ALLOWED_RAW_FETCH).filter((f) => !filesWithRawFetch.has(f));
    expect(stale, "these allowlist entries no longer contain a raw /api/ fetch").toEqual([]);
  });
});
