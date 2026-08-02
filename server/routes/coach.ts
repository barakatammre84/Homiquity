import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { runCoachTurn, CoachTurnError, isCoachConfigured, type CoachTurnResult, type CoachEmit, type VerifiedUserContext, type CoachIntakeData, type DocumentExtractedData, deriveUserType, deriveReadinessState, deriveCompletionPercentage, deriveCompletedSteps, coachIntakeSchema, coachActionPlanSchema, coachDocumentChecklistSchema, coachProfileSchema } from "../services/coachingService";
import { buildBorrowerGraph } from "../services/borrowerGraph";
import { getCoachIntakeSnapshots } from "../services/coachIntake";
import { beginSse, writeSse } from "../sse";
import {
  detectSensitiveInput,
  SENSITIVE_INPUT_MESSAGES,
  SENSITIVE_INPUT_REDACTED_PLACEHOLDER,
} from "../services/sensitiveInputGuard";
import { pickActiveLoanApplication } from "@shared/schema";
import type { CoachConversation, User } from "@shared/schema";
import { z } from "zod";
import { routeParam } from "../http/routeParams";

const messageSchema = z.object({
  message: z.string().min(1).max(5000),
  conversationId: z.string().optional(),
  propertyPrice: z.number().optional(),
  propertyAddress: z.string().optional(),
});

async function buildVerifiedContext(userId: string, user: User, propertyContext?: { price: number; address: string } | null): Promise<VerifiedUserContext> {
  try {
    const applications = await storage.getLoanApplicationsByUser(userId);
    // Coach context: the in-flight file first; else the funded one (post-close
    // coaching still needs the closed loan's facts); else the most recent file
    // of any status so the coach is never blind to history.
    const activeApp = pickActiveLoanApplication(applications)
      ?? applications.find(a => a.status === "funded")
      ?? applications[0];

    if (!activeApp) {
      return {
        hasApplication: false,
        userName: user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : (user.email?.split("@")[0] || undefined),
      };
    }

    let employmentHistory: VerifiedUserContext["employmentHistory"] = [];
    try {
      const { db: database } = await import("../db");
      const { employmentHistory: empTable } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const empRecords = await database.select().from(empTable)
        .where(eq(empTable.applicationId, activeApp.id));
      employmentHistory = empRecords.map(e => ({
        employerName: e.employerName,
        positionTitle: e.positionTitle,
        isSelfEmployed: e.isSelfEmployed || false,
        startDate: e.startDate,
        totalMonthlyIncome: e.totalMonthlyIncome,
      }));
    } catch (e) {
      console.warn("[Coach] Could not fetch employment history:", e);
    }

    let uploadedDocuments: VerifiedUserContext["uploadedDocuments"] = [];
    let documentExtractedData: DocumentExtractedData[] = [];
    try {
      const docs = await storage.getDocumentsByApplication(activeApp.id);
      uploadedDocuments = docs.map(d => {
        let extractedName: string | null = null;
        let extractedEmployer: string | null = null;
        let extractionConfidence: "high" | "medium" | "low" | null = null;
        let extractionIssues: string[] | null = null;
        let documentDate: string | null = null;

        if (d.notes) {
          try {
            const parsed = JSON.parse(d.notes as string);
            if (parsed.employeeName) extractedName = parsed.employeeName;
            if (parsed.employerName) extractedEmployer = parsed.employerName;
            if (parsed.confidence) extractionConfidence = parsed.confidence;
            if (parsed.issues && Array.isArray(parsed.issues)) extractionIssues = parsed.issues;
            if (parsed.payPeriodEnd) documentDate = parsed.payPeriodEnd;
            else if (parsed.statementEndDate) documentDate = parsed.statementEndDate;
            else if (parsed.statementDate) documentDate = parsed.statementDate;
            else if (parsed.documentYear) documentDate = `${parsed.documentYear}-12-31`;
          } catch {
            // notes is not valid JSON, skip
          }
        }

        return {
          documentType: d.documentType,
          status: d.status || "uploaded",
          uploadDate: d.createdAt ? new Date(d.createdAt).toISOString().split("T")[0] : null,
          documentDate,
          fileName: d.fileName || null,
          extractedName,
          extractedEmployer,
          extractionConfidence,
          extractionIssues,
        };
      });

      for (const doc of docs) {
        if (!doc.notes) continue;
        try {
          const parsed = JSON.parse(doc.notes as string);
          if (!parsed.confidence || parsed.confidence === "low") continue;

          const extracted: DocumentExtractedData = {
            documentType: doc.documentType,
            confidence: parsed.confidence,
          };

          if (parsed.grossIncome) extracted.grossIncome = parsed.grossIncome;
          if (parsed.adjustedGrossIncome) extracted.adjustedGrossIncome = parsed.adjustedGrossIncome;
          if (parsed.taxableIncome) extracted.taxableIncome = parsed.taxableIncome;
          if (parsed.filingStatus) extracted.filingStatus = parsed.filingStatus;
          if (parsed.documentYear) extracted.documentYear = parsed.documentYear;
          if (parsed.grossPay) extracted.grossPay = parsed.grossPay;
          if (parsed.netPay) extracted.netPay = parsed.netPay;
          if (parsed.ytdGross) extracted.ytdGross = parsed.ytdGross;
          if (parsed.employerName) extracted.employerName = parsed.employerName;
          if (parsed.employeeName) extracted.employeeName = parsed.employeeName;
          if (parsed.closingBalance) extracted.closingBalance = parsed.closingBalance;
          if (parsed.totalDeposits) extracted.totalDeposits = parsed.totalDeposits;
          if (parsed.accountType) extracted.accountType = parsed.accountType;

          const hasData = Object.keys(extracted).length > 2;
          if (hasData) documentExtractedData.push(extracted);
        } catch {
          // notes is not valid JSON extraction data, skip
        }
      }
    } catch (e) {
      console.warn("[Coach] Could not fetch documents:", e);
    }

    const context: VerifiedUserContext = {
      hasApplication: true,
      applicationStatus: activeApp.status,
      annualIncome: activeApp.annualIncome,
      monthlyDebts: activeApp.monthlyDebts,
      creditScore: activeApp.creditScore,
      employmentType: activeApp.employmentType,
      employmentYears: activeApp.employmentYears,
      employerName: activeApp.employerName,
      isVeteran: activeApp.isVeteran || false,
      isFirstTimeBuyer: activeApp.isFirstTimeBuyer || false,
      dtiRatio: activeApp.dtiRatio,
      ltvRatio: activeApp.ltvRatio,
      preApprovalAmount: activeApp.preApprovalAmount,
      purchasePrice: activeApp.purchasePrice,
      downPayment: activeApp.downPayment,
      preferredLoanType: activeApp.preferredLoanType,
      propertyType: activeApp.propertyType,
      loanPurpose: activeApp.loanPurpose,
      employmentHistory,
      uploadedDocuments,
      documentExtractedData: documentExtractedData.length > 0 ? documentExtractedData : undefined,
      userName: user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : (user.email?.split("@")[0] || undefined),
    };

    try {
      const graph = await buildBorrowerGraph(userId);
      if (graph) {
        context.completionPercentage = graph.readiness.completionPercentage;
        context.readinessTier = graph.readiness.tier;
        context.outstandingInputs = graph.readiness.outstandingInputs;
        context.completedInputs = graph.readiness.completedInputs;
        context.documentsMissing = graph.documentsMissing;
        context.documentsUploaded = graph.documentsUploaded;
        context.documentsVerified = graph.documentsVerified;
        context.daysSinceLastActivity = graph.predictiveSignals.daysSinceLastActivity;
        context.engagementLevel = graph.predictiveSignals.engagementLevel;
        context.suggestedNextAction = graph.predictiveSignals.suggestedNextAction;

        const selfEmployed = employmentHistory?.some(e => e.isSelfEmployed);
        const multipleIncomes = (employmentHistory?.length || 0) > 1;
        context.hasMultipleIncomes = multipleIncomes;
        context.hasBusinessIncome = selfEmployed || false;

        const investmentPropertyTypes = ["investment", "investment_property", "rental", "multi_family"];
        const propertyTypeVal = (activeApp?.propertyType || "").toLowerCase();
        const loanPurposeVal = (activeApp?.loanPurpose || "").toLowerCase();
        const occupancyVal = ((activeApp as any)?.occupancyType || (activeApp as any)?.occupancy || "").toLowerCase();
        context.hasInvestmentProperties = investmentPropertyTypes.includes(propertyTypeVal)
          || loanPurposeVal.includes("investment")
          || loanPurposeVal.includes("rental")
          || occupancyVal === "investment"
          || occupancyVal === "non_owner_occupied"
          || occupancyVal === "investor";
      }
    } catch (e) {
      console.warn("[Coach] Could not enrich context from Borrower Graph:", e);
    }

    if (propertyContext) {
      context.propertyContext = propertyContext;
    }

    context.userType = deriveUserType(context);
    context.readinessState = deriveReadinessState(context);
    context.completionPercentage = deriveCompletionPercentage(context);
    context.completedSteps = deriveCompletedSteps(context);

    return context;
  } catch (error) {
    console.error("[Coach] Error building verified context:", error);
    return { hasApplication: false };
  }
}

function getLatestIntakeFromConversation(
  conversation: any,
  latestResponse?: { intake?: CoachIntakeData }
): CoachIntakeData | null {
  const intake: CoachIntakeData = {};
  
  const existingProfile = conversation.financialProfile as any;
  if (existingProfile) {
    if (existingProfile.annualIncome) intake.annualIncome = String(existingProfile.annualIncome);
    if (existingProfile.creditScore) intake.creditScore = String(existingProfile.creditScore);
  }

  if (latestResponse?.intake) {
    Object.assign(intake, latestResponse.intake);
  }

  return Object.keys(intake).length > 0 ? intake : null;
}

export function registerCoachRoutes(app: Express) {
  app.get("/api/coach/conversations", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const conversations = await storage.getCoachConversationsByUser(user.id);
      res.json(conversations);
    } catch (error) {
      console.error("Get coach conversations error:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/coach/intake/latest", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      // One conversations query + one batched messages query (was an N+1 loop).
      const { snapshots, conversations: sorted } = await getCoachIntakeSnapshots(user.id);

      if (sorted.length === 0) {
        return res.json(null);
      }

      const intake: CoachIntakeData = {};

      for (const snapshot of snapshots) {
        const msgIntakeParsed = coachIntakeSchema.safeParse(snapshot);
        if (msgIntakeParsed.success) {
          for (const [key, val] of Object.entries(msgIntakeParsed.data)) {
            if (val !== null && val !== undefined && val !== "" && !(key in intake)) {
              (intake as any)[key] = val;
            }
          }
        }
      }

      const latestConv = sorted[0];
      const rawProfile = latestConv.financialProfile as any;
      const readinessTier = latestConv.readinessTier;
      const completionPercentage = latestConv.completionPercentage;

      const validatedIntake = Object.keys(intake).length > 0
        ? coachIntakeSchema.safeParse(intake)
        : null;
      const validatedProfile = rawProfile
        ? coachProfileSchema.safeParse(rawProfile)
        : null;
      const validatedActionPlan = latestConv.actionPlan
        ? coachActionPlanSchema.safeParse(latestConv.actionPlan)
        : null;
      const validatedChecklist = latestConv.documentChecklist
        ? coachDocumentChecklistSchema.safeParse(latestConv.documentChecklist)
        : null;

      res.json({
        intake: validatedIntake?.success ? validatedIntake.data : null,
        readinessTier,
        completionPercentage,
        profile: validatedProfile?.success ? validatedProfile.data : null,
        actionPlan: validatedActionPlan?.success ? validatedActionPlan.data : null,
        documentChecklist: validatedChecklist?.success ? validatedChecklist.data : null,
        updatedAt: latestConv.updatedAt,
      });
    } catch (error) {
      console.error("Get coach intake error:", error);
      res.status(500).json({ error: "Failed to fetch coach intake" });
    }
  });

  app.get("/api/coach/conversations/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const conversation = await storage.getCoachConversation(routeParam(req, "id"));
      if (!conversation || conversation.userId !== user.id) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await storage.getCoachMessages(conversation.id);
      res.json({ conversation, messages });
    } catch (error) {
      console.error("Get coach conversation error:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  const DAILY_COACH_MESSAGE_LIMIT = 30;

  interface PreparedCoachTurn {
    user: User;
    message: string;
    conversation: CoachConversation;
    history: Array<{ role: string; content: string }>;
    userMessageId: string;
    remaining: number;
    verifiedContext: VerifiedUserContext;
  }

  // Shared pre-flight for both message endpoints: validate, enforce the daily
  // cap, resolve/create the conversation, snapshot history BEFORE persisting
  // the new user message (the old flow inserted first and re-fetched, so the
  // model saw the user's message twice), then persist it and build context.
  // Writes the error response itself and returns null when the turn must not run.
  async function prepareCoachTurn(req: Request, res: Response): Promise<PreparedCoachTurn | null> {
    const user = req.user as User;
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid message", details: parsed.error.errors });
      return null;
    }

    const { message, conversationId, propertyPrice, propertyAddress } = parsed.data;
    const propertyCtx = propertyPrice && propertyAddress
      ? { price: propertyPrice, address: propertyAddress }
      : null;

    const todayCount = await storage.countUserCoachMessagesToday(user.id);
    if (todayCount >= DAILY_COACH_MESSAGE_LIMIT) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      res.status(429).json({
        error: "Daily message limit reached",
        remaining: 0,
        dailyLimit: DAILY_COACH_MESSAGE_LIMIT,
        resetsAt: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      });
      return null;
    }

    let conversation: CoachConversation | undefined;
    if (conversationId) {
      conversation = await storage.getCoachConversation(conversationId);
      if (!conversation || conversation.userId !== user.id) {
        res.status(404).json({ error: "Conversation not found" });
        return null;
      }
    } else {
      conversation = await storage.createCoachConversation({
        userId: user.id,
        title: message.substring(0, 100),
        status: "active",
      });
    }

    const existingMessages = await storage.getCoachMessages(conversation.id);
    const history = existingMessages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    const userMsg = await storage.createCoachMessage({
      conversationId: conversation.id,
      role: "user",
      content: message,
    });

    const verifiedContext = await buildVerifiedContext(user.id, user, propertyCtx);

    if (conversation.readinessTier) {
      verifiedContext.previousReadinessTier = conversation.readinessTier as string;
    }
    if (conversation.financialProfile && typeof conversation.financialProfile === "object") {
      const prevProfile = conversation.financialProfile as any;
      if (prevProfile.completionPercentage !== undefined && prevProfile.completionPercentage !== null) {
        verifiedContext.previousCompletionPercentage = prevProfile.completionPercentage;
      }
    }

    return {
      user,
      message,
      conversation,
      history,
      userMessageId: userMsg.id,
      remaining: Math.max(0, DAILY_COACH_MESSAGE_LIMIT - todayCount - 1),
      verifiedContext,
    };
  }

  // Persist the assistant turn. coach_messages.structuredData keeps EXACTLY
  // the legacy shape (borrowerGraph readiness, GET /api/coach/intake/latest,
  // and the Pre-Approval prefill all read it), and the conversation-level
  // jsonb merge mirrors the pre-rebuild logic — with one deliberate change:
  // completionPercentage is now ALWAYS the server-derived figure (runCoachTurn
  // stamps it on state.profile); the model never controls it.
  async function persistAssistantTurn(
    conversation: CoachConversation,
    verifiedContext: VerifiedUserContext,
    result: CoachTurnResult,
  ) {
    const state = result.state;
    const hasStructuredData = !!(
      state.profile || state.intake || state.actionPlan || state.documentChecklist || state.borrowerPackage
    );

    const assistantMsg = await storage.createCoachMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: result.message,
      structuredData: hasStructuredData
        ? {
            profile: state.profile || null,
            intake: state.intake || null,
            actionPlan: state.actionPlan || null,
            documentChecklist: state.documentChecklist || null,
            borrowerPackage: state.borrowerPackage || null,
          }
        : null,
    });

    const updateData: Record<string, any> = {};

    if (verifiedContext.readinessTier) {
      updateData.readinessTier = verifiedContext.readinessTier;
    }

    if (state.profile) {
      updateData.financialProfile = state.profile;
      if (state.profile.readinessTier) {
        updateData.readinessTier = state.profile.readinessTier;
      }
      updateData.completionPercentage = state.profile.completionPercentage;
    } else if (verifiedContext.completionPercentage !== undefined) {
      const existingProfile = (conversation.financialProfile as any) || {};
      updateData.financialProfile = {
        ...existingProfile,
        completionPercentage: verifiedContext.completionPercentage,
      };
    }
    if (state.actionPlan) {
      updateData.actionPlan = state.actionPlan;
    }
    if (state.documentChecklist) {
      updateData.documentChecklist = state.documentChecklist;
    }

    if (Object.keys(updateData).length > 0) {
      await storage.updateCoachConversation(conversation.id, updateData);
    }

    return assistantMsg;
  }

  // Streaming variant. SSE protocol (one JSON object per frame):
  //   meta  {conversationId, userMessageId, remaining, degraded?}
  //   text  {delta}
  //   captured {applicationId, created, applied[], skipped[]}
  //   panel {profile? | actionPlan? | documentChecklist? | borrowerPackage? | suggestions?}
  //   lint_replaced {categories, citations}
  //   done  {messageId, usage, remaining}
  //   error {code, message, retryable}
  app.post("/api/coach/message/stream", isAuthenticated, async (req, res) => {
    let streaming = false;
    try {
      // Input-side sensitive-data guard: runs BEFORE prepareCoachTurn so a
      // pasted SSN/DOB is never persisted, never enters model context, and
      // never lands in a log. The stored user message becomes the redacted
      // placeholder; the reply is canned (no model call, no ai_interactions
      // row — nothing was invoked).
      const guardHit = detectSensitiveInput(
        typeof req.body?.message === "string" ? req.body.message : "",
      );
      if (guardHit) {
        req.body.message = SENSITIVE_INPUT_REDACTED_PLACEHOLDER;
      }

      const prep = await prepareCoachTurn(req, res);
      if (!prep) return;

      if (guardHit) {
        const guardMessage = SENSITIVE_INPUT_MESSAGES[guardHit.kind];
        const assistantMsg = await storage.createCoachMessage({
          conversationId: prep.conversation.id,
          role: "assistant",
          content: guardMessage,
        });
        console.error(
          `[coach-guard] blocked ${guardHit.kind}-shaped input (conversation ${prep.conversation.id})`,
        );
        beginSse(res);
        streaming = true;
        writeSse(res, "meta", {
          conversationId: prep.conversation.id,
          userMessageId: prep.userMessageId,
          remaining: prep.remaining,
        });
        writeSse(res, "text", { delta: guardMessage });
        writeSse(res, "done", { messageId: assistantMsg.id, usage: null, remaining: prep.remaining });
        res.end();
        return;
      }

      beginSse(res);
      streaming = true;

      // Client gone → stop paying for tokens nobody sees. (Side effects the
      // turn already applied — user message, intake sync — stay applied.)
      const abortController = new AbortController();
      req.on("close", () => abortController.abort());

      writeSse(res, "meta", {
        conversationId: prep.conversation.id,
        userMessageId: prep.userMessageId,
        remaining: prep.remaining,
        ...(isCoachConfigured() ? {} : { degraded: true }),
      });

      const emit: CoachEmit = (event) => {
        const { type, ...data } = event;
        writeSse(res, type, data);
      };

      const result = await runCoachTurn({
        req,
        userId: prep.user.id,
        userRole: prep.user.role,
        conversationId: prep.conversation.id,
        userMessage: prep.message,
        history: prep.history,
        existingProfile: prep.conversation.financialProfile ?? undefined,
        verifiedContext: prep.verifiedContext,
        emit,
        signal: abortController.signal,
      });

      const assistantMsg = await persistAssistantTurn(prep.conversation, prep.verifiedContext, result);

      writeSse(res, "done", {
        messageId: assistantMsg.id,
        usage: result.usage,
        remaining: prep.remaining,
      });
      res.end();
    } catch (error) {
      console.error("Coach stream error:", error);
      const payload = error instanceof CoachTurnError
        ? { code: error.code, message: error.message, retryable: error.retryable }
        : { code: "internal", message: "Failed to process message", retryable: true };
      // Once the stream is open the global error handler can't fire
      // (headersSent) — errors must be emitted in-stream. No assistant
      // message is persisted on error: the client shows a retry affordance.
      if (streaming) {
        writeSse(res, "error", payload);
        res.end();
      } else if (!res.headersSent) {
        res.status(502).json({ error: payload.message, ...payload });
      }
    }
  });

  // Non-streaming variant — same core turn, buffered. The response keeps the
  // pre-rebuild JSON contract (plus additive captured/suggestions/degraded)
  // so older clients keep working and the new client can fall back to it when
  // an intermediary buffers SSE.
  app.post("/api/coach/message", isAuthenticated, async (req, res) => {
    try {
      // Same input-side sensitive-data guard as the streaming variant.
      const guardHit = detectSensitiveInput(
        typeof req.body?.message === "string" ? req.body.message : "",
      );
      if (guardHit) {
        req.body.message = SENSITIVE_INPUT_REDACTED_PLACEHOLDER;
      }

      const prep = await prepareCoachTurn(req, res);
      if (!prep) return;

      if (guardHit) {
        const guardMessage = SENSITIVE_INPUT_MESSAGES[guardHit.kind];
        const assistantMsg = await storage.createCoachMessage({
          conversationId: prep.conversation.id,
          role: "assistant",
          content: guardMessage,
        });
        console.error(
          `[coach-guard] blocked ${guardHit.kind}-shaped input (conversation ${prep.conversation.id})`,
        );
        return res.json({
          conversationId: prep.conversation.id,
          message: assistantMsg,
          profile: prep.conversation.financialProfile || null,
          intake: getLatestIntakeFromConversation(prep.conversation),
          actionPlan: prep.conversation.actionPlan || null,
          documentChecklist: prep.conversation.documentChecklist || null,
          borrowerPackage: null,
          captured: null,
          suggestions: null,
        });
      }

      let lastCaptured: Record<string, unknown> | null = null;
      const emit: CoachEmit = (event) => {
        if (event.type === "captured") {
          const { type, ...data } = event;
          lastCaptured = data;
        }
      };

      const abortController = new AbortController();
      req.on("close", () => abortController.abort());

      const result = await runCoachTurn({
        req,
        userId: prep.user.id,
        userRole: prep.user.role,
        conversationId: prep.conversation.id,
        userMessage: prep.message,
        history: prep.history,
        existingProfile: prep.conversation.financialProfile ?? undefined,
        verifiedContext: prep.verifiedContext,
        emit,
        signal: abortController.signal,
      });

      const assistantMsg = await persistAssistantTurn(prep.conversation, prep.verifiedContext, result);
      const state = result.state;
      const existingIntake = getLatestIntakeFromConversation(prep.conversation, { intake: state.intake });

      res.json({
        conversationId: prep.conversation.id,
        message: assistantMsg,
        profile: state.profile || prep.conversation.financialProfile || null,
        intake: existingIntake,
        actionPlan: state.actionPlan || prep.conversation.actionPlan || null,
        documentChecklist: state.documentChecklist || prep.conversation.documentChecklist || null,
        borrowerPackage: state.borrowerPackage || null,
        captured: lastCaptured,
        suggestions: state.suggestions || null,
        ...(result.degraded ? { degraded: true } : {}),
      });
    } catch (error) {
      console.error("Coach message error:", error);
      if (res.headersSent) return;
      if (error instanceof CoachTurnError) {
        res.status(502).json({ error: error.message, code: error.code, retryable: error.retryable });
      } else {
        res.status(500).json({ error: "Failed to process message" });
      }
    }
  });

  app.patch("/api/coach/conversations/:id/action-plan/:itemId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const conversation = await storage.getCoachConversation(routeParam(req, "id"));
      if (!conversation || conversation.userId !== user.id) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const plan = (conversation.actionPlan as any[]) || [];
      const itemIndex = plan.findIndex((item: any) => item.id === routeParam(req, "itemId"));
      if (itemIndex === -1) {
        return res.status(404).json({ error: "Action item not found" });
      }

      plan[itemIndex].completed = !plan[itemIndex].completed;
      await storage.updateCoachConversation(conversation.id, { actionPlan: plan });

      res.json({ actionPlan: plan, toggled: plan[itemIndex] });
    } catch (error) {
      console.error("Toggle action item error:", error);
      res.status(500).json({ error: "Failed to toggle action item" });
    }
  });

  app.get("/api/coach/usage", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const dailyLimit = 30;
      const todayCount = await storage.countUserCoachMessagesToday(user.id);

      res.json({
        todayCount,
        dailyLimit,
        remaining: Math.max(0, dailyLimit - todayCount),
        isLimited: todayCount >= dailyLimit,
      });
    } catch (error) {
      console.error("Coach usage error:", error);
      res.status(500).json({ error: "Failed to fetch usage" });
    }
  });

  app.get("/api/coach/insights", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const verifiedContext = await buildVerifiedContext(user.id, user);
      const conversations = await storage.getCoachConversationsByUser(user.id);
      const hasAssessment = conversations.some(c => c.financialProfile);
      const totalConversations = conversations.length;

      const insights: Array<{ type: string; title: string; description: string; action?: string }> = [];

      if (verifiedContext.hasApplication && !hasAssessment) {
        insights.push({
          type: "readiness_check",
          title: "Get Your Readiness Assessment",
          description: "You have application data on file. Ask the coach to assess your mortgage readiness for a personalized action plan.",
          action: "Assess my mortgage readiness based on my application",
        });
      }

      if (verifiedContext.hasApplication && verifiedContext.uploadedDocuments) {
        const uploaded = verifiedContext.uploadedDocuments.length;
        if (uploaded === 0) {
          insights.push({
            type: "missing_docs",
            title: "Upload Your Documents",
            description: "No documents uploaded yet. The coach can create a personalized checklist for you.",
            action: "What documents do I need to upload?",
          });
        }
      }

      if (verifiedContext.hasApplication && verifiedContext.creditScore && verifiedContext.creditScore < 680) {
        insights.push({
          type: "credit_improvement",
          title: "Credit Score Tips",
          description: `Your credit score is ${verifiedContext.creditScore}. The coach can help you create a plan to improve it.`,
          action: "How can I improve my credit score for a better mortgage rate?",
        });
      }

      if (verifiedContext.hasApplication && verifiedContext.dtiRatio && parseFloat(verifiedContext.dtiRatio) > 43) {
        insights.push({
          type: "dti_high",
          title: "DTI Ratio Guidance",
          description: `Your debt-to-income ratio is ${verifiedContext.dtiRatio}%. The coach can help you strategize to lower it.`,
          action: "My DTI is high. What can I do to bring it down?",
        });
      }

      if (!verifiedContext.hasApplication && totalConversations === 0) {
        insights.push({
          type: "get_started",
          title: "Start Your Homebuying Journey",
          description: "Chat with the coach to understand what you need for a mortgage and create a personalized plan.",
        });
      }

      res.json({ insights, hasApplication: verifiedContext.hasApplication, hasAssessment });
    } catch (error) {
      console.error("Coach insights error:", error);
      res.status(500).json({ error: "Failed to fetch insights" });
    }
  });

  app.get("/api/coach/profile", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const conversations = await storage.getCoachConversationsByUser(user.id);
      const activeConv = conversations.find(c => c.financialProfile);
      if (!activeConv) {
        return res.json({ profile: null, actionPlan: null, documentChecklist: null });
      }
      res.json({
        profile: activeConv.financialProfile,
        actionPlan: activeConv.actionPlan,
        documentChecklist: activeConv.documentChecklist,
        readinessTier: activeConv.readinessTier,
        completionPercentage: activeConv.completionPercentage,
        conversationId: activeConv.id,
      });
    } catch (error) {
      console.error("Get coach profile error:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });
}
