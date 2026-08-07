import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getPublicQueryFn } from "@/lib/queryClient";
import { Building2, ShieldCheck, ArrowRight, Home, ReceiptText, Lock } from "lucide-react";

/**
 * CPA co-branded client landing (/cpa/:code).
 *
 * The client's CPA invited them to check their home-buying readiness. Attribution
 * mirrors the LO ReferralLanding: the code is stashed in localStorage and applied
 * once the client is authenticated (here if already signed in, else consumed on
 * RenterHome after signup). The messaging makes the §7216 posture explicit — the
 * client uploads their OWN return and the CPA never sees it.
 */

interface CpaValidation {
  valid: boolean;
  firmName: string;
  contactName: string | null;
}

const PENDING_KEY = "pendingCpaCode";

export default function CpaInviteLanding() {
  const { code } = useParams<{ code: string }>();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [applied, setApplied] = useState(false);

  // `getPublicQueryFn`: the route is unauthenticated
  // (server/routes/cpaPartners.ts:134) and this page is the first thing a
  // signed-out visitor sees, so a 401 must never bounce them to /login. The
  // key already resolves to this exact URL, so no second spelling is needed.
  const { data, isLoading, error } = useQuery<CpaValidation>({
    queryKey: ["/api/cpa/validate", code],
    queryFn: getPublicQueryFn<CpaValidation>(),
    enabled: !!code,
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cpa/apply-referral", { referralCode: code });
      return res.json();
    },
    onSuccess: () => {
      setApplied(true);
      localStorage.removeItem(PENDING_KEY);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't apply invite", description: err.message, variant: "destructive" });
    },
  });

  // Stash the code so RenterHome can attribute after a fresh signup.
  useEffect(() => {
    if (code) localStorage.setItem(PENDING_KEY, code);
  }, [code]);

  // Auto-attribute when the visitor is already signed in.
  useEffect(() => {
    if (user && !applied && data?.valid && !applyMutation.isPending) {
      applyMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, applied, data]);

  const handleGetStarted = () => {
    if (user) setLocation("/dashboard");
    else window.location.href = "/signup";
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <Skeleton className="mb-2 h-8 w-3/4" />
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

  if (error || !data?.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-destructive" data-testid="text-invalid-code">
              Invalid invite link
            </CardTitle>
            <CardDescription>This CPA invite link is not valid or is inactive.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/")} className="w-full" data-testid="button-go-home">
              <Home className="mr-2 h-4 w-4" />
              Go to homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl" data-testid="text-cpa-welcome">
            {applied ? "You're all set!" : `${data.firmName} invited you`}
          </CardTitle>
          <CardDescription>
            {applied
              ? `${data.firmName} will see your readiness progress — never your tax documents.`
              : "Turn last year's tax return into a home-buying readiness snapshot."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 rounded-lg bg-muted/50 p-4">
            <div className="flex items-start gap-3">
              <ReceiptText className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <p className="text-sm">
                You'll upload <span className="font-medium">your own</span> tax return. We read the
                income signals and build your readiness snapshot in seconds.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <p className="text-sm">
                <span className="font-medium">{data.firmName}</span> never sees your tax return or
                financial details — only whether you've started and how far along you are.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <p className="text-sm">
                This is an educational estimate, not a loan offer — and there's no cost to you.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="secondary">Upload your own return</Badge>
            <Badge variant="secondary">Private from your CPA</Badge>
            <Badge variant="secondary">Free</Badge>
          </div>

          <Button
            onClick={handleGetStarted}
            className="w-full"
            size="lg"
            disabled={applyMutation.isPending}
            data-testid="button-cpa-get-started"
          >
            {user ? "Go to my readiness snapshot" : "Get started"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {applied
              ? "Your CPA has been connected to your readiness progress."
              : `Continuing connects ${data.firmName} to your readiness progress (not your data).`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
