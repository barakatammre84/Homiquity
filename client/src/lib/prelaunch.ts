/**
 * Pre-license launch gate (client).
 *
 * Homiquity cannot solicit a mortgage transaction until the company NMLS
 * license (roadmap F1) is issued. Until then the public site runs in a
 * "gated" mode: educational + legal content and a waitlist only — no rates,
 * no pricing, no application funnel, no persona conversion pages.
 *
 * Fail-safe: a PRODUCTION build is GATED by default and must be explicitly
 * opened (VITE_PRELAUNCH_GATED="false") to go commercial. Dev/test builds are
 * open by default so local work and integration tests are unaffected.
 *
 * On F1 day this flips together with (a) the real NMLS id in
 * shared/companyIdentity.ts and (b) the server PRELAUNCH_GATED env var. See
 * kb/ARMED_LAUNCH_CHARTER_2026-07-07.md.
 */
export const PRELAUNCH_GATED: boolean =
  import.meta.env.VITE_PRELAUNCH_GATED === "true" ||
  (import.meta.env.PROD && import.meta.env.VITE_PRELAUNCH_GATED !== "false");
