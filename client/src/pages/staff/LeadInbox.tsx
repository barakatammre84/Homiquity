import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Inbox, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Lead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  loanPurpose: string | null;
  propertyState: string | null;
  doNotContact: boolean;
  consentCapturedAt: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  rejected: "Not proceeding",
  duplicate: "Duplicate",
  unsubscribed: "Unsubscribed",
};

function contactName(lead: Lead) {
  return [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unnamed lead";
}

export default function LeadInbox() {
  const [search, setSearch] = useState("");
  const { data = [], isLoading, isError } = useQuery<Lead[]>({ queryKey: ["/api/leads"] });

  const leads = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data;
    return data.filter((lead) =>
      [contactName(lead), lead.email, lead.phone, lead.source, lead.loanPurpose, lead.propertyState]
        .some((value) => value?.toLowerCase().includes(query)),
    );
  }, [data, search]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <Inbox className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-lead-inbox-title">Lead Inbox</h1>
          <p className="text-sm text-muted-foreground">New mortgage inquiries awaiting a timely, consent-aware response.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Inbound leads {!isLoading && `(${data.length})`}</CardTitle>
            <CardDescription>Newest first. Do-not-contact records remain visible but must not be contacted.</CardDescription>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, contact, source…" aria-label="Search leads" data-testid="input-lead-search" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3" data-testid="lead-inbox-loading">
              {Array.from({ length: 5 }).map((_, index) => <Skeleton className="h-12 w-full" key={index} />)}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center" data-testid="lead-inbox-error">
              <AlertCircle className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">The lead inbox could not be loaded. Please refresh.</p>
            </div>
          ) : leads.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground" data-testid="lead-inbox-empty">
              {data.length ? "No leads match your search." : "No inbound leads yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Lead</TableHead><TableHead>Contact</TableHead><TableHead>Need</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead>Received</TableHead></TableRow></TableHeader>
                <TableBody>{leads.map((lead) => (
                  <TableRow key={lead.id} data-testid={`lead-row-${lead.id}`}>
                    <TableCell className="font-medium">{contactName(lead)}{lead.doNotContact && <Badge variant="destructive" className="ml-2">Do not contact</Badge>}</TableCell>
                    <TableCell><div>{lead.email || "—"}</div><div className="text-xs text-muted-foreground">{lead.phone || ""}</div></TableCell>
                    <TableCell>{lead.loanPurpose?.replaceAll("_", " ") || "—"}{lead.propertyState ? ` · ${lead.propertyState}` : ""}</TableCell>
                    <TableCell>{lead.source.replaceAll("_", " ")}</TableCell>
                    <TableCell><Badge variant="secondary">{STATUS_LABELS[lead.status] || lead.status}</Badge></TableCell>
                    <TableCell>{new Date(lead.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
