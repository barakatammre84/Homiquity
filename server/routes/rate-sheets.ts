import type { Express } from "express";
import type { IStorage } from "../storage";
import { logAudit } from "../auditLog";
import { insertWholesaleLenderSchema, insertRateSheetSchema, insertRateSheetProductSchema, insertLenderPricingAdjustmentSchema } from "@shared/schema";
import { computeOffers, type BorrowerPricingProfile } from "../services/pricingAdapter";
import { requireRole } from "../auth";

export function registerRateSheetRoutes(
  app: Express,
  storage: IStorage,
) {
  // ============================================================
  // WHOLESALE LENDERS
  // ============================================================

  app.get("/api/wholesale-lenders", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const { status, integrationTier } = req.query;
      const lenders = await storage.getWholesaleLenders({
        status: status as string | undefined,
        integrationTier: integrationTier as string | undefined,
      });
      res.json(lenders);
    } catch (err) {
      console.error("Error fetching wholesale lenders:", err);
      res.status(500).json({ error: "Failed to fetch wholesale lenders" });
    }
  });

  app.get("/api/wholesale-lenders/:id", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const lender = await storage.getWholesaleLender(req.params.id);
      if (!lender) return res.status(404).json({ error: "Lender not found" });
      res.json(lender);
    } catch (err) {
      console.error("Error fetching lender:", err);
      res.status(500).json({ error: "Failed to fetch lender" });
    }
  });

  app.post("/api/wholesale-lenders", requireRole("admin"), async (req, res) => {
    try {
      const parsed = insertWholesaleLenderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const lender = await storage.createWholesaleLender(parsed.data);
      await logAudit(req, "WHOLESALE_LENDER_CREATED", "wholesale_lender", lender.id, {
        lenderName: lender.lenderName,
        lenderCode: lender.lenderCode,
      });
      res.status(201).json(lender);
    } catch (err: any) {
      if (err.message?.includes("unique") || err.code === "23505") {
        return res.status(409).json({ error: "Lender code or ID already exists" });
      }
      console.error("Error creating lender:", err);
      res.status(500).json({ error: "Failed to create lender" });
    }
  });

  app.patch("/api/wholesale-lenders/:id", requireRole("admin"), async (req, res) => {
    try {
      const existing = await storage.getWholesaleLender(req.params.id);
      if (!existing) return res.status(404).json({ error: "Lender not found" });
      const lender = await storage.updateWholesaleLender(req.params.id, req.body);
      await logAudit(req, "WHOLESALE_LENDER_UPDATED", "wholesale_lender", req.params.id, {
        updatedFields: Object.keys(req.body),
      });
      res.json(lender);
    } catch (err) {
      console.error("Error updating lender:", err);
      res.status(500).json({ error: "Failed to update lender" });
    }
  });

  // ============================================================
  // RATE SHEETS
  // ============================================================

  app.get("/api/rate-sheets", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const { lenderId, status } = req.query;
      const sheets = await storage.getRateSheets({
        lenderId: lenderId as string | undefined,
        status: status as string | undefined,
      });
      res.json(sheets);
    } catch (err) {
      console.error("Error fetching rate sheets:", err);
      res.status(500).json({ error: "Failed to fetch rate sheets" });
    }
  });

  app.get("/api/rate-sheets/active", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const sheets = await storage.getActiveRateSheets();
      res.json(sheets);
    } catch (err) {
      console.error("Error fetching active rate sheets:", err);
      res.status(500).json({ error: "Failed to fetch active rate sheets" });
    }
  });

  app.get("/api/rate-sheets/:id", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const sheet = await storage.getRateSheet(req.params.id);
      if (!sheet) return res.status(404).json({ error: "Rate sheet not found" });
      res.json(sheet);
    } catch (err) {
      console.error("Error fetching rate sheet:", err);
      res.status(500).json({ error: "Failed to fetch rate sheet" });
    }
  });

  app.post("/api/rate-sheets", requireRole("admin"), async (req, res) => {
    try {
      const parsed = insertRateSheetSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const lender = await storage.getWholesaleLender(parsed.data.lenderId);
      if (!lender) return res.status(400).json({ error: "Invalid lenderId: lender not found" });

      const sheet = await storage.createRateSheet({
        ...parsed.data,
        uploadedBy: (req.user as any)?.id,
      });
      await logAudit(req, "RATE_SHEET_CREATED", "rate_sheet", sheet.id, {
        lenderId: sheet.lenderId,
        sheetId: sheet.sheetId,
        version: sheet.version,
        effectiveDate: sheet.effectiveDate,
      });
      res.status(201).json(sheet);
    } catch (err: any) {
      if (err.code === "23505") {
        return res.status(409).json({ error: "Rate sheet ID already exists" });
      }
      console.error("Error creating rate sheet:", err);
      res.status(500).json({ error: "Failed to create rate sheet" });
    }
  });

  app.patch("/api/rate-sheets/:id", requireRole("admin"), async (req, res) => {
    try {
      const existing = await storage.getRateSheet(req.params.id);
      if (!existing) return res.status(404).json({ error: "Rate sheet not found" });
      const sheet = await storage.updateRateSheet(req.params.id, req.body);
      await logAudit(req, "RATE_SHEET_UPDATED", "rate_sheet", req.params.id, {
        updatedFields: Object.keys(req.body),
      });
      res.json(sheet);
    } catch (err) {
      console.error("Error updating rate sheet:", err);
      res.status(500).json({ error: "Failed to update rate sheet" });
    }
  });

  // ============================================================
  // RATE SHEET PRODUCTS
  // ============================================================

  app.get("/api/rate-sheets/:rateSheetId/products", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const products = await storage.getRateSheetProducts(req.params.rateSheetId);
      res.json(products);
    } catch (err) {
      console.error("Error fetching rate sheet products:", err);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/rate-sheet-products/:id", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const product = await storage.getRateSheetProduct(req.params.id);
      if (!product) return res.status(404).json({ error: "Product not found" });
      res.json(product);
    } catch (err) {
      console.error("Error fetching product:", err);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/rate-sheets/:rateSheetId/products", requireRole("admin"), async (req, res) => {
    try {
      const sheet = await storage.getRateSheet(req.params.rateSheetId);
      if (!sheet) return res.status(404).json({ error: "Rate sheet not found" });

      const parsed = insertRateSheetProductSchema.safeParse({
        ...req.body,
        rateSheetId: req.params.rateSheetId,
      });
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const product = await storage.createRateSheetProduct(parsed.data);
      await logAudit(req, "RATE_SHEET_PRODUCT_CREATED", "rate_sheet_product", product.id, {
        rateSheetId: req.params.rateSheetId,
        productCode: product.productCode,
        productType: product.productType,
        baseRate: product.baseRate,
      });
      res.status(201).json(product);
    } catch (err) {
      console.error("Error creating product:", err);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.post("/api/rate-sheets/:rateSheetId/products/bulk", requireRole("admin"), async (req, res) => {
    try {
      const sheet = await storage.getRateSheet(req.params.rateSheetId);
      if (!sheet) return res.status(404).json({ error: "Rate sheet not found" });

      const { products } = req.body;
      if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: "products array is required" });
      }

      const created = [];
      const errors = [];
      for (let i = 0; i < products.length; i++) {
        const parsed = insertRateSheetProductSchema.safeParse({
          ...products[i],
          rateSheetId: req.params.rateSheetId,
        });
        if (!parsed.success) {
          errors.push({ index: i, error: parsed.error.flatten() });
          continue;
        }
        const product = await storage.createRateSheetProduct(parsed.data);
        created.push(product);
      }

      await logAudit(req, "RATE_SHEET_PRODUCTS_BULK_CREATED", "rate_sheet", req.params.rateSheetId, {
        totalSubmitted: products.length,
        totalCreated: created.length,
        totalErrors: errors.length,
      });
      res.status(201).json({ created, errors });
    } catch (err) {
      console.error("Error bulk creating products:", err);
      res.status(500).json({ error: "Failed to bulk create products" });
    }
  });

  app.patch("/api/rate-sheet-products/:id", requireRole("admin"), async (req, res) => {
    try {
      const existing = await storage.getRateSheetProduct(req.params.id);
      if (!existing) return res.status(404).json({ error: "Product not found" });
      const product = await storage.updateRateSheetProduct(req.params.id, req.body);
      await logAudit(req, "RATE_SHEET_PRODUCT_UPDATED", "rate_sheet_product", req.params.id, {
        updatedFields: Object.keys(req.body),
      });
      res.json(product);
    } catch (err) {
      console.error("Error updating product:", err);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  // ============================================================
  // LENDER PRICING ADJUSTMENTS
  // ============================================================

  app.get("/api/lender-pricing-adjustments", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const { lenderId, adjustmentType } = req.query;
      const adjustments = await storage.getLenderPricingAdjustments({
        lenderId: lenderId as string | undefined,
        adjustmentType: adjustmentType as string | undefined,
      });
      res.json(adjustments);
    } catch (err) {
      console.error("Error fetching pricing adjustments:", err);
      res.status(500).json({ error: "Failed to fetch pricing adjustments" });
    }
  });

  app.post("/api/lender-pricing-adjustments", requireRole("admin"), async (req, res) => {
    try {
      const parsed = insertLenderPricingAdjustmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const lender = await storage.getWholesaleLender(parsed.data.lenderId);
      if (!lender) return res.status(400).json({ error: "Invalid lenderId: lender not found" });

      const adj = await storage.createLenderPricingAdjustment(parsed.data);
      await logAudit(req, "PRICING_ADJUSTMENT_CREATED", "lender_pricing_adjustment", adj.id, {
        lenderId: adj.lenderId,
        adjustmentType: adj.adjustmentType,
        adjustmentValue: adj.adjustmentValue,
      });
      res.status(201).json(adj);
    } catch (err) {
      console.error("Error creating pricing adjustment:", err);
      res.status(500).json({ error: "Failed to create pricing adjustment" });
    }
  });

  app.patch("/api/lender-pricing-adjustments/:id", requireRole("admin"), async (req, res) => {
    try {
      const adj = await storage.updateLenderPricingAdjustment(req.params.id, req.body);
      if (!adj) return res.status(404).json({ error: "Adjustment not found" });
      await logAudit(req, "PRICING_ADJUSTMENT_UPDATED", "lender_pricing_adjustment", req.params.id, {
        updatedFields: Object.keys(req.body),
      });
      res.json(adj);
    } catch (err) {
      console.error("Error updating pricing adjustment:", err);
      res.status(500).json({ error: "Failed to update pricing adjustment" });
    }
  });

  // ============================================================
  // LENDER OFFERS
  // ============================================================

  app.get("/api/lender-offers", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const { applicationId, lenderId, status } = req.query;
      const offers = await storage.getLenderOffers({
        applicationId: applicationId as string | undefined,
        lenderId: lenderId as string | undefined,
        status: status as string | undefined,
      });
      res.json(offers);
    } catch (err) {
      console.error("Error fetching lender offers:", err);
      res.status(500).json({ error: "Failed to fetch lender offers" });
    }
  });

  app.get("/api/lender-offers/:id", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const offer = await storage.getLenderOffer(req.params.id);
      if (!offer) return res.status(404).json({ error: "Offer not found" });
      res.json(offer);
    } catch (err) {
      console.error("Error fetching offer:", err);
      res.status(500).json({ error: "Failed to fetch offer" });
    }
  });

  // ============================================================
  // OFFER COMPARISON - Pricing Engine Adapter
  // ============================================================

  app.post("/api/lender-offers/compare", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const profile: BorrowerPricingProfile = req.body;

      if (profile.loanPurpose === ("cash_out" as any)) {
        profile.loanPurpose = "cash_out_refinance";
      }

      if (!profile.creditScore || !profile.loanAmount || !profile.propertyValue) {
        return res.status(400).json({
          error: "Missing required fields: creditScore, loanAmount, propertyValue",
        });
      }

      const offers = await computeOffers(storage, profile);

      await logAudit(req, "OFFER_COMPARISON_EXECUTED", "lender_offer", undefined, {
        creditScore: profile.creditScore,
        loanAmount: profile.loanAmount,
        propertyValue: profile.propertyValue,
        offersGenerated: offers.length,
      });

      res.json({
        borrowerProfile: {
          creditScore: profile.creditScore,
          loanAmount: profile.loanAmount,
          ltv: (profile.loanAmount / profile.propertyValue) * 100,
          propertyType: profile.propertyType || "single_family",
          occupancyType: profile.occupancyType || "primary_residence",
        },
        offers,
        generatedAt: new Date().toISOString(),
        totalOffers: offers.length,
      });
    } catch (err) {
      console.error("Error computing offer comparison:", err);
      res.status(500).json({ error: "Failed to compute offer comparison" });
    }
  });
}
