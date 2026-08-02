// Borrower routes: Partner providers + partner orders (credit/title/appraisal).
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import { type IStorage } from "../../storage";
import { isAuthenticated, requireRole } from "../../auth";
import { isStaffRole, isInternalStaffRole, type User } from "@shared/schema";
import { z } from "zod";
import { firstQueryValue } from "../queryParams";

// Verify that an internal staff user is actually assigned to the given application.
// Returns true for admin (unrestricted), checks LO assignment for lo/loa, and
// deal-team membership for processor/underwriter/closer.
// External partner roles (broker, lender) are NOT permitted by this helper.
// Exported: the LO-2 scenario route reuses this gate (one access model, no forks).
import { verifyInternalStaffApplicationAccess } from "./access";
import { routeParams } from "../../http/routeParams";

export function registerPartnerOrderRoutes(
  app: Express,
  storage: IStorage,
) {
  // Get all partner providers
  app.get("/api/partner-providers", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const serviceType = firstQueryValue(req.query.serviceType);
      let providers;
      if (serviceType) {
        providers = await storage.getPartnerProvidersByServiceType(serviceType);
      } else {
        providers = await storage.getAllPartnerProviders();
      }
      res.json(providers);
    } catch (error) {
      console.error("Get partner providers error:", error);
      res.status(500).json({ error: "Failed to get providers" });
    }
  });

  // Create partner provider (admin only)
  app.post("/api/partner-providers", requireRole("admin"), async (req, res) => {
    try {
      const schema = z.object({
        name: z.string(),
        code: z.string(),
        serviceType: z.string(),
        apiBaseUrl: z.string().optional(),
        apiVersion: z.string().optional(),
        baseFee: z.string().optional(),
        contactEmail: z.string().optional(),
        contactPhone: z.string().optional(),
        expectedTurnaroundHours: z.number().optional(),
        isTestMode: z.boolean().default(true),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      const provider = await storage.createPartnerProvider({
        ...result.data,
        isActive: true,
      });

      res.status(201).json(provider);
    } catch (error) {
      console.error("Create partner provider error:", error);
      res.status(500).json({ error: "Failed to create provider" });
    }
  });

  // Create partner order (credit, title, appraisal, etc.)
  app.post("/api/partner-orders", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isInternalStaffRole(user.role)) {
        return res.status(403).json({ error: "Internal staff only can create partner orders" });
      }

      const schema = z.object({
        applicationId: z.string(),
        providerId: z.string(),
        serviceType: z.string(),
        notes: z.string().optional(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      // Verify caller is assigned to this application (assignment-scoped)
      const partnerOrderAllowed = await verifyInternalStaffApplicationAccess(storage, result.data.applicationId, user.id, user.role);
      if (!partnerOrderAllowed) {
        return res.status(403).json({ error: "Access denied to this application" });
      }

      const provider = await storage.getPartnerProvider(result.data.providerId);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      const order = await storage.createPartnerOrder({
        ...result.data,
        status: "pending",
        orderedBy: user.id,
        orderedAt: new Date(),
        fee: provider.baseFee,
      });

      // Log activity
      await storage.createDealActivity({
        applicationId: result.data.applicationId,
        activityType: "partner_order_created",
        title: `${result.data.serviceType} Order Created`,
        description: `Order placed with ${provider.name}`,
        metadata: { orderId: order.id, providerId: provider.id },
        performedBy: user.id,
      });

      res.status(201).json(order);
    } catch (error) {
      console.error("Create partner order error:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  // Get partner orders for an application
  app.get("/api/partner-orders/application/:applicationId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = routeParams(req);
      const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      const orders = await storage.getPartnerOrdersByApplication(applicationId);
      res.json(orders);
    } catch (error) {
      console.error("Get partner orders error:", error);
      res.status(500).json({ error: "Failed to get orders" });
    }
  });

  // Update partner order status (webhook simulation / manual update)
  app.patch("/api/partner-orders/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isInternalStaffRole(user.role)) {
        return res.status(403).json({ error: "Internal staff only" });
      }

      const { id } = routeParams(req);
      const schema = z.object({
        status: z.enum(["pending", "submitted", "in_progress", "completed", "failed", "cancelled"]).optional(),
        resultSummary: z.record(z.any()).optional(),
        creditScoreExperian: z.number().optional(),
        creditScoreEquifax: z.number().optional(),
        creditScoreTransUnion: z.number().optional(),
        appraisedValue: z.string().optional(),
        titleStatus: z.string().optional(),
        completedAt: z.string().transform(s => new Date(s)).optional(),
        errorMessage: z.string().optional(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      // Verify the order exists and caller is assigned to its application (assignment-scoped)
      const existingOrder = await storage.getPartnerOrder(id);
      if (!existingOrder) {
        return res.status(404).json({ error: "Order not found" });
      }
      const partnerOrderUpdateAllowed = await verifyInternalStaffApplicationAccess(storage, existingOrder.applicationId, user.id, user.role);
      if (!partnerOrderUpdateAllowed) {
        return res.status(403).json({ error: "Access denied to this application" });
      }

      const updated = await storage.updatePartnerOrder(id, result.data as any);
      if (!updated) {
        return res.status(404).json({ error: "Order not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Update partner order error:", error);
      res.status(500).json({ error: "Failed to update order" });
    }
  });

  // ===== DEAL TEAM MEMBERS =====

}
