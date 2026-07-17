// Storage domain: Agent profiles + property CRUD extensions.
// One link in the DatabaseStorage inheritance chain — see ./index.ts.
import { db } from "../db";
import { eq, desc, and, sql } from "drizzle-orm";
// SSN uses ssnVault (canonical, from main); account numbers use piiVault (this
// branch — main leaves account numbers plaintext).

import {
  properties,
  savedProperties,
  agentProfiles,
  type Property,
  type AgentProfile,
  type InsertAgentProfile,
  agentReferralRequests,
  type AgentReferralRequest,
  type InsertAgentReferralRequest,
} from "@shared/schema";
import { UrlaStorage } from "./urla";
export class AgentProfilesStorage extends UrlaStorage {
  // Agent Profiles
  async createAgentProfile(data: InsertAgentProfile): Promise<AgentProfile> {
    const [profile] = await db.insert(agentProfiles).values(data).returning();
    return profile;
  }

  async getAgentProfile(id: string): Promise<AgentProfile | undefined> {
    const [profile] = await db
      .select()
      .from(agentProfiles)
      .where(eq(agentProfiles.id, id))
      .limit(1);
    return profile;
  }

  async getAgentProfileByUserId(userId: string): Promise<AgentProfile | undefined> {
    const [profile] = await db
      .select()
      .from(agentProfiles)
      .where(eq(agentProfiles.userId, userId))
      .limit(1);
    return profile;
  }

  async updateAgentProfile(id: string, data: Partial<AgentProfile>): Promise<AgentProfile | undefined> {
    const { createdAt, updatedAt, id: profileId, ...cleanData } = data as any;
    const [updated] = await db
      .update(agentProfiles)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(agentProfiles.id, id))
      .returning();
    return updated;
  }

  async getAllAgentProfiles(): Promise<AgentProfile[]> {
    return await db.select().from(agentProfiles).orderBy(desc(agentProfiles.createdAt));
  }

  async searchAgentProfiles(filters: { location?: string; specialty?: string }): Promise<AgentProfile[]> {
    let query = db.select().from(agentProfiles);
    const conditions = [];
    if (filters.location) {
      conditions.push(sql`${agentProfiles.serviceArea} && ARRAY[${filters.location}]::text[]`);
    }
    if (filters.specialty) {
      conditions.push(sql`${agentProfiles.specialties} && ARRAY[${filters.specialty}]::text[]`);
    }
    if (conditions.length > 0) {
      return await (query as any).where(and(...conditions)).orderBy(desc(agentProfiles.averageRating));
    }
    return await query.orderBy(desc(agentProfiles.averageRating));
  }

  async createAgentReferralRequest(data: InsertAgentReferralRequest): Promise<AgentReferralRequest> {
    const [request] = await db.insert(agentReferralRequests).values(data).returning();
    return request;
  }

  async getAgentReferralRequests(agentId?: string): Promise<AgentReferralRequest[]> {
    if (agentId) {
      return await db.select().from(agentReferralRequests)
        .where(eq(agentReferralRequests.matchedAgentId, agentId))
        .orderBy(desc(agentReferralRequests.createdAt));
    }
    return await db.select().from(agentReferralRequests).orderBy(desc(agentReferralRequests.createdAt));
  }

  async updateAgentReferralRequest(id: string, data: Partial<AgentReferralRequest>): Promise<AgentReferralRequest | undefined> {
    const { id: _id, createdAt, ...cleanData } = data as any;
    const [updated] = await db.update(agentReferralRequests)
      .set(cleanData)
      .where(eq(agentReferralRequests.id, id))
      .returning();
    return updated;
  }

  // Property CRUD extensions
  async updateProperty(id: string, data: Partial<Property>): Promise<Property | undefined> {
    const { createdAt, updatedAt, id: propId, ...cleanData } = data as any;
    const [updated] = await db
      .update(properties)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(properties.id, id))
      .returning();
    return updated;
  }

  async deleteProperty(id: string): Promise<void> {
    await db.delete(savedProperties).where(eq(savedProperties.propertyId, id));
    await db.delete(properties).where(eq(properties.id, id));
  }

  async getPropertiesByAgent(agentId: string): Promise<Property[]> {
    return await db
      .select()
      .from(properties)
      .where(eq(properties.agentId, agentId))
      .orderBy(desc(properties.createdAt));
  }

}
