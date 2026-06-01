import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Palette,
  Users,
  MessageSquare,
  Copy,
  Plus,
  Send,
  Phone,
  Mail,
  Shield,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

interface CoBrandProfile {
  id: string;
  brandName: string;
  tagline: string | null;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  nmlsId: string | null;
  licenseNumber: string | null;
  disclaimerText: string | null;
  bio: string | null;
  specialties: string[] | null;
  serviceAreas: string[] | null;
  isActive: boolean;
}

interface ReferralStatus {
  id: string;
  clientName: string | null;
  clientEmail: string | null;
  status: string;
  createdAt: string;
  clickedAt: string | null;
  appliedAt: string | null;
  applicationStatus: string | null;
  applicationStage: string | null;
}

interface DealDeskThread {
  id: string;
  subject: string;
  scenarioType: string | null;
  status: string;
  loanAmount: string | null;
  propertyType: string | null;
  creditScore: number | null;
  borrowerType: string | null;
  notes: string | null;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    pending: { label: "Pending", variant: "secondary" },
    clicked: { label: "Clicked", variant: "outline" },
    applied: { label: "Applied", variant: "default" },
    expired: { label: "Expired", variant: "destructive" },
    pre_approved: { label: "Pre-Approved", variant: "default" },
    submitted: { label: "Submitted", variant: "secondary" },
    approved: { label: "Approved", variant: "default" },
    denied: { label: "Denied", variant: "destructive" },
  };
  const v = variants[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={v.variant} data-testid={`badge-status-${status}`}>{v.label}</Badge>;
}

function BrandingTab({ profile, onSave }: { profile: CoBrandProfile | null; onSave: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    brandName: profile?.brandName || "",
    tagline: profile?.tagline || "",
    contactEmail: profile?.contactEmail || user?.email || "",
    contactPhone: profile?.contactPhone || "",
    websiteUrl: profile?.websiteUrl || "",
    nmlsId: profile?.nmlsId || "",
    licenseNumber: profile?.licenseNumber || "",
    bio: profile?.bio || "",
    disclaimerText: profile?.disclaimerText || "",
    primaryColor: profile?.primaryColor || "#1e3a5f",
    accentColor: profile?.accentColor || "#10b981",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (profile) {
        return apiRequest("PATCH", `/api/co-brand/profile/${profile.id}`, formData);
      }
      return apiRequest("POST", "/api/co-brand/profile", formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/co-brand/profile"] });
      toast({ title: "Saved", description: "Your branding profile has been updated." });
      onSave();
    },
    onError: () => toast({ title: "Error", description: "Failed to save profile", variant: "destructive" }),
  });

  return (
    <div className="space-y-6" data-testid="branding-tab">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand Identity</CardTitle>
          <CardDescription>Configure how your landing pages and pre-approval letters look to clients.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">Brand Name</label>
              <Input
                value={formData.brandName}
                onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                placeholder="e.g., Smith Realty Group"
                className="mt-1"
                data-testid="input-brand-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Tagline</label>
              <Input
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                placeholder="e.g., Your trusted home partner"
                className="mt-1"
                data-testid="input-tagline"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Professional Bio</label>
            <Textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Tell clients about your experience and expertise..."
              className="mt-1"
              rows={3}
              data-testid="input-bio"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">Contact Email</label>
              <Input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                className="mt-1"
                data-testid="input-contact-email"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Contact Phone</label>
              <Input
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                placeholder="(555) 123-4567"
                className="mt-1"
                data-testid="input-contact-phone"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-foreground">Website</label>
              <Input
                value={formData.websiteUrl}
                onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                placeholder="https://yoursite.com"
                className="mt-1"
                data-testid="input-website"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">NMLS ID</label>
              <Input
                value={formData.nmlsId}
                onChange={(e) => setFormData({ ...formData, nmlsId: e.target.value })}
                placeholder="123456"
                className="mt-1"
                data-testid="input-nmls"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">License Number</label>
              <Input
                value={formData.licenseNumber}
                onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                className="mt-1"
                data-testid="input-license"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="text-sm font-medium text-foreground">Primary Color</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={formData.primaryColor}
                  onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border"
                  data-testid="input-primary-color"
                />
                <span className="text-xs text-muted-foreground">{formData.primaryColor}</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Accent Color</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={formData.accentColor}
                  onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border"
                  data-testid="input-accent-color"
                />
                <span className="text-xs text-muted-foreground">{formData.accentColor}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Legal Disclaimer</label>
            <Textarea
              value={formData.disclaimerText}
              onChange={(e) => setFormData({ ...formData, disclaimerText: e.target.value })}
              placeholder="Optional legal disclaimer for your landing pages..."
              className="mt-1"
              rows={2}
              data-testid="input-disclaimer"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate()} disabled={!formData.brandName || saveMutation.isPending} data-testid="button-save-branding">
              {saveMutation.isPending ? "Saving..." : profile ? "Update Branding" : "Create Profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {profile && (
        <Card data-testid="card-preview">
          <CardHeader>
            <CardTitle className="text-base">Landing Page Preview</CardTitle>
            <CardDescription>This is how your co-branded page will appear to clients.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <div className="p-6 text-white" style={{ background: `linear-gradient(135deg, ${profile.primaryColor}, ${profile.primaryColor}dd)` }}>
                <h3 className="text-lg font-bold">{profile.brandName}</h3>
                {profile.tagline && <p className="mt-1 text-sm opacity-90">{profile.tagline}</p>}
              </div>
              <div className="bg-card p-4">
                {profile.bio && <p className="text-sm text-muted-foreground">{profile.bio}</p>}
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {profile.contactEmail && (
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{profile.contactEmail}</span>
                  )}
                  {profile.contactPhone && (
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{profile.contactPhone}</span>
                  )}
                  {profile.nmlsId && (
                    <span className="flex items-center gap-1"><Shield className="h-3 w-3" />NMLS #{profile.nmlsId}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Input
                readOnly
                value={`${window.location.origin}/partner/${profile.id}`}
                className="text-xs"
                data-testid="input-landing-url"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/partner/${profile.id}`);
                }}
                data-testid="button-copy-landing-url"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReferralsTab() {
  const { data: referrals = [], isLoading } = useQuery<ReferralStatus[]>({
    queryKey: ["/api/co-brand/referrals"],
  });

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>;
  }

  if (referrals.length === 0) {
    return (
      <Card data-testid="card-no-referrals">
        <CardContent className="py-8 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium text-foreground">No referrals yet</p>
          <p className="text-sm text-muted-foreground mt-1">Share your co-branded link with clients to start tracking referrals.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-referrals">
      <CardHeader>
        <CardTitle className="text-base">Client Referral Status</CardTitle>
        <CardDescription>Track your referred clients through the mortgage process.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Link Status</TableHead>
              <TableHead>Application</TableHead>
              <TableHead>Referred</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {referrals.map((ref) => (
              <TableRow key={ref.id} data-testid={`row-referral-${ref.id}`}>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{ref.clientName || "Anonymous"}</p>
                    {ref.clientEmail && <p className="text-xs text-muted-foreground">{ref.clientEmail}</p>}
                  </div>
                </TableCell>
                <TableCell><StatusBadge status={ref.status} /></TableCell>
                <TableCell>
                  {ref.applicationStatus ? (
                    <StatusBadge status={ref.applicationStatus} />
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {ref.createdAt ? format(new Date(ref.createdAt), "MMM d, yyyy") : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DealDeskTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newThread, setNewThread] = useState({ subject: "", scenarioType: "general", notes: "", loanAmount: "", creditScore: "" });

  const { data: threads = [], isLoading } = useQuery<DealDeskThread[]>({
    queryKey: ["/api/deal-desk/threads"],
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/deal-desk/threads", {
      ...newThread,
      loanAmount: newThread.loanAmount || null,
      creditScore: newThread.creditScore ? parseInt(newThread.creditScore) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deal-desk/threads"] });
      toast({ title: "Scenario submitted", description: "Your question has been sent to the loan team." });
      setDialogOpen(false);
      setNewThread({ subject: "", scenarioType: "general", notes: "", loanAmount: "", creditScore: "" });
    },
    onError: () => toast({ title: "Error", description: "Failed to create scenario", variant: "destructive" }),
  });

  return (
    <div className="space-y-4" data-testid="deal-desk-tab">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-semibold text-foreground">Deal Desk</h3>
          <p className="text-sm text-muted-foreground">Quick scenario questions for the loan team.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-new-scenario">
              <Plus className="h-4 w-4 mr-1" /> New Scenario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ask a Scenario Question</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium">Question</label>
                <Input
                  value={newThread.subject}
                  onChange={(e) => setNewThread({ ...newThread, subject: e.target.value })}
                  placeholder="e.g., Can a borrower with 580 credit get FHA?"
                  className="mt-1"
                  data-testid="input-scenario-subject"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Scenario Type</label>
                <Select value={newThread.scenarioType} onValueChange={(v) => setNewThread({ ...newThread, scenarioType: v })}>
                  <SelectTrigger className="mt-1" data-testid="select-scenario-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Question</SelectItem>
                    <SelectItem value="eligibility">Eligibility Check</SelectItem>
                    <SelectItem value="pricing">Pricing Scenario</SelectItem>
                    <SelectItem value="documentation">Documentation</SelectItem>
                    <SelectItem value="program">Loan Program</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Loan Amount</label>
                  <Input
                    type="number"
                    value={newThread.loanAmount}
                    onChange={(e) => setNewThread({ ...newThread, loanAmount: e.target.value })}
                    placeholder="$350,000"
                    className="mt-1"
                    data-testid="input-scenario-amount"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Credit Score</label>
                  <Input
                    type="number"
                    value={newThread.creditScore}
                    onChange={(e) => setNewThread({ ...newThread, creditScore: e.target.value })}
                    placeholder="720"
                    className="mt-1"
                    data-testid="input-scenario-credit"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Details</label>
                <Textarea
                  value={newThread.notes}
                  onChange={(e) => setNewThread({ ...newThread, notes: e.target.value })}
                  placeholder="Provide additional details about the scenario..."
                  className="mt-1"
                  rows={3}
                  data-testid="input-scenario-notes"
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => createMutation.mutate()} disabled={!newThread.subject || createMutation.isPending} data-testid="button-submit-scenario">
                  <Send className="h-4 w-4 mr-1" /> Submit Question
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : threads.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">No scenarios yet</p>
            <p className="text-sm text-muted-foreground mt-1">Ask the loan team quick scenario questions to help your clients.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {threads.map((thread) => (
            <Card key={thread.id} className="hover-elevate" data-testid={`card-thread-${thread.id}`}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{thread.subject}</p>
                      <Badge variant={thread.status === "open" ? "default" : "secondary"}>
                        {thread.status === "open" ? "Open" : "Closed"}
                      </Badge>
                      {thread.scenarioType && (
                        <Badge variant="outline" className="text-[10px]">{thread.scenarioType}</Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {thread.loanAmount && <span>${Number(thread.loanAmount).toLocaleString()}</span>}
                      {thread.creditScore && <span>Score: {thread.creditScore}</span>}
                      <span>{format(new Date(thread.createdAt), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" data-testid={`button-view-thread-${thread.id}`}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgentCoBranding() {
  const { data: profile, isLoading } = useQuery<CoBrandProfile | null>({
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

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" data-testid="agent-co-branding-page">
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
          <BrandingTab profile={profile || null} onSave={() => {}} />
        </TabsContent>

        <TabsContent value="referrals">
          <ReferralsTab />
        </TabsContent>

        <TabsContent value="deal-desk">
          <DealDeskTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
