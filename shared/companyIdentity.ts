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
  /** NMLS unique identifier — "PENDING" until licensing (roadmap F1) lands. */
  nmlsId: "PENDING",
  contactEmail: "support@homiquity.com",
  contactPhone: "(555) 123-4567",
} as const;

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
