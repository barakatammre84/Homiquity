import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import CpaPortal, { stageLabel } from "@/pages/agent-broker/CpaPortal";
import { Copy, Check, Link2, Users, ShieldCheck, Clock, ArrowRight, Lock } from "lucide-react";

/**
 * PartnerHub shell (/partners/hub — PH-1). One authenticated home for every
 * partner persona: realtors get the identity + referral view built on the new
 * partner spine; CPAs get the existing portal as their tab content until the
 * convergence prompt. Inviter-only doctrine: progress stages, never borrower
 * financials (charter §5-C6).
 */

interface PartnerMe {
  partner: {
    id: string;
    persona: string;
    firmName: string;
    contactName: string | null;
    email: string;
    licenseNumber: string | null;
    licenseState: string | null;
    licenseVerificationStatus: "pending_review" | "verified" | "rejected";
    referralSlug: string;
    referralLink: string;
    status: string;
    createdAt: string;
  };
}

interface HubReferral {
  displayName: string;
  stage: string;
  shared: boolean;
  referredAt: string | null;
}

function LicenseBadge({ status }: { status: PartnerMe["partner"]["licenseVerificationStatus"] }) {
  if (status === "verified") {
    return (
      <Badge variant="success" data-testid="badge-license-status">
        <ShieldCheck className="mr-1 h-3 w-3" />
        License verified
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge variant="warning" data-testid="badge-license-status">
        License not confirmed
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" data-testid="badge-license-status">
      <Clock className="mr-1 h-3 w-3" />
      License review pending
    </Badge>
  );
}

function RealtorHub() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: me, isLoading: meLoading, isError: meError } = useQuery<PartnerMe>({
    queryKey: ["/api/partners/me"],
  });
  const { data: referralsData, isLoading: refsLoading } = useQuery<{ referrals: HubReferral[] }>({
    queryKey: ["/api/partners/me/referrals"],
  });

  const partner = me?.partner;
  const referrals = referralsData?.referrals ?? [];

  const copyLink = async () => {
    if (!partner) return;
    try {
      await navigator.clipboard.writeText(partner.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied", description: "Share it with your buyers." });
    } catch {
      toast({ title: "Couldn't copy", description: partner.referralLink });
    }
  };

  if (meError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>We couldn't load your partner profile</CardTitle>
          <CardDescription>Please refresh, or contact us if this keeps happening.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Identity */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle data-testid="text-partner-firm">
              {meLoading ? <Skeleton className="h-6 w-48" /> : partner?.firmName}
            </CardTitle>
            <CardDescription>
              {meLoading ? <Skeleton className="mt-1 h-4 w-32" /> : partner?.contactName}
            </CardDescription>
          </div>
          {partner && <LicenseBadge status={partner.licenseVerificationStatus} />}
        </CardHeader>
        {partner && partner.status !== "active" && (
          <CardContent>
            <p className="text-sm text-muted-foreground" data-testid="text-partner-suspended">
              Your partner account is currently suspended — your referral link is paused. Contact us
              if you think this is a mistake.
            </p>
          </CardContent>
        )}
      </Card>

      {/* Referral link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4 text-primary" />
            Your referral link
          </CardTitle>
          <CardDescription>
            Buyers who sign up through this link are attributed to you automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {meLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : partner ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code
                className="flex-1 truncate rounded-md bg-muted px-3 py-2 text-sm"
                data-testid="text-referral-link"
              >
                {partner.referralLink}
              </code>
              <Button onClick={copyLink} variant="outline" data-testid="button-copy-link">
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Referrals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            Your referrals{" "}
            {!refsLoading && (
              <span className="font-normal text-muted-foreground" data-testid="text-referral-count">
                ({referrals.length})
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Progress stages appear only for clients who choose to share them — their financial
            details always stay private to them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {refsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : referrals.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center" data-testid="referrals-empty">
              <Users className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No referrals yet — share your link to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((r, i) => (
                    <TableRow key={`${r.displayName}-${i}`} data-testid={`row-referral-${i}`}>
                      <TableCell className="font-medium">{r.displayName}</TableCell>
                      <TableCell>
                        {r.shared ? (
                          <Badge variant="secondary" data-testid={`badge-stage-${i}`}>
                            {stageLabel(r.stage)}
                          </Badge>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
                            data-testid={`text-stage-hidden-${i}`}
                          >
                            <Lock className="h-3.5 w-3.5" />
                            Invited · progress private
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {r.referredAt ? new Date(r.referredAt).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PH-2 placeholder */}
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            Coming next: milestone alerts and a consent-based pipeline view, so you know the moment a
            client clears a stage — once they've chosen to share it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PartnersHub() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <PageShell title="Partner Hub" fullHeight>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </PageShell>
    );
  }

  if (user?.role === "cpa") {
    // The existing CPA portal is the CPA tab content until the convergence prompt.
    return (
      <PageShell fullHeight>
        <CpaPortal />
      </PageShell>
    );
  }

  if (user?.role === "admin") {
    return (
      <PageShell title="Partner Hub" subtitle="Admins manage partners from the admin queue." fullHeight>
        <Card>
          <CardContent className="flex items-center justify-between py-6">
            <p className="text-sm text-muted-foreground">
              Partner accounts, license reviews, and waitlist invites live in the admin area.
            </p>
            <Button asChild data-testid="button-goto-admin-partners">
              <Link href="/admin/partners">
                Open partner admin
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Partner Hub"
      subtitle="Your referral link, your clients' progress — never their private data."
      fullHeight
    >
      <RealtorHub />
    </PageShell>
  );
}
