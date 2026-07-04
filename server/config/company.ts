export const COMPANY_CONFIG = {
  legalName: "Homiquity Mortgage Corporation",
  shortName: "Homiquity Mortgage Corp.",
  nmlsId: "PENDING",
  mersOrgId: "PENDING",
  contactEmail: "support@homiquity.com",
  contactPhone: "(555) 123-4567",
  get contactInfo() {
    return `${this.contactEmail} | ${this.contactPhone}`;
  },
  equalHousingLender: true,
  // Canonical production base URL — the single source for any customer-facing
  // link (SMS/email document links, etc.). Override with APP_BASE_URL per env.
  // DOMAIN CUTOVER: once homiquity.com is attached in Vercel, flip this default
  // to "https://homiquity.com" (or just set APP_BASE_URL) — one change, nothing
  // else to edit. Defaults to the current live domain until then.
  baseUrl: process.env.APP_BASE_URL || "https://mortgage-stream.vercel.app",
} as const;
