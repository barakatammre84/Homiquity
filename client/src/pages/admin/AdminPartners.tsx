import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { friendlyApiError } from "@/lib/errorMessage";
import { Users, Search, AlertCircle, ShieldCheck, ShieldX, Pause, Play } from "lucide-react";
import { format } from "date-fns";
import AdminPartnerWaitlist from "@/pages/admin/AdminPartnerWaitlist";

/**
 * Unified partner admin (/admin/partners — PH-1). Two tabs: active partner
 * accounts (partner_profiles ∪ cpa_partners) with the manual license-review
 * queue, and the pre-launch waitlist (the existing page, now with invites).
 * CPA rows are read-only here until the convergence prompt — their lifecycle
 * stays on the CPA routes.
 */

interface AdminPartnerRow {
  id: string;
  table: "partner_profiles" | "cpa_partners";
  persona: string;
  firmName: string;
  contactName: string | null;
  email: string;
  referralSlug: string;
  licenseNumber: string | null;
  licenseState: string | null;
  licenseVerificationStatus: "pending_review" | "verified" | "rejected" | null;
  status: string;
  source: string;
  createdAt: string | null;
}

const PERSONA_LABELS: Record<string, string> = {
  realtor: "Real-estate agent",
  cpa: "CPA",
};

function LicenseCell({ row }: { row: AdminPartnerRow }) {
  if (row.table === "cpa_partners") {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  const detail = row.licenseNumber
    ? `${row.licenseNumber}${row.licenseState ? ` (${row.licenseState})` : ""}`
    : "Not provided";
  const badge =
    row.licenseVerificationStatus === "verified" ? (
      <Badge variant="success">Verified</Badge>
    ) : row.licenseVerificationStatus === "rejected" ? (
      <Badge variant="warning">Not confirmed</Badge>
    ) : (
      <Badge variant="secondary">Pending review</Badge>
    );
  return (
    <div className="space-y-1">
      {badge}
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function PartnerAccountsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery<{ partners: AdminPartnerRow[] }>({
    queryKey: ["/api/admin/partners"],
  });

  const act = useMutation({
    mutationFn: async (input: { id: string; action: "license-review" | "status"; body: Record<string, string> }) => {
      const res = await apiRequest("POST", `/api/admin/partners/${input.id}/${input.action}`, input.body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partners"] });
    },
    onError: (err: Error) => {
      toast({
        title: "Action failed",
        description: friendlyApiError(err, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const rows = useMemo(() => {
    const all = data?.partners ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (r) =>
        r.firmName.toLowerCase().includes(q) ||
        (r.contactName ?? "").toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.referralSlug.toLowerCase().includes(q) ||
        (PERSONA_LABELS[r.persona] ?? r.persona).toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">
            Partner accounts{" "}
            {!isLoading && !isError && (
              <span className="font-normal text-muted-foreground" data-testid="text-partner-accounts-count">
                ({data?.partners.length ?? 0})
              </span>
            )}
          </CardTitle>
          <CardDescription>Self-registered partners, newest first. License review is manual.</CardDescription>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, slug…"
            className="pl-9"
            aria-label="Search partner accounts"
            data-testid="input-partner-accounts-search"
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3" data-testid="partner-accounts-loading">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center" data-testid="partner-accounts-error">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Couldn't load partner accounts. Please refresh.</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center" data-testid="partner-accounts-empty">
            <Users className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {data && data.partners.length > 0 ? "No partners match your search." : "No partner accounts yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Persona</TableHead>
                  <TableHead>Referral slug</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={`${r.table}-${r.id}`} data-testid={`row-partner-account-${r.id}`}>
                    <TableCell>
                      <div className="font-medium text-foreground">{r.contactName || r.firmName}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.firmName} · {r.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{PERSONA_LABELS[r.persona] ?? r.persona}</Badge>
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{r.referralSlug}</code>
                    </TableCell>
                    <TableCell>
                      <LicenseCell row={r} />
                    </TableCell>
                    <TableCell>
                      {r.status === "active" ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="warning">Suspended</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {r.createdAt ? format(new Date(r.createdAt), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.table === "cpa_partners" ? (
                        <span className="text-xs text-muted-foreground">Managed in CPA lane</span>
                      ) : (
                        <div className="flex justify-end gap-1.5">
                          {r.licenseVerificationStatus === "pending_review" && (
                            <>
                              <Button
                                size="sm" className="touch-target"
                                variant="outline"
                                disabled={act.isPending}
                                onClick={() =>
                                  act.mutate({ id: r.id, action: "license-review", body: { decision: "verified" } })
                                }
                                data-testid={`button-verify-${r.id}`}
                              >
                                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                                Verify
                              </Button>
                              <Button
                                size="sm" className="touch-target"
                                variant="outline"
                                disabled={act.isPending}
                                onClick={() =>
                                  act.mutate({ id: r.id, action: "license-review", body: { decision: "rejected" } })
                                }
                                data-testid={`button-reject-${r.id}`}
                              >
                                <ShieldX className="mr-1 h-3.5 w-3.5" />
                                Reject
                              </Button>
                            </>
                          )}
                          {r.status === "active" ? (
                            <Button
                              size="sm" className="touch-target"
                              variant="outline"
                              disabled={act.isPending}
                              onClick={() => act.mutate({ id: r.id, action: "status", body: { status: "suspended" } })}
                              data-testid={`button-suspend-${r.id}`}
                            >
                              <Pause className="mr-1 h-3.5 w-3.5" />
                              Suspend
                            </Button>
                          ) : (
                            <Button
                              size="sm" className="touch-target"
                              variant="outline"
                              disabled={act.isPending}
                              onClick={() => act.mutate({ id: r.id, action: "status", body: { status: "active" } })}
                              data-testid={`button-reactivate-${r.id}`}
                            >
                              <Play className="mr-1 h-3.5 w-3.5" />
                              Reactivate
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminPartners() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-admin-partnerhub-title">
            Partners
          </h1>
          <p className="text-sm text-muted-foreground">
            PartnerHub accounts, license review, and the pre-launch waitlist.
          </p>
        </div>
      </div>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts" data-testid="tab-partner-accounts">
            Accounts
          </TabsTrigger>
          <TabsTrigger value="waitlist" data-testid="tab-partner-waitlist">
            Waitlist
          </TabsTrigger>
        </TabsList>
        <TabsContent value="accounts" className="mt-4">
          <PartnerAccountsTab />
        </TabsContent>
        <TabsContent value="waitlist" className="mt-4">
          <AdminPartnerWaitlist embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
