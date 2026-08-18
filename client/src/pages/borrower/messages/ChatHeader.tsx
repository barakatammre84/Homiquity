import { Link } from "wouter";
import { ArrowLeft, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getPresenceColor, getPresenceLabel } from "@/lib/formatters";
import { ROLE_DISPLAY_NAMES, type TeamMember } from "./types";

export function ChatHeader({
  isLoading,
  selectedMember,
}: {
  isLoading: boolean;
  selectedMember: TeamMember | null;
}) {
  return (
    <div className="border-b bg-background">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back" data-testid="button-back">
            <Link href="/messages">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          {isLoading || !selectedMember ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div>
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <Avatar className="h-10 w-10" data-testid="avatar-chat-member">
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {selectedMember.initials}
                  </AvatarFallback>
                </Avatar>
                {selectedMember.presenceStatus && (
                  <Circle
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-current ${getPresenceColor(selectedMember.presenceStatus)}`}
                    data-testid="status-chat-member"
                  />
                )}
              </div>
              <div>
                <h2 className="font-semibold" data-testid="text-chat-member-name">{selectedMember.name}</h2>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span data-testid="text-chat-member-role">{ROLE_DISPLAY_NAMES[selectedMember.role] || selectedMember.role}</span>
                  {selectedMember.presenceStatus && (
                    <>
                      <span className="text-xs">·</span>
                      <span className={`text-xs ${getPresenceColor(selectedMember.presenceStatus)}`} data-testid="text-presence-status">
                        {getPresenceLabel(selectedMember.presenceStatus)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
