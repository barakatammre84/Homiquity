import { useEffect, useRef } from "react";
import { AlertCircle, RefreshCw, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMessage, PendingUserMessage, StreamingMessage, TypingIndicator } from "./ChatMessage";
import type { CoachTurnState } from "./useCoachStream";
import type { CoachMessage } from "./types";

// Persisted messages come from the conversation query; the in-flight turn
// (pending user message, streamed reply, errors) renders as an overlay after
// them — the user always sees their message the instant they hit send.
export function MessageList({
  messages,
  turn,
  onRetry,
  onDismissError,
}: {
  messages: CoachMessage[];
  turn: CoachTurnState;
  onRetry: () => void;
  onDismissError: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, turn.streamingText, turn.status]);

  // Once the conversation refetches mid-turn (new conversations fetch as soon
  // as `meta` assigns an id), the user's message may already be in the query
  // data — don't render it twice.
  const last = messages[messages.length - 1];
  const showPendingUser =
    turn.pendingUserMessage !== null &&
    !(last && last.role === "user" && last.content === turn.pendingUserMessage);

  const turnActive = turn.status !== "idle";
  const showTyping =
    (turn.status === "connecting" || turn.status === "streaming" || turn.status === "finalizing") &&
    turn.streamingText.length === 0 &&
    !turn.lintReplaced;

  return (
    <div className="flex-1 overflow-y-auto p-4" data-testid="chat-messages-container">
      <div className="mx-auto max-w-3xl space-y-4">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {turnActive && showPendingUser && <PendingUserMessage content={turn.pendingUserMessage!} />}

        {turnActive && turn.streamingText.length > 0 && <StreamingMessage text={turn.streamingText} />}

        {showTyping && <TypingIndicator />}

        {turnActive && turn.lintReplaced && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pl-11" data-testid="lint-replaced-note">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            <span>A reply was revised to meet communication rules.</span>
          </div>
        )}

        {turn.status === "error" && turn.error && (
          <div
            className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3"
            data-testid="chat-turn-error"
          >
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{turn.error.message}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              {turn.error.retryable && (
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={onRetry} data-testid="button-retry-turn">
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Dismiss" onClick={onDismissError} data-testid="button-dismiss-error">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>
    </div>
  );
}
