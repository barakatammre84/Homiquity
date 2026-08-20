import { useAuth } from "@/hooks/useAuth";

/**
 * Where a "talk to Homi" control should send the visitor.
 *
 * `/ai-coach` is an `<AnyAuthPage>` route (App.tsx), so a signed-out visitor who
 * clicks one of these CTAs is bounced straight to `/login` — a page whose
 * heading reads "Welcome back. Sign in to your account to continue." A
 * first-time visitor has no account to sign back in to, and the public site
 * advertises Homi on every page ("Homi answers your questions any hour, in
 * plain English", Landing's TRUST_POINTS), so the dead end lands on exactly the
 * people the marketing surface exists to convert.
 *
 * `CoachPromptBar` — the landing hero's own ask-Homi bar — already routes by
 * auth state (`navigate(isAuthenticated ? "/ai-coach" : "/signup")`). This hook
 * is that same rule, hoisted so the public chrome shares one definition instead
 * of each call site re-deriving it. **Link Homi from a public surface through
 * this hook, never with a bare `href="/ai-coach"`** — that literal is what put a
 * login wall behind the footer link and behind six calculator CTAs.
 *
 * Signed out we send to `/signup` rather than `/login?next=`: signup is the
 * product's intended conversion path, and `getPostAuthRoute` already carries a
 * visitor onward to `/ai-coach` when they arrived with a question to ask.
 *
 * Cheap in the entry bundle: `useAuth` is already eager (App.tsx imports
 * PrivateLayout directly, which uses it), so consuming it in the Footer adds a
 * reference, not a module.
 */
export function useCoachHref(): string {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? "/ai-coach" : "/signup";
}
