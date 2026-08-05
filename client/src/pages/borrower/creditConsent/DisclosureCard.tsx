import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Info, RefreshCw } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { DisclosureData, DraftData } from "./types";

export function DraftResumeAlert({ draft }: { draft: NonNullable<DraftData["draft"]> }) {
  return (
    <Alert className="border-border bg-info-subtle">
      <RefreshCw className="h-4 w-4 text-info" />
      <AlertDescription className="text-info">
        <strong>Resume Progress:</strong> You have a saved draft from{" "}
        {draft.lastSavedAt && formatDistanceToNow(new Date(draft.lastSavedAt), { addSuffix: true })}.
        Your progress has been restored automatically.
        {draft.expiresAt && (
          <span className="block text-sm mt-1 opacity-80">
            This draft expires {format(new Date(draft.expiresAt), "MMMM d, yyyy")}
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * The FCRA disclosure text itself, rendered verbatim from the server with its
 * version stamped above it — the version is what the recorded consent is tied
 * to, so it is displayed rather than assumed.
 */
export function DisclosureCard({ disclosure }: { disclosure: DisclosureData | undefined }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Credit Authorization Disclosure
        </CardTitle>
        <CardDescription>
          Please read the following disclosure carefully before providing your authorization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          <span>Version: {disclosure?.disclosureVersion}</span>
        </div>

        <ScrollArea className="h-64 rounded-md border p-4 bg-muted/30">
          <pre className="whitespace-pre-wrap text-sm font-sans" data-testid="text-disclosure-content">
            {disclosure?.disclosureText}
          </pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
