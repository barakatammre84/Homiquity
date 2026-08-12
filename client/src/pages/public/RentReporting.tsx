import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { SEOHead } from "@/components/SEOHead";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Home, CheckCircle2, Info, Building2, Landmark, FileText } from "lucide-react";

/**
 * Rent reporting — pre-launch interest capture.
 *
 * WHAT THIS PAGE MAY AND MAY NOT SAY. Three rails apply at once and they are why the
 * copy below reads the way it does:
 *
 *  1. We are not reporting anything yet. The Metro 2 format authority and the FCRA
 *     furnisher authority are both absent (docs/cdia-metro2/, docs/fcra/), so the
 *     furnishing queue performs no I/O. The pitch that opened this program proposed
 *     collecting subscription revenue while users sat queued; the honest alternative is
 *     to say plainly that reporting has not started — ON the surface, not in a footnote.
 *  2. No credit-improvement promise. Scoring models differ and a new tradeline does not
 *     reliably move a score in a stated direction. A promise here is a UDAAP exposure and
 *     sits adjacent to the open CROA question from the 2026-08-04 adjudication §5.6.
 *  3. No approval-likelihood or rate language. Reg N §1014.3(q) and the Reg Z
 *     trigger-term rules bind every public page, and `regn-guaranteed-approval` is a
 *     no-override hardBlock in shared/compliance/loCommsLint.ts.
 *
 * NOTHING IS SOLD HERE. There is no pricing card, no checkout, and no payment processor
 * in the product. The pitch's "$5/mo" and "$49 one-time — report past 24 months" cards
 * are deliberately absent: the first cannot be charged before a tradeline exists, and the
 * second would furnish history we never observed.
 *
 * Posts to /api/email-capture (email only, honeypot-guarded, deduped, always {ok:true}).
 * Deliberately NOT /api/leads: that path is consumer-mortgage intake, it mandates a
 * TrustedForm certificate we cannot mint on our own page, and it fires speed-to-lead
 * outreach. A waitlist signup is not a mortgage inquiry. Email-only also keeps this clear
 * of TCPA, which governs calls and texts to a phone number we deliberately do not collect.
 */
export default function RentReporting() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Please enter a valid email", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/email-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          source: "rent_reporting_waitlist",
          website,
        }),
      });
      if (!res.ok) throw new Error("request failed");
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
        title="Rent reporting — Homiquity"
        description="Homiquity is building rent reporting for renters working toward a home purchase. Join the list — we'll tell you when it opens."
      />

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
        <Link href="/">
          <span className="text-2xl font-bold tracking-tight text-primary">homiquity</span>
        </Link>
        <Link href="/login">
          <Button variant="ghost" size="sm" data-testid="button-login">Sign in</Button>
        </Link>
      </header>

      <main id="main" tabIndex={-1} className="flex flex-1 items-start justify-center px-4 py-10 focus:outline-none sm:px-6">
        <div className="mx-auto w-full max-w-lg">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Home className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl" data-testid="text-rent-reporting-title">
              You've been paying a mortgage. It just wasn't yours.
            </h1>
            <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
              Rent is most people's largest monthly payment, and for most renters it goes
              unrecorded. We're building rent reporting to change that — designed for renters
              working toward buying.
            </p>
          </div>

          {/* The honest state of the product, stated first and not buried. */}
          <Alert className="mt-8" data-testid="alert-not-yet-reporting">
            <Info className="h-4 w-4" />
            <AlertDescription data-testid="text-not-reporting-yet">
              <span className="font-medium text-foreground">We are not reporting to the credit
              bureaus yet.</span>{" "}
              This is a waitlist, not a signup. Nothing is being reported, nothing is for sale,
              and you will not be charged. We'll email you when it actually opens.
            </AlertDescription>
          </Alert>

          {!done ? (
            <form onSubmit={handleSubmit} className="mt-6 space-y-5" data-testid="form-rent-waitlist">
              <div className="space-y-2">
                <Label htmlFor="rent-email">Email</Label>
                <Input
                  id="rent-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  data-testid="input-rent-email"
                />
                <p className="text-sm text-muted-foreground">
                  Email only — we don't ask for your phone, and we won't call or text you.
                </p>
              </div>

              {/* Honeypot: hidden from people, tempting to bots. Same pattern as the
                  partner waitlist; a filled value is silently dropped server-side. */}
              <div className="hidden" aria-hidden="true">
                <Label htmlFor="rent-website">Website</Label>
                <Input
                  id="rent-website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting} data-testid="button-rent-waitlist-submit">
                {submitting ? "Adding you…" : "Join the list"}
              </Button>
            </form>
          ) : (
            <div className="mt-6 rounded-2xl border border-border p-6 text-center" data-testid="panel-rent-waitlist-done">
              <CheckCircle2 className="mx-auto h-8 w-8 text-primary" />
              <h2 className="mt-3 text-lg font-semibold text-foreground">You're on the list.</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                We'll email you when rent reporting opens. Until then nothing happens to your
                credit file, because nothing is being reported.
              </p>
            </div>
          )}

          <section className="mt-10" aria-labelledby="how-it-will-work">
            <h2 id="how-it-will-work" className="text-lg font-semibold text-foreground">
              How it will work
            </h2>
            <ol className="mt-4 space-y-4">
              {[
                {
                  icon: FileText,
                  title: "Tell us about your lease",
                  body: "Your monthly rent, your landlord, and the address — the facts a rent record has to be built on.",
                },
                {
                  icon: Landmark,
                  title: "Pay rent through Homiquity",
                  body: "Rent moves through a licensed payments partner to your landlord. That first-party record is what makes a reported payment defensible — we won't guess at a payment from your bank feed.",
                },
                {
                  icon: Building2,
                  title: "Your payment history gets reported",
                  body: "Once we're an approved furnisher, your on-time payments go on file. You can stop reporting at any time, and we'll ask before anything is sent.",
                },
              ].map((step, i) => (
                <li key={step.title} className="flex gap-4" data-testid={`step-rent-${i + 1}`}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Deliberately plain about limits. A rent tradeline is not a score guarantee,
              and saying so here is cheaper than saying it to a regulator later. */}
          <p className="mt-8 text-xs leading-relaxed text-muted-foreground" data-testid="text-rent-disclosure">
            Rent reporting adds your payment history to your credit file. It is not credit
            repair and it is not a promise about your credit score — scoring models differ and
            results vary from person to person. Late or missed payments can be reported too.
            Homiquity does not decide whether you qualify for a mortgage; lenders do.
          </p>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Working toward a purchase?{" "}
            <Link href="/calculators/rent-vs-buy">
              <span className="font-medium text-primary underline-offset-4 hover:underline">
                Compare renting and buying
              </span>
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
