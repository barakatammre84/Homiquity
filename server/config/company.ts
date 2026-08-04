import { COMPANY_IDENTITY } from "@shared/companyIdentity";
import { mersOrgIdApplicable } from "@shared/businessChannel";

// Server-side company config. Public identity (legal name, NMLS ID, contact)
// lives in shared/companyIdentity.ts so the client renders the same values;
// this object adds the server-only settings and keeps the original shape for
// existing importers (mismo, emails, credit service, pre-underwriting).
export const COMPANY_CONFIG = {
  ...COMPANY_IDENTITY,
  /**
   * MERS organisation id.
   *
   * MERS registers the notes an entity HOLDS. A broker holds none, so in the
   * broker channel this is not a pending task — it is inapplicable, and
   * pursuing an org id would be an annual membership fee for a registry with
   * nothing to register (audit F-14). It was previously "PENDING", which read
   * as merely late and kept the item on the roadmap.
   *
   * Becomes a real, required id the moment the channel flips to
   * correspondent — see shared/businessChannel.ts and
   * knowledge-base/governance/CHANNEL_DECISION.md.
   */
  mersOrgId: mersOrgIdApplicable() ? "PENDING" : "NOT_APPLICABLE_BROKER_CHANNEL",
  get contactInfo() {
    return `${this.contactEmail} | ${this.contactPhone}`;
  },
  equalHousingLender: true,
  // Canonical production base URL — the single source for any customer-facing
  // link (SMS/email document links, etc.). Override with APP_BASE_URL per env.
  // Cutover complete (2026-07-13): www.homiquity.com is the live custom domain.
  // Override with APP_BASE_URL per environment.
  baseUrl: process.env.APP_BASE_URL || "https://www.homiquity.com",
} as const;
