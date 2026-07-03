import { db } from "../db";
import { userActivities } from "@shared/schema";
import { and, eq, gte, sql } from "drizzle-orm";

/**
 * 7-day behavioral summary used by the dashboard's next-action logic and the
 * /api/user-activity-summary endpoint. One grouped query.
 */

export interface UserActivitySummary {
  totalPageViews: number;
  propertySearches: number;
  calculatorUses: number;
  coachChats: number;
  propertyViews: number;
  activities: Array<{ activityType: string; count: number; lastSeen: string }>;
}

export async function getUserActivitySummary(userId: string): Promise<UserActivitySummary> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentActivities = await db
    .select({
      activityType: userActivities.activityType,
      count: sql<number>`count(*)::int`,
      lastSeen: sql<string>`max(${userActivities.createdAt})`,
    })
    .from(userActivities)
    .where(and(
      eq(userActivities.userId, userId),
      gte(userActivities.createdAt, sevenDaysAgo)
    ))
    .groupBy(userActivities.activityType);

  const countOf = (type: string) =>
    recentActivities.find((a) => a.activityType === type)?.count || 0;

  return {
    totalPageViews: countOf("page_view"),
    propertySearches: countOf("property_search"),
    calculatorUses: countOf("calculator_use"),
    coachChats: countOf("coach_chat"),
    propertyViews: countOf("property_view"),
    activities: recentActivities,
  };
}
