import { COMPANY_IDENTITY } from "@shared/companyIdentity";

// Server-side company config. Public identity (legal name, NMLS ID, contact)
// lives in shared/companyIdentity.ts so the client renders the same values;
// this object adds the server-only settings and keeps the original shape for
// existing importers (mismo, emails, credit service, pre-underwriting).
export const COMPANY_CONFIG = {
  ...COMPANY_IDENTITY,
  mersOrgId: "PENDING",
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
