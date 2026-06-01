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
} as const;
