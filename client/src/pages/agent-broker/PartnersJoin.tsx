import { useState } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { friendlyApiError } from "@/lib/errorMessage";
import { Home, Calculator, Lock, HandCoins, Link2, ShieldCheck, ArrowRight } from "lucide-react";

/**
 * PartnerHub self-service onboarding (/partners/join — PH-1).
 *
 * B2B recruitment surface (ungated, like /for-cpas and /partners): a referral
 * partner creates an account here — no consumer solicitation, no rate or
 * approval language. The realtor persona registers in place; the CPA persona
 * routes to the existing /for-cpas flow until the convergence prompt.
 */

const VALUE_PROPS = [
  {
    icon: Link2,
    title: "One link for every client",
    body: "Share your personal referral link. Clients you send are attributed to you automatically when they sign up.",
  },
  {
    icon: Lock,
    title: "Progress, never private data",
    body: "See where each referral stands — never their income, documents, or financial details. Your client's data stays theirs.",
  },
  {
    icon: HandCoins,
    title: "No fees, either direction",
    body: "This is a free tool to keep you in the loop. Homiquity does not pay referral fees and none are owed to us.",
  },
];

export default function PartnersJoin() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const preselect = new URLSearchParams(search).get("persona");
  const { toast } = useToast();
  const [persona, setPersona] = useState<"realtor" | "cpa">(preselect === "cpa" ? "cpa" : "realtor");
  const [form, setForm] = useState({
    contactName: "",
    firmName: "",
    email: "",
    password: "",
    licenseNumber: "",
    licenseState: "",
  });

  const register = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/partners/register", {
        persona: "realtor",
        contactName: form.contactName,
        firmName: form.firmName,
        email: form.email,
        password: form.password,
        licenseNumber: form.licenseNumber.trim() || undefined,
        licenseState: form.licenseState.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Welcome aboard", description: "Your partner hub is ready." });
      setLocation("/partners/hub");
    },
    onError: (err: Error) => {
      toast({
        title: "Couldn't create your account",
        description: friendlyApiError(err, "Please check your details and try again."),
        variant: "destructive",
      });
    },
  });

  const canSubmit =
    form.contactName.trim().length > 0 &&
    form.firmName.trim().length > 0 &&
    form.email.trim().length > 3 &&
    form.password.length >= 8 &&
    (form.licenseState.trim().length === 0 || form.licenseState.trim().length === 2);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/50">
      <div className="mx-auto grid max-w-5xl gap-8 p-4 py-10 sm:p-6 md:grid-cols-2 md:items-start">
        {/* Pitch */}
        <div className="space-y-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Home className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold leading-tight" data-testid="text-partners-join-hero">
              Partner with Homiquity
            </h1>
            <p className="text-muted-foreground">
              Send clients with one link, then watch their progress instead of chasing it. Built for
              the professionals buyers already trust.
            </p>
          </div>
          <div className="space-y-4">
            {VALUE_PROPS.map((v) => (
              <div key={v.title} className="flex items-start gap-3">
                <v.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold">{v.title}</p>
                  <p className="text-sm text-muted-foreground">{v.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-transparent bg-muted/40 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-status-success" />
            <p className="text-xs text-muted-foreground">
              Referral visibility is progress-only. Homiquity pays no referral fees and charges
              partners nothing — this portal exists so your clients get a smoother mortgage process.
            </p>
          </div>
        </div>

        {/* Persona select + registration */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPersona("realtor")}
              aria-pressed={persona === "realtor"}
              className={`rounded-lg border p-4 text-left transition-colors ${
                persona === "realtor" ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
              data-testid="button-persona-realtor"
            >
              <Home className="mb-2 h-5 w-5 text-primary" />
              <p className="text-sm font-semibold">Real-estate agent</p>
              <p className="text-xs text-muted-foreground">Refer buyers, track their journey</p>
            </button>
            <button
              type="button"
              onClick={() => setPersona("cpa")}
              aria-pressed={persona === "cpa"}
              className={`rounded-lg border p-4 text-left transition-colors ${
                persona === "cpa" ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
              data-testid="button-persona-cpa"
            >
              <Calculator className="mb-2 h-5 w-5 text-primary" />
              <p className="text-sm font-semibold">CPA / accountant</p>
              <p className="text-xs text-muted-foreground">Client tax-readiness referrals</p>
            </button>
          </div>

          {persona === "cpa" ? (
            <Card>
              <CardHeader>
                <CardTitle>CPA partners have a dedicated flow</CardTitle>
                <CardDescription>
                  CPA onboarding lives on its own page, built around client tax-readiness invites.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full" data-testid="button-goto-cpa-flow">
                  <Link href="/for-cpas">
                    Continue to CPA onboarding
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Become an agent partner</CardTitle>
                <CardDescription>Free to join. Get your referral link in seconds.</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (canSubmit && !register.isPending) register.mutate();
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="contactName">Your name</Label>
                    <Input
                      id="contactName"
                      value={form.contactName}
                      onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                      placeholder="Jordan Rivera"
                      autoComplete="name"
                      required
                      data-testid="input-contact-name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="firmName">Brokerage</Label>
                    <Input
                      id="firmName"
                      value={form.firmName}
                      onChange={(e) => setForm({ ...form, firmName: e.target.value })}
                      placeholder="Rivera Realty Group"
                      autoComplete="organization"
                      required
                      data-testid="input-firm-name"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <Label htmlFor="licenseNumber">License # (optional)</Label>
                      <Input
                        id="licenseNumber"
                        value={form.licenseNumber}
                        onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                        placeholder="475.123456"
                        data-testid="input-license-number"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="licenseState">State</Label>
                      <Input
                        id="licenseState"
                        value={form.licenseState}
                        onChange={(e) => setForm({ ...form, licenseState: e.target.value.toUpperCase().slice(0, 2) })}
                        placeholder="IL"
                        maxLength={2}
                        data-testid="input-license-state"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Work email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="jordan@riverarealty.com"
                      autoComplete="email"
                      required
                      data-testid="input-email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      data-testid="input-password"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!canSubmit || register.isPending}
                    data-testid="button-register-partner"
                  >
                    {register.isPending ? "Creating your account…" : "Create partner account"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    License details go to a manual verification queue — you can add or correct them
                    later. Already a partner?{" "}
                    <Link href="/login" className="text-primary hover:underline">
                      Sign in
                    </Link>
                  </p>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
