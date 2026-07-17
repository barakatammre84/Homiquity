// Borrower routes: Multi-property support: list/add/switch/deal-fell-through/update.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import { type IStorage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { unlicensedStateRejection } from "@shared/companyIdentity";

// Verify that an internal staff user is actually assigned to the given application.
// Returns true for admin (unrestricted), checks LO assignment for lo/loa, and
// deal-team membership for processor/underwriter/closer.
// External partner roles (broker, lender) are NOT permitted by this helper.
// Exported: the LO-2 scenario route reuses this gate (one access model, no forks).

export function registerApplicationPropertyRoutes(
  app: Express,
  storage: IStorage,
) {
  // Application Properties Routes - multi-property support
  app.get("/api/loan-applications/:id/properties", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      const properties = await storage.getApplicationProperties(id);
      res.json(properties);
    } catch (error) {
      console.error("Get application properties error:", error);
      res.status(500).json({ error: "Failed to get properties" });
    }
  });

  app.get("/api/loan-applications/:id/current-property", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      const property = await storage.getCurrentProperty(id);
      res.json(property || null);
    } catch (error) {
      console.error("Get current property error:", error);
      res.status(500).json({ error: "Failed to get current property" });
    }
  });

  app.post("/api/loan-applications/:id/properties", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Licensed-state gate (roadmap A5): attaching a property stamps its
      // state onto the application — same footprint rule as intake.
      const stateRejection = unlicensedStateRejection(req.body.state);
      if (stateRejection) {
        return res.status(422).json(stateRejection);
      }

      const propertyData = {
        applicationId: id,
        address: req.body.address,
        city: req.body.city,
        state: req.body.state,
        zipCode: req.body.zipCode,
        propertyType: req.body.propertyType,
        purchasePrice: req.body.purchasePrice?.toString().replace(/[,$]/g, "") || "0",
        downPayment: req.body.downPayment?.toString().replace(/[,$]/g, "") || "0",
        isCurrentProperty: true,
        status: "active" as const,
        offerAmount: req.body.offerAmount?.toString().replace(/[,$]/g, ""),
        offerDate: req.body.offerDate ? new Date(req.body.offerDate) : undefined,
        offerStatus: req.body.offerStatus,
      };

      const property = await storage.createApplicationProperty(propertyData);

      // Also update the main application with the new property details
      await storage.updateLoanApplication(id, {
        propertyAddress: property.address,
        propertyCity: property.city || undefined,
        propertyState: property.state || undefined,
        propertyZip: property.zipCode || undefined,
        propertyType: property.propertyType || undefined,
        purchasePrice: property.purchasePrice,
        downPayment: property.downPayment || undefined,
      });

      // Log the activity
      await storage.createDealActivity({
        applicationId: id,
        activityType: "status_change",
        title: "New Property Added",
        description: `Property at ${property.address} has been added to the application.`,
        performedBy: req.user!.id,
      });

      res.status(201).json(property);
    } catch (error) {
      console.error("Create application property error:", error);
      res.status(500).json({ error: "Failed to add property" });
    }
  });

  app.post("/api/loan-applications/:id/properties/:propertyId/switch", isAuthenticated, async (req, res) => {
    try {
      const { id, propertyId } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const property = await storage.switchToProperty(id, propertyId);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      // Licensed-state gate (roadmap A5): switching makes this property the
      // subject property — refuse when it sits outside the footprint.
      const stateRejection = unlicensedStateRejection(property.state);
      if (stateRejection) {
        return res.status(422).json(stateRejection);
      }

      // Update the main application with the switched property details
      await storage.updateLoanApplication(id, {
        propertyAddress: property.address,
        propertyCity: property.city || undefined,
        propertyState: property.state || undefined,
        propertyZip: property.zipCode || undefined,
        propertyType: property.propertyType || undefined,
        purchasePrice: property.purchasePrice,
        downPayment: property.downPayment || undefined,
      });

      // Log the activity
      await storage.createDealActivity({
        applicationId: id,
        activityType: "status_change",
        title: "Property Switched",
        description: `Application property changed to ${property.address}.`,
        performedBy: req.user!.id,
      });

      res.json(property);
    } catch (error) {
      console.error("Switch property error:", error);
      res.status(500).json({ error: "Failed to switch property" });
    }
  });

  app.post("/api/loan-applications/:id/properties/:propertyId/deal-fell-through", isAuthenticated, async (req, res) => {
    try {
      const { id, propertyId } = req.params;
      const { reason } = req.body;
      
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const property = await storage.markDealFellThrough(id, propertyId, reason || "Deal did not proceed");
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      // Log the activity
      await storage.createDealActivity({
        applicationId: id,
        activityType: "status_change",
        title: "Deal Fell Through",
        description: `The deal for ${property.address} did not proceed. Reason: ${reason || "Not specified"}`,
        performedBy: req.user!.id,
      });

      res.json(property);
    } catch (error) {
      console.error("Mark deal fell through error:", error);
      res.status(500).json({ error: "Failed to update property status" });
    }
  });

  app.patch("/api/loan-applications/:id/properties/:propertyId", isAuthenticated, async (req, res) => {
    try {
      const { id, propertyId } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Licensed-state gate (roadmap A5): a property edit can change the
      // state; the current property syncs onto the application below.
      const stateRejection = unlicensedStateRejection(req.body.state);
      if (stateRejection) {
        return res.status(422).json(stateRejection);
      }

      const updateData: any = {};
      if (req.body.address !== undefined) updateData.address = req.body.address;
      if (req.body.city !== undefined) updateData.city = req.body.city;
      if (req.body.state !== undefined) updateData.state = req.body.state;
      if (req.body.zipCode !== undefined) updateData.zipCode = req.body.zipCode;
      if (req.body.propertyType !== undefined) updateData.propertyType = req.body.propertyType;
      if (req.body.purchasePrice !== undefined) updateData.purchasePrice = req.body.purchasePrice?.toString().replace(/[,$]/g, "");
      if (req.body.downPayment !== undefined) updateData.downPayment = req.body.downPayment?.toString().replace(/[,$]/g, "");
      if (req.body.offerAmount !== undefined) updateData.offerAmount = req.body.offerAmount?.toString().replace(/[,$]/g, "");
      if (req.body.offerStatus !== undefined) updateData.offerStatus = req.body.offerStatus;
      if (req.body.status !== undefined) updateData.status = req.body.status;

      const property = await storage.updateApplicationProperty(id, propertyId, updateData);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      // If this is the current property, also update the main application
      if (property.isCurrentProperty) {
        await storage.updateLoanApplication(id, {
          propertyAddress: property.address,
          propertyCity: property.city || undefined,
          propertyState: property.state || undefined,
          propertyZip: property.zipCode || undefined,
          propertyType: property.propertyType || undefined,
          purchasePrice: property.purchasePrice,
          downPayment: property.downPayment || undefined,
        });
      }

      res.json(property);
    } catch (error) {
      console.error("Update application property error:", error);
      res.status(500).json({ error: "Failed to update property" });
    }
  });

}
