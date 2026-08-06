import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { JSX } from "react";
import { AppErrorBoundary } from "./AppErrorBoundary";
import * as errorReporter from "@/lib/errorReporter";

// The root error boundary (audit finding C1). Every route is React.lazy(), so a
// rolling deploy rotates chunk hashes under a tab that still holds the
// previous index.html — the next lazy import() rejects and, with no boundary,
// blanks the whole app. These tests pin the two behaviours that make that
// recoverable: reload-once on a stale chunk, and a real fallback (never a blank
// screen) on anything else.

function Boom({ message }: { message: string }): JSX.Element {
  throw new Error(message);
}

const CHUNK_MESSAGE = "Failed to fetch dynamically imported module: /assets/Dashboard-a1b2c3.js";

let reloadSpy: ReturnType<typeof vi.fn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.sessionStorage.clear();
  reloadSpy = vi.fn();
  // happy-dom's location.reload is not writable directly; redefine it.
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, reload: reloadSpy },
  });
  // React logs caught render errors; keep the test output readable.
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(errorReporter, "reportCaughtError").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  consoleErrorSpy.mockRestore();
});

describe("AppErrorBoundary", () => {
  it("renders children untouched when nothing throws", () => {
    render(
      <AppErrorBoundary>
        <div data-testid="child">ok</div>
      </AppErrorBoundary>,
    );
    expect(screen.getByTestId("child").textContent).toBe("ok");
    expect(screen.queryByTestId("app-error-boundary")).toBeNull();
  });

  it("shows a fallback instead of a blank screen when a render throws", () => {
    render(
      <AppErrorBoundary>
        <Boom message="totally unrelated render bug" />
      </AppErrorBoundary>,
    );
    expect(screen.getByTestId("app-error-boundary")).toBeTruthy();
    expect(screen.getByTestId("button-error-reload")).toBeTruthy();
  });

  it("does NOT auto-reload on a non-chunk error (that would loop on a real bug)", () => {
    render(
      <AppErrorBoundary>
        <Boom message="totally unrelated render bug" />
      </AppErrorBoundary>,
    );
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("auto-reloads once on a stale-chunk error — the rolling-deploy self-heal", () => {
    render(
      <AppErrorBoundary>
        <Boom message={CHUNK_MESSAGE} />
      </AppErrorBoundary>,
    );
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("reloads at most once per tab, so a genuinely broken build cannot loop", () => {
    const first = render(
      <AppErrorBoundary>
        <Boom message={CHUNK_MESSAGE} />
      </AppErrorBoundary>,
    );
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    first.unmount();

    // Simulates the tab coming back on the new build and failing again.
    render(
      <AppErrorBoundary>
        <Boom message={CHUNK_MESSAGE} />
      </AppErrorBoundary>,
    );
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("app-error-boundary")).toBeTruthy();
  });

  it("forwards the caught error to telemetry (React swallows these from window.onerror)", () => {
    render(
      <AppErrorBoundary>
        <Boom message="telemetry me" />
      </AppErrorBoundary>,
    );
    expect(errorReporter.reportCaughtError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "telemetry me" }),
      expect.any(String),
    );
  });

  it("survives sessionStorage being unavailable (private mode)", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });

    render(
      <AppErrorBoundary>
        <Boom message={CHUNK_MESSAGE} />
      </AppErrorBoundary>,
    );

    // No throw, and the fallback is still reachable.
    expect(screen.getByTestId("app-error-boundary")).toBeTruthy();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
