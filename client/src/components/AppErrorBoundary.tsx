import { Component, type ReactNode, type ErrorInfo } from "react";
import { reportCaughtError } from "@/lib/errorReporter";

/**
 * Root error boundary (C1). Every route is `React.lazy()`, so a rolling
 * deploy — which rotates chunk hashes while a user still holds the previous
 * `index.html` — makes the next lazy `import()` *reject*. That rejection throws
 * during render; with nothing to catch it, React unmounts the whole tree and
 * the user gets a blank page. This boundary turns that into a self-heal.
 *
 * Two failure modes, two responses:
 *  - **Stale chunk** (the deploy case): reload once to pull the fresh
 *    `index.html` + new chunk hashes. A `sessionStorage` guard makes it reload
 *    at most once per tab so a genuinely-broken build can't loop.
 *  - **Anything else**: render a real fallback with a manual reload, instead of
 *    a white screen.
 *
 * Caught render errors never reach `window.onerror`, so `componentDidCatch`
 * forwards them to telemetry explicitly.
 */

// Vite/Rollup lazy-import load failures surface with these messages across
// browsers. Matching is intentionally broad — a false positive costs one reload.
const CHUNK_ERROR_RE =
  /Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed|Failed to fetch/i;

const RELOAD_GUARD_KEY = "homiquity_chunk_reloaded";

function isChunkLoadError(error: unknown): boolean {
  const message =
    (error as { message?: string } | undefined)?.message ?? String(error);
  return CHUNK_ERROR_RE.test(message);
}

function alreadyReloaded(): boolean {
  try {
    return window.sessionStorage.getItem(RELOAD_GUARD_KEY) === "1";
  } catch {
    return false; // private mode / storage disabled → skip the auto-reload path
  }
}

function markReloaded(): void {
  try {
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
  } catch {
    /* fall through to the manual fallback */
  }
}

function clearReloadGuard(): void {
  try {
    window.sessionStorage.removeItem(RELOAD_GUARD_KEY);
  } catch {
    /* no-op */
  }
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportCaughtError(error, info.componentStack ?? undefined);

    // A stale-chunk failure after a deploy is recoverable: reload once to fetch
    // the new build. Guard against a reload loop when the build is truly broken.
    if (isChunkLoadError(error) && !alreadyReloaded()) {
      markReloaded();
      window.location.reload();
    }
  }

  private handleReload = () => {
    // Manual retry clears the guard so a later, unrelated stale chunk can still
    // auto-heal in this tab.
    clearReloadGuard();
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    // While the stale-chunk reload is in flight this renders for a beat; the
    // panel below is the terminal state for non-recoverable errors.
    return (
      <div
        role="alert"
        data-testid="app-error-boundary"
        className="min-h-screen bg-background flex items-center justify-center p-6"
      >
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-foreground">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The page failed to load. This is usually fixed by reloading.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            data-testid="button-error-reload"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
