import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { COMPANY_IDENTITY } from "@shared/companyIdentity";
import { ArrowRight, Clock, Home, LogIn, Shield } from "lucide-react";

/**
 * Funnel chrome (extracted from PreApproval.tsx): the draft-restore banner
 * (#249 — adopting a saved draft is ONE explicit decision point, never a
 * silent prefill), the pre-submit auth gate, and the compliance footer whose
 * copy is regulatory surface (soft-inquiry framing, not-a-commitment
 * disclosure, broker disclosure, Equal Housing).
 */

export function RestoreDraftBanner({
  onRestore,
  onDismiss,
}: {
  onRestore: () => void;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-2 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
      data-testid="banner-restore-draft"
    >
      <div className="bg-card border shadow-lg rounded-xl p-4 flex items-center gap-3">
        <div className="bg-primary/10 rounded-lg p-2 shrink-0">
          <Clock className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">You have unsaved progress</p>
          <p className="text-xs text-muted-foreground">Pick up where you left off?</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="ghost" onClick={onDismiss} data-testid="button-dismiss-restore">
            No
          </Button>
          <Button size="sm" onClick={onRestore} data-testid="button-restore-draft">
            Restore
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export function AuthGateOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      data-testid="auth-gate-overlay"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-card border rounded-xl shadow-lg p-8 max-w-md w-full text-center"
      >
        <div className="mx-auto mb-6 h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
          <LogIn className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-2xl font-bold text-foreground mb-3" data-testid="text-auth-gate-title">
          One last step
        </h3>
        <p className="text-muted-foreground mb-6">
          Create an account (or sign in) to see your pre-approval results. Your answers are already saved.
        </p>
        <div className="space-y-3">
          <a href="/signup" className="block">
            <Button size="lg" className="w-full" data-testid="button-auth-gate-signup">
              Create account
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
          <a href="/login" className="block">
            <Button size="lg" variant="outline" className="w-full" data-testid="button-auth-gate-login">
              Sign In
            </Button>
          </a>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            data-testid="button-auth-gate-dismiss"
          >
            Go back to form
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1">
          <Shield className="h-3 w-3" />
          Your data is encrypted and never shared
        </p>
      </motion.div>
    </motion.div>
  );
}

export function FunnelFooter() {
  return (
    <footer className="border-t border-muted bg-muted/30 mt-auto" data-testid="footer-compliance">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        <div className="text-xs text-muted-foreground leading-relaxed space-y-4">
          <p>
            <sup>1</sup> Homiquity&apos;s pre-approval process uses self-reported information and a soft credit inquiry to provide an initial determination. A soft credit check will not affect your credit score. Final loan approval is subject to full underwriting review, including verification of income, assets, employment, and property appraisal. Pre-approval is not a commitment to lend and does not guarantee final approval. All loans are subject to credit and property approval. Terms and conditions apply.
          </p>
        </div>

        <div className="border-t border-muted pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
            <div>
              <p className="font-semibold text-foreground text-base mb-3">Homiquity</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Homiquity Mortgage Corporation is a mortgage broker. Loans are arranged with third-party wholesale lending partners; Homiquity does not make credit decisions or fund loans.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-2">Contact Us</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>{COMPANY_IDENTITY.contactEmail}</p>
                <p>{COMPANY_IDENTITY.contactPhone}</p>
              </div>
              <div className="mt-3 space-y-1">
                <p className="font-medium text-foreground text-xs">Resources</p>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>FAQ</p>
                  <p>Privacy Policy</p>
                  <p>Terms of Use</p>
                </div>
              </div>
            </div>
            <div>
              <p className="font-medium text-foreground mb-2">Legal</p>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>NMLS Consumer Access</p>
                <p>Disclosures & Licensing</p>
                <p>Equal Housing Opportunity</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-muted pt-4 text-xs text-muted-foreground leading-relaxed space-y-3">
          <p>
            &copy; {new Date().getFullYear()} Homiquity Mortgage Corporation. All rights reserved. Homiquity is a family of companies serving the homeownership ecosystem including mortgage brokerage, property search, and AI-powered guidance.
          </p>
          <p>
            Mortgage loans arranged by Homiquity Mortgage Corporation through third-party wholesale lending partners. Not available in all states. Equal Housing Opportunity. NMLS Consumer Access.
          </p>
          <div className="flex items-center justify-center gap-4 pt-2">
            <div className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" />
              <span>Soft credit check only</span>
            </div>
            <div className="flex items-center gap-1">
              <Home className="h-3.5 w-3.5" />
              <span>Equal Housing Opportunity</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
