import type { Express } from "express";
import type { IStorage } from "../storage";
import { isAuthenticated, requireRole } from "../auth";
import { isStaffRole, isInternalStaffRole, insertTaskSchema } from "@shared/schema";
import { parseBodyOr400 } from "./validate";

// Internal-only staff roles that have global task access.
// Partner roles (broker, lender) are scoped to their referred applications only.
const INTERNAL_STAFF_ROLES = new Set(["admin", "lo", "loa", "processor", "underwriter", "closer"]);
function isInternalStaff(role: string): boolean {
  return INTERNAL_STAFF_ROLES.has(role);
}

// Verify that the caller has object-level access to the application a task belongs to.
//
// Access rules per role:
//   admin        → global (unrestricted)
//   lo / loa     → must be the assigned loan officer (loanOfficerId) on the application,
//                  OR the application has no LO yet (unassigned file)
//   processor / underwriter / closer
//                → must be an active deal-team member on the application
//   broker / lender → must be the referring broker (referringBrokerId) on the application
//   borrower / others → must own the application (userId)
async function verifyTaskApplicationAccess(
  storage: IStorage,
  applicationId: string | null | undefined,
  userId: string,
  userRole: string,
): Promise<boolean> {
  if (userRole === "admin") return true;
  if (!applicationId) return false;

  const application = await storage.getLoanApplication(applicationId);
  if (!application) return false;

  if (userRole === "broker" || userRole === "lender") {
    // Partners must be active deal-team members, consistent with getLoanApplicationWithAccess.
    const teamMembers = await storage.getDealTeamMembers(applicationId);
    return teamMembers.some(m => m.userId === userId);
  }

  if (userRole === "lo" || userRole === "loa") {
    // LO/LOA are scoped strictly to files they are assigned to as loan officer.
    return application.loanOfficerId === userId;
  }

  if (userRole === "processor" || userRole === "underwriter" || userRole === "closer") {
    // Pipeline roles must be active deal-team members on the specific application.
    const teamMembers = await storage.getDealTeamMembers(applicationId);
    return teamMembers.some(m => m.userId === userId);
  }

  // Borrowers and any unrecognised roles: must own the application.
  return application.userId === userId;
}

export async function registerTaskEngineRoutes(
  app: Express,
  storage: IStorage,
) {
  // Task Routes - Internal staff only can create and manage tasks.
  // External partner roles (broker, lender) are excluded from task creation.
  app.post("/api/tasks", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"), async (req, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role || "";
      const applicationId = req.body.applicationId;

      // All roles (including internal staff) must have application-level access.
      // Admin always passes; all other roles are scoped via verifyTaskApplicationAccess.
      const allowed = await verifyTaskApplicationAccess(storage, applicationId, userId, userRole);
      if (!allowed) {
        return res.status(403).json({ error: "Access denied to this application" });
      }

      const data = parseBodyOr400(
        insertTaskSchema.omit({ createdByUserId: true, verifiedByUserId: true, verifiedAt: true }),
        req.body,
        res,
      );
      if (data === undefined) return;
      const task = await storage.createTask({ ...data, createdByUserId: userId });

      await storage.createDealActivity({
        applicationId: task.applicationId,
        activityType: "note",
        title: "Task Created",
        description: `New task: ${task.title}`,
        performedBy: userId,
      });

      res.status(201).json(task);
    } catch (error) {
      console.error("Create task error:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.get("/api/tasks", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role || "";
      const userId = req.user!.id;

      let tasks;
      if (userRole === "admin") {
        // Only admins get the unrestricted global task list
        tasks = await storage.getAllTasks();
      } else {
        // All other roles (including processor/underwriter/closer) see only tasks
        // associated with their own user record. Per-application access is enforced
        // at the /api/tasks/application/:applicationId and /api/tasks/:id routes.
        tasks = await storage.getTasksByUser(userId);
      }

      res.json(tasks);
    } catch (error) {
      console.error("Get tasks error:", error);
      res.status(500).json({ error: "Failed to get tasks" });
    }
  });

  app.get("/api/tasks/user/:userId", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      const requestingUserId = req.user!.id;
      const userRole = req.user?.role || "";

      // Only admins may retrieve another user's task list. All other roles
      // (including internal staff) may only access their own tasks; cross-user
      // task listing is a platform-wide data access that must be admin-gated.
      if (userId !== requestingUserId && userRole !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const tasks = await storage.getTasksByUser(userId);
      res.json(tasks);
    } catch (error) {
      console.error("Get user tasks error:", error);
      res.status(500).json({ error: "Failed to get user tasks" });
    }
  });

  app.get("/api/tasks/application/:applicationId", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const userId = req.user!.id;
      const userRole = req.user?.role || "";

      // Internal staff: unrestricted access
      // Partner roles (broker/lender): must have referral on the application
      // Borrowers: must own the application
      const allowed = await verifyTaskApplicationAccess(storage, applicationId, userId, userRole);
      if (!allowed) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const tasks = await storage.getTasksByApplication(applicationId);
      res.json(tasks);
    } catch (error) {
      console.error("Get application tasks error:", error);
      res.status(500).json({ error: "Failed to get application tasks" });
    }
  });

  app.get("/api/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const userId = req.user!.id;
      const userRole = req.user?.role || "";
      const isAssignedUser = task.assignedToUserId === userId;

      // All roles: must have application-level access or be the assigned user.
      // Admin always passes; all other roles are scoped via verifyTaskApplicationAccess.
      if (!isAssignedUser) {
        const allowed = await verifyTaskApplicationAccess(storage, task.applicationId, userId, userRole);
        if (!allowed) {
          return res.status(403).json({ error: "Unauthorized" });
        }
      }

      const taskDocs = await storage.getTaskDocuments(task.id);

      res.json({ ...task, documents: taskDocs });
    } catch (error) {
      console.error("Get task error:", error);
      res.status(500).json({ error: "Failed to get task" });
    }
  });

  // Fields that only staff may set on a task. Non-staff (assignees) are
  // restricted to the BORROWER_ALLOWED_FIELDS allowlist below.
  const STAFF_ONLY_TASK_FIELDS = new Set([
    "applicationId",
    "assignedToUserId",
    "createdByUserId",
    "title",
    "description",
    "taskType",
    "taskTypeCode",
    "triggerSource",
    "ownerRole",
    "slaClass",
    "slaDueAt",
    "escalationLevel",
    "escalatedAt",
    "documentCategory",
    "documentYear",
    "documentInstructions",
    "requestingTeam",
    "isCustomRequest",
    "status",
    "priority",
    "dueDate",
    "verificationStatus",
    "verificationNotes",
    "verifiedByUserId",
    "verifiedAt",
    "resolvedByUserId",
    "completedAt",
    "autoResolved",
    "autoResolveCondition",
    "blocksLoanProgress",
    "aiAnalysisResult",
    "aiAnalyzedAt",
    "extractedData",
    "triggerMetadata",
  ]);

  // The only fields a non-staff assignee may update through this legacy route.
  // Status changes must go through /api/task-engine/tasks/:taskId/status instead.
  const BORROWER_ALLOWED_TASK_FIELDS = new Set(["resolutionNotes"]);

  app.patch("/api/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const userRole = req.user?.role || "";
      const userId = req.user!.id;
      const isInternalStaff = isInternalStaffRole(userRole);
      const isAssignedUser = task.assignedToUserId === userId;

      if (!isInternalStaff && !isAssignedUser) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Internal staff must also have application-level access.
      // Admin always passes; all other internal roles are scoped via verifyTaskApplicationAccess.
      if (isInternalStaff) {
        const allowed = await verifyTaskApplicationAccess(storage, task.applicationId, userId, userRole);
        if (!allowed) {
          return res.status(403).json({ error: "Access denied to this application" });
        }
      }

      let updateData: Record<string, unknown>;

      if (isInternalStaff) {
        // verifiedByUserId/verifiedAt are server-controlled attestation fields;
        // omit them from the accepted shape so staff can't forge who verified.
        const data = parseBodyOr400(
          insertTaskSchema.omit({ createdByUserId: true, verifiedByUserId: true, verifiedAt: true }).partial(),
          req.body,
          res,
        );
        if (data === undefined) return;
        updateData = { ...data };
        if (updateData.verificationStatus) {
          updateData.verifiedByUserId = userId;
          updateData.verifiedAt = new Date();
        }
      } else {
        // Non-staff (assignee): reject any attempt to set staff-controlled fields.
        const forbidden = Object.keys(req.body).filter((k) =>
          STAFF_ONLY_TASK_FIELDS.has(k)
        );
        if (forbidden.length > 0) {
          return res.status(403).json({
            error: "Unauthorized: you may not modify restricted task fields",
            fields: forbidden,
          });
        }
        // Restrict to the borrower-safe allowlist only.
        updateData = Object.fromEntries(
          Object.entries(req.body as Record<string, unknown>).filter(([k]) =>
            BORROWER_ALLOWED_TASK_FIELDS.has(k)
          )
        );
        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ error: "No updatable fields provided" });
        }
      }

      const updated = await storage.updateTask(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Update task error:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role || "";
      if (userRole !== "admin") {
        return res.status(403).json({ error: "Only admins can delete tasks" });
      }

      await storage.deleteTask(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete task error:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // Task Document Routes
  app.post("/api/tasks/:taskId/documents", isAuthenticated, async (req, res) => {
    try {
      const { taskId } = req.params;
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const userId = req.user!.id;
      const userRole = req.user?.role || "";
      const isAssignedUser = task.assignedToUserId === userId;

      // All roles: must have application-level access or be the assigned user.
      if (!isAssignedUser) {
        const allowed = await verifyTaskApplicationAccess(storage, task.applicationId, userId, userRole);
        if (!allowed) {
          return res.status(403).json({ error: "Unauthorized" });
        }
      }

      const { documentId } = req.body;

      const doc = await storage.getDocument(documentId);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      // Non-internal-staff users (including broker/lender and borrowers) may only link documents
      // they own or that belong to the same application.
      if (!isInternalStaff(userRole)) {
        const ownsDocument = doc.userId === userId;
        const sameApplication = task.applicationId && doc.applicationId === task.applicationId;
        if (!ownsDocument && !sameApplication) {
          return res.status(403).json({ error: "Unauthorized" });
        }
      }

      const taskDocument = await storage.createTaskDocument({
        taskId,
        documentId,
      });

      await storage.updateTask(taskId, { status: "submitted" });

      await storage.createDealActivity({
        applicationId: task.applicationId,
        activityType: "document_uploaded",
        title: "Document Uploaded for Task",
        description: `Document uploaded for task: ${task.title}`,
        performedBy: userId,
      });

      res.status(201).json(taskDocument);
    } catch (error) {
      console.error("Create task document error:", error);
      res.status(500).json({ error: "Failed to link document to task" });
    }
  });

  app.get("/api/tasks/:taskId/documents", isAuthenticated, async (req, res) => {
    try {
      const { taskId } = req.params;
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const userId = req.user!.id;
      const userRole = req.user?.role || "";

      // All roles: must have application-level access or be the assigned user.
      if (task.assignedToUserId !== userId) {
        const allowed = await verifyTaskApplicationAccess(storage, task.applicationId, userId, userRole);
        if (!allowed) {
          return res.status(403).json({ error: "Unauthorized" });
        }
      }

      const taskDocs = await storage.getTaskDocuments(taskId);
      res.json(taskDocs);
    } catch (error) {
      console.error("Get task documents error:", error);
      res.status(500).json({ error: "Failed to get task documents" });
    }
  });

  // Document verification is an underwriting action — restricted to deal-team staff only
  app.patch("/api/tasks/:taskId/documents/:docId/verify", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role || "";
      const userId = req.user!.id;

      // Role-level gate: only internal staff roles may verify documents.
      if (!isInternalStaff(userRole)) {
        return res.status(403).json({ error: "Only internal staff can verify documents" });
      }

      const { taskId, docId } = req.params;
      const { isVerified, verificationNotes } = req.body;

      // Object-level gate: non-admin staff must be a deal-team member on the application.
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      if (userRole !== "admin" && task.applicationId) {
        const allowed = await verifyTaskApplicationAccess(storage, task.applicationId, userId, userRole);
        if (!allowed) {
          return res.status(403).json({ error: "Not authorized to verify documents for this application" });
        }
      }

      const updated = await storage.updateTaskDocument(docId, {
        isVerified,
        verificationNotes,
      });

      if (isVerified) {
        const task = await storage.getTask(taskId);
        if (task) {
          await storage.updateTask(taskId, {
            status: "verified",
            verificationStatus: "verified",
            verifiedByUserId: req.user!.id,
            verifiedAt: new Date(),
            verificationNotes,
          });
        }
      }

      res.json(updated);
    } catch (error) {
      console.error("Verify task document error:", error);
      res.status(500).json({ error: "Failed to verify document" });
    }
  });

  // ========================================================================
  // TASK ENGINE API ENDPOINTS
  // ========================================================================

  // Import task engine
  const { taskEngine, userRoleToOwnerRole, canAccessRoleQueue } = await import("../services/taskEngine");

  // Get SLA class configurations (admin/underwriter only — control-plane config)
  app.get("/api/task-engine/sla-classes", requireRole("admin", "underwriter"), async (req, res) => {
    try {
      const configs = await taskEngine.getAllSlaClassConfigs();
      res.json(configs);
    } catch (error) {
      console.error("Get SLA classes error:", error);
      res.status(500).json({ error: "Failed to get SLA configurations" });
    }
  });

  // Get task type SLA mappings (admin/underwriter only — control-plane config)
  app.get("/api/task-engine/task-type-mappings", requireRole("admin", "underwriter"), async (req, res) => {
    try {
      const mappings = await taskEngine.getAllTaskTypeSlaMappings();
      res.json(mappings);
    } catch (error) {
      console.error("Get task type mappings error:", error);
      res.status(500).json({ error: "Failed to get task type mappings" });
    }
  });

  // Get task dashboard metrics (admin/underwriter only — platform-wide aggregation)
  app.get("/api/task-engine/metrics", requireRole("admin", "underwriter"), async (req, res) => {
    try {
      const metrics = await taskEngine.getTaskDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Get task metrics error:", error);
      res.status(500).json({ error: "Failed to get task metrics" });
    }
  });

  // Get tasks with SLA status for an application (staff only)
  app.get("/api/task-engine/applications/:applicationId/tasks", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role || "";
      const userId = req.user!.id;
      if (!isInternalStaffRole(userRole)) {
        return res.status(403).json({ error: "Internal staff access required for full task list" });
      }
      const { applicationId } = req.params;
      // All staff roles must have application-level access; admin always passes.
      const allowed = await verifyTaskApplicationAccess(storage, applicationId, userId, userRole);
      if (!allowed) {
        return res.status(403).json({ error: "Access denied to this application" });
      }
      const tasks = await taskEngine.getTasksForApplication(applicationId);
      res.json(tasks);
    } catch (error) {
      console.error("Get application tasks error:", error);
      res.status(500).json({ error: "Failed to get tasks" });
    }
  });

  // Get borrower-visible tasks (verify ownership)
  app.get("/api/task-engine/applications/:applicationId/borrower-tasks", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const userId = req.user!.id;
      const userRole = req.user?.role || "";

      // Internal staff: unrestricted; partner roles: must have referral; borrowers: must own
      const allowed = await verifyTaskApplicationAccess(storage, applicationId, userId, userRole);
      if (!allowed) {
        return res.status(403).json({ error: "Access denied to this application" });
      }

      const tasks = await taskEngine.getBorrowerTasks(applicationId);
      res.json(tasks);
    } catch (error) {
      console.error("Get borrower tasks error:", error);
      res.status(500).json({ error: "Failed to get borrower tasks" });
    }
  });

  // Get tasks by owner role (a shared, cross-application role work queue).
  // Admin may query any role's queue. A non-admin internal-staff member may query
  // ONLY their own role's queue; cross-role enumeration and external/partner roles
  // (broker, lender) and clients are denied. This mirrors the self-only rule on
  // GET /api/tasks/user/:userId — you see your own scope, admins see everything.
  app.get("/api/task-engine/tasks/by-role/:role", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role || "";
      if (!canAccessRoleQueue(userRole, req.params.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      // Normalize to owner-role form (e.g. "underwriter" -> "UW") so the lookup is
      // correct regardless of the casing/alias the client sends.
      const status = req.query.status as string | undefined;
      const tasks = await taskEngine.getTasksByOwnerRole(userRoleToOwnerRole(req.params.role), status);
      res.json(tasks);
    } catch (error) {
      console.error("Get tasks by role error:", error);
      res.status(500).json({ error: "Failed to get tasks by role" });
    }
  });

  // Get tasks assigned to current user
  app.get("/api/task-engine/my-tasks", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const status = req.query.status as string | undefined;
      const tasks = await taskEngine.getTasksForUser(userId, status);
      res.json(tasks);
    } catch (error) {
      console.error("Get my tasks error:", error);
      res.status(500).json({ error: "Failed to get tasks" });
    }
  });

  // Get pending task count for borrower (for sidebar badge)
  app.get("/api/task-engine/my-tasks/pending-count", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const tasks = await taskEngine.getTasksForUser(userId, "OPEN");
      const pendingCount = tasks.filter(t => t.ownerRole === "BORROWER").length;
      res.json({ pendingCount });
    } catch (error) {
      console.error("Get pending task count error:", error);
      res.status(500).json({ error: "Failed to get pending count" });
    }
  });

  // Create task with SLA (staff only)
  app.post("/api/task-engine/tasks", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role || "";
      const userId = req.user!.id;
      if (!isInternalStaffRole(userRole)) {
        return res.status(403).json({ error: "Internal staff access required" });
      }

      const { title, description, applicationId, taskType, taskTypeCode, ownerRole, assignedToUserId } = req.body;

      if (!title || !applicationId || !taskType) {
        return res.status(400).json({ error: "Title, applicationId, and taskType are required" });
      }

      // All staff roles must have application-level access; admin always passes.
      const allowed = await verifyTaskApplicationAccess(storage, applicationId, userId, userRole);
      if (!allowed) {
        return res.status(403).json({ error: "Access denied to this application" });
      }

      const task = await taskEngine.createTask(
        {
          title,
          description,
          applicationId,
          taskType,
          taskTypeCode,
          ownerRole,
          assignedToUserId,
        },
        userId,
        "MANUAL"
      );

      res.status(201).json(task);
    } catch (error) {
      console.error("Create task error:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  // Update task status (staff or assigned user only)
  app.patch("/api/task-engine/tasks/:taskId/status", isAuthenticated, async (req, res) => {
    try {
      const { taskId } = req.params;
      const { status, notes } = req.body;
      const userId = req.user!.id;
      const userRole = req.user?.role || "";

      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }

      // Fetch task first to check authorization
      const existingTask = await storage.getTask(taskId);
      if (!existingTask) {
        return res.status(404).json({ error: "Task not found" });
      }

      if (isInternalStaffRole(userRole)) {
        // Internal staff must have application-level access; admin always passes.
        const allowed = await verifyTaskApplicationAccess(storage, existingTask.applicationId, userId, userRole);
        if (!allowed) {
          return res.status(403).json({ error: "Access denied to this application" });
        }
      } else {
        // Non-internal-staff (including partners and borrowers) can only update tasks assigned to them
        if (existingTask.assignedToUserId !== userId) {
          return res.status(403).json({ error: "Access denied: You can only update tasks assigned to you" });
        }
      }

      const task = await taskEngine.updateTaskStatus(taskId, status, userId, notes);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Update task status error:", error);
      res.status(500).json({ error: "Failed to update task status" });
    }
  });

  // Escalate a task (internal staff only, scoped to deal team)
  app.post("/api/task-engine/tasks/:taskId/escalate", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role || "";
      const userId = req.user!.id;
      if (!isInternalStaff(userRole)) {
        return res.status(403).json({ error: "Internal staff access required" });
      }

      const { taskId } = req.params;
      const { reason } = req.body;

      // Non-admin internal staff must be deal-team members on the application.
      const existingTask = await storage.getTask(taskId);
      if (!existingTask) {
        return res.status(404).json({ error: "Task not found" });
      }
      if (userRole !== "admin" && existingTask.applicationId) {
        const allowed = await verifyTaskApplicationAccess(storage, existingTask.applicationId, userId, userRole);
        if (!allowed) {
          return res.status(403).json({ error: "Access denied to this application" });
        }
      }

      const task = await taskEngine.escalateTask(taskId, reason);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Escalate task error:", error);
      res.status(500).json({ error: "Failed to escalate task" });
    }
  });

  // Get task audit trail (internal staff only, scoped to deal team)
  app.get("/api/task-engine/tasks/:taskId/audit", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role || "";
      const userId = req.user!.id;
      if (!isInternalStaff(userRole)) {
        return res.status(403).json({ error: "Internal staff access required" });
      }

      const { taskId } = req.params;

      // Non-admin internal staff must be deal-team members on the application.
      const existingTask = await storage.getTask(taskId);
      if (!existingTask) {
        return res.status(404).json({ error: "Task not found" });
      }
      if (userRole !== "admin" && existingTask.applicationId) {
        const allowed = await verifyTaskApplicationAccess(storage, existingTask.applicationId, userId, userRole);
        if (!allowed) {
          return res.status(403).json({ error: "Access denied to this application" });
        }
      }

      const auditTrail = await taskEngine.getTaskAuditTrail(taskId);
      res.json(auditTrail);
    } catch (error) {
      console.error("Get task audit trail error:", error);
      res.status(500).json({ error: "Failed to get audit trail" });
    }
  });

  // Run escalation check (admin only - for manual trigger)
  app.post("/api/task-engine/run-escalation", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role || "";
      if (userRole !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const escalatedCount = await taskEngine.runEscalationCheck();
      res.json({ escalatedCount, message: `Escalated ${escalatedCount} tasks` });
    } catch (error) {
      console.error("Run escalation error:", error);
      res.status(500).json({ error: "Failed to run escalation check" });
    }
  });
}
