import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";
import { SkipLink } from "@/components/SkipLink";

interface PublicLayoutProps {
  children: React.ReactNode;
}

/**
 * Shell for the ungated public surface (education, calculators, rates,
 * glossary, FAQ, property search).
 *
 * The Footer is mounted HERE, not per page. It carries the NMLS unique
 * identifier, the Equal Housing Opportunity notice, and the broker-not-lender
 * disclosure — all of which have to be reachable from any page a visitor can
 * land on, and search traffic lands on calculator and rate pages directly.
 * Leaving it to each page to import meant ~9 pages had it and every calculator,
 * rate, FAQ, glossary, and resource page did not. Keep it in the layout so the
 * disclosure is structural rather than something a new page can forget.
 *
 * Persona LPs (/refinance, /va-loans, …) and the legal pages render their own
 * SkipLink/main/Footer and deliberately do not use this layout.
 */
export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SkipLink />
      <Navigation />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">{children}</main>
      <Footer />
    </div>
  );
}
