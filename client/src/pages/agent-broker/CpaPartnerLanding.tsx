import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { friendlyApiError } from "@/lib/errorMessage";
import { Building2, Lock, ShieldCheck, HandCoins, Link2, ArrowRight } from "lucide-react";

/**
 * CPA partner onboarding + marketing (/for-cpas).
 *
 * B2B recruitment page: a CPA registers a partner account and gets a co-branded
 * client-invite link. Compliance framing is explicit — the CPA never receives a
 * client's tax data (IRC §7216) and there are no referral fees (RESPA §8).
 */

const VALUE_PROPS = [
  {
    icon: Lock,
    title: "Your clients' data stays private",
    body: "Clients upload their own returns. You never see their tax documents or income — only whether they've started and their readiness stage.",
  },
  {
    icon: HandCoins,
    title: "No fees, no strings",
    body: "This is a free tool to add value for your clients. Homiquity does not pay referral fees and none are owed to us.",
  },
  {
    icon: Link2,
    title: "One link, all your clients",
    body: "Share a single co-branded link. Track referral progress at a glance from your partner portal.",
  },
];

export default function CpaPartnerLanding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [form, setForm] = useState({ firmName: "", contactName: "", email: "", password: "" });

  const register = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cpa-partners/register", form);
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Welcome aboard", description: "Your CPA partner portal is ready." });
      setLocation("/cpa-portal");
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
    form.firmName.trim().length > 0 && form.email.trim().length > 3 && form.password.length >= 8;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/50">
      <div className="mx-auto grid max-w-5xl gap-8 p-4 py-10 sm:p-6 md:grid-cols-2 md:items-center">
        {/* Pitch */}
        <div className="space-y-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold leading-tight" data-testid="text-cpa-hero">
              Help your clients see their home-buying readiness
            </h1>
            <p className="text-muted-foreground">
              Give clients a simple way to turn last year's return into a readiness snapshot — while
              their tax details stay entirely with them.
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
              Because clients upload their own returns directly, you are not disclosing client tax
              return information to a third party. This is an educational readiness tool, not a
              mortgage offer.
            </p>
          </div>
        </div>

        {/* Registration */}
        <Card>
          <CardHeader>
            <CardTitle>Become a CPA partner</CardTitle>
            <CardDescription>Free to join. Get your client-invite link in seconds.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSubmit) register.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="firmName">Firm name</Label>
                <Input
                  id="firmName"
                  value={form.firmName}
                  onChange={(e) => setForm({ ...form, firmName: e.target.value })}
                  placeholder="Smith & Co. CPAs"
                  data-testid="input-firm-name"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contactName">Your name</Label>
                <Input
                  id="contactName"
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  placeholder="Jordan Smith"
                  data-testid="input-contact-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@firm.com"
                  data-testid="input-email"
                  required
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
                  data-testid="input-password"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={!canSubmit || register.isPending}
                data-testid="button-cpa-register"
              >
                {register.isPending ? "Creating…" : "Create partner account"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                By joining you confirm you will only share the invite link with clients who choose to
                use it. No referral compensation is offered or owed.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
