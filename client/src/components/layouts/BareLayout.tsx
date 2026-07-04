import { SkipLink } from "@/components/SkipLink";

interface BareLayoutProps {
  children: React.ReactNode;
}

/**
 * Minimal landmark wrapper for routes that render without Public/PrivateLayout
 * (login, signup, apply, legal pages, invite/referral landings). Provides the
 * skip-link + a <main> landmark so keyboard/screen-reader users get the same
 * baseline as layout-wrapped pages. Use for pages that DON'T render their own nav.
 */
export function BareLayout({ children }: BareLayoutProps) {
  return (
    <>
      <SkipLink />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
    </>
  );
}
