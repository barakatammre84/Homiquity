import { useCallback, useEffect } from "react";
import { useSearchParams } from "wouter";
import { pickWorkableLoanApplication } from "@shared/schema";

/**
 * The query-string key that carries the borrower's chosen loan file, e.g.
 * /documents?app=<id>. Exported so tests and deep links agree on one spelling.
 */
export const ACTIVE_APP_PARAM = "app";

/**
 * Per-tab mirror of the selection. The URL alone is not enough: the in-app nav
 * links are bare (`/documents`, `/tasks`), so a normal click drops the query
 * string and the borrower would silently snap back to a different file
 * mid-workflow. This carries the choice across those navigations.
 *
 * sessionStorage, not localStorage — two tabs open on two different loan files
 * must stay independent. The stored value is only ever an id, and it is still
 * validated against the server-scoped list before use, so a stale entry (an
 * older session, a since-closed file) is inert rather than wrong.
 */
export const ACTIVE_APP_STORAGE_KEY = "homiquity_active_app";

function readStoredApplicationId(): string | null {
  try {
    return window.sessionStorage.getItem(ACTIVE_APP_STORAGE_KEY);
  } catch {
    return null; // private mode / storage disabled
  }
}

function storeApplicationId(id: string): void {
  try {
    window.sessionStorage.setItem(ACTIVE_APP_STORAGE_KEY, id);
  } catch {
    /* selection just falls back to the canonical pick */
  }
}

/** The minimum an application must expose to be selectable. */
export interface SelectableApplication {
  id: string;
  status: string;
}

/**
 * Resolve "which file is the borrower working on" from a list plus a requested
 * id. Pure and router-free so the rule is testable on its own.
 *
 * The requested id is only honoured when it appears in `applications` — the
 * list the server already scoped to this user. That membership check is the
 * trust boundary: a hand-edited or pasted `?app=` never reaches an API call,
 * it just falls back to the canonical pick.
 *
 * The fallback is `pickWorkableLoanApplication` (shared/schema/lendingCore.ts)
 * and nothing else — never `?? applications[0]`, which is how uploads once
 * landed on a denied/withdrawn/funded file (#271, #273).
 */
export function resolveActiveApplication<T extends SelectableApplication>(
  applications: readonly T[],
  requestedId: string | null | undefined,
): T | undefined {
  if (requestedId) {
    const requested = applications.find((a) => a.id === requestedId);
    if (requested) return requested;
  }
  return pickWorkableLoanApplication(applications);
}

export interface UseActiveApplicationResult<T extends SelectableApplication> {
  /** The file every surface on this page should read from. */
  activeApplication: T | undefined;
  /** Point the whole app at another file (writes `?app=` and the tab mirror). */
  selectApplication: (application: T) => void;
  /** The requested id (URL, else stored) before validation — tests/diagnostics. */
  requestedApplicationId: string | null;
}

/**
 * THE borrower-surface hook for "which loan file am I looking at".
 *
 * Selection is shared state, not component state: the Dashboard, Documents,
 * Tasks, Verification and URLA all resolve it the same way, so switching files
 * on one carries to the rest. It rides in two places — `?app=` in the URL (so a
 * file is linkable and survives reload) and a per-tab mirror (so it also
 * survives the bare `/documents`-style nav links, which drop the query string).
 * The URL wins when both are present.
 *
 * Deliberately takes the list instead of fetching it. Callers already hold it
 * (most from `/api/dashboard`, Documents from `/api/loan-applications`), and
 * binding selection to one endpoint would make the hook unusable on the other.
 *
 * The hook never writes the *URL* on its own — only `selectApplication` does.
 * Auto-correcting an unmatched `?app=` would erase a valid deep link during the
 * render before the list loads, when *every* id looks unmatched.
 */
export function useActiveApplication<T extends SelectableApplication>(
  applications: readonly T[],
): UseActiveApplicationResult<T> {
  const [searchParams, setSearchParams] = useSearchParams();
  // The URL wins over the stored value so a shared/deep link always opens the
  // file it names, even when this tab was last looking at another one.
  const requestedApplicationId = searchParams.get(ACTIVE_APP_PARAM) ?? readStoredApplicationId();

  const activeApplication = resolveActiveApplication(applications, requestedApplicationId);

  // Mirror whatever actually resolved, so the choice survives the bare in-app
  // links. Writing the *resolved* id (not the requested one) means a stale or
  // foreign id is corrected here instead of being persisted.
  useEffect(() => {
    if (activeApplication) storeApplicationId(activeApplication.id);
  }, [activeApplication?.id]);

  const selectApplication = useCallback(
    (application: T) => {
      storeApplicationId(application.id);
      setSearchParams(
        (prev) => {
          // Copy so sibling params (?tab=, ?highlight=) survive a switch.
          const next = new URLSearchParams(prev);
          next.set(ACTIVE_APP_PARAM, application.id);
          return next;
        },
        // Replace: switching files is a view change, not a place to go "back"
        // to. Pushing would make Back walk the switcher history instead of
        // leaving the page.
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { activeApplication, selectApplication, requestedApplicationId };
}
