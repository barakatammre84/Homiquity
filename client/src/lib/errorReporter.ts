/**
 * Lightweight client error reporter. Forwards uncaught errors and unhandled
 * promise rejections to the server (`POST /api/client-errors`), which relays
 * them to Sentry — so the browser never needs a DSN. No dependency, and it
 * self-throttles to avoid flooding the endpoint from a render loop.
 */

let sentInWindow = 0;
let windowStart = Date.now();
const MAX_PER_MINUTE = 10;

function allowed(): boolean {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    sentInWindow = 0;
  }
  if (sentInWindow >= MAX_PER_MINUTE) return false;
  sentInWindow += 1;
  return true;
}

function report(message: string, stack?: string) {
  if (!message || !allowed()) return;
  try {
    // keepalive lets the report survive a navigation triggered by the error.
    fetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message.slice(0, 2000),
        stack: stack?.slice(0, 10000),
        url: window.location.href,
        userAgent: navigator.userAgent,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never let telemetry throw.
  }
}

/**
 * Report an error React already caught in an error boundary. Those never reach
 * the `window.error` listener below — React swallows them — so a boundary has
 * to forward them here explicitly or they go untelemetered. Shares the same
 * throttle as the uncaught-error path.
 */
export function reportCaughtError(error: unknown, componentStack?: string) {
  const err = error as { message?: string; stack?: string } | undefined;
  const message = err?.message || String(error) || "Caught render error";
  const stack = [err?.stack, componentStack].filter(Boolean).join("\n\n");
  report(message, stack || undefined);
}

export function installErrorReporter() {
  window.addEventListener("error", (event) => {
    report(event.message || String(event.error), event.error?.stack);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason: any = event.reason;
    const message = reason?.message || String(reason) || "Unhandled promise rejection";
    report(message, reason?.stack);
  });
}
