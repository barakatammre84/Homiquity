import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { friendlyApiError } from "@/lib/errorMessage";
import { SEOHead } from "@/components/SEOHead";
import { COMPANY_IDENTITY, companyNmlsDisplay } from "@shared/companyIdentity";
import { Handshake, CheckCircle2, ArrowRight } from "lucide-react";

/**
 * Pre-launch partner / center-of-influence waitlist.
 *
 * The pre-license acquisition target is the referral network we service consumers
 * THROUGH — loan officers, lenders, CPAs, real-estate agents — not consumer
 * applicants (who move on before launch). This is B2B interest capture: it posts
 * to /api/partner-waitlist (NOT the consumer /api/leads path) and carries no rate,
 * payment, APR, or approval language. Ungated: recruiting partners is exactly what
 * we want to do pre-license.
 */
const PARTNER_TYPES = [
  { value: "loan_officer", label: "Loan Officer" },
  { value: "lender", label: "Lender / AE" },
  { value: "cpa", label: "CPA / Accountant" },
  { value: "real_estate_agent", label: "Real Estate Agent" },
  { value: "other", label: "Other" },
] as const;

type PartnerType = (typeof PARTNER_TYPES)[number]["value"];

export default function PartnerWaitlist() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [partnerType, setPartnerType] = useState<PartnerType | null>(null);
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const nmls = companyNmlsDisplay();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Please add your name", variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Please enter a valid email", variant: "destructive" });
      return;
    }
    if (!partnerType) {
      toast({ title: "Tell us how you'd partner", description: "Pick the option that fits you best.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // This one DID check res.ok, but `throw new Error("request failed")`
      // discards the server's own envelope, so a 400 naming the bad field and a
      // 429 telling the partner to come back later both rendered as the same
      // "Something went wrong". apiRequest throws ApiError carrying the
      // "<status>: <body>" shape friendlyApiError knows how to read.
      await apiRequest("POST", "/api/partner-waitlist", {
        name: name.trim(),
        email: email.trim(),
        company: company.trim() || undefined,
        partnerType,
        message: message.trim() || undefined,
        website,
      });
      setDone(true);
    } catch (error) {
      toast({
        title: "We couldn't add you just yet",
        description: friendlyApiError(error, "Please check your details and try again."),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEOHead
        title="Partner with Homiquity"
        description="Homiquity is building its referral network ahead of launch. Loan officers, lenders, CPAs, and real-estate agents — join the partner list and we'll be in touch as we open."
      />

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
        <Link href="/">
          <span className="text-2xl font-bold tracking-tight text-flare">homiquity</span>
        </Link>
        <Button asChild variant="ghost" size="sm" className="touch-target" data-testid="button-login">
          <Link href="/login">Sign in</Link>
        </Button>
      </header>

      <main id="main" tabIndex={-1} className="flex flex-1 items-start justify-center px-4 py-10 focus:outline-none sm:px-6">
        <div className="mx-auto w-full max-w-lg">
          {!done ? (
            <>
              <div className="text-center">
                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <Handshake className="h-7 w-7 text-primary" />
                </div>
                <h1 className="font-display text-3xl font-bold leading-none text-foreground sm:text-4xl" data-testid="text-partner-title">
                  Partner with Homiquity.
                </h1>
                <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
                  We're building relationships with the professionals who guide people home —
                  loan officers, lenders, CPAs, and real-estate agents. Join the partner list
                  and we'll reach out as we open.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div className="space-y-2">
                  <Label>How would you partner with us?</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="group-partner-type">
                    {PARTNER_TYPES.map((t) => {
                      const selected = partnerType === t.value;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setPartnerType(t.value)}
                          aria-pressed={selected}
                          data-testid={`option-partner-type-${t.value}`}
                          className={`rounded-lg border p-3 text-sm font-medium transition-colors ${
                            selected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-foreground hover:border-primary/50 hover:bg-muted"
                          }`}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="partner-name">Name</Label>
                  <Input
                    id="partner-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Smith"
                    autoComplete="name"
                    data-testid="input-partner-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="partner-email">Work email</Label>
                  <Input
                    id="partner-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                    data-testid="input-partner-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="partner-company">
                    Company <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="partner-company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Company or brokerage"
                    autoComplete="organization"
                    data-testid="input-partner-company"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="partner-message">
                    Anything you'd like us to know? <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="partner-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Where you work, the clients you serve, what you're looking for in a partner…"
                    rows={3}
                    data-testid="input-partner-message"
                  />
                </div>

                <div className="absolute -left-[9999px]" aria-hidden="true">
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>

                <Button type="submit" className="w-full gap-2" disabled={submitting} data-testid="button-partner-submit">
                  {submitting ? "Sending…" : "Join the partner list"}
                  {!submitting && <ArrowRight className="h-4 w-4" />}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  We'll only use this to talk about partnering — no spam.
                </p>
              </form>
            </>
          ) : (
            <div className="text-center" data-testid="partner-success">
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-status-success/10">
                <CheckCircle2 className="h-7 w-7 text-status-success" />
              </div>
              <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl">You're on the list.</h1>
              <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
                Thanks for your interest in partnering with Homiquity. We'll be in touch as we open.
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
