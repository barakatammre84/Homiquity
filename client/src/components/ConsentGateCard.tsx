import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, consentKeys, consentTemplateKeys } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ShieldCheck } from "lucide-react";

interface ConsentTemplate {
  id: string;
  consentType: string;
  version: string;
  title: string;
  shortDescription: string | null;
  fullText: string;
  regulatoryReference: string | null;
}

/**
 * Borrower-facing consent capture for a gated document/action. Shown when an
 * endpoint returns 403 CONSENT_REQUIRED: fetches the active versioned
 * template, displays the full legal text, and records the acknowledgment
 * through /api/consents (which captures IP, user agent, and a SHA-256
 * content hash server-side). Calls onConsented so the caller can retry.
 */
export function ConsentGateCard({
  applicationId,
  consentType,
  onConsented,
}: {
  applicationId: string;
  consentType: string;
  onConsented: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [acknowledged, setAcknowledged] = useState(false);

  // No queryFn: the key IS the request. The default transport builds the URL
  // from it via buildQueryUrl, so the trailing object becomes `?type=...` and
  // the cache key and the fetched URL cannot drift apart. Built from the factory
  // so this and TaxReturnInsightCard address the endpoint identically.
  const { data: templates, isLoading } = useQuery<ConsentTemplate[]>({
    queryKey: consentTemplateKeys.byType(consentType),
  });

  const template = templates?.[0];

  const consentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/consents", {
        applicationId,
        templateId: template?.id,
        templateVersion: template?.version,
        consentType,
        consentGiven: true,
        consentMethod: "click",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consentKeys.all() });
      toast({ title: "Consent recorded", description: "Thank you — loading your document now." });
      onConsented();
    },
    onError: (error: Error) => {
      toast({ title: "Could not record consent", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <Card className="max-w-2xl w-full" data-testid="consent-gate-loading">
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!template) {
    return (
      <Card className="max-w-md w-full" data-testid="consent-gate-missing-template">
        <CardHeader>
          <CardTitle>Disclosure unavailable</CardTitle>
          <CardDescription>
            The required disclosure could not be loaded. Please contact support before proceeding.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl w-full" data-testid="consent-gate-card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 rounded-lg p-2">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg" data-testid="text-consent-title">{template.title}</CardTitle>
            {template.shortDescription && (
              <CardDescription>{template.shortDescription}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className="h-56 rounded-md border p-4">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-consent-body">
            {template.fullText}
          </p>
        </ScrollArea>

        <label className="flex items-start gap-3 cursor-pointer" data-testid="label-consent-ack">
          <Checkbox
            checked={acknowledged}
            onCheckedChange={(c) => setAcknowledged(c === true)}
            className="mt-0.5"
            data-testid="checkbox-consent-ack"
          />
          <span className="text-sm text-muted-foreground leading-relaxed">
            I have read and agree to the {template.title}
            {template.regulatoryReference ? ` (${template.regulatoryReference})` : ""}. Version {template.version}.
          </span>
        </label>

        <Button
          className="w-full gap-2"
          disabled={!acknowledged || consentMutation.isPending}
          onClick={() => consentMutation.mutate()}
          data-testid="button-consent-accept"
        >
          <ShieldCheck className="h-4 w-4" />
          {consentMutation.isPending ? "Recording…" : "Agree and Continue"}
        </Button>
      </CardContent>
    </Card>
  );
}
