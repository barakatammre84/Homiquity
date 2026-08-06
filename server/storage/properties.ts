// Storage domain: Properties + saved properties.
// One link in the DatabaseStorage inheritance chain — see ./index.ts.
import { db } from "../db";
import {
  eq,
  desc,
  and,
  gte,
  lte,
  or,
  ilike,
} from "drizzle-orm";
// SSN uses ssnVault (canonical, from main); account numbers use piiVault (this
// branch — main leaves account numbers plaintext).

import { properties, savedProperties, type Property, type InsertProperty } from "@shared/schema";
import { ApplicationsStorage } from "./applications";
export class PropertiesStorage extends ApplicationsStorage {
  // Properties
  async createProperty(data: InsertProperty): Promise<Property> {
    const [property] = await db.insert(properties).values(data).returning();
    return property;
  }

  async getProperty(id: string): Promise<Property | undefined> {
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, id))
      .limit(1);
    return property;
  }

  async getAllProperties(filters?: {
    search?: string;
    type?: string;
    minPrice?: number;
    maxPrice?: number;
  }): Promise<Property[]> {
    let query = db.select().from(properties);
    const conditions = [];

    if (filters?.type && filters.type !== "all") {
      conditions.push(eq(properties.propertyType, filters.type));
    }

    if (filters?.minPrice !== undefined) {
      conditions.push(gte(properties.price, filters.minPrice.toString()));
    }

    if (filters?.maxPrice !== undefined) {
      conditions.push(lte(properties.price, filters.maxPrice.toString()));
    }

    if (filters?.search) {
      conditions.push(
        or(
          ilike(properties.address, `%${filters.search}%`),
          ilike(properties.city, `%${filters.search}%`),
          ilike(properties.state, `%${filters.search}%`)
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await query.orderBy(desc(properties.createdAt));
  }

  /**
   * Idempotent by check-then-insert: saved_properties has no unique index on
   * (user_id, property_id), so a bare insert let a double click record the
   * same property twice and getSavedProperties returned it twice. The check
   * races in principle; unsaveProperty deletes every matching row, so a
   * duplicate that slips through is still fully removable.
   */
  async saveProperty(userId: string, propertyId: string): Promise<void> {
    const [existing] = await db
      .select({ id: savedProperties.id })
      .from(savedProperties)
      .where(and(eq(savedProperties.userId, userId), eq(savedProperties.propertyId, propertyId)))
      .limit(1);
    if (existing) return;
    await db.insert(savedProperties).values({ userId, propertyId });
  }

  async unsaveProperty(userId: string, propertyId: string): Promise<void> {
    await db
      .delete(savedProperties)
      .where(and(eq(savedProperties.userId, userId), eq(savedProperties.propertyId, propertyId)));
  }

  /** Just the ids — what the UI needs to render each heart's state. */
  async getSavedPropertyIds(userId: string): Promise<string[]> {
    const rows = await db
      .select({ propertyId: savedProperties.propertyId })
      .from(savedProperties)
      .where(eq(savedProperties.userId, userId));
    return Array.from(new Set(rows.map((r) => r.propertyId)));
  }

  async getSavedProperties(userId: string): Promise<Property[]> {
    const saved = await db
      .select({ property: properties })
      .from(savedProperties)
      .innerJoin(properties, eq(savedProperties.propertyId, properties.id))
      .where(eq(savedProperties.userId, userId));
    return saved.map((s) => s.property);
  }

}
