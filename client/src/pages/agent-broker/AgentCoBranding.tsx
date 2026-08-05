import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { MessageSquare, Palette, Users } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import type { CoBrandProfile } from "./agentCoBranding/types";
import { BrandingTab } from "./agentCoBranding/BrandingTab";
import { ReferralsTab } from "./agentCoBranding/ReferralsTab";
import { DealDeskTab } from "./agentCoBranding/DealDeskTab";

export default function AgentCoBranding() {
  const { data: profile, isLoading, isError, error, refetch } = useQuery<CoBrandProfile | null>({
    queryKey: ["/api/co-brand/profile"],
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  // A failed load is indistinguishable from "no profile yet" once it reaches
  // BrandingTab: the form renders empty with a "Create Profile" button, so a
  // partner who already has a profile would POST a second one over a load
  // error. Fail visibly instead (ux-01).
  if (isError) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <QueryErrorState
          error={error}
          onRetry={() => refetch()}
          title="We couldn't load your branding profile"
          data-testid="co-brand-error"
        />
      </div>
    );
  }

  return (
    <PageShell width="content">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Palette className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground md:text-2xl" data-testid="text-page-title">Co-Branding Portal</h1>
            <p className="text-sm text-muted-foreground">Create co-branded landing pages and track your referrals.</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="branding" data-testid="co-brand-tabs">
        <TabsList className="mb-4">
          <TabsTrigger value="branding" data-testid="tab-branding">
            <Palette className="h-4 w-4 mr-1" /> Branding
          </TabsTrigger>
          <TabsTrigger value="referrals" data-testid="tab-referrals">
            <Users className="h-4 w-4 mr-1" /> Referrals
          </TabsTrigger>
          <TabsTrigger value="deal-desk" data-testid="tab-deal-desk">
            <MessageSquare className="h-4 w-4 mr-1" /> Deal Desk
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <BrandingTab profile={profile || null} />
        </TabsContent>

        <TabsContent value="referrals">
          <ReferralsTab />
        </TabsContent>

        <TabsContent value="deal-desk">
          <DealDeskTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
