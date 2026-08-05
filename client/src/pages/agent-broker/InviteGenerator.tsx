import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageShell } from "@/components/PageShell";
import { computeInviteStats, filterInvites } from "./inviteGenerator/inviteStats";
import { inviteFormSchema, type FilterTab, type InviteFormValues, type InviteWithStatus } from "./inviteGenerator/types";
import { CreateInviteDialog } from "./inviteGenerator/CreateInviteDialog";
import { InviteStatsCards } from "./inviteGenerator/InviteStatsCards";
import { InviteTable } from "./inviteGenerator/InviteTable";
import { InviteEmptyState } from "./inviteGenerator/InviteEmptyState";

export default function InviteGenerator() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      message: "",
      expiresInDays: 30,
    },
  });

  const { data: invites, isLoading: invitesLoading } = useQuery<InviteWithStatus[]>({
    queryKey: ["/api/application-invites"],
    enabled: !!user,
  });

  const createInviteMutation = useMutation({
    mutationFn: async (data: InviteFormValues) => {
      const response = await apiRequest("POST", "/api/application-invites", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/application-invites"] });
      setGeneratedLink(data.inviteUrl);
      toast({
        title: "Invite link created",
        description: "Copy the link to send to your client.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create invite link.",
        variant: "destructive",
      });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/application-invites/${id}/resend`, { expiresInDays: 30 });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/application-invites"] });
      toast({ title: "Invite resent", description: "Expiration extended by 30 days." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to resend invite.", variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/application-invites/${id}/revoke`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/application-invites"] });
      toast({ title: "Invite revoked", description: "The link is no longer valid." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to revoke invite.", variant: "destructive" });
    },
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "Link copied to clipboard." });
    } catch {
      toast({ title: "Error", description: "Failed to copy link.", variant: "destructive" });
    }
  };

  const onSubmit = (data: InviteFormValues) => {
    createInviteMutation.mutate(data);
  };

  const resetAndClose = () => {
    form.reset();
    setGeneratedLink(null);
    setIsDialogOpen(false);
  };

  const stats = useMemo(() => computeInviteStats(invites), [invites]);
  const filteredInvites = useMemo(() => filterInvites(invites, activeFilter), [invites, activeFilter]);

  const isLoading = authLoading || invitesLoading;

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="mb-8 h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="mt-8 h-64" />
      </div>
    );
  }

  return (
    <PageShell width="full" contentClassName="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Client Invite Links</h1>
          <p className="text-muted-foreground">
            Generate personalized application links for your clients
          </p>
        </div>
        <CreateInviteDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          form={form}
          onSubmit={onSubmit}
          isPending={createInviteMutation.isPending}
          generatedLink={generatedLink}
          onCopy={copyToClipboard}
          onReset={resetAndClose}
          onCreateAnother={() => {
            form.reset();
            setGeneratedLink(null);
          }}
        />
      </div>

      <InviteStatsCards stats={stats} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>Invite History</CardTitle>
              <CardDescription>Track and manage your client invite links</CardDescription>
            </div>
            <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as FilterTab)}>
              <TabsList>
                <TabsTrigger value="all" data-testid="tab-all">
                  All ({stats.total})
                </TabsTrigger>
                <TabsTrigger value="pending" data-testid="tab-pending">
                  Pending ({stats.pending})
                </TabsTrigger>
                <TabsTrigger value="clicked" data-testid="tab-clicked">
                  Clicked ({stats.clicked})
                </TabsTrigger>
                <TabsTrigger value="applied" data-testid="tab-applied">
                  Applied ({stats.applied})
                </TabsTrigger>
                <TabsTrigger value="expired" data-testid="tab-expired">
                  Expired ({stats.expired})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {filteredInvites.length > 0 ? (
            <InviteTable
              invites={filteredInvites}
              onCopy={copyToClipboard}
              onResend={(id) => resendMutation.mutate(id)}
              onRevoke={(id) => revokeMutation.mutate(id)}
              isResending={resendMutation.isPending}
              isRevoking={revokeMutation.isPending}
            />
          ) : (
            <InviteEmptyState
              activeFilter={activeFilter}
              onCreateInvite={() => setIsDialogOpen(true)}
            />
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
