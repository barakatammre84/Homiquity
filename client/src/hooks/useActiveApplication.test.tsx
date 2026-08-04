import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  ACTIVE_APP_PARAM,
  ACTIVE_APP_STORAGE_KEY,
  resolveActiveApplication,
  useActiveApplication,
  type SelectableApplication,
} from "./useActiveApplication";

// Selection is the one piece of borrower state that must agree across pages, so
// these tests pin both halves: the rule (resolveActiveApplication) and the
// carrier (the ?app= query param).

const app = (id: string, status: string): SelectableApplication => ({ id, status });

const at = (url: string) => window.history.replaceState(null, "", url);

beforeEach(() => {
  at("/dashboard");
  window.sessionStorage.clear();
});

describe("resolveActiveApplication", () => {
  it("honours a requested id that belongs to the borrower", () => {
    const apps = [app("a-1", "draft"), app("a-2", "processing")];
    expect(resolveActiveApplication(apps, "a-2")?.id).toBe("a-2");
  });

  it("ignores an id that is not in the list and falls back to the canonical pick", () => {
    // The list is server-scoped to this user, so membership is the trust
    // boundary: a pasted/edited ?app= must never reach an API call.
    const apps = [app("a-1", "processing")];
    expect(resolveActiveApplication(apps, "someone-elses-file")?.id).toBe("a-1");
  });

  it("falls back past closed files instead of resurrecting them (#271/#273)", () => {
    // Newest-first, and the newest is closed — the exact shape that made
    // `?? applications[0]` attach uploads to a withdrawn loan.
    const apps = [app("closed", "withdrawn"), app("open", "doc_collection")];
    expect(resolveActiveApplication(apps, undefined)?.id).toBe("open");
  });

  it("refuses a REQUESTED closed file too, not just the fallback (#271/#273)", () => {
    // The companion to the case above, and the half that was open: a terminal
    // file passes the membership check (it really is this borrower's), so
    // naming it in ?app= used to hand it back as the working file — and
    // Documents.tsx puts that id straight into the upload registration.
    const apps = [app("closed", "withdrawn"), app("open", "doc_collection")];
    expect(resolveActiveApplication(apps, "closed")?.id).toBe("open");
  });

  it("still selects a draft — borrower surfaces work on unsubmitted files", () => {
    const apps = [app("d-1", "draft")];
    expect(resolveActiveApplication(apps, null)?.id).toBe("d-1");
  });

  it("returns undefined when nothing is workable", () => {
    expect(resolveActiveApplication([], null)).toBeUndefined();
    expect(resolveActiveApplication([app("x", "denied")], null)).toBeUndefined();
  });
});

describe("useActiveApplication", () => {
  const apps = [app("a-1", "draft"), app("a-2", "processing")];

  it("reads the active file from ?app= so a deep link opens the right loan", () => {
    at(`/documents?${ACTIVE_APP_PARAM}=a-2`);
    const { result } = renderHook(() => useActiveApplication(apps));
    expect(result.current.activeApplication?.id).toBe("a-2");
  });

  it("selecting a file writes ?app= and preserves sibling params", () => {
    at(`/documents?tab=income&${ACTIVE_APP_PARAM}=a-2`);
    const { result } = renderHook(() => useActiveApplication(apps));

    act(() => result.current.selectApplication(apps[0]));

    const params = new URLSearchParams(window.location.search);
    expect(params.get(ACTIVE_APP_PARAM)).toBe("a-1");
    expect(params.get("tab")).toBe("income"); // a switch must not drop page state
    expect(result.current.activeApplication?.id).toBe("a-1");
  });

  it("never rewrites the URL on its own, so a deep link survives the loading render", () => {
    // First render happens before the list arrives: every id looks unmatched.
    // If the hook "corrected" the URL here it would erase a valid link.
    at(`/documents?${ACTIVE_APP_PARAM}=a-2`);
    const { result, rerender } = renderHook(({ list }) => useActiveApplication(list), {
      initialProps: { list: [] as SelectableApplication[] },
    });

    expect(result.current.activeApplication).toBeUndefined();
    expect(window.location.search).toContain(`${ACTIVE_APP_PARAM}=a-2`);

    rerender({ list: apps });
    expect(result.current.activeApplication?.id).toBe("a-2");
  });

  it("falls back to the canonical pick when nothing is requested", () => {
    at("/dashboard");
    const { result } = renderHook(() => useActiveApplication(apps));
    expect(result.current.activeApplication?.id).toBe("a-1");
    expect(result.current.requestedApplicationId).toBeNull();
  });

  // The in-app nav links are bare ("/documents", "/tasks"), so they drop the
  // query string. Without the tab mirror the borrower would snap back to a
  // different loan file mid-workflow — the bug this hook exists to prevent.
  it("carries the selection across a bare link that drops ?app=", () => {
    at(`/dashboard?${ACTIVE_APP_PARAM}=a-2`);
    const first = renderHook(() => useActiveApplication(apps));
    expect(first.result.current.activeApplication?.id).toBe("a-2");
    first.unmount();

    at("/tasks"); // bare in-app navigation — no query string
    const { result } = renderHook(() => useActiveApplication(apps));
    expect(result.current.activeApplication?.id).toBe("a-2");
  });

  it("lets an explicit ?app= win over the stored selection", () => {
    window.sessionStorage.setItem("homiquity_active_app", "a-2");
    at(`/documents?${ACTIVE_APP_PARAM}=a-1`);
    const { result } = renderHook(() => useActiveApplication(apps));
    expect(result.current.activeApplication?.id).toBe("a-1");
  });

  it("treats a stale stored id as inert rather than wrong", () => {
    // e.g. a file that closed, or a previous user in this tab.
    window.sessionStorage.setItem("homiquity_active_app", "gone");
    at("/tasks");
    const { result } = renderHook(() => useActiveApplication(apps));
    expect(result.current.activeApplication?.id).toBe("a-1"); // canonical pick
    expect(window.sessionStorage.getItem("homiquity_active_app")).toBe("a-1"); // corrected
  });

  it("drops a stored id once its file closes, with no ?app= involved", () => {
    // The mirror is written whenever a file resolves, so it keeps naming the
    // borrower's file after underwriting denies it — nothing clears it, and the
    // bare nav links mean there is no ?app= to override it. Unlike the test
    // above the id is still IN the list, so membership cannot catch it: without
    // the workability check the borrower lands on a denied file and uploads
    // against it.
    const closing = [app("a-1", "denied"), app("a-2", "processing")];
    window.sessionStorage.setItem(ACTIVE_APP_STORAGE_KEY, "a-1");
    at("/documents");
    const { result } = renderHook(() => useActiveApplication(closing));
    expect(result.current.activeApplication?.id).toBe("a-2");
    expect(window.sessionStorage.getItem(ACTIVE_APP_STORAGE_KEY)).toBe("a-2"); // corrected
  });
});
