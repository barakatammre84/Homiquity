// Vercel Edge Middleware — private beta gate.
//
// Active ONLY while the BETA_ACCESS_CODE env var is set (Vercel → Settings →
// Environment Variables). When it is unset — local dev, tests, and public
// launch — this file is a no-op and every request passes straight through.
//
// While the gate is on:
//   1. A beta tester opens an invite link:  https://<host>/?beta=<code>
//   2. The middleware verifies the code, sets an HttpOnly cookie holding the
//      SHA-256 of that code, and redirects to the same URL minus the param.
//   3. Later requests are admitted on the cookie alone. BETA_ACCESS_CODE may
//      hold several comma-separated codes; removing one from the env var
//      invalidates that code's cookies on the next request.
//   4. Everyone else gets a 401 lock screen with a code form, and /robots.txt
//      answers Disallow-all so the gated site is never indexed.
//
// /api/* is deliberately NOT gated: Vercel cron invocations and API clients
// carry no browser cookie, and every API route already sits behind app auth.

const COOKIE_NAME = "hq_beta";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

export const config = {
  // Skip /api/* at the routing layer so crons and API traffic never pay for
  // an edge invocation; the pathname check below repeats this defensively.
  matcher: "/((?!api/).*)",
};

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

function getCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

function lockScreen(showError: boolean): Response {
  const error = showError
    ? `<p class="error">That code didn&rsquo;t work. Check for typos, or ask us for a fresh invite link.</p>`
    : "";
  const html = `<!doctype html>
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
  return new Response(html, {
    status: 401,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export default async function middleware(
  request: Request,
): Promise<Response | undefined> {
  const codes = betaCodes(process.env.BETA_ACCESS_CODE);
  if (codes.length === 0) return undefined;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return undefined;

  if (url.pathname === "/robots.txt") {
    return new Response("User-agent: *\nDisallow: /\n", {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  }

  const validHashes = await Promise.all(codes.map(sha256Hex));

  const cookie = getCookie(request, COOKIE_NAME);
  if (cookie && validHashes.includes(cookie)) return undefined;

  const attempt = url.searchParams.get("beta");
  if (attempt === null) return lockScreen(false);
  if (!codes.includes(attempt)) return lockScreen(true);

  // Valid invite link: set the cookie and reload the same URL without ?beta=
  // so the code never lingers in the address bar or browser history.
  url.searchParams.delete("beta");
  const headers = new Headers({ location: url.pathname + url.search });
  headers.append(
    "set-cookie",
    `${COOKIE_NAME}=${await sha256Hex(attempt)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
  );
  return new Response(null, { status: 302, headers });
}
