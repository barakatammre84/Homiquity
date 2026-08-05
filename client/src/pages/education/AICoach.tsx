import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient, coachConversationKeys } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, Sparkles, WifiOff } from "lucide-react";
import { Icons, iconSize } from "@/lib/icons";
import { companyNmlsDisplay } from "@shared/companyIdentity";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { usePageView, useTrackActivity, useTrackCoachSession } from "@/hooks/useActivityTracker";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { useCoachStream } from "@/components/coach/useCoachStream";
import { MessageList } from "@/components/coach/MessageList";
import { Composer } from "@/components/coach/Composer";
import { CapturePanel } from "@/components/coach/CapturePanel";
import { ConversationSidebar } from "@/components/coach/ConversationSidebar";
import { InsightsBanner, WelcomeState } from "@/components/coach/WelcomeState";
import { ActionPlanPanel, DocumentChecklistInline, DocumentChecklistPanel, ReadinessPanel } from "@/components/coach/panels";
import type {
  ActionPlanItem,
  CoachConversation,
  CoachInsight,
  CoachMessage,
  CoachProfile,
  CoachUsage,
  DocumentRequirement,
} from "@/components/coach/types";
import { getSourceContext } from "./aiCoach/sourceContext";

// The AI Homebuyer Coach — streaming chat (SSE via useCoachStream) with a live
// "Pre-App Profile" capture panel. Everything the model captures through the
// record_intake tool is auto-saved to the borrower's draft application
// server-side and surfaced here as a visible trail.

export default function AICoach() {
  usePageView("/ai-coach");
  const trackActivity = useTrackActivity();
  const trackCoachSession = useTrackCoachSession();
  const { toast } = useToast();

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sourceHandled, setSourceHandled] = useState(false);
  const [mobileConvOpen, setMobileConvOpen] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  const {
    data: conversations = [],
    isLoading: loadingConvs,
    isError: convsError,
    error: convsErrorObj,
    refetch: refetchConvs,
  } = useQuery<CoachConversation[]>({
    queryKey: coachConversationKeys.all(),
  });

  const {
    data: activeData,
    isError: activeError,
    error: activeErrorObj,
    refetch: refetchActive,
  } = useQuery<{
    conversation: CoachConversation;
    messages: CoachMessage[];
  }>({
    queryKey: coachConversationKeys.detail(activeConversationId!),
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
    // `conversations.length === 0` must mean "this borrower has no history",
    // not "the list failed to load" — on an error the default [] looks
    // identical, and auto-sending would open a second conversation for
    // someone who already had one.
    if (
      sourceContext &&
      !sourceHandled &&
      !activeConversationId &&
      conversations.length === 0 &&
      !loadingConvs &&
      !convsError
    ) {
      setSourceHandled(true);
      handleSend(sourceContext.autoMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceContext, sourceHandled, activeConversationId, conversations.length, loadingConvs, convsError]);

  const toggleActionItem = useMutation({
    mutationFn: async (itemId: string) => {
      if (!activeConversationId) return;
      const res = await apiRequest("PATCH", `/api/coach/conversations/${activeConversationId}/action-plan/${itemId}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: coachConversationKeys.detail(activeConversationId!) });
      queryClient.invalidateQueries({ queryKey: coachConversationKeys.all() });
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
  // Application to attach a Plaid connection to — surfaced by record_intake's
  // captured events; null until the coach has saved intake this session.
  const capturedAppId = useMemo(() => {
    let id: string | null = null;
    for (const e of turn.captured) if (e.applicationId) id = e.applicationId;
    return id;
  }, [turn.captured]);
  const hasChecklist = !!documentChecklist && documentChecklist.length > 0;

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
      {documentChecklist && documentChecklist.length > 0 && (
        <DocumentChecklistPanel docs={documentChecklist} applicationId={capturedAppId} />
      )}
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
      ) : convsError ? (
        // A failed load left `conversations` at [] and the sidebar rendered as
        // if the borrower had never chatted — their history silently gone
        // (ux-01). The auto-send effect above is suppressed on the same flag.
        <QueryErrorState
          error={convsErrorObj}
          onRetry={() => void refetchConvs()}
          title="We couldn't load your conversations"
          data-testid="coach-conversations-error"
        />
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

        {/* First-contact disclosure — static copy, deliberately not model-
            generated: AI identity, educational-guidance limitation, PII
            channel rule, and the SAFE Act unique-identifier line (renders
            only once licensed, via companyNmlsDisplay). */}
        <div
          className="flex items-center gap-2 border-b px-4 py-2 text-xs text-muted-foreground"
          data-testid="banner-coach-disclosure"
        >
          <Icons.security className={`${iconSize.dense} shrink-0`} />
          <span>
            You're chatting with Homiquity's AI assistant. Its guidance is educational — estimates
            aren't offers or approvals, and final terms come from underwriting review and official
            disclosures. Please don't share your Social Security number or date of birth in chat.
            {companyNmlsDisplay() ? ` ${companyNmlsDisplay()} · ` : " "}Equal Housing Opportunity.
          </span>
        </div>

        {!hasActiveChat ? (
          <WelcomeState onStart={(msg) => handleSend(msg)} insights={insights} />
        ) : activeError && turn.status === "idle" ? (
          // Opening a saved conversation whose fetch failed used to render an
          // empty thread — indistinguishable from a conversation with no
          // messages. Only shown while idle so it can't replace a live stream.
          <div className="p-4">
            <QueryErrorState
              error={activeErrorObj}
              onRetry={() => void refetchActive()}
              title="We couldn't load this conversation"
              data-testid="coach-conversation-error"
            />
          </div>
        ) : (
          <>
            {insights.length > 0 && messages.length === 0 && turn.status === "idle" && (
              <InsightsBanner insights={insights} onAction={(msg) => handleSend(msg)} />
            )}
            <MessageList messages={messages} turn={turn} onRetry={retry} onDismissError={dismissError} />
          </>
        )}

        {hasActiveChat && hasChecklist && (
          <DocumentChecklistInline docs={documentChecklist!} applicationId={capturedAppId} />
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
