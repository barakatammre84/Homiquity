import { Link } from "wouter";
import { Circle, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { getPresenceColor } from "@/lib/formatters";
import { formatMessageTime, ROLE_DISPLAY_NAMES, type ListEntry } from "./types";

export interface ConversationListProps {
  isStaff: boolean;
  entries: ListEntry[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}

/** The no-thread-selected view: premium header plus the conversation roster. */
export function ConversationList({
  isStaff,
  entries,
  isLoading,
  isError,
  error,
  onRetry,
}: ConversationListProps) {
  return (
    <>
      {/* Premium Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/90">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />

        <div className="relative px-6 py-8">
          <div className="flex items-center gap-2 text-primary-foreground/80 mb-2">
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Communication</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Messages
          </h1>
          <p className="mt-1 text-primary-foreground/80">
            {isStaff ? "Secure messages with your borrowers" : "Chat with your mortgage team"}
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8 -mt-6">
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle>{isStaff ? "Conversations" : "Your Team"}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isError ? (
              <div className="p-4">
                <QueryErrorState
                  error={error}
                  onRetry={onRetry}
                  title="We couldn't load your messages"
                  data-testid="messages-error"
                />
              </div>
            ) : isLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground" data-testid="empty-team">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                {isStaff ? (
                  <>
                    <p>No borrower conversations yet</p>
                    <p className="text-sm mt-1">When a borrower messages you, the thread appears here</p>
                  </>
                ) : (
                  <>
                    <p>No team members assigned yet</p>
                    <p className="text-sm mt-1">Team members will appear here once assigned to your loan</p>
                  </>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {entries.map(({ member, lastMessage, unreadCount }) => {
                  return (
                    <Link
                      key={member.id}
                      href={`/messages/${member.id}`}
                      data-testid={`link-conversation-${member.id}`}
                    >
                      <div
                        className="flex items-center gap-4 p-4 cursor-pointer transition-colors hover-elevate"
                      >
                        <div className="relative">
                          <Avatar className="h-12 w-12" data-testid={`avatar-${member.id}`}>
                            <AvatarFallback className="bg-primary/10 text-primary font-medium">
                              {member.initials}
                            </AvatarFallback>
                          </Avatar>
                          {member.presenceStatus && (
                            <Circle
                              className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 fill-current ${getPresenceColor(member.presenceStatus)}`}
                              data-testid={`status-indicator-${member.id}`}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium" data-testid={`text-member-name-${member.id}`}>{member.name}</span>
                            {lastMessage && (
                              <span className="text-xs text-muted-foreground" data-testid={`text-timestamp-${member.id}`}>
                                {formatMessageTime(lastMessage.createdAt!)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs shrink-0" data-testid={`badge-role-${member.id}`}>
                              {ROLE_DISPLAY_NAMES[member.role] || member.role}
                            </Badge>
                            {lastMessage && (
                              <span className="text-sm text-muted-foreground truncate" data-testid={`text-last-message-${member.id}`}>
                                {lastMessage.message}
                              </span>
                            )}
                            {unreadCount > 0 && (
                              <Badge className="ml-auto shrink-0" data-testid={`badge-unread-${member.id}`}>
                                {unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
