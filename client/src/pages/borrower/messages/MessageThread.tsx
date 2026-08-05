import { useRef, useEffect } from "react";
import { CheckCheck, Clock, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { TeamMessage, DocumentRequestData } from "@shared/schema";
import { DocumentRequestCard } from "./DocumentRequestCard";
import { formatMessageTime, type TeamMember } from "./types";

export interface MessageThreadProps {
  messages: TeamMessage[];
  isLoading: boolean;
  selectedMember: TeamMember | null;
  memberId: string;
}

/**
 * The scrolling thread. Owns the scroll container so the pin-to-bottom effect
 * lives with the element it scrolls.
 */
export function MessageThread({ messages, isLoading, selectedMember, memberId }: MessageThreadProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
      <div className="space-y-4 max-w-3xl mx-auto">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <Skeleton className="h-16 w-64 rounded-lg" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12" data-testid="empty-conversation">
            <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium" data-testid="text-empty-title">Start a conversation</h3>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-empty-description">
              Send a message to {selectedMember?.name || "this team member"} to get started
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isFromCurrentUser = msg.senderId !== memberId;
            const showTimestamp = index === 0 ||
              (new Date(msg.createdAt!).getTime() - new Date(messages[index - 1].createdAt!).getTime()) > 300000;
            const isDocumentRequest = msg.messageType === 'document_request' && msg.documentRequestData;

            return (
              <div key={msg.id}>
                {showTimestamp && (
                  <div className="flex justify-center my-4">
                    <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                      {formatMessageTime(msg.createdAt!)}
                    </span>
                  </div>
                )}
                <div
                  className={`flex ${isFromCurrentUser ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${msg.id}`}
                >
                  <div className={`flex items-end gap-2 max-w-[80%] ${isFromCurrentUser ? "flex-row-reverse" : ""}`}>
                    {!isFromCurrentUser && selectedMember && (
                      <Avatar className="h-8 w-8 mb-1">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {selectedMember.initials}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    {isDocumentRequest ? (
                      <DocumentRequestCard
                        data={msg.documentRequestData as DocumentRequestData}
                        isFromCurrentUser={isFromCurrentUser}
                        messageId={msg.id}
                        applicationId={msg.applicationId}
                        partnerId={memberId}
                      />
                    ) : (
                      <div
                        className={`rounded-2xl px-4 py-2 ${
                          isFromCurrentUser
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted rounded-bl-md"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    )}
                  </div>
                </div>
                {isFromCurrentUser && !isDocumentRequest && (
                  <div className="flex justify-end mt-0.5 mr-1">
                    {msg.isRead ? (
                      <CheckCheck className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Clock className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </ScrollArea>
  );
}
