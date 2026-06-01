import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Copy, Share2, Users, TrendingUp, FileText, CheckCircle2, Link } from "lucide-react";

interface ReferralCodeResponse {
  referralCode: string;
  referralLink: string;
  fullUrl: string;
}

interface ReferralStats {
  totalReferrals: number;
  referralsThisMonth: number;
  activeApplications: number;
  closedLoans: number;
}

export default function ReferralLink() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: codeData, isLoading: codeLoading } = useQuery<ReferralCodeResponse>({
    queryKey: ["/api/my-referral-code"],
    enabled: !!user,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<ReferralStats>({
    queryKey: ["/api/my-referral-stats"],
    enabled: !!user,
  });

  const copyToClipboard = async () => {
    if (codeData?.fullUrl) {
      await navigator.clipboard.writeText(codeData.fullUrl);
      toast({
        title: "Link Copied",
        description: "Your referral link has been copied to clipboard",
      });
    }
  };

  const shareLink = async () => {
    if (codeData?.fullUrl && navigator.share) {
      try {
        await navigator.share({
          title: "Get Pre-Approved for a Mortgage",
          text: `I can help you get pre-approved for a mortgage in 3 minutes! Use my personal link to get started:`,
          url: codeData.fullUrl,
        });
      } catch (error) {
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  if (codeLoading || statsLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Link className="h-5 w-5 text-primary" />
          <CardTitle data-testid="text-referral-title">Your Referral Link</CardTitle>
        </div>
        <CardDescription>
          Share this link with potential borrowers. When they sign up, they'll be connected with you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <Input
            value={codeData?.fullUrl || ""}
            readOnly
            className="font-mono text-sm"
            data-testid="input-referral-link"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={copyToClipboard}
            data-testid="button-copy-link"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button onClick={shareLink} data-testid="button-share-link">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Your referral code:</span>
          <Badge variant="secondary" data-testid="badge-referral-code">
            {codeData?.referralCode}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                <span>Total Referrals</span>
              </div>
              <div className="text-2xl font-bold" data-testid="stat-total-referrals">
                {stats?.totalReferrals || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                <span>This Month</span>
              </div>
              <div className="text-2xl font-bold" data-testid="stat-this-month">
                {stats?.referralsThisMonth || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <FileText className="h-4 w-4" />
                <span>Active Apps</span>
              </div>
              <div className="text-2xl font-bold" data-testid="stat-active-apps">
                {stats?.activeApplications || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span>Closed Loans</span>
              </div>
              <div className="text-2xl font-bold" data-testid="stat-closed-loans">
                {stats?.closedLoans || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
