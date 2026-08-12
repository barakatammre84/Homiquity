// Borrower routes: Scenario calculator, partner waitlist, affordability check.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import { type IStorage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { type User } from "@shared/schema";
import { z } from "zod";
import { buildBorrowerGraph, getPropertyAffordability } from "../../services/borrowerGraph";
import { firstQueryValue } from "../queryParams";
import { monthlyPrincipalAndInterest } from "@shared/lib/amortization";

// Verify that an internal staff user is actually assigned to the given application.
// Returns true for admin (unrestricted), checks LO assignment for lo/loa, and
// deal-team membership for processor/underwriter/closer.
// External partner roles (broker, lender) are NOT permitted by this helper.
// Exported: the LO-2 scenario route reuses this gate (one access model, no forks).

export function registerScenarioWaitlistRoutes(
  app: Express,
  storage: IStorage,
) {
  // Scenario Calculator Route
  // =============================================
  app.post("/api/scenario-calculator", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        purchasePrice: z.number().positive(),
        downPaymentPercent: z.number().min(0).max(100),
        creditScore: z.number().min(300).max(850),
        loanProgram: z.enum(["conventional", "fha", "va", "usda"]),
        interestRate: z.number().optional(),
        propertyTax: z.number().optional(),
        insurance: z.number().optional(),
        annualIncome: z.number().optional(),
      });

      const validated = schema.parse(req.body);

      const defaultRates: Record<string, number> = {
        conventional: 6.875,
        fha: 6.5,
        va: 6.25,
        usda: 6.375,
      };

      const purchasePrice = validated.purchasePrice;
      const downPayment = purchasePrice * (validated.downPaymentPercent / 100);
      let loanAmount = purchasePrice - downPayment;
      const ltv = (loanAmount / purchasePrice) * 100;
      const rate = validated.interestRate ?? defaultRates[validated.loanProgram];

      if (validated.loanProgram === "fha") {
        loanAmount = loanAmount * 1.0175;
      }

      const monthlyPrincipalInterest = monthlyPrincipalAndInterest(loanAmount, rate, 360);

      let monthlyPmi = 0;
      if (validated.loanProgram === "conventional" && ltv > 80) {
        monthlyPmi = (loanAmount * 0.005) / 12;
      } else if (validated.loanProgram === "fha") {
        monthlyPmi = (loanAmount * 0.0085) / 12;
      }

      const monthlyPropertyTax = validated.propertyTax ?? (purchasePrice * 0.011) / 12;
      const monthlyInsurance = validated.insurance ?? (purchasePrice * 0.0035) / 12;
      const totalMonthlyPayment = monthlyPrincipalInterest + monthlyPmi + monthlyPropertyTax + monthlyInsurance;

      let dti: number | null = null;
      if (validated.annualIncome) {
        const monthlyIncome = validated.annualIncome / 12;
        dti = (totalMonthlyPayment / monthlyIncome) * 100;
      }

      res.json({
        purchasePrice,
        downPayment,
        downPaymentPercent: validated.downPaymentPercent,
        loanAmount: Math.round(loanAmount * 100) / 100,
        interestRate: rate,
        loanProgram: validated.loanProgram,
        ltv: Math.round(ltv * 100) / 100,
        monthlyPrincipalInterest: Math.round(monthlyPrincipalInterest * 100) / 100,
        monthlyPmi: Math.round(monthlyPmi * 100) / 100,
        monthlyPropertyTax: Math.round(monthlyPropertyTax * 100) / 100,
        monthlyInsurance: Math.round(monthlyInsurance * 100) / 100,
        totalMonthlyPayment: Math.round(totalMonthlyPayment * 100) / 100,
        dti: dti !== null ? Math.round(dti * 100) / 100 : null,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.issues });
      }
      console.error("Scenario calculator error:", error);
      res.status(500).json({ error: "Failed to calculate scenario" });
    }
  });

  const trackSchema = z.object({
    activityType: z.string().min(1).max(64).regex(/^[a-z_]+$/),
    page: z.string().max(256).optional(),
    metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    sessionId: z.string().max(64).optional(),
  });

  app.post("/api/track", async (req, res) => {
    try {
      const parsed = trackSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid tracking data" });
      }
      const { activityType, page, metadata, sessionId } = parsed.data;
      const userId = req.user ? (req.user as User).id : null;
      const { userActivities } = await import("@shared/schema");
      const { db } = await import("../../db");
      await db.insert(userActivities).values({
        userId,
        sessionId: sessionId || null,
        activityType,
        page: page || null,
        metadata: metadata ? metadata : null,
      });
      res.json({ ok: true });
    } catch (error) {
      console.error("Activity tracking error:", error);
      res.json({ ok: true });
    }
  });

  const emailCaptureSchema = z.object({
    email: z.string().email().max(255),
    source: z.string().max(100).optional(),
    website: z.string().optional(),
  });

  app.post("/api/email-capture", async (req, res) => {
    try {
      const parsed = emailCaptureSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid email address" });
      }
      if (parsed.data.website) {
        return res.json({ ok: true });
      }
      const { emailCaptures } = await import("@shared/schema");
      const { db } = await import("../../db");
      const { eq } = await import("drizzle-orm");

      const existing = await db
        .select({ id: emailCaptures.id })
        .from(emailCaptures)
        .where(eq(emailCaptures.email, parsed.data.email))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(emailCaptures).values({
          email: parsed.data.email,
          source: parsed.data.source || "website",
        });
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("Email capture error:", error);
      res.json({ ok: true });
    }
  });

  // Pre-launch partner / center-of-influence waitlist. B2B interest capture for
  // loan officers, lenders, CPAs, and real-estate agents — the referral network
  // we'll service consumers through. Not a consumer mortgage lead: no TCPA/
  // TrustedForm path, no rate/approval handling. Public + honeypot-guarded;
  // rate-limited in app.ts alongside /api/email-capture.
  const partnerWaitlistSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(255),
    email: z.string().email().max(255),
    company: z.string().trim().max(255).optional(),
    partnerType: z.enum(["loan_officer", "lender", "cpa", "real_estate_agent", "other"]),
    message: z.string().trim().max(2000).optional(),
    website: z.string().optional(), // honeypot
  });

  app.post("/api/partner-waitlist", async (req, res) => {
    try {
      const parsed = partnerWaitlistSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Please check the form and try again." });
      }
      if (parsed.data.website) {
        return res.json({ ok: true }); // silently drop bots
      }
      const { partnerWaitlist } = await import("@shared/schema");
      const { db } = await import("../../db");
      const { eq } = await import("drizzle-orm");

      const existing = await db
        .select({ id: partnerWaitlist.id })
        .from(partnerWaitlist)
        .where(eq(partnerWaitlist.email, parsed.data.email))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(partnerWaitlist).values({
          name: parsed.data.name,
          email: parsed.data.email,
          company: parsed.data.company || null,
          partnerType: parsed.data.partnerType,
          message: parsed.data.message || null,
        });
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("Partner waitlist error:", error);
      res.json({ ok: true });
    }
  });

  app.get("/api/user-activity-summary", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { getUserActivitySummary } = await import("../../services/activitySummary");
      res.json(await getUserActivitySummary(userId));
    } catch (error) {
      console.error("Activity summary error:", error);
      res.status(500).json({ error: "Failed to load activity summary" });
    }
  });

  app.get("/api/borrower-graph", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const graph = await buildBorrowerGraph(user.id);
      res.json(graph);
    } catch (error) {
      console.error("Borrower graph error:", error);
      res.status(500).json({ error: "Failed to build borrower profile" });
    }
  });

  app.get("/api/borrower-graph/affordability", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const price = parseFloat(firstQueryValue(req.query.price) ?? "");
      if (!price || isNaN(price) || price <= 0) {
        return res.status(400).json({ error: "Valid price parameter required" });
      }
      const result = await getPropertyAffordability(user.id, price);
      res.json(result);
    } catch (error) {
      console.error("Affordability check error:", error);
      res.status(500).json({ error: "Failed to check affordability" });
    }
  });
}
