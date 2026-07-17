// Storage domain: Referral links, team messaging, presence, document-request integration.
// One link in the DatabaseStorage inheritance chain — see ./index.ts.
import { db } from "../db";
import {
  eq,
  desc,
  and,
  sql,
  or,
  asc,
  inArray,
} from "drizzle-orm";
// SSN uses ssnVault (canonical, from main); account numbers use piiVault (this
// branch — main leaves account numbers plaintext).

import {
  users,
  loanApplications,
  teamMessages,
  isStaffRole,
  type User,
  type TeamMessage,
  type InsertTeamMessage,
} from "@shared/schema";
import { OpsAnalyticsStorage } from "./opsAnalytics";
export class MessagingStorage extends OpsAnalyticsStorage {
  // ============================================
  // Referral Link System Methods
  // ============================================
  
  async generateReferralCode(userId: string): Promise<string> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");
    
    // If user already has a referral code, return it
    if (user.referralCode) {
      return user.referralCode;
    }
    
    // Generate a unique code based on name and random suffix
    const baseName = `${user.firstName || 'LO'}-${user.lastName || 'USER'}`.toUpperCase().replace(/[^A-Z]/g, '');
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const referralCode = `${baseName.substring(0, 8)}-${suffix}`;
    
    // Save to user
    await db.update(users).set({ referralCode }).where(eq(users.id, userId));
    
    return referralCode;
  }
  
  async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.referralCode, referralCode));
    return user;
  }
  
  async setUserReferredBy(userId: string, referringUserId: string): Promise<void> {
    await db.update(users).set({ referredByUserId: referringUserId }).where(eq(users.id, userId));
  }
  
  async getReferralsByUser(userId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.referredByUserId, userId));
  }
  
  async getReferralStats(userId: string): Promise<{
    totalReferrals: number;
    referralsThisMonth: number;
    activeApplications: number;
    closedLoans: number;
  }> {
    // Get all users referred by this user
    const referredUsers = await this.getReferralsByUser(userId);
    const referredUserIds = referredUsers.map(u => u.id);
    
    if (referredUserIds.length === 0) {
      return { totalReferrals: 0, referralsThisMonth: 0, activeApplications: 0, closedLoans: 0 };
    }
    
    // Count referrals this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const referralsThisMonth = referredUsers.filter(u => 
      u.createdAt && new Date(u.createdAt) >= startOfMonth
    ).length;
    
    // Get applications from referred users
    const applications = await db.select()
      .from(loanApplications)
      .where(sql`${loanApplications.userId} = ANY(${referredUserIds})`);
    
    const activeStatuses = ['draft', 'submitted', 'analyzing', 'pre_approved', 'verified', 'underwriting', 'approved'];
    const activeApplications = applications.filter(a => activeStatuses.includes(a.status)).length;
    const closedLoans = applications.filter(a => a.status === 'closed').length;
    
    return {
      totalReferrals: referredUsers.length,
      referralsThisMonth,
      activeApplications,
      closedLoans,
    };
  }

  // ============================================
  // Team Messaging Methods
  // ============================================
  
  async sendMessage(data: InsertTeamMessage): Promise<TeamMessage> {
    const [message] = await db.insert(teamMessages).values(data).returning();
    return message;
  }

  async getMessageById(messageId: string): Promise<TeamMessage | null> {
    const [message] = await db.select().from(teamMessages).where(eq(teamMessages.id, messageId)).limit(1);
    return message ?? null;
  }

  async getMessages(userId: string, otherUserId: string): Promise<TeamMessage[]> {
    return db.select()
      .from(teamMessages)
      .where(
        or(
          and(
            eq(teamMessages.senderId, userId),
            eq(teamMessages.recipientId, otherUserId)
          ),
          and(
            eq(teamMessages.senderId, otherUserId),
            eq(teamMessages.recipientId, userId)
          )
        )
      )
      .orderBy(asc(teamMessages.createdAt));
  }
  
  async getConversations(userId: string): Promise<{
    partnerId: string;
    lastMessage: TeamMessage;
    unreadCount: number;
  }[]> {
    // Get all messages involving the user
    const messages = await db.select()
      .from(teamMessages)
      .where(
        or(
          eq(teamMessages.senderId, userId),
          eq(teamMessages.recipientId, userId)
        )
      )
      .orderBy(desc(teamMessages.createdAt));
    
    // Group by conversation partner
    const conversationMap = new Map<string, { lastMessage: TeamMessage; unreadCount: number }>();
    
    for (const msg of messages) {
      const partnerId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      
      if (!conversationMap.has(partnerId)) {
        // Count unread messages from this partner
        const unreadCount = messages.filter(
          m => m.senderId === partnerId && m.recipientId === userId && !m.isRead
        ).length;
        
        conversationMap.set(partnerId, {
          lastMessage: msg,
          unreadCount,
        });
      }
    }
    
    return Array.from(conversationMap.entries()).map(([partnerId, data]) => ({
      partnerId,
      ...data,
    }));
  }
  
  async markMessagesAsRead(userId: string, senderId: string): Promise<void> {
    await db.update(teamMessages)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(teamMessages.recipientId, userId),
          eq(teamMessages.senderId, senderId),
          eq(teamMessages.isRead, false)
        )
      );
  }
  
  async getUnreadMessageCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(teamMessages)
      .where(
        and(
          eq(teamMessages.recipientId, userId),
          eq(teamMessages.isRead, false)
        )
      );
    return result[0]?.count || 0;
  }
  
  async getStaffUsersForTeamDisplay(): Promise<User[]> {
    // Get all staff users who can be part of a borrower's team
    return db.select()
      .from(users)
      .where(
        or(
          eq(users.role, 'lo'),
          eq(users.role, 'loa'),
          eq(users.role, 'processor'),
          eq(users.role, 'underwriter'),
          eq(users.role, 'closer'),
          eq(users.role, 'admin')
        )
      );
  }
  
  // ============================================
  // Presence Tracking Methods
  // ============================================
  
  async updateUserPresence(userId: string): Promise<void> {
    await db.update(users)
      .set({ lastActiveAt: new Date() })
      .where(eq(users.id, userId));
  }
  
  async getUserPresenceStatus(userId: string): Promise<'online' | 'away' | 'offline'> {
    const [user] = await db.select({ lastActiveAt: users.lastActiveAt })
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user?.lastActiveAt) return 'offline';
    
    const now = new Date();
    const lastActive = new Date(user.lastActiveAt);
    const diffMinutes = (now.getTime() - lastActive.getTime()) / 60000;
    
    if (diffMinutes < 2) return 'online';
    if (diffMinutes < 10) return 'away';
    return 'offline';
  }
  
  private attachPresence(users: User[]): (User & { presenceStatus: 'online' | 'away' | 'offline' })[] {
    const now = new Date();
    return users.map(user => {
      let presenceStatus: 'online' | 'away' | 'offline' = 'offline';
      if (user.lastActiveAt) {
        const diffMinutes = (now.getTime() - new Date(user.lastActiveAt).getTime()) / 60000;
        if (diffMinutes < 2) presenceStatus = 'online';
        else if (diffMinutes < 10) presenceStatus = 'away';
      }
      return { ...user, presenceStatus };
    });
  }

  async getTeamMembersWithPresence(): Promise<(User & { presenceStatus: 'online' | 'away' | 'offline' })[]> {
    // Staff-facing / internal view: all staff (used for internal coordination).
    return this.attachPresence(await this.getStaffUsersForTeamDisplay());
  }

  /**
   * A borrower's OWN loan team — the staff actually assigned to their
   * application(s): deal-team members plus assigned loan officers. Scoping the
   * borrower's Messages view to this set stops them from browsing (and DMing)
   * the entire staff directory.
   *
   * Fallback: a borrower with no assigned team yet (common pre-assignment) gets
   * the full staff list so they are never left with no one to contact.
   */
  async getTeamMembersForBorrower(
    borrowerUserId: string,
  ): Promise<(User & { presenceStatus: 'online' | 'away' | 'offline' })[]> {
    const apps = await this.getLoanApplicationsByUser(borrowerUserId);
    const staffIds = new Set<string>();

    for (const app of apps) {
      if (app.loanOfficerId) staffIds.add(app.loanOfficerId);
      const team = await this.getDealTeamMembers(app.id);
      for (const m of team) {
        if (m.userId && isStaffRole(m.user?.role ?? "")) staffIds.add(m.userId);
      }
    }

    if (staffIds.size === 0) {
      // No team assigned yet — don't strand the borrower.
      return this.getTeamMembersWithPresence();
    }

    const members = await Promise.all([...staffIds].map((id) => this.getUser(id)));
    return this.attachPresence(members.filter((u): u is User => !!u));
  }

  /** True when this staff user is on the borrower's team (or none is assigned). */
  async isStaffOnBorrowerTeam(borrowerUserId: string, staffUserId: string): Promise<boolean> {
    const team = await this.getTeamMembersForBorrower(borrowerUserId);
    return team.some((m) => m.id === staffUserId);
  }
  
  // ============================================
  // Document Request Integration
  // ============================================
  
  async updateDocumentRequestStatus(
    messageId: string,
    status: 'pending' | 'submitted' | 'approved' | 'rejected',
    documentId?: string,
    expectedFromStatuses?: string[],
  ): Promise<TeamMessage | null> {
    const [message] = await db.select().from(teamMessages).where(eq(teamMessages.id, messageId));

    if (!message || message.messageType !== 'document_request') {
      return null;
    }

    const requestData = message.documentRequestData as any;
    if (!requestData) return null;

    const updatedData = {
      ...requestData,
      status,
      documentId: documentId || requestData.documentId,
    };

    // Conditional update: when an expected-prior-state set is supplied, the
    // WHERE clause also matches on the current JSON status, so a concurrent
    // writer that already changed it yields 0 rows (caller treats as 409).
    const whereClause = expectedFromStatuses && expectedFromStatuses.length > 0
      ? and(
          eq(teamMessages.id, messageId),
          inArray(
            sql`COALESCE(${teamMessages.documentRequestData}->>'status', 'pending')`,
            expectedFromStatuses,
          ),
        )
      : eq(teamMessages.id, messageId);

    const [updated] = await db.update(teamMessages)
      .set({ documentRequestData: updatedData })
      .where(whereClause)
      .returning();

    return updated ?? null;
  }
  
  async getPendingDocumentRequests(userId: string): Promise<TeamMessage[]> {
    const messages = await db.select()
      .from(teamMessages)
      .where(
        and(
          eq(teamMessages.recipientId, userId),
          eq(teamMessages.messageType, 'document_request')
        )
      )
      .orderBy(desc(teamMessages.createdAt));
    
    // Filter to only pending requests
    return messages.filter(msg => {
      const data = msg.documentRequestData as any;
      return data?.status === 'pending';
    });
  }

}
