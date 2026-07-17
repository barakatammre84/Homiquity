// Borrower routes: Team messaging, presence, conversations, document-request status, unread count.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import { type IStorage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { logAudit } from "../../auditLog";
import { lintOutboundText, REG_Z_ADVERTISING_DISCLOSURE_BLOCK } from "@shared/compliance/loCommsLint";
import { isStaffRole, type User } from "@shared/schema";
import { z } from "zod";
import { sendNotificationEmail } from "../../services/emailService";

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
      const userId = req.user!.id;
      const conversations = await storage.getConversations(userId);
      
      const partnerIds = [...new Set(conversations.map(c => c.partnerId).filter(Boolean))];
      const partners = await storage.getUsersByIds(partnerIds);
      const partnerMap = new Map(partners.map(p => [p.id, p]));

      const enrichedConversations = conversations.map((conv) => {
        const partner = partnerMap.get(conv.partnerId) || null;
        return {
          ...conv,
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
      const userId = req.user!.id;
      const { otherUserId } = req.params;
      
      const messages = await storage.getMessages(userId, otherUserId);
      
      // Mark messages as read
      await storage.markMessagesAsRead(userId, otherUserId);
      
      res.json(messages);
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
      if (parsed.data.applicationId) {
        const application = await storage.getLoanApplication(parsed.data.applicationId);
        if (!application || application.userId !== borrowerParty.id) {
          return res.status(403).json({ error: "Application does not belong to this conversation" });
        }
        applicationId = application.id;
      } else {
        const apps = await storage.getLoanApplicationsByUser(borrowerParty.id);
        applicationId = apps[0]?.id ?? null; // newest first; null pre-application
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

      const newMessage = await storage.sendMessage({
        senderId: user.id,
        recipientId,
        message,
        applicationId,
        messageType,
        documentRequestData: documentRequestData || null,
        isRead: false,
      });

      logAudit(req, "message.sent", "team_message", newMessage.id, {
        recipientId,
        applicationId,
        messageType,
      });

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
  
  // Update document request status (when borrower uploads or staff approves)
  app.patch("/api/messages/:messageId/document-request", isAuthenticated, async (req, res) => {
    try {
      const { messageId } = req.params;
      const { status, documentId } = req.body;
      const user = req.user as User;

      if (!status || !['pending', 'submitted', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: "Valid status is required" });
      }

      // Fetch the message so we can enforce participant and role-based transition checks
      // before mutating anything.
      const message = await storage.getMessageById(messageId);
      if (!message || message.messageType !== 'document_request') {
        return res.status(404).json({ error: "Document request not found" });
      }

      const isSender = message.senderId === user.id;
      const isRecipient = message.recipientId === user.id;

      // Caller must be a participant in the conversation.
      if (!isSender && !isRecipient) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Verify access to the associated loan file when one is present.
      if (message.applicationId) {
        const application = await storage.getLoanApplicationWithAccess(message.applicationId, user.id, user.role);
        if (!application) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      // Enforce which side of the conversation may perform each transition:
      //   submitted  → only the recipient (borrower) may mark a request as submitted
      //   approved / rejected / pending (reset) → only the sender (staff who made the request)
      if (status === 'submitted') {
        if (!isRecipient) {
          return res.status(403).json({ error: "Only the document recipient may mark a request as submitted" });
        }
      } else {
        // approved, rejected, pending — only the original requesting staff member
        if (!isSender || !isStaffRole(user.role)) {
          return res.status(403).json({ error: "Only the requesting staff member may approve, reject, or reset a document request" });
        }
      }

      // State-machine guard (prevents lost updates when borrower + staff act
      // concurrently, e.g. borrower re-submits while staff approves). Only the
      // listed prior states may transition to the target; the update below is
      // conditional on the current state, so a stale writer gets a 409.
      const LEGAL_FROM: Record<string, string[]> = {
        submitted: ["pending", "rejected"],       // borrower (re)uploads
        approved: ["submitted"],                   // staff clears a submitted doc
        rejected: ["submitted"],                   // staff bounces a submitted doc
        pending: ["submitted", "approved", "rejected"], // staff resets
      };
      const currentStatus = (message.documentRequestData as { status?: string } | null)?.status ?? "pending";
      if (currentStatus === status) {
        return res.json(message); // idempotent no-op
      }
      if (!LEGAL_FROM[status]?.includes(currentStatus)) {
        return res.status(409).json({
          error: `Cannot move a "${currentStatus}" request to "${status}".`,
          currentStatus,
        });
      }

      const updated = await storage.updateDocumentRequestStatus(messageId, status, documentId, LEGAL_FROM[status]);

      if (!updated) {
        // 0 rows matched the expected prior state — another writer beat us.
        const fresh = await storage.getMessageById(messageId);
        return res.status(409).json({
          error: "This request was just updated by someone else. Refresh to see the latest status.",
          currentStatus: (fresh?.documentRequestData as { status?: string } | null)?.status ?? null,
        });
      }

      res.json(updated);
    } catch (error) {
      console.error("Update document request error:", error);
      res.status(500).json({ error: "Failed to update document request" });
    }
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
