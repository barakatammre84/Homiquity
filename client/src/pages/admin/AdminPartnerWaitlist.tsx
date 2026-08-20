import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { friendlyApiError } from "@/lib/errorMessage";
import { Handshake, Search, Mail, AlertCircle, Send } from "lucide-react";
import { format } from "date-fns";

interface PartnerWaitlistEntry {
  id: string;
  name: string;
  email: string;
  company: string | null;
  partnerType: string;
  message: string | null;
  invitedAt: string | null;
  createdAt: string | null;
}

const PARTNER_TYPE_LABELS: Record<string, string> = {
  loan_officer: "Loan Officer",
  lender: "Lender / AE",
  cpa: "CPA / Accountant",
  real_estate_agent: "Real Estate Agent",
  other: "Other",
};

export default function AdminPartnerWaitlist({ embedded = false }: { embedded?: boolean }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data, isLoading, isError } = useQuery<PartnerWaitlistEntry[]>({
    queryKey: ["/api/admin/partner-waitlist"],
  });

  // PH-1 waitlist → activation conversion: emails a /partners/join link and
  // stamps invited_at so the queue shows who has already been converted.
  const invite = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/partner-waitlist/${id}/invite`, {});
      return res.json();
    },
    onSuccess: (result: { emailSent: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-waitlist"] });
      toast({
        title: result.emailSent ? "Invite sent" : "Marked invited",
        description: result.emailSent
          ? "They received a link to create their partner account."
          : "Email delivery is not configured in this environment; the entry is marked invited.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Couldn't send invite",
        description: friendlyApiError(err, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const entries = useMemo(() => {
    const rows = data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.company ?? "").toLowerCase().includes(q) ||
        (PARTNER_TYPE_LABELS[r.partnerType] ?? r.partnerType).toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className={embedded ? "space-y-6" : "mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6"}>
      {!embedded && (
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Handshake className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-admin-partners-title">
              Partner Waitlist
            </h1>
            <p className="text-sm text-muted-foreground">
              Loan officers, lenders, CPAs, and agents who asked to partner — your pre-launch recruitment queue.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">
              Signups{" "}
              {!isLoading && !isError && (
                <span className="font-normal text-muted-foreground" data-testid="text-partners-count">
                  ({data?.length ?? 0})
                </span>
              )}
            </CardTitle>
            <CardDescription>Newest first.</CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, company, type…"
              className="pl-9"
              aria-label="Search partner waitlist"
              data-testid="input-partners-search"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3" data-testid="partners-loading">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center" data-testid="partners-error">
              <AlertCircle className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Couldn't load the partner waitlist. Please refresh.</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center" data-testid="partners-empty">
              <Handshake className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {data && data.length > 0 ? "No partners match your search." : "No partner signups yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Invite</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((r) => (
                    <TableRow key={r.id} data-testid={`row-partner-${r.id}`}>
                      <TableCell className="font-medium text-foreground">
                        {r.name}
                        {r.message && (
                          <p className="mt-0.5 max-w-md text-xs font-normal text-muted-foreground" title={r.message}>
                            {r.message.length > 120 ? `${r.message.slice(0, 120)}…` : r.message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" data-testid={`badge-type-${r.id}`}>
                          {PARTNER_TYPE_LABELS[r.partnerType] ?? r.partnerType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.company || "—"}</TableCell>
                      <TableCell>
                        <a
                          href={`mailto:${r.email}`}
                          className="inline-flex items-center gap-1.5 text-primary hover:underline"
                          data-testid={`link-email-${r.id}`}
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {r.email}
                        </a>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {r.createdAt ? format(new Date(r.createdAt), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.invitedAt ? (
                          <span className="text-xs text-muted-foreground" data-testid={`text-invited-${r.id}`}>
                            Invited {format(new Date(r.invitedAt), "MMM d")}
                          </span>
                        ) : (
                          <Button
                            size="sm" className="touch-target"
                            variant="outline"
                            disabled={invite.isPending}
                            onClick={() => invite.mutate(r.id)}
                            data-testid={`button-invite-${r.id}`}
                          >
                            <Send className="mr-1 h-3.5 w-3.5" />
                            Invite
                          </Button>
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
    </div>
  );
}
