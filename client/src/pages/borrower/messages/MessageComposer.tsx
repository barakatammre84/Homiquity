import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { lintOutboundText } from "@shared/compliance/loCommsLint";
import { DocumentNeedsSummary } from "@/components/UploadDocumentDialog";
import { DocumentRequestDialog } from "./DocumentRequestDialog";

export interface MessageComposerProps {
  memberId: string;
  isStaff: boolean;
  recipientName: string;
  threadApplicationId: string | null;
}

/**
 * Outbound message composer and the LO-5 comms gate.
 *
 * The gate mirrors the server enforcement in POST /api/messages and is the
 * reason this lives in one small file: Tier 1 (Reg Z §1026.24 trigger terms)
 * hard-blocks the send, Tier 2 (Reg N §1014.3) warns and records a conscious
 * override. The lint itself is the shared, tested `lintOutboundText` — nothing
 * here re-implements or relaxes it.
 */
export function MessageComposer({
  memberId,
  isStaff,
  recipientName,
  threadApplicationId,
}: MessageComposerProps) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: {
      recipientId: string;
      message: string;
      applicationId?: string;
      acknowledgeComplianceWarning?: boolean;
    }) => {
      const response = await apiRequest("POST", "/api/messages", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", memberId] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
    },
    onError: () => {
      toast({ title: "Message not sent", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });

  // LO-5 comms lint: live feedback on STAFF outbound free text, mirroring the
  // server enforcement in POST /api/messages. Borrower (inbound) messages are
  // not advertising, so they're never linted. Deterministic — same text in,
  // same findings out.
  const outboundLint = isStaff && message.trim() ? lintOutboundText(message.trim()) : null;

  const handleSendMessage = () => {
    if (!message.trim() || !memberId) return;

    // Tier 1 (Reg Z §1026.24 trigger terms) is a hard block — route figures
    // through the Loan Estimate / Advisor Report, not a message.
    if (outboundLint?.blocked) {
      const blockMatch = outboundLint.hardBlockMatches[0] ?? outboundLint.triggerMatches[0];
      toast({
        title: outboundLint.hardBlockMatches.length > 0
          ? "This message can't be sent"
          : "Can't send loan figures in a message",
        description: blockMatch?.guidance,
        variant: "destructive",
      });
      return;
    }

    sendMessageMutation.mutate({
      recipientId: memberId,
      message: message.trim(),
      applicationId: threadApplicationId || undefined,
      // Tier 2 (Reg N §1014.3) warns with the banner visible above; sending
      // with it shown is a conscious, server-logged override.
      acknowledgeComplianceWarning: outboundLint?.requiresOverride ? true : undefined,
    });
    setMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="border-t bg-background p-4">
      {!isStaff && (
        <DocumentNeedsSummary applicationId={threadApplicationId} recipientId={memberId} />
      )}
      {outboundLint && (outboundLint.blocked || outboundLint.requiresOverride) && (
        <Alert
          variant={outboundLint.blocked ? "destructive" : "default"}
          className="mb-3 max-w-3xl mx-auto"
          data-testid="comms-lint-alert"
        >
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            {outboundLint.blocked ? (
              <>
                <span className="font-medium">
                  {outboundLint.hardBlockMatches.length > 0
                    ? "This message can't be sent."
                    : "Loan figures can't go in a message."}
                </span>{" "}
                {(outboundLint.hardBlockMatches[0] ?? outboundLint.triggerMatches[0])?.guidance}
              </>
            ) : (
              <>
                <span className="font-medium">Compliance check:</span>{" "}
                {outboundLint.promiseMatches[0]?.guidance}
                {outboundLint.promiseMatches[0]?.suggestedRewrite && (
                  <span className="mt-1 block italic">
                    Try: “{outboundLint.promiseMatches[0].suggestedRewrite}”
                  </span>
                )}
              </>
            )}
          </AlertDescription>
        </Alert>
      )}
      <div className="flex items-center gap-2 max-w-3xl mx-auto">
        {isStaff && (
          <DocumentRequestDialog
            recipientId={memberId}
            recipientName={recipientName}
            applicationId={threadApplicationId}
          />
        )}
        <Input
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          className="flex-1"
          data-testid="input-message"
        />
        <Button
          size="icon"
          aria-label={outboundLint?.requiresOverride ? "Send anyway (override compliance warning)" : "Send message"}
          onClick={handleSendMessage}
          disabled={!message.trim() || sendMessageMutation.isPending || (outboundLint?.blocked ?? false)}
          data-testid="button-send"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
