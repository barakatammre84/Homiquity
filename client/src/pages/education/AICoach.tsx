import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, Sparkles, WifiOff } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { usePageView, useTrackActivity, useTrackCoachSession } from "@/hooks/useActivityTracker";
import { useCoachStream } from "@/components/coach/useCoachStream";
import { MessageList } from "@/components/coach/MessageList";
import { Composer } from "@/components/coach/Composer";
import { CapturePanel } from "@/components/coach/CapturePanel";
import { ConversationSidebar } from "@/components/coach/ConversationSidebar";
import { InsightsBanner, WelcomeState } from "@/components/coach/WelcomeState";
import { ActionPlanPanel, DocumentChecklistPanel, ReadinessPanel } from "@/components/coach/panels";
import type {
  ActionPlanItem,
  CoachConversation,
  CoachInsight,
  CoachMessage,
  CoachProfile,
  CoachUsage,
  DocumentRequirement,
} from "@/components/coach/types";

// The AI Homebuyer Coach — streaming chat (SSE via useCoachStream) with a live
// "Pre-App Profile" capture panel. Everything the model captures through the
// record_intake tool is auto-saved to the borrower's draft application
// server-side and surfaced here as a visible trail.

function getSourceContext(): { banner: string; autoMessage: string } | null {
  const params = new URLSearchParams(window.location.search);
  const source = params.get("source");
  const context = params.get("context");
  const type = params.get("type");

  if (source === "va" || type === "va" || context === "va") {
    return {
      banner: "VA Loan Guidance",
      autoMessage: "I'm a veteran and I'd like to explore VA loan options. Can you help me understand my eligibility and benefits?",
    };
  }
  if (source === "first-time" || context === "first-time") {
    return {
      banner: "First-Time Buyer",
      autoMessage: "I'm a first-time homebuyer and I want to understand what I need to get started. Can you assess my readiness?",
    };
  }
  if (source === "refinance" || type === "refinance") {
    return {
      banner: "Refinance Guidance",
      autoMessage: "I'm interested in refinancing my current mortgage. Can you help me understand my options?",
    };
  }
  if (source === "investor" || context === "investor") {
    return {
      banner: "Investment Property",
      autoMessage: "I'm looking at investment properties. Can you help me understand mortgage requirements for rental properties?",
    };
  }
  const propertyPrice = params.get("propertyPrice");
  const propertyAddress = params.get("propertyAddress");
  if (propertyPrice && propertyAddress) {
    const formattedPrice = parseFloat(propertyPrice).toLocaleString();
    return {
      banner: "Property Analysis",
      autoMessage: `I'm looking at a property at ${decodeURIComponent(propertyAddress)} listed at $${formattedPrice}. Can you help me understand if this home fits my budget and what my monthly payments would look like?`,
    };
  }
  if (propertyPrice) {
    const formattedPrice = parseFloat(propertyPrice).toLocaleString();
    return {
      banner: "Property Analysis",
      autoMessage: `I'm considering a home priced at $${formattedPrice}. Can you help me understand if I can afford it and what loan options might work?`,
    };
  }
  return null;
}

export default function AICoach() {
  usePageView("/ai-coach");
  const trackActivity = useTrackActivity();
  const trackCoachSession = useTrackCoachSession();
  const { toast } = useToast();

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sourceHandled, setSourceHandled] = useState(false);
  const [mobileConvOpen, setMobileConvOpen] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  const { data: conversations = [], isLoading: loadingConvs } = useQuery<CoachConversation[]>({
    queryKey: ["/api/coach/conversations"],
  });

  const { data: activeData } = useQuery<{
    conversation: CoachConversation;
    messages: CoachMessage[];
  }>({
    queryKey: ["/api/coach/conversations", activeConversationId],
    enabled: !!activeConversationId,
  });

  const { data: usage } = useQuery<CoachUsage>({
    queryKey: ["/api/coach/usage"],
  });

  const { data: insightsData } = useQuery<{ insights: CoachInsight[]; hasApplication: boolean; hasAssessment: boolean }>({
    queryKey: ["/api/coach/insights"],
  });

  const { turn, send, retry, dismissError, isBusy } = useCoachStream({
    conversationId: activeConversationId,
    onConversationId: setActiveConversationId,
  });

  const handleSend = (msg: string) => {
    if (isBusy || usage?.isLimited) return;
    if (!activeConversationId) {
      trackCoachSession("coach_session_start");
    }
    void send(msg);
    trackActivity("coach_chat", "/ai-coach");
  };

  const sourceContext = getSourceContext();
  useEffect(() => {
    if (sourceContext && !sourceHandled && !activeConversationId && conversations.length === 0 && !loadingConvs) {
      setSourceHandled(true);
      handleSend(sourceContext.autoMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceContext, sourceHandled, activeConversationId, conversations.length, loadingConvs]);

  const toggleActionItem = useMutation({
    mutationFn: async (itemId: string) => {
      if (!activeConversationId) return;
      const res = await apiRequest("PATCH", `/api/coach/conversations/${activeConversationId}/action-plan/${itemId}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/conversations", activeConversationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/conversations"] });
      if (data?.toggled) {
        toast({
          title: data.toggled.completed ? "Nice work!" : "Unmarked",
          description: data.toggled.completed
            ? `"${data.toggled.title}" marked as complete.`
            : `"${data.toggled.title}" marked as incomplete.`,
        });
      }
    },
  });

  const messages = activeData?.messages ?? [];
  const activeConv = activeData?.conversation;

  // Live turn data overrides the persisted conversation while streaming.
  const profile = (turn.panel.profile ?? activeConv?.financialProfile ?? null) as CoachProfile | null;
  const actionPlan = (turn.panel.actionPlan ?? activeConv?.actionPlan ?? null) as ActionPlanItem[] | null;
  const documentChecklist = (turn.panel.documentChecklist ?? activeConv?.documentChecklist ?? null) as DocumentRequirement[] | null;

  const insights = insightsData?.insights ?? [];
  // First-message fix: an in-flight turn counts as an active chat, so the
  // pending bubble + typing indicator render immediately on the very first send.
  const hasActiveChat = !!activeConversationId || messages.length > 0 || turn.status !== "idle";

  const selectConversation = (id: string | null) => {
    if (isBusy) return;
    dismissError();
    setActiveConversationId(id);
    setMobileConvOpen(false);
  };

  const sidePanelContent = (
    <div className="space-y-3" data-testid="coach-side-panel">
      <CapturePanel captured={turn.captured} />
      {profile && <ReadinessPanel profile={profile} />}
      {actionPlan && actionPlan.length > 0 && (
        <ActionPlanPanel plan={actionPlan} onToggle={(itemId) => toggleActionItem.mutate(itemId)} />
      )}
      {documentChecklist && documentChecklist.length > 0 && <DocumentChecklistPanel docs={documentChecklist} />}
    </div>
  );

  const conversationListContent = (
    <>
      <div className="flex items-center gap-2 mb-4 px-1">
        <Sparkles className="h-5 w-5 text-success-subtle-foreground" />
        <h2 className="font-semibold text-foreground text-sm">AI Coach</h2>
      </div>
      {loadingConvs ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ConversationSidebar
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={(id) => selectConversation(id)}
          onNew={() => selectConversation(null)}
        />
      )}
    </>
  );

  return (
    <div className="flex h-[calc(100vh-4rem)]" data-testid="page-ai-coach">
      <div className="w-64 border-r p-3 overflow-y-auto hidden lg:block">
        {conversationListContent}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {hasActiveChat && (
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Sheet open={mobileConvOpen} onOpenChange={setMobileConvOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Conversations" className="lg:hidden" data-testid="button-mobile-conversations">
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-3">
                <SheetHeader className="pb-2">
                  <SheetTitle className="text-sm">Conversations</SheetTitle>
                </SheetHeader>
                {conversationListContent}
              </SheetContent>
            </Sheet>

            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium truncate" data-testid="text-active-conversation-title">
                {activeConv?.title || "New Conversation"}
              </p>
              {sourceContext && !activeConversationId && (
                <Badge variant="secondary" className="text-xs" data-testid="badge-source-context">
                  {sourceContext.banner}
                </Badge>
              )}
            </div>

            <Sheet open={mobilePanelOpen} onOpenChange={setMobilePanelOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Profile & assessment panel" className="xl:hidden" data-testid="button-mobile-panel">
                  <Sparkles className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 p-3 overflow-y-auto">
                <SheetHeader className="pb-2">
                  <SheetTitle className="text-sm">Your Pre-App Profile</SheetTitle>
                </SheetHeader>
                {sidePanelContent}
              </SheetContent>
            </Sheet>
          </div>
        )}

        {turn.degraded && (
          <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2 text-xs text-muted-foreground" data-testid="banner-degraded">
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
            <span>
              Offline guidance mode — the AI coach isn't configured in this environment. Answers are standard
              guidance and nothing is saved to your profile.
            </span>
          </div>
        )}

        {!hasActiveChat ? (
          <WelcomeState onStart={(msg) => handleSend(msg)} insights={insights} />
        ) : (
          <>
            {insights.length > 0 && messages.length === 0 && turn.status === "idle" && (
              <InsightsBanner insights={insights} onAction={(msg) => handleSend(msg)} />
            )}
            <MessageList messages={messages} turn={turn} onRetry={retry} onDismissError={dismissError} />
          </>
        )}

        {hasActiveChat && (
          <Composer
            onSend={handleSend}
            busy={isBusy}
            usage={usage}
            suggestions={turn.panel.suggestions}
          />
        )}
      </div>

      <div className="w-80 border-l overflow-y-auto p-3 hidden xl:block">
        {sidePanelContent}
      </div>
    </div>
  );
}
