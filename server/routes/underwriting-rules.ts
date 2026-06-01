import type { Express } from "express";
import type { IStorage } from "../storage";
import { requireRole } from "../auth";
import { insertUnderwritingRuleDslSchema } from "@shared/schema";
import { logAudit } from "../auditLog";
import { executeRules } from "../services/ruleEngine";
import { z } from "zod";

export function registerUnderwritingRulesRoutes(
  app: Express,
  storage: IStorage,
) {
  app.get("/api/underwriting-rules", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const { category, triggerType, isActive } = req.query;
      const filters: { category?: string; triggerType?: string; isActive?: boolean } = {};
      if (category && typeof category === "string") filters.category = category;
      if (triggerType && typeof triggerType === "string") filters.triggerType = triggerType;
      if (isActive !== undefined) filters.isActive = isActive === "true";

      const rules = await storage.getUnderwritingRules(filters);
      res.json(rules);
    } catch (error) {
      console.error("Get underwriting rules error:", error);
      res.status(500).json({ error: "Failed to get underwriting rules" });
    }
  });

  app.get("/api/underwriting-rules/:id", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const rule = await storage.getUnderwritingRule(req.params.id);
      if (!rule) {
        return res.status(404).json({ error: "Rule not found" });
      }
      res.json(rule);
    } catch (error) {
      console.error("Get underwriting rule error:", error);
      res.status(500).json({ error: "Failed to get underwriting rule" });
    }
  });

  app.post("/api/underwriting-rules", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const parsed = insertUnderwritingRuleDslSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid rule data", details: parsed.error.flatten() });
      }

      const existing = await storage.getUnderwritingRuleByCode(parsed.data.ruleCode);
      if (existing) {
        return res.status(409).json({ error: `Rule code "${parsed.data.ruleCode}" already exists` });
      }

      const rule = await storage.createUnderwritingRule({
        ...parsed.data,
        createdBy: req.user!.id,
        version: 1,
        isActive: false,
      });

      await logAudit(req, "RULE_CREATE", "underwriting_rule", rule.id, {
        ruleCode: rule.ruleCode,
        ruleName: rule.ruleName,
        category: rule.category,
      });

      res.status(201).json(rule);
    } catch (error) {
      console.error("Create underwriting rule error:", error);
      res.status(500).json({ error: "Failed to create underwriting rule" });
    }
  });

  app.patch("/api/underwriting-rules/:id", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const rule = await storage.getUnderwritingRule(req.params.id);
      if (!rule) {
        return res.status(404).json({ error: "Rule not found" });
      }

      if (rule.approvedBy && rule.isActive) {
        return res.status(400).json({ error: "Cannot edit an active, approved rule. Create a new version instead." });
      }

      const allowedFields = [
        "ruleName", "ruleDescription", "productTypes", "incomeTypes",
        "triggerType", "triggerConditions", "conditionsDsl", "actions",
        "priority", "stopOnMatch", "category", "guidelineReference",
        "effectiveDate", "expirationDate",
      ];

      const updates: Record<string, any> = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) {
          updates[key] = req.body[key];
        }
      }

      const updated = await storage.updateUnderwritingRule(req.params.id, updates);

      await logAudit(req, "RULE_UPDATE", "underwriting_rule", req.params.id, {
        ruleCode: rule.ruleCode,
        updatedFields: Object.keys(updates),
      });

      res.json(updated);
    } catch (error) {
      console.error("Update underwriting rule error:", error);
      res.status(500).json({ error: "Failed to update underwriting rule" });
    }
  });

  app.delete("/api/underwriting-rules/:id", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const rule = await storage.getUnderwritingRule(req.params.id);
      if (!rule) {
        return res.status(404).json({ error: "Rule not found" });
      }

      const updated = await storage.updateUnderwritingRule(req.params.id, {
        isActive: false,
        expirationDate: new Date(),
      });

      await logAudit(req, "RULE_DEACTIVATE", "underwriting_rule", req.params.id, {
        ruleCode: rule.ruleCode,
        ruleName: rule.ruleName,
      });

      res.json(updated);
    } catch (error) {
      console.error("Deactivate underwriting rule error:", error);
      res.status(500).json({ error: "Failed to deactivate underwriting rule" });
    }
  });

  app.post("/api/underwriting-rules/:id/version", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const rule = await storage.getUnderwritingRule(req.params.id);
      if (!rule) {
        return res.status(404).json({ error: "Rule not found" });
      }

      const newVersion = await storage.createUnderwritingRule({
        ruleCode: rule.ruleCode + `_v${(rule.version || 1) + 1}`,
        ruleName: rule.ruleName,
        ruleDescription: rule.ruleDescription,
        productTypes: rule.productTypes,
        incomeTypes: rule.incomeTypes,
        triggerType: rule.triggerType,
        triggerConditions: rule.triggerConditions as Record<string, unknown>,
        conditionsDsl: rule.conditionsDsl as Record<string, unknown>,
        actions: rule.actions as Record<string, unknown>[],
        priority: rule.priority,
        stopOnMatch: rule.stopOnMatch,
        category: rule.category,
        guidelineReference: rule.guidelineReference,
        isActive: false,
        effectiveDate: new Date(),
        version: (rule.version || 1) + 1,
        previousVersionId: rule.id,
        createdBy: req.user!.id,
      });

      await logAudit(req, "RULE_VERSION", "underwriting_rule", newVersion.id, {
        previousVersionId: rule.id,
        previousRuleCode: rule.ruleCode,
        newVersion: newVersion.version,
      });

      res.status(201).json(newVersion);
    } catch (error) {
      console.error("Version underwriting rule error:", error);
      res.status(500).json({ error: "Failed to create rule version" });
    }
  });

  app.post("/api/underwriting-rules/:id/approve", requireRole("admin"), async (req, res) => {
    try {
      const rule = await storage.getUnderwritingRule(req.params.id);
      if (!rule) {
        return res.status(404).json({ error: "Rule not found" });
      }

      if (rule.approvedBy) {
        return res.status(400).json({ error: "Rule is already approved" });
      }

      if (rule.createdBy === req.user!.id) {
        return res.status(400).json({ error: "Cannot approve your own rule (four-eyes principle)" });
      }

      const updated = await storage.updateUnderwritingRule(req.params.id, {
        approvedBy: req.user!.id,
        approvedAt: new Date(),
        isActive: true,
      });

      if (rule.previousVersionId) {
        await storage.updateUnderwritingRule(rule.previousVersionId, {
          isActive: false,
          expirationDate: new Date(),
        });
      }

      await logAudit(req, "RULE_APPROVE", "underwriting_rule", req.params.id, {
        ruleCode: rule.ruleCode,
        ruleName: rule.ruleName,
        approvedBy: req.user!.id,
        previousVersionRetired: rule.previousVersionId || null,
      });

      res.json(updated);
    } catch (error) {
      console.error("Approve underwriting rule error:", error);
      res.status(500).json({ error: "Failed to approve underwriting rule" });
    }
  });

  app.post("/api/underwriting-rules/:id/retire", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const rule = await storage.getUnderwritingRule(req.params.id);
      if (!rule) {
        return res.status(404).json({ error: "Rule not found" });
      }

      if (!rule.isActive) {
        return res.status(400).json({ error: "Rule is already inactive" });
      }

      const updated = await storage.updateUnderwritingRule(req.params.id, {
        isActive: false,
        expirationDate: new Date(),
      });

      await logAudit(req, "RULE_RETIRE", "underwriting_rule", req.params.id, {
        ruleCode: rule.ruleCode,
        ruleName: rule.ruleName,
        retiredBy: req.user!.id,
      });

      res.json(updated);
    } catch (error) {
      console.error("Retire underwriting rule error:", error);
      res.status(500).json({ error: "Failed to retire underwriting rule" });
    }
  });

  app.post("/api/underwriting-rules/execute", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const schema = z.object({
        snapshotId: z.string(),
        context: z.record(z.any()),
        ruleIds: z.array(z.string()).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid execution request", details: parsed.error.flatten() });
      }

      const results = await executeRules(
        storage,
        parsed.data.snapshotId,
        parsed.data.context,
        parsed.data.ruleIds,
      );

      const fired = results.filter((r: { conditionsMet: boolean }) => r.conditionsMet).length;

      await logAudit(req, "RULE_EXECUTE", "underwriting_rule", parsed.data.snapshotId, {
        rulesEvaluated: results.length,
        rulesFired: fired,
      });

      res.json({ results, summary: {
        total: results.length,
        fired,
        skipped: results.length - fired,
      }});
    } catch (error) {
      console.error("Execute rules error:", error);
      res.status(500).json({ error: "Failed to execute rules" });
    }
  });

  app.get("/api/underwriting-rules/execution-log/:snapshotId", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const logs = await storage.getRuleExecutionLogs(req.params.snapshotId);
      res.json(logs);
    } catch (error) {
      console.error("Get rule execution logs error:", error);
      res.status(500).json({ error: "Failed to get rule execution logs" });
    }
  });
}
