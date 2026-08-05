// Agent/broker routes: Agent directory: list/search, referral requests, agent detail + listings.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import type { IStorage } from "../../storage";
import { isAuthenticated, requireRole } from "../../auth";
import { isPartnerRole } from "@shared/roles";
import { z } from "zod";
import crypto from "crypto";
import { db } from "../../db";
import { inArray } from "drizzle-orm";
import {
  type User,
  isInternalStaffRole,
  isStaffRole,
  insertAgentReferralRequestSchema,
  insertAgentProfileSchema,
  insertApplicationMilestoneSchema,
  loanApplications,
} from "@shared/schema";
import { parseBodyOr400 } from "../validate";
import { firstQueryValue } from "../queryParams";
import { routeParam } from "../../http/routeParams";


export function registerAgentDirectoryRoutes(
  app: Express,
  storage: IStorage,
) {
  app.get("/api/agents", async (req, res) => {
    try {
      const agents = await storage.getAllAgentProfiles();
      res.json(agents);
    } catch (error) {
      console.error("Get agents error:", error);
      res.status(500).json({ error: "Failed to get agents" });
    }
  });

  app.get("/api/agents/search", async (req, res) => {
    try {
      const agents = await storage.searchAgentProfiles({
        location: firstQueryValue(req.query.location),
        specialty: firstQueryValue(req.query.specialty),
      });
      const agentUsers = await storage.getUsersByIds([...new Set(agents.map((a) => a.userId))]);
      const usersById = new Map(agentUsers.map((u) => [u.id, u]));
      const enriched = agents.map((agent) => {
          const user = usersById.get(agent.userId);
          return {
            id: agent.id,
            firstName: user?.firstName || "Agent",
            lastName: user?.lastName || "",
            bio: agent.bio,
            brokerage: agent.brokerage,
            specialties: agent.specialties,
            serviceArea: agent.serviceArea,
            photoUrl: agent.photoUrl,
            averageRating: agent.averageRating,
            totalReviews: agent.totalReviews,
            propertiesSold: agent.propertiesSold,
            activeListings: agent.activeListings,
            yearsInBusiness: agent.yearsInBusiness,
            isVerified: agent.isVerified,
          };
        });
      res.json(enriched);
    } catch (error) {
      console.error("Search agents error:", error);
      res.status(500).json({ error: "Failed to search agents" });
    }
  });

  app.post("/api/agent-referral-requests", async (req, res) => {
    try {
      const parsed = insertAgentReferralRequestSchema.parse(req.body);
      const request = await storage.createAgentReferralRequest(parsed);

      let matchedAgent = null;
      let bestMatch = null;

      if (parsed.preferredAgentId) {
        bestMatch = await storage.getAgentProfile(parsed.preferredAgentId);
      }

      if (!bestMatch) {
        const agents = await storage.searchAgentProfiles({
          location: parsed.location,
        });
        if (agents.length > 0) {
          bestMatch = agents[0];
        }
      }

      if (bestMatch) {
        await storage.updateAgentReferralRequest(request.id, {
          matchedAgentId: bestMatch.id,
          status: "matched",
          referralSentAt: new Date(),
        });
        const user = await storage.getUser(bestMatch.userId);
        matchedAgent = {
          firstName: user?.firstName || "Agent",
          lastName: user?.lastName || "",
          brokerage: bestMatch.brokerage,
          photoUrl: bestMatch.photoUrl,
        };
      }

      res.json({
        id: request.id,
        status: matchedAgent ? "matched" : "pending",
        matchedAgent,
      });
    } catch (error) {
      console.error("Create referral request error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.issues });
      }
      res.status(500).json({ error: "Failed to submit referral request" });
    }
  });

  app.get("/api/agent-referral-requests", requireRole("admin"), async (req, res) => {
    try {
      const requests = await storage.getAgentReferralRequests();
      res.json(requests);
    } catch (error) {
      console.error("Get referral requests error:", error);
      res.status(500).json({ error: "Failed to get referral requests" });
    }
  });

  app.get("/api/agents/:agentId", async (req, res) => {
    try {
      const agent = await storage.getAgentProfile(routeParam(req, "agentId"));
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      const user = await storage.getUser(agent.userId);
      res.json({
        ...agent,
        user: user ? { email: user.email, firstName: user.firstName, lastName: user.lastName } : undefined,
      });
    } catch (error) {
      console.error("Get agent error:", error);
      res.status(500).json({ error: "Failed to get agent" });
    }
  });

  app.get("/api/agents/:agentId/listings", async (req, res) => {
    try {
      const properties = await storage.getPropertiesByAgent(routeParam(req, "agentId"));
      res.json(properties.filter(p => p.status === "active"));
    } catch (error) {
      console.error("Get agent listings error:", error);
      res.status(500).json({ error: "Failed to get agent listings" });
    }
  });

  // Current user agent profile routes.
  // Staff/partner roles only: this GET auto-provisions an agent profile, and an
  // agent profile is the key that unlocks listing management (POST /api/properties)
  // and public agent-directory presence — consumer and CPA accounts must never be
  // able to mint one for themselves.
}
