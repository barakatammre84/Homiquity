import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Home,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  Shield,
  FileText,
  Sparkles,
  Zap,
  Scale,
} from "lucide-react";

interface InviteValidation {
  valid: boolean;
  invite: {
    id: string;
    clientName: string | null;
    clientEmail: string | null;
    message: string | null;
    referrer: {
      firstName: string;
      lastName: string;
      role: string;
    } | null;
  };
}

const TIMELINE_STEPS = [
  {
    icon: FileText,
    title: "Answer a few questions",
    description: "Basic info about your finances and goals",
    duration: "~3 min",
  },
  {
    icon: Zap,
    title: "Instant analysis",
    description: "AI-powered review of your profile",
    duration: "~30 sec",
  },
  {
    icon: CheckCircle2,
    title: "Get your decision",
    description: "Pre-approval letter and loan options",
    duration: "Instant",
  },
];

export default function ApplyInvite() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const [, setInviteId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<InviteValidation>({
    queryKey: ["/api/application-invites/validate", token],
    queryFn: async () => {
      const response = await fetch(`/api/application-invites/validate/${token}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Invalid invite link");
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (data?.invite?.id) {
      setInviteId(data.invite.id);
      sessionStorage.setItem("inviteId", data.invite.id);
      if (data.invite.clientEmail) {
        sessionStorage.setItem("prefillEmail", data.invite.clientEmail);
      }
      if (data.invite.clientName) {
        sessionStorage.setItem("prefillName", data.invite.clientName);
      }
    }
  }, [data]);

  const startApplication = () => {
    setLocation("/apply");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
            <Skeleton className="h-8 w-64 mx-auto mb-2" />
            <Skeleton className="h-4 w-48 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-12" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    const errorMessage = (error as Error).message || "This invite link is invalid or has expired.";
    const isExpired = errorMessage.toLowerCase().includes("expired");

    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl" data-testid="text-error-title">
              {isExpired ? "Link Expired" : "Invalid Link"}
            </CardTitle>
            <CardDescription data-testid="text-error-description">
              {errorMessage}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertTitle>What happened?</AlertTitle>
              <AlertDescription>
                {isExpired
                  ? "Invite links expire after a set period for security. Your loan officer can send you a fresh link in seconds."
                  : "This link may have already been used or is no longer valid. Please contact your loan officer for a new one."}
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => setLocation("/")}
                data-testid="button-go-home"
              >
                Go to Homepage
              </Button>
              <Button
                className="flex-1"
                onClick={() => setLocation("/apply")}
                data-testid="button-apply-directly"
              >
                Apply Directly
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const referrer = data?.invite?.referrer;
  const referrerName = referrer
    ? `${referrer.firstName} ${referrer.lastName}`.trim() || "Your Loan Officer"
    : "Your Loan Officer";
  const referrerInitials = referrer
    ? `${(referrer.firstName?.[0] || "").toUpperCase()}${(referrer.lastName?.[0] || "").toUpperCase()}` || "LO"
    : "LO";
  const referrerRoleLabel =
    referrer?.role === "lo" ? "Loan Officer" :
    referrer?.role === "loa" ? "Loan Officer Assistant" :
    referrer?.role === "admin" ? "Mortgage Specialist" : "Your Guide";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="text-center mb-10">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Home className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3" data-testid="text-welcome-title">
            {data?.invite?.clientName
              ? `Welcome, ${data.invite.clientName}`
              : "Welcome"}
          </h1>
          <p className="text-xl text-muted-foreground" data-testid="text-welcome-subtitle">
            You've been invited to get pre-approved for a mortgage
          </p>
        </div>

        {referrer && (
          <Card className="mb-6">
            <CardContent className="flex items-center gap-4 pt-6">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                  {referrerInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-lg" data-testid="text-referrer-name">{referrerName}</p>
                <p className="text-sm text-muted-foreground">{referrerRoleLabel}</p>
              </div>
              <Badge variant="secondary">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Assigned to you
              </Badge>
            </CardContent>
            {data?.invite?.message && (
              <CardContent className="pt-0">
                <div className="bg-muted/50 rounded-lg p-4 text-muted-foreground" data-testid="text-personal-message">
                  <p className="text-sm font-medium text-foreground mb-1">Personal message:</p>
                  <p className="italic">"{data.invite.message}"</p>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Here's what to expect
            </CardTitle>
            <CardDescription>
              Get pre-approved in as little as 3 minutes — no hard credit check
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {TIMELINE_STEPS.map((step, idx) => (
                <div key={step.title} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <step.icon className="h-5 w-5 text-primary" />
                    </div>
                    {idx < TIMELINE_STEPS.length - 1 && (
                      <div className="w-px flex-1 bg-border my-1" />
                    )}
                  </div>
                  <div className="pb-6">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-medium">{step.title}</h3>
                      <Badge variant="outline" className="text-xs">{step.duration}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-3 text-center">
              <div className="flex flex-col items-center gap-2">
                <Shield className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">Bank-Level Security</p>
                <p className="text-xs text-muted-foreground">256-bit encryption</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Clock className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">Soft Credit Check Only</p>
                <p className="text-xs text-muted-foreground">Won't affect your score</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Scale className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">Equal Housing Lender</p>
                <p className="text-xs text-muted-foreground">NMLS compliant</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button
            size="lg"
            onClick={startApplication}
            data-testid="button-start-application"
          >
            Start My Application
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="mt-4 text-xs text-muted-foreground max-w-md mx-auto">
            By continuing, you agree to our Terms of Service and Privacy Policy.
            This is a soft inquiry and will not affect your credit score.
          </p>
        </div>
      </div>
    </div>
  );
}
