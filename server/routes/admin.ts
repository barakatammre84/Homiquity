import type { Express } from "express";
import type { IStorage } from "../storage";
import {
  insertContentCategorySchema,
  insertArticleSchema,
  insertFaqSchema,
  ALL_ROLES,
  type User,
} from "@shared/schema";
import { z } from "zod";
import { logAudit } from "../auditLog";
import { refreshRates } from "../services/rateService";
import { requireRole } from "../auth";

export function registerAdminRoutes(
  app: Express,
  storage: IStorage,
) {
  app.get("/api/admin/stats", requireRole("admin"), async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Admin stats error:", error);
      res.status(500).json({ error: "Failed to get admin stats" });
    }
  });

  app.get("/api/admin/applications", requireRole("admin"), async (req, res) => {
    try {
      const applications = await storage.getAllLoanApplications();
      res.json(applications);
    } catch (error) {
      console.error("Admin applications error:", error);
      res.status(500).json({ error: "Failed to get applications" });
    }
  });

  app.get("/api/admin/users", requireRole("admin"), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Admin users error:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  app.patch("/api/admin/users/:id/role", requireRole("admin"), async (req, res) => {
    try {
      const { role } = req.body;
      if (!ALL_ROLES.includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      const existingUser = await storage.getUser(req.params.id);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }
      const previousRole = existingUser.role;
      const user = await storage.updateUserRole(req.params.id, role);
      if (!user) {
        return res.status(500).json({ error: "Failed to update role" });
      }
      logAudit(req, "user.role_change", "user", req.params.id, { newRole: role, previousRole });
      res.json(user);
    } catch (error) {
      console.error("Update user role error:", error);
      res.status(500).json({ error: "Failed to update user role" });
    }
  });

  // ================================
  // Learning Center & FAQ Routes
  // ================================

  // --- Content Categories (Admin) ---
  
  // Get all categories (admin - includes inactive)
  app.get("/api/admin/content-categories", requireRole("admin", "lo"), async (req, res) => {
    try {
      const categories = await storage.getAllContentCategories();
      res.json(categories);
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ error: "Failed to get categories" });
    }
  });

  // Create category (admin)
  app.post("/api/admin/content-categories", requireRole("admin", "lo"), async (req, res) => {
    try {
      const validatedData = insertContentCategorySchema.parse(req.body);
      const category = await storage.createContentCategory(validatedData);
      res.status(201).json(category);
    } catch (error) {
      console.error("Create category error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  // Update category (admin)
  app.patch("/api/admin/content-categories/:id", requireRole("admin", "lo"), async (req, res) => {
    try {
      const updated = await storage.updateContentCategory(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update category error:", error);
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  // Delete category (admin)
  app.delete("/api/admin/content-categories/:id", requireRole("admin", "lo"), async (req, res) => {
    try {
      await storage.deleteContentCategory(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete category error:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // --- Articles (Admin) ---

  // Get all articles (admin - includes drafts)
  app.get("/api/admin/articles", requireRole("admin", "lo"), async (req, res) => {
    try {
      const articles = await storage.getAllArticles();
      res.json(articles);
    } catch (error) {
      console.error("Get articles error:", error);
      res.status(500).json({ error: "Failed to get articles" });
    }
  });

  // Get single article (admin)
  app.get("/api/admin/articles/:id", requireRole("admin", "lo"), async (req, res) => {
    try {
      const article = await storage.getArticle(req.params.id);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }
      res.json(article);
    } catch (error) {
      console.error("Get article error:", error);
      res.status(500).json({ error: "Failed to get article" });
    }
  });

  // Create article (admin)
  app.post("/api/admin/articles", requireRole("admin", "lo"), async (req, res) => {
    try {
      const validatedData = insertArticleSchema.parse({
        ...req.body,
        authorId: req.user!.id,
        publishedAt: req.body.status === "published" ? new Date() : null,
      });
      const article = await storage.createArticle(validatedData);
      res.status(201).json(article);
    } catch (error) {
      console.error("Create article error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create article" });
    }
  });

  // Update article (admin)
  app.patch("/api/admin/articles/:id", requireRole("admin", "lo"), async (req, res) => {
    try {
      const updateData = { ...req.body };
      // Set publishedAt when publishing for the first time
      if (req.body.status === "published") {
        const existing = await storage.getArticle(req.params.id);
        if (existing && existing.status !== "published") {
          updateData.publishedAt = new Date();
        }
      }
      
      const updated = await storage.updateArticle(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Article not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update article error:", error);
      res.status(500).json({ error: "Failed to update article" });
    }
  });

  // Delete article (admin)
  app.delete("/api/admin/articles/:id", requireRole("admin", "lo"), async (req, res) => {
    try {
      await storage.deleteArticle(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete article error:", error);
      res.status(500).json({ error: "Failed to delete article" });
    }
  });

  // --- FAQs (Admin) ---

  // Get all FAQs (admin - includes drafts)
  app.get("/api/admin/faqs", requireRole("admin", "lo"), async (req, res) => {
    try {
      const faqs = await storage.getAllFaqs();
      res.json(faqs);
    } catch (error) {
      console.error("Get FAQs error:", error);
      res.status(500).json({ error: "Failed to get FAQs" });
    }
  });

  // Get single FAQ (admin)
  app.get("/api/admin/faqs/:id", requireRole("admin", "lo"), async (req, res) => {
    try {
      const faq = await storage.getFaq(req.params.id);
      if (!faq) {
        return res.status(404).json({ error: "FAQ not found" });
      }
      res.json(faq);
    } catch (error) {
      console.error("Get FAQ error:", error);
      res.status(500).json({ error: "Failed to get FAQ" });
    }
  });

  // Create FAQ (admin)
  app.post("/api/admin/faqs", requireRole("admin", "lo"), async (req, res) => {
    try {
      const validatedData = insertFaqSchema.parse({
        ...req.body,
        authorId: req.user!.id,
      });
      const faq = await storage.createFaq(validatedData);
      res.status(201).json(faq);
    } catch (error) {
      console.error("Create FAQ error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create FAQ" });
    }
  });

  // Update FAQ (admin)
  app.patch("/api/admin/faqs/:id", requireRole("admin", "lo"), async (req, res) => {
    try {
      const updated = await storage.updateFaq(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "FAQ not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update FAQ error:", error);
      res.status(500).json({ error: "Failed to update FAQ" });
    }
  });

  // Delete FAQ (admin)
  app.delete("/api/admin/faqs/:id", requireRole("admin", "lo"), async (req, res) => {
    try {
      await storage.deleteFaq(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete FAQ error:", error);
      res.status(500).json({ error: "Failed to delete FAQ" });
    }
  });

  // --- Public Learning Center & FAQ Routes ---

  // Get active categories (public)
  app.get("/api/content-categories", async (req, res) => {
    try {
      const categories = await storage.getActiveContentCategories();
      res.json(categories);
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ error: "Failed to get categories" });
    }
  });

  // Get published articles (public)
  app.get("/api/articles", async (req, res) => {
    try {
      const { category, search } = req.query;
      
      let articles;
      if (search && typeof search === "string") {
        articles = await storage.searchArticles(search);
      } else if (category && typeof category === "string") {
        articles = await storage.getArticlesByCategory(category);
      } else {
        articles = await storage.getPublishedArticles();
      }
      
      res.json(articles);
    } catch (error) {
      console.error("Get articles error:", error);
      res.status(500).json({ error: "Failed to get articles" });
    }
  });

  // Get single article by slug (public)
  app.get("/api/articles/:slug", async (req, res) => {
    try {
      const article = await storage.getArticleBySlug(req.params.slug);
      if (!article || article.status !== "published") {
        return res.status(404).json({ error: "Article not found" });
      }
      
      // Increment view count
      await storage.incrementArticleViewCount(article.id);
      
      res.json(article);
    } catch (error) {
      console.error("Get article error:", error);
      res.status(500).json({ error: "Failed to get article" });
    }
  });

  // Get published FAQs (public)
  app.get("/api/faqs", async (req, res) => {
    try {
      const { category, search, popular } = req.query;
      
      let faqs;
      if (search && typeof search === "string") {
        faqs = await storage.searchFaqs(search);
      } else if (popular === "true") {
        faqs = await storage.getPopularFaqs();
      } else if (category && typeof category === "string") {
        faqs = await storage.getFaqsByCategory(category);
      } else {
        faqs = await storage.getPublishedFaqs();
      }
      
      res.json(faqs);
    } catch (error) {
      console.error("Get FAQs error:", error);
      res.status(500).json({ error: "Failed to get FAQs" });
    }
  });

  // Get single FAQ and increment view (public)
  app.get("/api/faqs/:id", async (req, res) => {
    try {
      const faq = await storage.getFaq(req.params.id);
      if (!faq || faq.status !== "published") {
        return res.status(404).json({ error: "FAQ not found" });
      }
      
      // Increment view count
      await storage.incrementFaqViewCount(faq.id);
      
      res.json(faq);
    } catch (error) {
      console.error("Get FAQ error:", error);
      res.status(500).json({ error: "Failed to get FAQ" });
    }
  });

  // Mark FAQ as helpful/not helpful (public)
  app.post("/api/faqs/:id/feedback", async (req, res) => {
    try {
      const { helpful } = req.body;
      if (typeof helpful !== "boolean") {
        return res.status(400).json({ error: "helpful must be a boolean" });
      }
      
      const faq = await storage.getFaq(req.params.id);
      if (!faq || faq.status !== "published") {
        return res.status(404).json({ error: "FAQ not found" });
      }
      
      await storage.markFaqHelpful(req.params.id, helpful);
      res.json({ success: true });
    } catch (error) {
      console.error("FAQ feedback error:", error);
      res.status(500).json({ error: "Failed to record feedback" });
    }
  });

  // =============================================================================
  // MORTGAGE RATES
  // =============================================================================

  app.get("/api/rates", async (req, res) => {
    try {
      const rates = await storage.getMortgageRatesForLocation(undefined, undefined);
      const preview = rates.slice(0, 6).map((r: any) => ({
        id: r.id,
        programName: r.program?.name || "Mortgage",
        interestRate: r.rate,
        apr: r.apr,
        loanType: r.program?.name || "Fixed",
      }));
      res.json(preview);
    } catch (error) {
      console.error("Get rates preview error:", error);
      res.status(500).json({ error: "Failed to get rates" });
    }
  });

  // Get mortgage rates for a location (public)
  app.get("/api/mortgage-rates", async (req, res) => {
    try {
      const { state, zipcode } = req.query;
      const rates = await storage.getMortgageRatesForLocation(
        state as string | undefined,
        zipcode as string | undefined
      );
      res.json(rates);
    } catch (error) {
      console.error("Get mortgage rates error:", error);
      res.status(500).json({ error: "Failed to get mortgage rates" });
    }
  });

  // Get all rate programs (public)
  app.get("/api/mortgage-rate-programs", async (req, res) => {
    try {
      const programs = await storage.getActiveMortgageRatePrograms();
      res.json(programs);
    } catch (error) {
      console.error("Get mortgage rate programs error:", error);
      res.status(500).json({ error: "Failed to get mortgage rate programs" });
    }
  });

  // =============================================================================
  // MORTGAGE RATES ADMIN (Admin only)
  // =============================================================================

  // Get all mortgage rates for admin
  app.get("/api/admin/mortgage-rates", requireRole("admin"), async (req, res) => {
    try {
      const rates = await storage.getAllMortgageRates();
      res.json(rates);
    } catch (error) {
      console.error("Admin get mortgage rates error:", error);
      res.status(500).json({ error: "Failed to get mortgage rates" });
    }
  });

  // Get all rate programs for admin
  app.get("/api/admin/mortgage-rate-programs", requireRole("admin"), async (req, res) => {
    try {
      const programs = await storage.getAllMortgageRatePrograms();
      res.json(programs);
    } catch (error) {
      console.error("Admin get mortgage rate programs error:", error);
      res.status(500).json({ error: "Failed to get mortgage rate programs" });
    }
  });

  // Create a new rate program (admin only)
  app.post("/api/admin/mortgage-rate-programs", requireRole("admin"), async (req, res) => {
    try {
      const program = await storage.createMortgageRateProgram(req.body);
      res.status(201).json(program);
    } catch (error) {
      console.error("Create mortgage rate program error:", error);
      res.status(500).json({ error: "Failed to create mortgage rate program" });
    }
  });

  // Update a rate program (admin only)
  app.patch("/api/admin/mortgage-rate-programs/:id", requireRole("admin"), async (req, res) => {
    try {
      const program = await storage.updateMortgageRateProgram(req.params.id, req.body);
      if (!program) {
        return res.status(404).json({ error: "Program not found" });
      }
      res.json(program);
    } catch (error) {
      console.error("Update mortgage rate program error:", error);
      res.status(500).json({ error: "Failed to update mortgage rate program" });
    }
  });

  // Delete a rate program (admin only)
  app.delete("/api/admin/mortgage-rate-programs/:id", requireRole("admin"), async (req, res) => {
    try {
      await storage.deleteMortgageRateProgram(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete mortgage rate program error:", error);
      res.status(500).json({ error: "Failed to delete mortgage rate program" });
    }
  });

  // Create a new mortgage rate (admin only)
  app.post("/api/admin/mortgage-rates", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as User;
      const rateData = {
        ...req.body,
        createdBy: user.id,
        updatedBy: user.id,
      };
      const rate = await storage.createMortgageRate(rateData);
      res.status(201).json(rate);
    } catch (error) {
      console.error("Create mortgage rate error:", error);
      res.status(500).json({ error: "Failed to create mortgage rate" });
    }
  });

  // Update a mortgage rate (admin only)
  app.patch("/api/admin/mortgage-rates/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as User;
      const rateData = {
        ...req.body,
        updatedBy: user.id,
      };
      const rate = await storage.updateMortgageRate(req.params.id, rateData);
      if (!rate) {
        return res.status(404).json({ error: "Rate not found" });
      }
      res.json(rate);
    } catch (error) {
      console.error("Update mortgage rate error:", error);
      res.status(500).json({ error: "Failed to update mortgage rate" });
    }
  });

  // Delete a mortgage rate (admin only)
  app.delete("/api/admin/mortgage-rates/:id", requireRole("admin"), async (req, res) => {
    try {
      await storage.deleteMortgageRate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete mortgage rate error:", error);
      res.status(500).json({ error: "Failed to delete mortgage rate" });
    }
  });

  app.post("/api/admin/mortgage-rates/refresh", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"), async (req, res) => {
    try {
      const result = await refreshRates();
      res.json({ success: true, source: result.source, count: result.count });
    } catch (error) {
      console.error("Refresh mortgage rates error:", error);
      res.status(500).json({ error: "Failed to refresh mortgage rates" });
    }
  });
}
