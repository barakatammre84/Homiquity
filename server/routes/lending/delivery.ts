// Lending routes: MISMO 3.4 export + data-quality scoring.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import type { IStorage } from "../../storage";
import { isAuthenticated, requireRole } from "../../auth";
import { insertBorrowerDeclarationsSchema } from "@shared/schema";
import { generateMISMO34XML, type MISMOLoanDTO } from "../../mismo";
import { z } from "zod";
import * as creditService from "../../services/creditService";
import { routeParams } from "../../http/routeParams";

const declarationsValidationSchema = insertBorrowerDeclarationsSchema.partial().extend({
  applicationId: z.string().optional(),
});

// Intake validation lives in shared/schema/lending.ts (loanApplicationIntakeSchema),
// derived from the same base schema the funnel validates with client-side — the
// server rejects exactly what the client rejects, and "not_sure" credit maps to
// the named CREDIT_SCORE_UNKNOWN_DEFAULT instead of a silent clamp.

export function registerDeliveryRoutes(
  app: Express,
  storage: IStorage,
) {
  app.get("/api/loan-applications/:id/mismo-export", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"), async (req, res) => {
    try {
      const { id } = routeParams(req);

      // Object-level check kept as defense-in-depth alongside the role gate.
      const authorizedApp = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!authorizedApp) {
        return res.status(403).json({ error: "Access denied" });
      }

      const mismoData = await storage.getMISMOLoanData(id);
      
      if (!mismoData) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Build the DTO with declarations from storage
      const dto: MISMOLoanDTO = {
        ...mismoData,
      };

      // Delivery shape per the ULDD Implementation Guide: AtClosing + Current
      // LOAN states, no ASSET container. The note date (when captured on the
      // delivery row) stamps the AtClosing loan state.
      const deliveryData = await storage.getLoanDeliveryData(id);
      const xml = generateMISMO34XML(dto, {
        purpose: "loanDelivery",
        noteDate: deliveryData?.noteDate ?? undefined,
      });
      
      // Set proper headers for XML download
      res.setHeader("Content-Type", "application/xml");
      res.setHeader("Content-Disposition", `attachment; filename="mismo-${id}.xml"`);
      res.send(xml);

      await storage.createDealActivity({
        applicationId: id,
        activityType: "note",
        title: "MISMO XML Exported",
        description: "Loan data exported in MISMO 3.4 format for GSE delivery",
        performedBy: req.user!.id,
      });
    } catch (error) {
      console.error("MISMO export error:", error);
      res.status(500).json({ error: "Failed to generate MISMO XML" });
    }
  });

  // Data Quality Scoring API - for broker dashboard (ownership-scoped query)
  app.get("/api/loan-applications/:id/data-quality", isAuthenticated, async (req, res) => {
    try {
      const { id } = routeParams(req);
      // Use ownership-scoped query - authorization happens at database level
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role || "");
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      const quality = await storage.getApplicationDataQuality(id);
      res.json(quality);
    } catch (error) {
      console.error("Data quality error:", error);
      res.status(500).json({ error: "Failed to get data quality" });
    }
  });

  // Borrower Declarations API - with ownership-scoped query
}
