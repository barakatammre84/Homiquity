// Storage domain: Plaid verifications + link tokens.
// One link in the DatabaseStorage inheritance chain — see ./index.ts.
import { db } from "../db";
import { eq, desc } from "drizzle-orm";
// SSN uses ssnVault (canonical, from main); account numbers use piiVault (this
// branch — main leaves account numbers plaintext).

import { verifications, plaidLinkTokens, type Verification, type InsertVerification, type PlaidLinkToken, type InsertPlaidLinkToken } from "@shared/schema";
import { PipelineStorage } from "./pipeline";
export class VerificationsStorage extends PipelineStorage {
  // Plaid Verifications
  async createPlaidLinkToken(data: InsertPlaidLinkToken): Promise<PlaidLinkToken> {
    const [token] = await db.insert(plaidLinkTokens).values(data).returning();
    return token;
  }

  async getPlaidLinkToken(id: string): Promise<PlaidLinkToken | undefined> {
    const [token] = await db
      .select()
      .from(plaidLinkTokens)
      .where(eq(plaidLinkTokens.id, id))
      .limit(1);
    return token;
  }

  async updatePlaidLinkToken(id: string, data: Partial<PlaidLinkToken>): Promise<PlaidLinkToken | undefined> {
    const { id: tokenId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(plaidLinkTokens)
      .set(cleanData)
      .where(eq(plaidLinkTokens.id, id))
      .returning();
    return updated;
  }

  async createVerification(data: InsertVerification): Promise<Verification> {
    const [verification] = await db.insert(verifications).values(data).returning();
    return verification;
  }

  async getVerification(id: string): Promise<Verification | undefined> {
    const [verification] = await db
      .select()
      .from(verifications)
      .where(eq(verifications.id, id))
      .limit(1);
    return verification;
  }

  async getVerificationsByApplication(applicationId: string): Promise<Verification[]> {
    return await db
      .select()
      .from(verifications)
      .where(eq(verifications.applicationId, applicationId))
      .orderBy(desc(verifications.createdAt));
  }

  async getVerificationsByUser(userId: string): Promise<Verification[]> {
    return await db
      .select()
      .from(verifications)
      .where(eq(verifications.userId, userId))
      .orderBy(desc(verifications.createdAt));
  }

  async updateVerification(id: string, data: Partial<Verification>): Promise<Verification | undefined> {
    const { id: verId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(verifications)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(verifications.id, id))
      .returning();
    return updated;
  }

}
