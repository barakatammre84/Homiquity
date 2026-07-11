import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/PageShell";
import { useToast } from "@/hooks/use-toast";
import { Building2, Copy, Check, Users, ShieldCheck, ReceiptText } from "lucide-react";

/**
 * CPA partner portal — a CPA's own workspace.
 *
 * Shows the referral link and referred-client PROGRESS ONLY (stage + first
 * name + last initial). It deliberately never surfaces a client's tax figures,
 * income, or documents: the CPA is an inviter, not a recipient of borrower
 * financial data (IRC §7216). No compensation is shown (RESPA §8).
 */

interface CpaPartnerProfile {
  firmName: string;
  contactName: string | null;
  referralCode: string;
  referralLink: string;
}

interface CpaReferralRow {
  displayName: string;
  stage: string;
  referredAt: string;
}

interface CpaStats {
  total: number;
  active: number;
  exploring: number;
}

const STAGE_LABELS: Record<string, string> = {
  exploring: "Exploring",
  submitted: "Applied",
  analyzing: "In review",
  pre_approved: "Pre-approved",
  doc_collection: "Collecting docs",
  processing: "Processing",
  underwriting: "Underwriting",
  conditional: "Conditional",
  closed: "Closed",
};

function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, " ");
}

export default function CpaPortal() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: me, isLoading: meLoading } = useQuery<{ partner: CpaPartnerProfile }>({
    queryKey: ["/api/cpa/me"],
  });
  const { data: stats } = useQuery<CpaStats>({ queryKey: ["/api/cpa/stats"] });
  const { data: referralsData, isLoading: refsLoading } = useQuery<{ referrals: CpaReferralRow[] }>({
    queryKey: ["/api/cpa/referrals"],
  });

  const partner = me?.partner;
  const referrals = referralsData?.referrals ?? [];

  const copyLink = async () => {
    if (!partner) return;
    try {
      await navigator.clipboard.writeText(partner.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied", description: "Share it with your clients." });
    } catch {
      toast({ title: "Couldn't copy", description: partner.referralLink });
    }
  };

  return (
    <PageShell width="content" contentClassName="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold" data-testid="text-cpa-firm">
            {meLoading ? <Skeleton className="h-6 w-40" /> : partner?.firmName ?? "CPA Partner"}
          </h1>
          <p className="text-sm text-muted-foreground">Client readiness referral portal</p>
        </div>
      </div>

      {/* Referral link */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Your client invite link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 text-sm" data-testid="text-referral-link">
              {partner?.referralLink ?? "…"}
            </code>
            <Button size="sm" variant="outline" onClick={copyLink} disabled={!partner} data-testid="button-copy-link">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Share this with clients who want to see their home-buying readiness. They upload their
            own tax return — you never see it.
          </p>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Clients referred", value: stats?.total ?? 0 },
          { label: "In application", value: stats?.active ?? 0 },
          { label: "Exploring", value: stats?.exploring ?? 0 },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold" data-testid={`stat-${s.label}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Client list — stage only */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Users className="h-4 w-4 text-primary" />
            Referred clients
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {refsLoading ? (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </>
          ) : referrals.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground" data-testid="text-no-referrals">
              No clients yet. Share your link above to get started.
            </p>
          ) : (
            referrals.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-muted/40 p-3"
                data-testid={`referral-row-${i}`}
              >
                <div className="flex items-center gap-2">
                  <ReceiptText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{r.displayName}</span>
                </div>
                <Badge variant="secondary" className="no-default-hover-elevate text-[11px]">
                  {stageLabel(r.stage)}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-transparent bg-muted/30 p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-status-success" />
        <p className="text-xs text-muted-foreground">
          You see your clients' progress only — never their tax documents, income, or financial
          details. Homiquity does not pay referral fees; this portal is provided at no cost.
        </p>
      </div>
    </PageShell>
  );
}
