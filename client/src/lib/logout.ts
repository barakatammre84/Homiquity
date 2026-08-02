import { ACTIVE_APP_STORAGE_KEY } from "@/hooks/useActiveApplication";
import { queryClient } from "@/lib/queryClient";

/**
 * THE sign-out path. Every logout control calls this — there is no second
 * implementation to drift.
 *
 * It used to be three hand-rolled copies (the sidebar, and the desktop and
 * mobile menus in Navigation). The sidebar's copy never called
 * `queryClient.clear()`, so signing out from there left the previous user's
 * cached data — applications, documents, messages — in memory. That was masked
 * only by the hard `window.location.href` navigation at the end, which throws
 * the heap away; the day anyone switched that to a client-side route, the
 * sidebar path would have leaked one user's file into the next session.
 *
 * Order matters: tear down the server session first, then every trace of the
 * old one on the client, and only then navigate.
 */
export async function logout(): Promise<void> {
  try {
    // Raw fetch on purpose. apiRequest would route a 401 into the session-expiry
    // redirect, but here a dead session is the *goal*, not an interruption —
    // and the user is already on their way to "/". See the allowlist in
    // tests/apiRequestConvergence.test.ts.
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch {
    // Network failure still signs the user out locally: clearing the client
    // state and leaving is strictly safer than stranding them in a session
    // they asked to end.
  }

  queryClient.clear();

  try {
    // The per-tab active-file mirror is scoped to the user who chose it.
    // A stale id is inert (it fails validation against the next user's list),
    // but there is no reason to carry it across a sign-out.
    window.sessionStorage.removeItem(ACTIVE_APP_STORAGE_KEY);
  } catch {
    /* private mode / storage disabled */
  }

  window.location.href = "/";
}
