// Borrower routes: Team messaging, presence, conversations, document-request status, unread count.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import { type IStorage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { logAudit } from "../../auditLog";
import { lintOutboundText, REG_Z_ADVERTISING_DISCLOSURE_BLOCK } from "@shared/compliance/loCommsLint";
import { scanForEscalationTriggers } from "@shared/compliance/complaintEscalation";
import { escalateFlaggedMessage } from "../../services/complaintEscalation";
import { isStaffRole, pickWorkableLoanApplication, type User } from "@shared/schema";
import { z } from "zod";
import { sendNotificationEmail } from "../../services/emailService";
import { routeParams } from "../../http/routeParams";
import { canonicalDocumentType } from "@shared/documentTypes";
import { toMessageViewForApplicationAccess } from "../../services/messageVisibility";
import { isInternalStaffRole } from "@shared/roles";

// Verify that an internal staff user is actually assigned to the given application.
// Returns true for admin (unrestricted), checks LO assignment for lo/loa, and
// deal-team membership for processor/underwriter/closer.
// External partner roles (broker, lender) are NOT permitted by this helper.
// Exported: the LO-2 scenario route reuses this gate (one access model, no forks).

export function registerMessagingRoutes(
  app: Express,
  storage: IStorage,
) {
  // Team Messaging API Routes
  // ============================================

  // Team members for the Messages view. A borrower sees only THEIR assigned
  // loan team (deal-team members + assigned LOs), not the whole staff
  // directory; staff keep the full list for internal coordination. Borrowers
  // with no team assigned yet fall back to all staff so they can still reach
  // someone (see storage.getTeamMembersForBorrower).
  app.get("/api/team-members", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const staffUsersWithPresence = isStaffRole(user.role)
        ? await storage.getTeamMembersWithPresence()
        : await storage.getTeamMembersForBorrower(user.id);

      // Transform to include display info and presence
      const teamMembers = staffUsersWithPresence.map(user => ({
        id: user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Team Member',
        role: user.role,
        email: user.email,
        profileImageUrl: user.profileImageUrl,
        initials: getInitials(user),
        presenceStatus: user.presenceStatus,
      }));
      
      res.json(teamMembers);
    } catch (error) {
      console.error("Get team members error:", error);
      res.status(500).json({ error: "Failed to get team members" });
    }
  });
  
  // Update presence (heartbeat endpoint)
  app.post("/api/presence/heartbeat", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      await storage.updateUserPresence(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Presence update error:", error);
      res.status(500).json({ error: "Failed to update presence" });
    }
  });

  // Get all conversations for current user
  app.get("/api/messages/conversations", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const userId = user.id;
      const conversations = await storage.getConversations(userId);
      const accessibleApplicationIds = new Set(
        await storage.getAccessibleMessageApplicationIds(
          userId,
          user.role,
          conversations
            .map((conversation) => conversation.lastMessage.applicationId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      
      const partnerIds = [...new Set(conversations.map(c => c.partnerId).filter(Boolean))];
      const partners = await storage.getUsersByIds(partnerIds);
      const partnerMap = new Map(partners.map(p => [p.id, p]));

      const enrichedConversations = conversations.map((conv) => {
        const partner = partnerMap.get(conv.partnerId) || null;
        return {
          ...conv,
          lastMessage: toMessageViewForApplicationAccess(
            conv.lastMessage,
            accessibleApplicationIds,
          ),
          partner: partner ? {
            id: partner.id,
            name: `${partner.firstName || ''} ${partner.lastName || ''}`.trim() || partner.email || 'User',
            role: partner.role,
            email: partner.email,
            profileImageUrl: partner.profileImageUrl,
            initials: getInitials(partner),
          } : null,
        };
      });
      
      res.json(enrichedConversations);
    } catch (error) {
      console.error("Get conversations error:", error);
      res.status(500).json({ error: "Failed to get conversations" });
    }
  });

  // Get messages with a specific user
  app.get("/api/messages/:otherUserId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const userId = user.id;
      const { otherUserId } = routeParams(req);
      
      const messages = await storage.getMessages(userId, otherUserId);
      const accessibleApplicationIds = new Set(
        await storage.getAccessibleMessageApplicationIds(
          userId,
          user.role,
          messages
            .map((message) => message.applicationId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const messageViews = messages.map((message) =>
        toMessageViewForApplicationAccess(message, accessibleApplicationIds),
      );
      
      // Mark messages as read
      await storage.markMessagesAsRead(userId, otherUserId);
      
      res.json(messageViews);
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });

  // Send a message (supports regular text and document requests).
  // Borrower communications are loan-file records: every send is validated,
  // scoped to borrower↔staff pairs, stamped with the loan application, audit
  // logged, and the recipient is actually notified (in-app + email).
  const sendMessageSchema = z.object({
    recipientId: z.string().min(1),
    message: z.string().trim().min(1).max(2000),
    applicationId: z.string().optional(),
    messageType: z.enum(["text", "document_request"]).default("text"),
    // Set by the composer when the LO consciously sends past a Tier-2 (Reg N
    // §1014.3) compliance warning; the override is audit-logged (LO-5).
    acknowledgeComplianceWarning: z.boolean().optional(),
    documentRequestData: z
      .object({
        documentType: z.string().min(1).max(100),
        documentName: z.string().min(1).max(200),
        description: z.string().max(500).optional(),
        status: z.literal("pending").default("pending"),
      })
      .optional(),
  });

  app.post("/api/messages", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;

      const parsed = sendMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid message", details: parsed.error.flatten().fieldErrors });
      }
      const { recipientId, message, messageType, documentRequestData } = parsed.data;

      const recipient = await storage.getUser(recipientId);
      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" });
      }

      // Scoping: messaging exists between a borrower and their loan team.
      // Borrower↔borrower (or any pair with no staff member) is not a thing.
      const senderIsStaff = isStaffRole(user.role);
      const recipientIsStaff = isStaffRole(recipient.role || "");
      if (!senderIsStaff && !recipientIsStaff) {
        return res.status(403).json({ error: "Messages can only be exchanged with your loan team" });
      }

      // A borrower may only message staff on their OWN team (deal-team + LOs).
      // Mirrors the scoped team-members list, so they can't reach an arbitrary
      // staff member by user id. If they have no team yet, the team list falls
      // back to all staff, and so does this check — no dead end.
      if (!senderIsStaff && recipientIsStaff) {
        const onTeam = await storage.isStaffOnBorrowerTeam(user.id, recipientId);
        if (!onTeam) {
          return res.status(403).json({ error: "You can only message members of your assigned loan team" });
        }
      }

      // Document requests are a staff→borrower workflow.
      if (messageType === "document_request") {
        if (!senderIsStaff) {
          return res.status(403).json({ error: "Only your loan team can send document requests" });
        }
        if (!documentRequestData) {
          return res.status(400).json({ error: "documentRequestData is required for document requests" });
        }
      }

      // Stamp the message onto the borrower's loan file so the conversation is
      // part of the (retained, examinable) loan record. If the caller supplied
      // an applicationId, verify it belongs to the borrower side of the pair;
      // otherwise derive the borrower's most recent application.
      const borrowerParty = senderIsStaff ? recipient : user;
      let applicationId: string | null = null;
      let borrowerHasAnyApplication = false;
      if (parsed.data.applicationId) {
        const application = await storage.getLoanApplication(parsed.data.applicationId);
        if (!application || application.userId !== borrowerParty.id) {
          return res.status(403).json({ error: "Application does not belong to this conversation" });
        }
        applicationId = application.id;
      } else {
        // The file the borrower is actually working on, not `apps[0]`: the list
        // is newest-first with no status filter, so the newest entry is often a
        // denied/withdrawn/funded one while an older file is still in flight —
        // and the thread would be stamped onto the closed loan (the #271/#273
        // bug class, banned in pickWorkableLoanApplication's docblock). With no
        // workable file the message is stored unattached (as it already is
        // pre-application) rather than misfiled on a closed record.
        const apps = await storage.getLoanApplicationsByUser(borrowerParty.id);
        borrowerHasAnyApplication = apps.length > 0;
        applicationId = pickWorkableLoanApplication(apps)?.id ?? null;
      }
      if (messageType === "document_request" && !applicationId) {
        return res.status(409).json({
          error: "Choose an active loan application before requesting a document",
        });
      }
      if (
        senderIsStaff &&
        !applicationId &&
        (borrowerHasAnyApplication || !isInternalStaffRole(user.role))
      ) {
        return res.status(403).json({
          error: borrowerHasAnyApplication
            ? "Choose a loan application you are assigned to before messaging this borrower"
            : "Only Homiquity staff can contact a borrower before a loan application exists",
        });
      }
      // Staff messages attached to a loan file must come from someone who can
      // actually work that file. Knowing a borrower/application id is not
      // enough to open a communication channel or create a document request.
      if (senderIsStaff && applicationId) {
        const staffApplication = await storage.getLoanApplicationWithAccess(
          applicationId,
          user.id,
          user.role,
        );
        if (!staffApplication) {
          return res.status(403).json({ error: "You do not have access to this loan application" });
        }
      }
      if (!senderIsStaff && recipientIsStaff && applicationId) {
        const recipientApplication = await storage.getLoanApplicationWithAccess(
          applicationId,
          recipient.id,
          recipient.role || "",
        );
        if (!recipientApplication) {
          return res.status(403).json({
            error: "That loan-team member no longer has access to this application",
          });
        }
      }

      // LO-5 comms compliance lint on STAFF → borrower outbound free text.
      // Tier 1 (Reg Z §1026.24 trigger terms) is a hard block routed to the
      // disclosed channels (Loan Estimate / Advisor Report); Tier 2 (Reg N
      // §1014.3 promise phrases) warns and needs an explicit, logged override
      // to send. Borrower → staff inbound and structured document requests are
      // not advertising and are not linted. Enforcement is server-side, so the
      // block holds even if the composer is bypassed.
      if (senderIsStaff && messageType === "text") {
        const lint = lintOutboundText(message);
        if (lint.blocked) {
          const blockMatches = [...lint.triggerMatches, ...lint.hardBlockMatches];
          logAudit(req, "comms_lint.blocked", "loan_application", applicationId ?? undefined, {
            recipientId,
            categories: blockMatches.map((m) => m.category),
            citations: blockMatches.map((m) => m.citation),
          });
          // A prohibited Reg N misrepresentation (e.g. guaranteed approval) has no
          // "disclose it instead" path — it simply cannot be sent, with no
          // override. A Reg Z trigger term routes to the disclosed channels.
          const hasRegNPromise = lint.hardBlockMatches.length > 0;
          return res.status(422).json({
            error: hasRegNPromise
              ? "This message states or implies a guaranteed approval, which federal law (Regulation N, 12 CFR §1014.3) prohibits. Approval can't be guaranteed before underwriting — please rephrase without promising an outcome."
              : "This message states specific loan terms that require federal disclosures. Send the figures via the borrower's Loan Estimate or Advisor Report instead.",
            complianceBlock: true,
            lint,
            ...(lint.hasTriggerTerms ? { disclosureBlock: REG_Z_ADVERTISING_DISCLOSURE_BLOCK } : {}),
          });
        }
        if (lint.requiresOverride && !parsed.data.acknowledgeComplianceWarning) {
          logAudit(req, "comms_lint.warned", "loan_application", applicationId ?? undefined, {
            recipientId,
            categories: lint.promiseMatches.map((m) => m.category),
          });
          return res.status(422).json({
            error: "This message may contain a prohibited representation. Review the suggested rewrite, or send anyway to record an override.",
            complianceWarning: true,
            lint,
          });
        }
        if (lint.requiresOverride && parsed.data.acknowledgeComplianceWarning) {
          logAudit(req, "comms_lint.override", "loan_application", applicationId ?? undefined, {
            recipientId,
            categories: lint.promiseMatches.map((m) => m.category),
            citations: lint.promiseMatches.map((m) => m.citation),
          });
        }
      }

      const messageInput = {
        senderId: user.id,
        recipientId,
        message,
        applicationId,
        messageType,
        documentRequestData: documentRequestData
          ? {
              ...documentRequestData,
              documentType: canonicalDocumentType(documentRequestData.documentType),
            }
          : null,
        isRead: false,
      };
      const sent = messageType === "document_request"
        ? await storage.sendDocumentRequestOnce({
            ...messageInput,
            applicationId: applicationId!,
          })
        : { message: await storage.sendMessage(messageInput), created: true };
      const newMessage = sent.message;

      // An open request for this document already exists on this file. Return
      // that request without another message, email, notification, or audit row.
      if (!sent.created) {
        return res.status(200).json({ ...newMessage, deduplicated: true });
      }

      logAudit(req, "message.sent", "team_message", newMessage.id, {
        recipientId,
        applicationId,
        messageType,
      });

      // CS2: borrower-side messages are scanned for the escalation playbook's
      // discrimination / credit-reporting-error trigger vocabulary. A match
      // creates an audit record + immediate founder (admin) notification —
      // it NEVER blocks, alters, or delays the message, and the borrower
      // response is unchanged (no tip-off). Fire-and-forget: an escalation
      // failure must not fail the send.
      if (!senderIsStaff) {
        const scan = scanForEscalationTriggers(message);
        if (scan.flagged) {
          logAudit(req, "complaint.flagged", "team_message", newMessage.id, {
            categories: scan.categories,
            applicationId,
            senderId: user.id,
          });
          escalateFlaggedMessage(storage, {
            messageId: newMessage.id,
            surface: "team_message",
            userId: user.id,
            applicationId,
            categories: scan.categories,
          }).catch((e) => console.error("[complaints] founder escalation failed:", e));
        }
      }

      // Notify the recipient — the UI promises this, so the backend delivers it.
      // The email intentionally carries no message content (PII stays behind login).
      const senderName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Your loan team";
      try {
        const isDocRequest = messageType === "document_request";
        await storage.createNotification({
          userId: recipientId,
          type: isDocRequest ? "document_request" : "message_received",
          title: isDocRequest ? "Document requested" : `New message from ${senderName}`,
          body: isDocRequest
            ? `${senderName} requested: ${documentRequestData!.documentName}. Upload it from your Documents page.`
            : "You have a new secure message. Open Messages to read and reply.",
          entityType: "team_message",
          entityId: newMessage.id,
          status: "unread",
        });
        if (recipient.email) {
          if (isDocRequest) {
            sendNotificationEmail({
              type: "document_requested",
              recipientEmail: recipient.email,
              data: { borrowerName: recipient.firstName || "there", documentName: documentRequestData!.documentName },
            });
          } else {
            sendNotificationEmail({
              type: "message_received",
              recipientEmail: recipient.email,
              data: { recipientName: recipient.firstName || "there", senderName },
            });
          }
        }
      } catch (notifyErr) {
        // Delivery of the message itself must not fail on notification errors.
        console.error("[Messages] Failed to notify recipient (non-fatal):", notifyErr);
      }

      res.status(201).json(newMessage);
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });
  
  // Retired compatibility endpoint. Submission now happens only inside the
  // atomic upload transaction, and approval/rejection only inside the human
  // document-review transaction. Keeping a non-mutating 410 gives stale
  // browser bundles a clear refresh signal without preserving a second source
  // of truth.
  app.patch("/api/messages/:messageId/document-request", isAuthenticated, (_req, res) => {
    res.status(410).json({
      error: "This document-request action has been replaced. Refresh and use the current loan-file workflow.",
      code: "DOCUMENT_REQUEST_ACTION_RETIRED",
    });
  });
  
  // Get pending document requests for current user
  app.get("/api/messages/document-requests/pending", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const pendingRequests = await storage.getPendingDocumentRequests(userId);
      res.json(pendingRequests);
    } catch (error) {
      console.error("Get pending document requests error:", error);
      res.status(500).json({ error: "Failed to get pending document requests" });
    }
  });

  // Get unread message count
  app.get("/api/messages/unread/count", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const count = await storage.getUnreadMessageCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Get unread count error:", error);
      res.status(500).json({ error: "Failed to get unread count" });
    }
  });

  // Helper function to get initials from user
  function getInitials(user: User): string {
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName.substring(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'TM';
  }

  // ================================
}
