import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { PENDING_REFERRAL_CODE_KEY, PENDING_CPA_CODE_KEY } from "@/lib/pendingAttribution";

/**
 * Applies any attribution code a consumer stashed before they had an account,
 * as soon as they authenticate — regardless of which page they land on (password
 * signup/login OR OAuth callback). Mounted once in the authenticated layout.
 *
 * Both channels stash a code on their landing page (LO `/ref/:code`,
 * CPA `/cpa/:code`) but a logged-out visitor can't attribute until they sign up.
 * Historically only the CPA code was ever consumed (and only on RenterHome), so a
 * logged-out consumer who arrived via an LO link was silently never attributed.
 *
 * Best-effort and idempotent: the code is cleared before the POST fires so a
 * remount can't double-apply, and a failed/duplicate attribution POST is swallowed
 * — it must never block, redirect, or re-toast over the app.
 */
export function usePendingAttribution(): void {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    let referralCode: string | null = null;
    let cpaCode: string | null = null;
    try {
      referralCode = localStorage.getItem(PENDING_REFERRAL_CODE_KEY);
      cpaCode = localStorage.getItem(PENDING_CPA_CODE_KEY);
      if (referralCode) localStorage.removeItem(PENDING_REFERRAL_CODE_KEY);
      if (cpaCode) localStorage.removeItem(PENDING_CPA_CODE_KEY);
    } catch {
      return;
    }

    if (referralCode) {
      apiRequest("POST", "/api/apply-referral", { referralCode }).catch(() => {
        /* best-effort attribution — never blocks the app */
      });
    }
    if (cpaCode) {
      apiRequest("POST", "/api/cpa/apply-referral", { referralCode: cpaCode }).catch(() => {
        /* best-effort attribution — never blocks the app */
      });
    }
  }, [isAuthenticated]);
}
