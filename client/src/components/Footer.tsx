import { Link } from "wouter";
import { Phone, Mail } from "lucide-react";

export function Footer() {
  // Deep Ink container in both modes (bg-primary would invert badly in dark
  // mode, where primary becomes Paper) — the footer shares the sidebar's
  // "navigation container" stop on the ramp.
  return (
    <footer className="bg-sidebar text-sidebar-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-white">homiquity</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/70">
              Clarity for every stage of homeownership. Pre-approval, property search, and AI coaching — all in one place.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Contact Us</h3>
            <ul className="mt-4 space-y-1 text-sm text-white/70">
              <li>
                <a href="mailto:hello@homiquity.com" className="flex items-center gap-2 rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-email">
                  <Mail className="h-4 w-4 shrink-0" />
                  hello@homiquity.com
                </a>
              </li>
              <li>
                <a href="tel:1-800-HOMIQTY" className="flex items-center gap-2 rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-phone">
                  <Phone className="h-4 w-4 shrink-0" />
                  1-800-HOMIQTY
                </a>
              </li>
              <li><Link href="/faq" className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-faq">FAQ</Link></li>
              <li><Link href="/resources" className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-resources">Resources</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Legal</h3>
            <ul className="mt-4 space-y-1 text-sm text-white/70">
              <li><a href="https://www.nmlsconsumeraccess.org" target="_blank" rel="noopener noreferrer" className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-nmls">NMLS Consumer Access</a></li>
              <li><Link href="/privacy" className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-privacy">Privacy Policy</Link></li>
              <li><Link href="/terms" className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-terms">Terms of Use</Link></li>
              <li><Link href="/disclosures" className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-disclosures">Disclosures & Licensing</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Products</h3>
            <ul className="mt-4 space-y-1 text-sm text-white/70">
              <li><Link href="/apply" className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-lend">Homiquity Lend</Link></li>
              <li><Link href="/ai-coach" className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-coach">Homiquity Coach</Link></li>
              <li><Link href="/rates" className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-rates">Rates</Link></li>
              <li><Link href="/resources" className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-resources-2">Resources</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/20 pt-8">
          <p className="text-xs text-white/60 leading-relaxed">
            &copy; {new Date().getFullYear()} Homiquity Inc. Equal Housing Lender. 
            Loans made or arranged pursuant to applicable state licensing. 
            Not available in all states.
          </p>
          <p className="mt-4 text-xs text-white/60 leading-relaxed">
            Home lending products offered by Homiquity Inc. are direct loans. 
            Loans made or arranged pursuant to applicable state licensing. Not available in all states. Equal Housing Lender. 
            NMLS Consumer Access.
          </p>
        </div>
      </div>
    </footer>
  );
}
