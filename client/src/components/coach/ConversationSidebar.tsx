import { MessageSquare, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TIER_CONFIG, type CoachConversation } from "./types";

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
}: {
  conversations: CoachConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        size="sm"
        className="touch-target w-full justify-start gap-2 mb-2"
        onClick={onNew}
        data-testid="button-new-conversation"
      >
        <Plus className="h-3.5 w-3.5" />
        New Conversation
      </Button>
      {conversations.map((c) => {
        const tier = c.readinessTier ? TIER_CONFIG[c.readinessTier] : null;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left p-2.5 rounded-lg text-sm transition-colors ${
              activeId === c.id
                ? "bg-primary/10 text-primary border border-primary/20"
                : "hover-elevate text-foreground"
            }`}
            data-testid={`button-conversation-${c.id}`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{c.title || "New Chat"}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 ml-5.5">
              {tier && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {tier.label}
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground">
                {new Date(c.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
