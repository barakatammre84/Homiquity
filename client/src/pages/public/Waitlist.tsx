import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { SEOHead } from "@/components/SEOHead";
import { COMPANY_IDENTITY, companyNmlsDisplay } from "@shared/companyIdentity";
import { Mail, CheckCircle2, ArrowRight } from "lucide-react";

/**
 * Pre-license waitlist / "coming soon" surface.
 *
 * Shown at "/" while PRELAUNCH_GATED (client/src/lib/prelaunch.ts) — the public
 * home page until the company NMLS license (roadmap F1) is issued. Deliberately
 * carries NO rate, payment, APR, or approval language and makes NO claim of
 * being licensed: pre-license we collect a marketing "notify me" email only
 * (POST /api/email-capture — NOT the TrustedForm/TCPA leads path), never a
 * mortgage lead. Keep it that way — see knowledge-base/governance/ARMED_LAUNCH_CHARTER_2026-07-07.md.
 */
export default function Waitlist() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const nmls = companyNmlsDisplay();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Please enter a valid email", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const form = e.target as HTMLFormElement;
    const honeypot = (form.elements.namedItem("website") as HTMLInputElement)?.value || "";
    try {
      await fetch("/api/email-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "waitlist", website: honeypot }),
      });
      setDone(true);
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEOHead
        title="Homiquity — Launching Soon"
        description="Homiquity is a mortgage brokerage getting ready to open. Join the list and we'll let you know the moment we launch."
      />

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
        <span className="text-2xl font-bold tracking-tight text-primary">homiquity</span>
        <Link href="/login">
          <Button variant="ghost" size="sm" data-testid="button-login">Sign in</Button>
        </Link>
      </header>

      <main id="main" tabIndex={-1} className="flex flex-1 items-center justify-center px-4 py-12 focus:outline-none sm:px-6">
        <div className="mx-auto w-full max-w-xl text-center">
          {!done ? (
            <>
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Mail className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl" data-testid="text-waitlist-title">
                A simpler mortgage, arriving soon.
              </h1>
              <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
                Homiquity is getting ready to open. Leave your email and we'll be in touch
                the moment we launch.
              </p>

              <form onSubmit={handleSubmit} className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                  aria-label="Email address"
                  data-testid="input-waitlist-email"
                />
                <div className="absolute -left-[9999px]" aria-hidden="true">
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                </div>
                <Button type="submit" className="gap-2" disabled={submitting} data-testid="button-waitlist-submit">
                  {submitting ? "Adding you..." : "Notify me"}
                  {!submitting && <ArrowRight className="h-4 w-4" />}
                </Button>
              </form>
              <p className="mt-3 text-xs text-muted-foreground">No spam — just one note when we open.</p>
            </>
          ) : (
            <div data-testid="waitlist-success">
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-status-success/10">
                <CheckCircle2 className="h-7 w-7 text-status-success" />
              </div>
              <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl">You're on the list.</h1>
              <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
                Thanks — we'll email you the moment Homiquity opens.
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 py-8 text-center text-xs leading-relaxed text-muted-foreground sm:px-6">
        <div className="mb-3 flex items-center justify-center gap-4">
          <Link href="/privacy"><span className="hover:text-foreground" data-testid="link-privacy">Privacy</span></Link>
          <Link href="/terms"><span className="hover:text-foreground" data-testid="link-terms">Terms</span></Link>
          <Link href="/disclosures"><span className="hover:text-foreground" data-testid="link-disclosures">Disclosures</span></Link>
        </div>
        <p>
          {COMPANY_IDENTITY.legalName} is a mortgage broker. Loans are arranged with third-party
          wholesale lending partners; Homiquity does not make credit decisions or fund loans.
          {nmls ? ` ${nmls}.` : ""} Equal Housing Opportunity.
        </p>
        <p className="mt-2">&copy; {new Date().getFullYear()} {COMPANY_IDENTITY.legalName}. All rights reserved.</p>
      </footer>
    </div>
  );
}
