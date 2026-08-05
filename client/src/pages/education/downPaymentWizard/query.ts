/**
 * Filters -> /api/dpa-programs endpoint, and the licensed-footprint notice.
 *
 * Extracted from DownPaymentWizard.tsx unchanged. The endpoint string doubles
 * as the query key, so its construction has to be stable: two filter states
 * that mean the same thing must produce the same string or they cache apart.
 */
import { LICENSED_STATES } from "@shared/companyIdentity";
import type { WizardFilters } from "./types";

export function buildDpaEndpoint(filters: WizardFilters): string {
  const queryParams = new URLSearchParams();
  if (filters.state !== "all") queryParams.set("state", filters.state);
  if (filters.firstTimeBuyer === "yes") queryParams.set("firstTimeBuyer", "true");
  if (filters.minCreditScore) queryParams.set("minCreditScore", filters.minCreditScore);
  const queryString = queryParams.toString();
  return `/api/dpa-programs${queryString ? `?${queryString}` : ""}`;
}

/**
 * Shown whenever a concrete state outside the licensed footprint is selected,
 * regardless of result count — the notice must stay correct even if the
 * directory ever gains rows for that state.
 */
export function isUnlicensedStateSelected(filters: WizardFilters): boolean {
  return filters.state !== "all" && !(LICENSED_STATES as readonly string[]).includes(filters.state);
}
