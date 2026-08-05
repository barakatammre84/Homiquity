/**
 * Co-branding portal types.
 *
 * Note what the profile carries: nmlsId, licenseNumber and disclaimerText all
 * render on the PUBLIC /partner/:profileId landing page, so they are
 * advertising identifiers rather than internal settings. Server-side, only
 * agent/partner roles may mint a profile at all — consumer roles get a 403
 * (tests/roleSeparation.test.ts).
 */

export interface CoBrandProfile {
  id: string;
  brandName: string;
  tagline: string | null;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  nmlsId: string | null;
  licenseNumber: string | null;
  disclaimerText: string | null;
  bio: string | null;
  specialties: string[] | null;
  serviceAreas: string[] | null;
  isActive: boolean;
}

export interface ReferralStatus {
  id: string;
  clientName: string | null;
  clientEmail: string | null;
  status: string;
  createdAt: string;
  clickedAt: string | null;
  appliedAt: string | null;
  applicationStatus: string | null;
  applicationStage: string | null;
}

export interface DealDeskThread {
  id: string;
  subject: string;
  scenarioType: string | null;
  status: string;
  loanAmount: string | null;
  propertyType: string | null;
  creditScore: number | null;
  borrowerType: string | null;
  notes: string | null;
  createdAt: string;
}

/** Brand colours the partner picks; defaults match the house palette. */
export const DEFAULT_PRIMARY_COLOR = "#1e3a5f";
export const DEFAULT_ACCENT_COLOR = "#10b981";
