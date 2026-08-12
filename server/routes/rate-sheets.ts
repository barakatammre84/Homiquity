import type { Express } from "express";
import type { IStorage } from "../storage";
import { logAudit } from "../auditLog";
import { writeWholesaleLenderSchema, insertRateSheetSchema, insertRateSheetProductSchema, insertLenderPricingAdjustmentSchema } from "@shared/schema";
import { LENDER_APPROVAL_STATUSES, type LenderApprovalStatus } from "@shared/wholesaleLenders";
import { z } from "zod";
import { computeOffers, type BorrowerPricingProfile } from "../services/pricingAdapter";
import { requireRole } from "../auth";
import { parseBodyOr400 } from "./validate";
import { firstQueryValue } from "./queryParams";
import { routeParam } from "../http/routeParams";

export function registerRateSheetRoutes(
  app: Express,
  storage: IStorage,
) {
  // ============================================================
  // WHOLESALE LENDERS
  // ============================================================

  app.get("/api/wholesale-lenders", requireRole("admin"), async (req, res) => {
    try {
      const lenders = await storage.getWholesaleLenders({
        status: firstQueryValue(req.query.status),
        integrationTier: firstQueryValue(req.query.integrationTier),
      });
      res.json(lenders);
    } catch (err) {
      console.error("Error fetching wholesale lenders:", err);
      res.status(500).json({ error: "Failed to fetch wholesale lenders" });
    }
  });

  app.get("/api/wholesale-lenders/:id", requireRole("admin"), async (req, res) => {
    try {
      const lender = await storage.getWholesaleLender(routeParam(req, "id"));
      if (!lender) return res.status(404).json({ error: "Lender not found" });
      res.json(lender);
    } catch (err) {
      console.error("Error fetching lender:", err);
      res.status(500).json({ error: "Failed to fetch lender" });
    }
  });

  app.post("/api/wholesale-lenders", requireRole("admin"), async (req, res) => {
    try {
      // Authorization columns are not settable here (F-22): a lender is
      // created at the schema DEFAULTs — approvalStatus "target", isDemo
      // false — and can only become approved through the audited endpoint
      // below. Creating one pre-approved would bypass that record entirely.
      const parsed = writeWholesaleLenderSchema.safeParse(req.body);
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
      const existing = await storage.getWholesaleLender(routeParam(req, "id"));
      if (!existing) return res.status(404).json({ error: "Lender not found" });
      // Authorization columns are omitted from this schema (F-22) — Zod
      // strips them, so a body carrying `approvalStatus` cannot take effect.
      const data = parseBodyOr400(writeWholesaleLenderSchema.partial(), req.body, res);
      if (data === undefined) return;
      const lender = await storage.updateWholesaleLender(routeParam(req, "id"), data);
      await logAudit(req, "WHOLESALE_LENDER_UPDATED", "wholesale_lender", routeParam(req, "id"), {
        updatedFields: Object.keys(data),
      });
      res.json(lender);
    } catch (err) {
      console.error("Error updating lender:", err);
      res.status(500).json({ error: "Failed to update lender" });
    }
  });

  // ------------------------------------------------------------
  // Counterparty approval — a business event, not a field edit (F-22).
  //
  // `approvalStatus` authorizes transmitting a borrower's file to a third
  // party and is the binding constraint on all revenue, yet it used to be
  // writable through the generic PATCH above, audited by field NAME only. The
  // two sibling admin money surfaces (fee-schedule publish, comp bands) both
  // audit previous -> next VALUES and require a reason; the surface that moves
  // AUTHORIZATION had the weakest trail of the three.
  //
  // Approval is now its own endpoint, and it records the evidence rather than
  // the fact alone: what changed, why, and which executed agreement backs it.
  // ------------------------------------------------------------
  app.post("/api/wholesale-lenders/:id/approval", requireRole("admin"), async (req, res) => {
    try {
      const approvalSchema = z
        .object({
          approvalStatus: z.enum(
            LENDER_APPROVAL_STATUSES as [LenderApprovalStatus, ...LenderApprovalStatus[]],
          ),
          // Required in every direction. A counterparty being de-authorized is
          // as consequential as one being approved, and "someone changed it"
          // is not an answer to "why".
          reason: z.string().trim().min(1).max(1000),
          // The agreement is the fact that MAKES the approval true, so it is
          // required to assert one. Approving without it is the unevidenced
          // change this endpoint exists to prevent.
          brokerAgreementReference: z.string().trim().min(1).max(200).optional(),
          /**
           * Contracted EPO clawback window, in days, from that agreement.
           * Required on approval (F-23): the clawback register otherwise rests
           * on DEFAULT_EPO_CLAWBACK_DAYS forever, because nothing else in the
           * system can write this column. NULL means "no agreement yet", so
           * the moment an agreement exists is the moment to record the term.
           */
          epoClawbackDays: z.number().int().positive().max(3650).optional(),
        })
        .refine(v => v.approvalStatus !== "approved" || !!v.brokerAgreementReference, {
          message:
            "brokerAgreementReference is required to approve a lender — approval asserts that an " +
            "executed broker agreement exists.",
          path: ["brokerAgreementReference"],
        })
        .refine(v => v.approvalStatus !== "approved" || v.epoClawbackDays !== undefined, {
          message:
            "epoClawbackDays is required to approve a lender: every wholesale broker agreement " +
            "carries an early-payoff clause, and the clawback reserve must rest on the contracted " +
            "term rather than the platform assumption.",
          path: ["epoClawbackDays"],
        });

      const data = parseBodyOr400(approvalSchema, req.body, res);
      if (data === undefined) return;

      const id = routeParam(req, "id");
      const existing = await storage.getWholesaleLender(id);
      if (!existing) return res.status(404).json({ error: "Lender not found" });

      // A demo row is a fictional company. It can never be an approved
      // counterparty, and the refusal lives here rather than relying on
      // `isApprovedLender()` filtering it downstream — a record asserting that
      // we hold a broker agreement with a company that does not exist should
      // not be creatable in the first place.
      if (existing.isDemo && data.approvalStatus === "approved") {
        return res.status(422).json({
          error:
            `${existing.lenderName} is a seeded demo counterparty, not a real company, and cannot ` +
            `be approved. Create the real lender instead, and retire this row.`,
          code: "cannot_approve_demo_lender",
        });
      }

      const updated = await storage.updateWholesaleLender(id, {
        approvalStatus: data.approvalStatus,
        ...(data.epoClawbackDays !== undefined ? { epoClawbackDays: data.epoClawbackDays } : {}),
      });

      // Previous -> next VALUES, plus the evidence. This is the record that
      // answers "who approved this counterparty, when, and on the strength of
      // what agreement?" — which the old field-name audit could not.
      await logAudit(req, "wholesale_lender.approval_changed", "wholesale_lender", id, {
        lenderName: existing.lenderName,
        previousApprovalStatus: existing.approvalStatus,
        nextApprovalStatus: data.approvalStatus,
        previousEpoClawbackDays: existing.epoClawbackDays ?? null,
        nextEpoClawbackDays: data.epoClawbackDays ?? existing.epoClawbackDays ?? null,
        brokerAgreementReference: data.brokerAgreementReference ?? null,
        reason: data.reason,
      });

      res.json({
        id: updated?.id ?? id,
        lenderName: existing.lenderName,
        approvalStatus: updated?.approvalStatus ?? data.approvalStatus,
        epoClawbackDays: updated?.epoClawbackDays ?? null,
      });
    } catch (err) {
      console.error("Error changing lender approval:", err);
      res.status(500).json({ error: "Failed to change lender approval" });
    }
  });

  // ============================================================
  // RATE SHEETS
  // ============================================================

  app.get("/api/rate-sheets", requireRole("admin"), async (req, res) => {
    try {
      const sheets = await storage.getRateSheets({
        lenderId: firstQueryValue(req.query.lenderId),
        status: firstQueryValue(req.query.status),
      });
      res.json(sheets);
    } catch (err) {
      console.error("Error fetching rate sheets:", err);
      res.status(500).json({ error: "Failed to fetch rate sheets" });
    }
  });

  app.get("/api/rate-sheets/active", requireRole("admin"), async (req, res) => {
    try {
      const sheets = await storage.getActiveRateSheets();
      res.json(sheets);
    } catch (err) {
      console.error("Error fetching active rate sheets:", err);
      res.status(500).json({ error: "Failed to fetch active rate sheets" });
    }
  });

  app.get("/api/rate-sheets/:id", requireRole("admin"), async (req, res) => {
    try {
      const sheet = await storage.getRateSheet(routeParam(req, "id"));
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
      const existing = await storage.getRateSheet(routeParam(req, "id"));
      if (!existing) return res.status(404).json({ error: "Rate sheet not found" });
      const data = parseBodyOr400(insertRateSheetSchema.partial(), req.body, res);
      if (data === undefined) return;
      const sheet = await storage.updateRateSheet(routeParam(req, "id"), data);
      await logAudit(req, "RATE_SHEET_UPDATED", "rate_sheet", routeParam(req, "id"), {
        updatedFields: Object.keys(data),
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

  app.get("/api/rate-sheets/:rateSheetId/products", requireRole("admin"), async (req, res) => {
    try {
      const products = await storage.getRateSheetProducts(routeParam(req, "rateSheetId"));
      res.json(products);
    } catch (err) {
      console.error("Error fetching rate sheet products:", err);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/rate-sheet-products/:id", requireRole("admin"), async (req, res) => {
    try {
      const product = await storage.getRateSheetProduct(routeParam(req, "id"));
      if (!product) return res.status(404).json({ error: "Product not found" });
      res.json(product);
    } catch (err) {
      console.error("Error fetching product:", err);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/rate-sheets/:rateSheetId/products", requireRole("admin"), async (req, res) => {
    try {
      const sheet = await storage.getRateSheet(routeParam(req, "rateSheetId"));
      if (!sheet) return res.status(404).json({ error: "Rate sheet not found" });

      const parsed = insertRateSheetProductSchema.safeParse({
        ...req.body,
        rateSheetId: routeParam(req, "rateSheetId"),
      });
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const product = await storage.createRateSheetProduct(parsed.data);
      await logAudit(req, "RATE_SHEET_PRODUCT_CREATED", "rate_sheet_product", product.id, {
        rateSheetId: routeParam(req, "rateSheetId"),
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
      const sheet = await storage.getRateSheet(routeParam(req, "rateSheetId"));
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
          rateSheetId: routeParam(req, "rateSheetId"),
        });
        if (!parsed.success) {
          errors.push({ index: i, error: parsed.error.flatten() });
          continue;
        }
        const product = await storage.createRateSheetProduct(parsed.data);
        created.push(product);
      }

      await logAudit(req, "RATE_SHEET_PRODUCTS_BULK_CREATED", "rate_sheet", routeParam(req, "rateSheetId"), {
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
      const existing = await storage.getRateSheetProduct(routeParam(req, "id"));
      if (!existing) return res.status(404).json({ error: "Product not found" });
      const data = parseBodyOr400(insertRateSheetProductSchema.omit({ rateSheetId: true }).partial(), req.body, res);
      if (data === undefined) return;
      const product = await storage.updateRateSheetProduct(routeParam(req, "id"), data);
      await logAudit(req, "RATE_SHEET_PRODUCT_UPDATED", "rate_sheet_product", routeParam(req, "id"), {
        updatedFields: Object.keys(data),
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

  app.get("/api/lender-pricing-adjustments", requireRole("admin"), async (req, res) => {
    try {
      const adjustments = await storage.getLenderPricingAdjustments({
        lenderId: firstQueryValue(req.query.lenderId),
        adjustmentType: firstQueryValue(req.query.adjustmentType),
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
      const data = parseBodyOr400(insertLenderPricingAdjustmentSchema.partial(), req.body, res);
      if (data === undefined) return;
      const adj = await storage.updateLenderPricingAdjustment(routeParam(req, "id"), data);
      if (!adj) return res.status(404).json({ error: "Adjustment not found" });
      await logAudit(req, "PRICING_ADJUSTMENT_UPDATED", "lender_pricing_adjustment", routeParam(req, "id"), {
        updatedFields: Object.keys(data),
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

  app.get("/api/lender-offers", requireRole("admin"), async (req, res) => {
    try {
      const offers = await storage.getLenderOffers({
        applicationId: firstQueryValue(req.query.applicationId),
        lenderId: firstQueryValue(req.query.lenderId),
        status: firstQueryValue(req.query.status),
      });
      res.json(offers);
    } catch (err) {
      console.error("Error fetching lender offers:", err);
      res.status(500).json({ error: "Failed to fetch lender offers" });
    }
  });

  app.get("/api/lender-offers/:id", requireRole("admin"), async (req, res) => {
    try {
      const offer = await storage.getLenderOffer(routeParam(req, "id"));
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

  app.post("/api/lender-offers/compare", requireRole("admin"), async (req, res) => {
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
