import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PENDING_REFERRAL_CODE_KEY } from "@/lib/pendingAttribution";
import { CheckCircle, User, Building2, ArrowRight, Home } from "lucide-react";

/**
 * Partner co-brand landing (/p/:slug — PH-1). The realtor-persona sibling of
 * /ref/:code: stashes the slug as a pending referral code (the partner's slug
 * IS their users.referral_code, so the existing attribution rail applies it
 * after signup) and frames the partner as the buyer's AGENT — never as a loan
 * officer or lender (SAFE Act framing, charter §5-C5). Reg N rails: readiness
 * language only, no approval or rate content. Route is prelaunch-Gated like
 * every consumer landing.
 */

interface PartnerBranding {
  valid: boolean;
  persona: string;
  displayName: string;
  firmName: string;
  referralSlug: string;
}

export default function PartnerReferralLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [applied, setApplied] = useState(false);

  const { data: partner, isLoading, error } = useQuery<PartnerBranding>({
    queryKey: ["/api/p", slug],
    enabled: !!slug,
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/apply-referral", { referralCode: slug });
      return res.json();
    },
    onSuccess: () => {
      setApplied(true);
      toast({
        title: "Connected",
        description: partner ? `You're connected with ${partner.displayName}.` : "You're connected.",
      });
      localStorage.removeItem(PENDING_REFERRAL_CODE_KEY);
    },
    onError: () => {
      // Best-effort — a duplicate/failed attribution must never block the page.
    },
  });

  useEffect(() => {
    if (slug) {
      try {
        localStorage.setItem(PENDING_REFERRAL_CODE_KEY, slug);
      } catch {
        /* storage unavailable — attribution falls back to the authed auto-apply below */
      }
    }
  }, [slug]);

  useEffect(() => {
    if (user && !applied && partner?.valid && !applyMutation.isPending) {
      applyMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, applied, partner]);

  const handleGetStarted = () => {
    if (user) {
      setLocation("/dashboard");
    } else {
      // The stashed pendingReferralCode is applied by usePendingAttribution
      // once they authenticate, so the partner attribution survives signup.
      window.location.href = "/signup";
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-10" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !partner?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-destructive" data-testid="text-invalid-partner-link">
              Invalid Referral Link
            </CardTitle>
            <CardDescription>This referral link is not valid or is no longer active.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/")} className="w-full" data-testid="button-go-home">
              <Home className="h-4 w-4 mr-2" />
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Home className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl" data-testid="text-partner-welcome">
            {applied ? "You're Connected!" : `${partner.displayName} sent you here`}
          </CardTitle>
          <CardDescription>
            {applied
              ? `${partner.displayName} will see your progress as you go — never your private details.`
              : "Check your home-buying readiness with Homiquity, with your agent kept in the loop."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium" data-testid="text-partner-name">{partner.displayName}</div>
                <div className="text-sm text-muted-foreground">Your real-estate agent</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium" data-testid="text-partner-firm">{partner.firmName}</div>
                <div className="text-sm text-muted-foreground">Brokerage</div>
              </div>
            </div>
          </div>

          {applied ? (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-success-subtle-foreground">
                <CheckCircle className="h-5 w-5" />
                <span>Successfully connected</span>
              </div>
              <Button onClick={handleGetStarted} className="w-full" data-testid="button-go-dashboard">
                Go to Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap justify-center gap-2">
                <Badge variant="secondary">Free service</Badge>
                <Badge variant="secondary">Secure &amp; private</Badge>
                <Badge variant="secondary">Progress you can share</Badge>
              </div>
              <Button
                onClick={handleGetStarted}
                className="w-full"
                size="lg"
                disabled={applyMutation.isPending}
                data-testid="button-get-started"
              >
                {user ? "Go to Dashboard" : "Get Started"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Mortgage brokerage services are provided by Homiquity, not by {partner.firmName}.
                Continuing connects your progress updates with {partner.displayName}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
