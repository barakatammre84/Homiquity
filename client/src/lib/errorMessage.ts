/**
 * Turn an error thrown by apiRequest/fetch into borrower-safe toast copy.
 *
 * apiRequest throws `new Error("<status>: <body>")` where <body> is usually a
 * JSON envelope like {"error":"..."}. Rendering that message verbatim leaks
 * things like `500: {"error":"Failed to register document"}` into a toast. This
 * helper extracts the human-readable server message for client-fault statuses
 * (4xx) and falls back to friendly copy for server faults (5xx), unparseable
 * bodies, HTML error pages, or a bare stringified object.
 *
 * Custom Errors thrown outside apiRequest (e.g. "Choose a file first") don't
 * match the "<status>: <body>" shape and pass through unchanged.
 */
export function friendlyApiError(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const raw =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!raw.trim()) return fallback;

  const match = raw.match(/^(\d{3}):\s*([\s\S]*)$/);
  const status = match ? Number(match[1]) : undefined;
  const body = (match ? match[2] : raw).trim();

  let message = body;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed.error === "string") message = parsed.error;
    else if (parsed && typeof parsed.message === "string") message = parsed.message;
  } catch {
    // Body wasn't JSON — treat it as a plain string message.
  }

  message = message.trim();

  // Don't surface a raw HTML error page, an empty body, or "[object Object]".
  if (!message || message.startsWith("<") || message === "[object Object]") {
    return fallback;
  }
  // Server faults shouldn't leak internal detail to the borrower.
  if (status !== undefined && status >= 500) return fallback;

  return message;
}
