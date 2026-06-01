import type { Express } from "express";
import type { IStorage } from "../storage";
import { isAuthenticated, requireRole } from "../auth";
import type { User } from "@shared/schema";
import { db } from "../db";
import {
  borrowerProfiles,
  realEstateOwned,
  lenderProducts,
  insertBorrowerProfileSchema,
  insertRealEstateOwnedSchema,
  insertLenderProductSchema,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  getCurrentState,
  getStateHistory,
  transitionState,
  getAvailableTransitions,
  getStateMetadata,
  initializeBorrowerState,
} from "../services/borrowerStateMachine";
import type { BorrowerState, TransitionTrigger } from "@shared/schema";
import { matchBorrowerToLenders, getTopMatches } from "../services/lenderMatchingEngine";
import {
  trackIntent,
  getIntentSummary,
  initializeReadinessChecklist,
  updateReadinessField,
  getReadinessScore,
} from "../services/intentTracker";

export function registerIntelligenceRoutes(
  app: Express,
  storage: IStorage,
) {

  app.get("/api/intelligence/profile", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const [profile] = await db.select().from(borrowerProfiles)
        .where(eq(borrowerProfiles.userId, user.id)).limit(1);
      res.json(profile || null);
    } catch (error) {
      console.error("Get borrower profile error:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.put("/api/intelligence/profile", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const data = insertBorrowerProfileSchema.parse({ ...req.body, userId: user.id });
      const [existing] = await db.select({ id: borrowerProfiles.id })
        .from(borrowerProfiles)
        .where(eq(borrowerProfiles.userId, user.id)).limit(1);

      if (existing) {
        const [updated] = await db.update(borrowerProfiles)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(borrowerProfiles.userId, user.id))
          .returning();
        res.json(updated);
      } else {
        const [created] = await db.insert(borrowerProfiles).values(data).returning();
        res.status(201).json(created);
      }
    } catch (error) {
      console.error("Update borrower profile error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.get("/api/intelligence/reo", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const rows = await db.select().from(realEstateOwned)
        .where(eq(realEstateOwned.userId, user.id));
      res.json(rows);
    } catch (error) {
      console.error("Get REO error:", error);
      res.status(500).json({ error: "Failed to fetch real estate owned" });
    }
  });

  app.post("/api/intelligence/reo", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const data = insertRealEstateOwnedSchema.parse({ ...req.body, userId: user.id });
      const [created] = await db.insert(realEstateOwned).values(data).returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("Create REO error:", error);
      res.status(500).json({ error: "Failed to add property" });
    }
  });

  app.delete("/api/intelligence/reo/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const [existing] = await db.select().from(realEstateOwned)
        .where(eq(realEstateOwned.id, req.params.id)).limit(1);
      if (!existing || existing.userId !== user.id) {
        return res.status(404).json({ error: "Property not found" });
      }
      await db.delete(realEstateOwned)
        .where(eq(realEstateOwned.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Delete REO error:", error);
      res.status(500).json({ error: "Failed to remove property" });
    }
  });

  app.get("/api/intelligence/state", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const current = await getCurrentState(user.id);
      const metadata = getStateMetadata(current);
      const available = getAvailableTransitions(current);
      res.json({ currentState: current, metadata, availableTransitions: available });
    } catch (error) {
      console.error("Get state error:", error);
      res.status(500).json({ error: "Failed to fetch state" });
    }
  });

  app.get("/api/intelligence/state/history", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const history = await getStateHistory(user.id);
      res.json(history);
    } catch (error) {
      console.error("Get state history error:", error);
      res.status(500).json({ error: "Failed to fetch state history" });
    }
  });

  app.post("/api/intelligence/state/transition", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { toState, trigger, applicationId, metadata } = req.body;

      const result = await transitionState(user.id, toState as BorrowerState, trigger as TransitionTrigger, {
        applicationId,
        triggeredByUserId: user.id,
        metadata,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.json(result);
    } catch (error) {
      console.error("State transition error:", error);
      res.status(500).json({ error: "Failed to transition state" });
    }
  });

  app.post("/api/intelligence/state/initialize", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      await initializeBorrowerState(user.id);
      const current = await getCurrentState(user.id);
      res.json({ currentState: current });
    } catch (error) {
      console.error("Initialize state error:", error);
      res.status(500).json({ error: "Failed to initialize state" });
    }
  });

  app.get("/api/intelligence/lender-matches", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const forceRefresh = req.query.refresh === "true";
      const matches = await matchBorrowerToLenders(user.id, { forceRefresh });
      res.json(matches);
    } catch (error) {
      console.error("Lender matching error:", error);
      res.status(500).json({ error: "Failed to match lenders" });
    }
  });

  app.get("/api/intelligence/lender-matches/top", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const limit = parseInt(req.query.limit as string) || 5;
      const matches = await getTopMatches(user.id, limit);
      res.json(matches);
    } catch (error) {
      console.error("Top matches error:", error);
      res.status(500).json({ error: "Failed to get top matches" });
    }
  });

  app.post("/api/intelligence/events", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { eventType, ...options } = req.body;
      await trackIntent(eventType, { ...options, userId: user.id });
      res.json({ success: true });
    } catch (error) {
      console.error("Track intent error:", error);
      res.status(500).json({ error: "Failed to track event" });
    }
  });

  app.post("/api/intelligence/events/batch", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { events } = req.body;
      if (!Array.isArray(events)) return res.status(400).json({ error: "events must be an array" });

      for (const event of events) {
        const { eventType, ...options } = event;
        await trackIntent(eventType, { ...options, userId: user.id });
      }
      res.json({ success: true, tracked: events.length });
    } catch (error) {
      console.error("Batch track error:", error);
      res.status(500).json({ error: "Failed to track events" });
    }
  });

  app.get("/api/intelligence/intent-summary", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const days = parseInt(req.query.days as string) || 30;
      const summary = await getIntentSummary(user.id, days);
      res.json(summary);
    } catch (error) {
      console.error("Intent summary error:", error);
      res.status(500).json({ error: "Failed to get intent summary" });
    }
  });

  app.get("/api/intelligence/readiness", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const score = await getReadinessScore(user.id);
      res.json(score);
    } catch (error) {
      console.error("Readiness score error:", error);
      res.status(500).json({ error: "Failed to get readiness score" });
    }
  });

  app.post("/api/intelligence/readiness/initialize", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      await initializeReadinessChecklist(user.id, req.body.applicationId);
      const score = await getReadinessScore(user.id);
      res.json(score);
    } catch (error) {
      console.error("Initialize readiness error:", error);
      res.status(500).json({ error: "Failed to initialize readiness checklist" });
    }
  });

  app.put("/api/intelligence/readiness/:fieldName", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { fieldName } = req.params;
      const { verificationStatus, sourceTable, sourceField, sourceRecordId } = req.body;

      await updateReadinessField(user.id, fieldName, {
        verificationStatus,
        sourceTable,
        sourceField,
        sourceRecordId,
      });
      const score = await getReadinessScore(user.id);
      res.json(score);
    } catch (error) {
      console.error("Update readiness field error:", error);
      res.status(500).json({ error: "Failed to update readiness field" });
    }
  });

  app.get("/api/admin/lender-products", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const products = await db.select().from(lenderProducts);
      res.json(products);
    } catch (error) {
      console.error("Get lender products error:", error);
      res.status(500).json({ error: "Failed to fetch lender products" });
    }
  });

  app.post("/api/admin/lender-products", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const data = insertLenderProductSchema.parse(req.body);
      const [created] = await db.insert(lenderProducts).values(data).returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("Create lender product error:", error);
      res.status(500).json({ error: "Failed to create lender product" });
    }
  });

  app.put("/api/admin/lender-products/:id", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const data = insertLenderProductSchema.partial().parse(req.body);
      const [updated] = await db.update(lenderProducts)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(lenderProducts.id, req.params.id))
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("Update lender product error:", error);
      res.status(500).json({ error: "Failed to update lender product" });
    }
  });

  app.delete("/api/admin/lender-products/:id", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      await db.delete(lenderProducts).where(eq(lenderProducts.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Delete lender product error:", error);
      res.status(500).json({ error: "Failed to delete lender product" });
    }
  });

  app.get("/api/staff/borrower/:userId/state", requireRole("admin"), async (req, res) => {
    try {
      const { userId } = req.params;
      const current = await getCurrentState(userId);
      const metadata = getStateMetadata(current);
      const history = await getStateHistory(userId);
      res.json({ currentState: current, metadata, history });
    } catch (error) {
      console.error("Staff get borrower state error:", error);
      res.status(500).json({ error: "Failed to fetch borrower state" });
    }
  });

  app.post("/api/staff/borrower/:userId/state/transition", requireRole("admin"), async (req, res) => {
    try {
      const staffUser = req.user as User;
      const { userId } = req.params;
      const { toState, trigger, applicationId, metadata } = req.body;

      const result = await transitionState(userId, toState as BorrowerState, trigger as TransitionTrigger, {
        applicationId,
        triggeredByUserId: staffUser.id,
        metadata: { ...metadata, staffOverride: true },
      });

      if (!result.success) return res.status(400).json({ error: result.error });
      res.json(result);
    } catch (error) {
      console.error("Staff state transition error:", error);
      res.status(500).json({ error: "Failed to transition state" });
    }
  });
}
