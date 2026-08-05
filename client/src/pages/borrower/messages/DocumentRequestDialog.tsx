import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileText, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { DocumentRequestData } from "@shared/schema";
import { DOCUMENT_TYPES } from "./types";

// Document Request Dialog Component
export function DocumentRequestDialog({
  recipientId,
  recipientName
}: {
  recipientId: string;
  recipientName: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();

  const sendDocRequestMutation = useMutation({
    mutationFn: async (data: {
      recipientId: string;
      message: string;
      messageType: string;
      documentRequestData: DocumentRequestData;
    }) => {
      const response = await apiRequest("POST", "/api/messages", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", recipientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
      toast({ title: "Document requested", description: "Your request has been sent to the team." });
      setOpen(false);
      setSelectedDocType("");
      setDescription("");
    },
    onError: () => {
      toast({ title: "Request failed", description: "Could not send the document request. Please try again.", variant: "destructive" });
    },
  });

  const handleSendRequest = () => {
    if (!selectedDocType) return;

    const docType = DOCUMENT_TYPES.find(d => d.value === selectedDocType);
    if (!docType) return;

    const documentRequestData: DocumentRequestData = {
      documentType: selectedDocType,
      documentName: docType.label,
      description: description || undefined,
      status: "pending",
    };

    sendDocRequestMutation.mutate({
      recipientId,
      message: `Document Request: ${docType.label}`,
      messageType: "document_request",
      documentRequestData,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Request document" data-testid="button-request-doc">
          <FileUp className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Document</DialogTitle>
          <DialogDescription>
            Request a document from {recipientName}. They'll receive a notification to upload it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="doc-type">Document Type</Label>
            <Select value={selectedDocType} onValueChange={setSelectedDocType}>
              <SelectTrigger data-testid="select-doc-type">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((doc) => (
                  <SelectItem key={doc.value} value={doc.value}>
                    <div className="flex items-center gap-2">
                      <span>{doc.label}</span>
                      <Badge variant="secondary" className="text-xs">{doc.category}</Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Additional Notes (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Any specific requirements or notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="input-doc-description"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-request">
            Cancel
          </Button>
          <Button
            onClick={handleSendRequest}
            disabled={!selectedDocType || sendDocRequestMutation.isPending}
            data-testid="button-send-request"
          >
            <FileText className="h-4 w-4 mr-2" />
            Send Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
