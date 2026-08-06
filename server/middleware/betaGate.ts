import type { NextFunction, Request, Response } from "express";

/**
 * The private beta gate — the ONE implementation (it began as an Express port
 * of a platform edge middleware, which is gone).
 *
 * Semantics are load-bearing and must not drift: a code that admits here but
 * not there, or a cookie whose digest changes, is an
 * incident-containment control (INCIDENT_RESPONSE_PLAN.md) failing open.
 * tests/betaGate.test.ts drives both against the same cases. Deliberately
 * self-contained (no import from ../../middleware) so the cutover deletion
 * cannot break this side.
 *
 * Semantics (unchanged from the Edge version):
 *   - BETA_ACCESS_CODE unset/blank ⇒ total no-op. Read per request, so on a
 *     persistent host arming/disarming the gate is a runtime env change.
 *   - /api/* is never gated: cron invocations and API clients carry no
 *     browser cookie, and every API route already sits behind app auth.
 *   - While armed, /robots.txt answers Disallow-all so the gated site is
 *     never indexed. This middleware must therefore mount BEFORE
 *     express.static / the SPA catch-all (server/app.ts mounts it ahead of
 *     the whole route surface), or the public robots.txt would win.
 *   - ?beta=<code> verifies against the comma-separated list, sets an
 *     HttpOnly cookie holding SHA-256(code), and 302s to the same URL minus
 *     the param. Later requests are admitted on the cookie alone; removing a
 *     code from the env var invalidates that code's cookies.
 *   - Everyone else gets the 401 lock screen with a code form.
 */

const COOKIE_NAME = "hq_beta";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

export function betaCodes(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

function getCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

// Lock-screen HTML ported verbatim from middleware.ts (the Edge original).
function lockScreenHtml(showError: boolean): string {
  const error = showError
    ? `<p class="error">That code didn&rsquo;t work. Check for typos, or ask us for a fresh invite link.</p>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Homiquity — Private Beta</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         background: hsl(216 60% 5%); color: hsl(216 63% 97%);
         font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 24rem; padding: 2.5rem 1.5rem; text-align: center; }
  h1 { font-size: 1.75rem; margin: 0 0 0.75rem; letter-spacing: -0.02em; }
  p { color: hsl(216 25% 70%); line-height: 1.55; margin: 0 0 1.5rem; }
  .error { color: hsl(0 75% 72%); }
  form { display: flex; gap: 0.5rem; }
  input { flex: 1; padding: 0.65rem 0.9rem; border-radius: 0.5rem; font-size: 1rem;
          border: 1px solid hsl(216 30% 25%); background: hsl(216 45% 10%); color: inherit; }
  input:focus { outline: 2px solid hsl(216 63% 60%); border-color: transparent; }
  button { padding: 0.65rem 1.1rem; border: none; border-radius: 0.5rem; font-size: 1rem;
           background: hsl(216 63% 97%); color: hsl(216 60% 5%); cursor: pointer; }
</style>
</head>
<body>
<main>
  <h1>Homiquity</h1>
  <p>We&rsquo;re in private beta. If you have an invite code, enter it below &mdash;
     or just open the invite link you were sent.</p>
  ${error}
  <form method="GET" action="/">
    <input name="beta" placeholder="Invite code" autocomplete="off" required autofocus>
    <button type="submit">Enter</button>
  </form>
</main>
</body>
</html>`;
}

function sendLockScreen(res: Response, showError: boolean): void {
  res
    .status(401)
    .set({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    })
    .send(lockScreenHtml(showError));
}

export function betaGateMiddleware(req: Request, res: Response, next: NextFunction): void {
  const codes = betaCodes(process.env.BETA_ACCESS_CODE);
  if (codes.length === 0) {
    next();
    return;
  }

  // originalUrl (not req.path/req.query) so the redirect rebuilds the URL the
  // way the Edge version did — remaining params byte-preserved, in order.
  const url = new URL(req.originalUrl || req.url, "http://beta-gate.internal");
  if (url.pathname.startsWith("/api/")) {
    next();
    return;
  }

  if (url.pathname === "/robots.txt") {
    res
      .status(200)
      .set({
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
      })
      .send("User-agent: *\nDisallow: /\n");
    return;
  }

  void (async () => {
    try {
      const validHashes = await Promise.all(codes.map(sha256Hex));

      const cookie = getCookie(req.headers.cookie, COOKIE_NAME);
      if (cookie && validHashes.includes(cookie)) {
        next();
        return;
      }

      const attempt = url.searchParams.get("beta");
      if (attempt === null) {
        sendLockScreen(res, false);
        return;
      }
      if (!codes.includes(attempt)) {
        sendLockScreen(res, true);
        return;
      }

      // Valid invite link: set the cookie and reload the same URL without
      // ?beta= so the code never lingers in the address bar or history.
      url.searchParams.delete("beta");
      res.append(
        "Set-Cookie",
        `${COOKIE_NAME}=${await sha256Hex(attempt)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
      );
      res.redirect(302, url.pathname + url.search);
    } catch (err) {
      next(err);
    }
  })();
}
