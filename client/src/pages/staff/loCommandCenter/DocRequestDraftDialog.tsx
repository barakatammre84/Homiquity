import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileUp } from "lucide-react";

/**
 * LO-M17: the one-click document-request draft. The server pre-fills the ask
 * from the file's outstanding conditions (alias-aware, rejected uploads don't
 * satisfy); the LO reviews, unchecks anything, optionally adds a note, and
 * approves. Each approved item sends through the EXISTING
 * POST /api/messages document_request path — this dialog adds no new send
 * surface, so the staff gate, borrower notification, and content-free email
 * behavior are inherited unchanged.
 */

export interface DocRequestDraftItem {
  documentType: string;
  documentName: string;
  conditionTitles: string[];
}

interface DraftResponse {
  applicationId: string;
  recipientId: string;
  items: DocRequestDraftItem[];
}

export function DocRequestDraftDialog({ applicationId }: { applicationId: string }) {
  const [open, setOpen] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: draft, isLoading } = useQuery<DraftResponse>({
    queryKey: ["/api/staff/applications", applicationId, "doc-request-draft"],
    enabled: open,
  });

  const selectedItems = (draft?.items ?? []).filter((i) => !excluded.has(i.documentType));

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      // One document_request per approved item — the shape the borrower's
      // Documents flow consumes. Sequential so a mid-loop failure reports how
      // far it got instead of a scatter of racing errors.
      for (const item of selectedItems) {
        await apiRequest("POST", "/api/messages", {
          recipientId: draft.recipientId,
          applicationId: draft.applicationId,
          message: `Document Request: ${item.documentName}`,
          messageType: "document_request",
          documentRequestData: {
            documentType: item.documentType,
            documentName: item.documentName,
            description: note.trim() || `Needed to clear: ${item.conditionTitles.join("; ")}`,
            status: "pending",
          },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff/applications", applicationId, "cockpit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff/applications", applicationId, "doc-request-draft"] });
      toast({
        title: "Document requests sent",
        description: `${selectedItems.length} request${selectedItems.length === 1 ? "" : "s"} sent to the borrower.`,
      });
      setOpen(false);
      setExcluded(new Set());
      setNote("");
    },
    onError: () => {
      toast({
        title: "Send failed",
        description: "Not all requests were sent — reopen the draft; already-sent items will no longer be listed once uploaded.",
        variant: "destructive",
      });
    },
  });

  const toggle = (documentType: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(documentType)) next.delete(documentType);
      else next.add(documentType);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-doc-request-draft">
          <FileUp className="mr-1 h-4 w-4" aria-hidden="true" />
          Draft doc request
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-doc-request-draft">
        <DialogHeader>
          <DialogTitle>Document request draft</DialogTitle>
        </DialogHeader>
        {isLoading || !draft ? (
          <Skeleton className="h-24 w-full" data-testid="skeleton-doc-draft" />
        ) : draft.items.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="text-no-missing-docs">
            Nothing to request — every outstanding condition either has a matching upload or
            isn&apos;t a document ask.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pre-filled from this file&apos;s outstanding conditions. Uncheck anything you
              don&apos;t want to ask for — nothing sends until you approve.
            </p>
            <ul className="space-y-2" data-testid="list-draft-items">
              {draft.items.map((item) => (
                <li key={item.documentType} className="flex items-start gap-2" data-testid={`draft-item-${item.documentType}`}>
                  <Checkbox
                    id={`draft-${item.documentType}`}
                    checked={!excluded.has(item.documentType)}
                    onCheckedChange={() => toggle(item.documentType)}
                    data-testid={`checkbox-${item.documentType}`}
                  />
                  <label htmlFor={`draft-${item.documentType}`} className="min-w-0 cursor-pointer">
                    <span className="block text-sm font-medium">{item.documentName}</span>
                    <span className="block text-xs text-muted-foreground">
                      Clears: {item.conditionTitles.join("; ")}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note to the borrower (replaces the per-item default)"
              maxLength={500}
              data-testid="input-draft-note"
            />
            <Button
              className="w-full"
              disabled={selectedItems.length === 0 || sendMutation.isPending}
              onClick={() => sendMutation.mutate()}
              data-testid="button-send-draft"
            >
              {sendMutation.isPending
                ? "Sending…"
                : `Send ${selectedItems.length} request${selectedItems.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
