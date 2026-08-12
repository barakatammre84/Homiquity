import { useEffect } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { isStaffRole } from "@shared/roles";
import type { TeamMessage } from "@shared/schema";
import type { ConversationData, ListEntry, TeamMember } from "./messages/types";
import { ConversationList } from "./messages/ConversationList";
import { ChatHeader } from "./messages/ChatHeader";
import { MessageThread } from "./messages/MessageThread";
import { MessageComposer } from "./messages/MessageComposer";

export default function Messages() {
  const params = useParams<{ memberId?: string }>();
  const memberId = params.memberId;
  const { user } = useAuth();
  const isStaff = isStaffRole(user?.role || "");

  // Presence heartbeat - update every 30 seconds
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        await apiRequest("POST", "/api/presence/heartbeat", {});
      } catch (error) {
        // Silently fail - presence is not critical
      }
    };

    // Send immediately on mount
    sendHeartbeat();

    // Then every 30 seconds
    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch team members with real-time updates (every 30 seconds for presence)
  const {
    data: teamMembers = [],
    isLoading: isLoadingTeam,
    isError: isErrorTeam,
    error: teamErrorObj,
    refetch: refetchTeam,
  } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
    refetchInterval: 30000, // Refresh presence every 30 seconds
  });

  // Fetch conversations for list view with real-time updates
  const {
    data: conversations = [],
    isLoading: isLoadingConversations,
    isError: isErrorConversations,
    error: conversationsErrorObj,
    refetch: refetchConversations,
  } = useQuery<ConversationData[]>({
    queryKey: ["/api/messages/conversations"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch messages for the selected team member with real-time updates
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<TeamMessage[]>({
    queryKey: ["/api/messages", memberId],
    enabled: !!memberId,
    refetchInterval: 3000, // Refresh every 3 seconds for active chats
  });

  // Opening a conversation marks its messages read server-side (see GET
  // /api/messages/:otherUserId), so refresh the shell badge counts once per
  // open rather than waiting for the 30s poll. Keyed on memberId so it fires
  // on open, not on every 3s refetch.
  useEffect(() => {
    if (memberId) {
      queryClient.invalidateQueries({ queryKey: ["/api/shell/badges"] });
    }
  }, [memberId]);

  // The loan file this thread is about — messages are stamped server-side, so
  // the newest stamped message is authoritative (drives the needs summary).
  const threadApplicationId = [...messages].reverse().find((m) => m.applicationId)?.applicationId ?? null;

  // Find the chat partner: assigned team member first, else resolve from the
  // conversation itself (this is how staff see their borrower threads).
  const conversationPartner = memberId
    ? conversations.find(c => c.partnerId === memberId)?.partner || null
    : null;
  const selectedMember = memberId
    ? teamMembers.find(m => m.id === memberId) || conversationPartner
    : null;

  // List entries, role-aware:
  // - staff: their conversations (borrower threads), newest first
  // - borrower: assigned team (message or not) + any other existing threads
  const listEntries: ListEntry[] = (() => {
    const fromConversations = conversations
      .filter(c => c.partner)
      .map(c => ({ member: c.partner as TeamMember, lastMessage: c.lastMessage, unreadCount: c.unreadCount }));
    if (isStaff) {
      return fromConversations.sort((a, b) =>
        new Date(b.lastMessage?.createdAt ?? 0).getTime() - new Date(a.lastMessage?.createdAt ?? 0).getTime()
      );
    }
    const teamIds = new Set(teamMembers.map(m => m.id));
    const teamEntries = teamMembers.map(m => {
      const conv = conversations.find(c => c.partnerId === m.id);
      return { member: m, lastMessage: conv?.lastMessage, unreadCount: conv?.unreadCount ?? 0 };
    });
    return [...teamEntries, ...fromConversations.filter(e => !teamIds.has(e.member.id))];
  })();
  const isLoadingList = isStaff ? isLoadingConversations : isLoadingTeam;
  const isErrorList = isStaff ? isErrorConversations : isErrorTeam;
  const listErrorObj = isStaff ? conversationsErrorObj : teamErrorObj;
  const refetchList = isStaff ? refetchConversations : refetchTeam;

  // If no member selected, show conversation list
  if (!memberId) {
    return (
      <ConversationList
        isStaff={isStaff}
        entries={listEntries}
        isLoading={isLoadingList}
        isError={isErrorList}
        error={listErrorObj}
        onRetry={() => refetchList()}
      />
    );
  }

  // Chat view with selected member
  return (
    <div className="flex flex-col h-full">
      <ChatHeader isLoading={isLoadingTeam} selectedMember={selectedMember} />

      <MessageThread
        messages={messages}
        isLoading={isLoadingMessages}
        selectedMember={selectedMember}
        memberId={memberId}
      />

      <MessageComposer
        memberId={memberId}
        isStaff={isStaff}
        recipientName={selectedMember?.name || "this borrower"}
        threadApplicationId={threadApplicationId}
      />
    </div>
  );
}
