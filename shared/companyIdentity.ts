/**
 * Public company identity — the single source for every customer-facing
 * mention of who Homiquity is. Shared because both the client (footer, LPs)
 * and the server (emails, generated documents, MISMO) must render the same
 * identity, and the SAFE Act / Reg H unique-identifier requirement (12 CFR
 * 1008; see docs/nmls-safe/ + knowledge-base/compliance/SAFE_MLO_COMPLIANCE_MAP.md) binds them all
 * the moment a real NMLS ID exists.
 *
 * Server-only settings (baseUrl env resolution, MERS org ID) stay in
 * server/config/company.ts, which composes this object.
 */
export const COMPANY_IDENTITY = {
  legalName: "Homiquity Mortgage Corporation",
  shortName: "Homiquity Mortgage Corp.",
  /** NMLS unique identifier — issued at F1 licensing (SAFE Act 12 CFR 1008). */
  nmlsId: "427468",
  contactEmail: "support@homiquity.com",
  contactPhone: "(224) 400-0531",
  /**
   * Canonical public web address — the single source for absolute canonical
   * tags, OG/Twitter URLs, and the sitemap host. Matches client/public/
   * sitemap.xml and robots.txt. This is the customer-facing marketing domain;
   * the server request base (baseUrl, env-resolved) lives in
   * server/config/company.ts and is reconciled at the domain cutover (roadmap
   * Phase 3). Keep this in sync with the sitemap/robots host.
   */
  siteUrl: "https://homiquity.com",
} as const;

/**
 * tel: href for the company contact phone, derived from contactPhone so the
 * displayed number and the dial target can never drift apart. Assumes a
 * 10-digit US number (prefixes +1).
 */
export function contactPhoneTel(): string {
  const digits = COMPANY_IDENTITY.contactPhone.replace(/\D/g, "");
  return `tel:+${digits.length === 10 ? `1${digits}` : digits}`;
}

/**
 * Display string for the company NMLS unique identifier, or null while
 * licensing is pending. Callers must render NOTHING when this is null — an
 * invented or placeholder NMLS ID on a public surface would itself be a
 * violation, so the display "lights up" only when F1 assigns the real ID
 * (one edit: the nmlsId constant above).
 */
export function companyNmlsDisplay(): string | null {
  const id = COMPANY_IDENTITY.nmlsId as string;
  if (!id || id === "PENDING") return null;
  return `NMLS #${id}`;
}

/**
 * True while the company NMLS license (roadmap F1) has not yet been issued.
 * Drives the pre-license launch gate (server/services/prelaunchGate.ts): we
 * cannot solicit a mortgage transaction until this returns false.
 */
export function isCompanyNmlsPending(): boolean {
  const id = COMPANY_IDENTITY.nmlsId as string;
  return !id || id === "PENDING";
}

// =============================================================================
// Licensed-state footprint (roadmap A5; 2026-07-17 adjudication gap D).
//
// The company license (SAFE Act / Reg H, 12 CFR 1008) is state-by-state and
// STATE LAW CONTROLS what activity requires licensure (docs/nmls/README.md
// hierarchy; for Illinois, the Residential Mortgage License Act governs). We
// therefore do not take applications, set a subject-property state, or quote
// location-scoped pricing outside this list. Same light-up contract as
// companyNmlsDisplay(): while the NMLS id is PENDING the footprint is empty.
//
// FOUNDER-MAINTAINED: founder confirmed Illinois-only on 2026-07-17. Add a
// state here ONLY when its license is issued and verifiable on NMLS Consumer
// Access — never speculatively. Keep LICENSED_STATE_DETAILS (the Disclosures
// page card) and STATE_ZIP3_RANGES (zip-scoped gates) in step.
// =============================================================================

export const LICENSED_STATES = ["IL"] as const;

/** Rendered on the Disclosures "State Licensing" card. Add the state-issued
 * license number to `licenseNumber` when at hand — never invent one; the
 * NMLS Consumer Access link is the verification path either way. */
export const LICENSED_STATE_DETAILS: Array<{
  code: string;
  name: string;
  license: string;
  licenseNumber?: string;
}> = [
  { code: "IL", name: "Illinois", license: "Illinois Residential Mortgage License" },
];

// Full-name lookup so isLicensedState accepts "Illinois" as well as "IL".
const LICENSED_STATE_NAMES = new Map(
  LICENSED_STATE_DETAILS.map((s) => [s.name.toLowerCase(), s.code]),
);

/** USPS 3-digit ZIP prefixes per licensed state (inclusive ranges). Illinois
 * is 600xx–629xx. Used where only a ZIP is known (e.g. the MCP pricing tool). */
const STATE_ZIP3_RANGES: Record<string, Array<[number, number]>> = {
  IL: [[600, 629]],
};

function normalizeStateCode(state: string | null | undefined): string | null {
  const trimmed = (state ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return LICENSED_STATE_NAMES.get(trimmed.toLowerCase()) ?? trimmed.toUpperCase();
}

/** True when the company may arrange financing for a property in `state`. */
export function isLicensedState(state: string | null | undefined): boolean {
  if (isCompanyNmlsPending()) return false;
  const code = normalizeStateCode(state);
  return code !== null && (LICENSED_STATES as readonly string[]).includes(code);
}

/** True when a 5-digit ZIP falls inside a licensed state's USPS prefix range. */
export function isZipInLicensedStates(zip: string | null | undefined): boolean {
  if (isCompanyNmlsPending()) return false;
  const digits = (zip ?? "").trim();
  if (!/^\d{5}$/.test(digits)) return false;
  const prefix = parseInt(digits.slice(0, 3), 10);
  return LICENSED_STATES.some((code) =>
    (STATE_ZIP3_RANGES[code] ?? []).some(([lo, hi]) => prefix >= lo && prefix <= hi),
  );
}

/** Borrower-safe copy for the gate responses. Names the footprint dynamically
 * so adding a state never requires a copy edit. */
export function unlicensedStateMessage(state?: string | null): string {
  const names = LICENSED_STATE_DETAILS.map((s) => s.name).join(", ");
  const where = normalizeStateCode(state);
  return (
    `Homiquity is currently licensed to arrange mortgage financing in ${names} only, ` +
    `so we can't yet accept applications or provide quotes for properties` +
    `${where ? ` in ${where}` : " outside those states"}. Our licensing is independently ` +
    `verifiable through NMLS Consumer Access (${companyNmlsDisplay() ?? "NMLS id pending"}).`
  );
}

/**
 * One-liner gate for API routes writing a subject-property state: returns the
 * 422 envelope body when the state is outside the licensed footprint, or null
 * when the write may proceed. An ABSENT state never rejects — the TRID
 * address-last funnel legitimately collects the property late; the gate fires
 * only when a concrete unlicensed state is being set.
 */
export function unlicensedStateRejection(
  state: string | null | undefined,
): { error: string; code: "UNLICENSED_STATE" } | null {
  const trimmed = (state ?? "").trim();
  if (!trimmed) return null;
  if (isLicensedState(trimmed)) return null;
  return { error: unlicensedStateMessage(trimmed), code: "UNLICENSED_STATE" };
}
