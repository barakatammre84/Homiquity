import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { getPresenceColor, getPresenceLabel } from "@/lib/formatters";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  ArrowLeft,
  Circle,
  MessageCircle,
  Clock,
  CheckCheck,
  FileText,
  Upload,
  AlertCircle,
  CheckCircle2,
  FileUp,
  ShieldAlert,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { isStaffRole } from "@shared/schema";
import { lintOutboundText } from "@shared/compliance/loCommsLint";
import type { TeamMessage, DocumentRequestData } from "@shared/schema";
import {
  UploadDocumentDialog,
  DocumentNeedsSummary,
  toUploadableDocumentType,
} from "@/components/UploadDocumentDialog";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string | null;
  profileImageUrl: string | null;
  initials: string;
  /** Absent for partners resolved from conversations (no live presence). */
  presenceStatus?: 'online' | 'away' | 'offline';
}

interface ConversationData {
  partnerId: string;
  lastMessage: TeamMessage;
  unreadCount: number;
  partner: TeamMember | null;
}

// Document types for requesting
const DOCUMENT_TYPES = [
  { value: "paystub", label: "Recent Pay Stubs", category: "Income" },
  { value: "w2", label: "W-2 Forms", category: "Income" },
  { value: "tax_return_1040", label: "Tax Returns (1040)", category: "Income" },
  { value: "bank_statement_checking", label: "Checking Account Statements", category: "Assets" },
  { value: "bank_statement_savings", label: "Savings Account Statements", category: "Assets" },
  { value: "drivers_license", label: "Driver's License", category: "Identity" },
  { value: "purchase_contract", label: "Purchase Contract", category: "Property" },
  { value: "homeowners_insurance_binder", label: "Homeowners Insurance", category: "Property" },
];

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  admin: "Tech/Ops Lead",
  lo: "Loan Officer",
  loa: "Loan Officer Assistant",
  processor: "Processor",
  underwriter: "Underwriter",
  closer: "Closer/Funder",
  aspiring_owner: "Aspiring Owner",
  active_buyer: "Active Buyer",
};

function formatMessageTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  
  if (days === 0) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } else if (days === 1) {
    return "Yesterday";
  } else if (days < 7) {
    return d.toLocaleDateString("en-US", { weekday: "short" });
  } else {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

// Document Request Dialog Component
function DocumentRequestDialog({ 
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

// Document Request Message Card Component
function DocumentRequestCard({
  data,
  isFromCurrentUser,
  messageId,
  applicationId,
  partnerId,
}: {
  data: DocumentRequestData;
  isFromCurrentUser: boolean;
  messageId: string;
  applicationId?: string | null;
  partnerId: string;
}) {
  const getStatusBadge = () => {
    switch (data.status) {
      case "pending":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      case "submitted":
        return <Badge className="bg-info-subtle text-info gap-1"><Upload className="h-3 w-3" />Submitted</Badge>;
      case "approved":
        return <Badge className="bg-success-subtle text-success-subtle-foreground gap-1"><CheckCircle2 className="h-3 w-3" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Rejected</Badge>;
      default:
        return null;
    }
  };

  const canUpload = !isFromCurrentUser && (data.status === "pending" || data.status === "rejected");

  return (
    <Card className={`max-w-sm ${isFromCurrentUser ? 'bg-primary/5' : 'bg-muted/50'}`}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-medium text-sm">{data.documentName}</span>
              {getStatusBadge()}
            </div>
            {data.description && (
              <p className="text-xs text-muted-foreground mb-2">{data.description}</p>
            )}
            {canUpload && (
              <UploadDocumentDialog
                applicationId={applicationId}
                defaultDocumentType={toUploadableDocumentType(data.documentType)}
                requestMessageId={messageId}
                confirmToRecipientId={partnerId}
                trigger={
                  <Button size="sm" className="w-full mt-2" data-testid="button-upload-doc">
                    <Upload className="h-4 w-4 mr-2" />
                    {data.status === "rejected" ? "Re-upload Document" : "Upload Document"}
                  </Button>
                }
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Messages() {
  const params = useParams<{ memberId?: string }>();
  const memberId = params.memberId;
  const [message, setMessage] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
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

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: {
      recipientId: string;
      message: string;
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
  const listEntries: { member: TeamMember; lastMessage?: TeamMessage; unreadCount: number }[] = (() => {
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

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

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

  // If no member selected, show conversation list
  if (!memberId) {
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
              {isErrorList ? (
                <div className="p-4">
                  <QueryErrorState
                    error={listErrorObj}
                    onRetry={() => refetchList()}
                    title="We couldn't load your messages"
                    data-testid="messages-error"
                  />
                </div>
              ) : isLoadingList ? (
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
              ) : listEntries.length === 0 ? (
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
                  {listEntries.map(({ member, lastMessage, unreadCount }) => {
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

  // Chat view with selected member
  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="border-b bg-background">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Link href="/messages">
              <Button variant="ghost" size="icon" aria-label="Back" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            {isLoadingTeam || !selectedMember ? (
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

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4 max-w-3xl mx-auto">
          {isLoadingMessages ? (
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
                          partnerId={memberId!}
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

      {/* Message Input */}
      <div className="border-t bg-background p-4">
        {!isStaff && (
          <DocumentNeedsSummary applicationId={threadApplicationId} recipientId={memberId!} />
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
              recipientId={memberId!}
              recipientName={selectedMember?.name || "this borrower"}
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
    </div>
  );
}
