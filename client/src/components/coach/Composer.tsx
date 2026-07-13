import { useRef, useState } from "react";
import { AlertCircle, ChevronRight, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PresalesDisclaimer } from "@/components/PresalesDisclaimer";
import type { CoachUsage } from "./types";

function SuggestedPrompts({
  suggestions,
  onSelect,
  disabled,
}: {
  suggestions: string[];
  onSelect: (msg: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 px-1 pb-2" data-testid="suggested-prompts">
      {suggestions.map((s, i) => (
        <Button
          key={i}
          variant="outline"
          size="sm"
          className="text-xs gap-1.5 h-auto py-1.5"
          onClick={() => onSelect(s)}
          disabled={disabled}
          data-testid={`button-suggestion-${i}`}
        >
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          {s}
        </Button>
      ))}
    </div>
  );
}

function UsageMeter({ usage }: { usage: CoachUsage }) {
  if (!usage.isLimited && usage.remaining > 10) return null;

  return (
    <div className="flex items-center gap-2 px-1 pb-1" data-testid="usage-meter">
      {usage.isLimited ? (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          <span>Daily limit reached. Resets tomorrow.</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{usage.remaining} messages remaining today</span>
        </div>
      )}
    </div>
  );
}

export function Composer({
  onSend,
  busy,
  usage,
  suggestions,
}: {
  onSend: (message: string) => void;
  busy: boolean;
  usage: CoachUsage | undefined;
  suggestions: string[] | undefined;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const limited = !!usage?.isLimited;
  const disabled = busy || limited;

  const submit = (msg?: string) => {
    const text = (msg ?? value).trim();
    if (!text || disabled) return;
    setValue("");
    onSend(text);
    textareaRef.current?.focus();
  };

  return (
    <div className="border-t p-3">
      <div className="max-w-3xl mx-auto space-y-2">
        {suggestions && suggestions.length > 0 && !busy && (
          <SuggestedPrompts suggestions={suggestions} onSelect={submit} disabled={disabled} />
        )}
        {usage && <UsageMeter usage={usage} />}
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={limited ? "Daily limit reached. Try again tomorrow." : "Ask about your mortgage readiness, documents, credit..."}
            className="resize-none min-h-[44px] max-h-[120px] text-sm"
            rows={1}
            disabled={disabled}
            data-testid="input-coach-message"
          />
          <Button
            size="icon"
            aria-label="Send"
            onClick={() => submit()}
            disabled={!value.trim() || disabled}
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <PresalesDisclaimer className="border-0 bg-transparent p-0 pt-1 text-[10px] leading-snug" />
      </div>
    </div>
  );
}
