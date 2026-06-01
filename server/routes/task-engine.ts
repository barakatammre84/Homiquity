import type { Express } from "express";
import type { IStorage } from "../storage";
import { isAuthenticated, requireRole } from "../auth";
import { isStaffRole } from "@shared/schema";

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
//                → pipeline-wide access; these roles work all active files in the system.
//                  Proper per-file restriction requires a deal-team assignment table that
//                  does not exist in the current schema; restricting them further would
//                  require introducing new functionality.
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
    return application.referringBrokerId === userId;
  }

  if (userRole === "lo" || userRole === "loa") {
    // LO/LOA are scoped to their assigned files or unassigned files.
    return application.loanOfficerId === userId || !application.loanOfficerId;
  }

  if (userRole === "processor" || userRole === "underwriter" || userRole === "closer") {
    // These pipeline roles work all active files. Object-level restriction requires
    // a deal-team table not present in the current schema.
    return true;
  }

  // Borrowers and any unrecognised roles: must own the application.
  return application.userId === userId;
}

export async function registerTaskEngineRoutes(
  app: Express,
  storage: IStorage,
) {
  // Task Routes - Admin/Staff can create and manage tasks
  app.post("/api/tasks", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role || "";
      const applicationId = req.body.applicationId;

      // Broker/lender must have a referral on the target application
      if (!isInternalStaff(userRole)) {
        const allowed = await verifyTaskApplicationAccess(storage, applicationId, userId, userRole);
        if (!allowed) {
          return res.status(403).json({ error: "Access denied to this application" });
        }
      }

      const taskData = {
        ...req.body,
        createdByUserId: userId,
      };

      const task = await storage.createTask(taskData);

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
      if (isInternalStaff(userRole)) {
        // Only internal staff get the full global task list
        tasks = await storage.getAllTasks();
      } else {
        // Partner roles (broker, lender) and borrowers see only their own tasks
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

      // Partner roles (broker/lender) may only retrieve their own task list,
      // never another user's. Internal staff can retrieve any user's tasks.
      if (userId !== requestingUserId) {
        if (!isInternalStaff(userRole)) {
          return res.status(403).json({ error: "Unauthorized" });
        }
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

      // Internal staff: unrestricted access
      // Partner staff (broker/lender): must have referral on the application
      // Borrowers/others: must own the application or be the assigned user
      if (!isInternalStaff(userRole)) {
        if (!isAssignedUser) {
          const allowed = await verifyTaskApplicationAccess(storage, task.applicationId, userId, userRole);
          if (!allowed) {
            return res.status(403).json({ error: "Unauthorized" });
          }
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
      const isStaff = isStaffRole(userRole || "");
      const isAssignedUser = task.assignedToUserId === userId;

      if (!isStaff && !isAssignedUser) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Partner roles (broker/lender) must also have a referral on the application
      if (isStaff && !isInternalStaff(userRole)) {
        const allowed = await verifyTaskApplicationAccess(storage, task.applicationId, userId, userRole);
        if (!allowed) {
          return res.status(403).json({ error: "Access denied to this application" });
        }
      }

      let updateData: Record<string, unknown>;

      if (isStaff) {
        updateData = { ...req.body };
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

      // Internal staff: unrestricted; partner roles: must have referral; others: must be assignee
      if (!isInternalStaff(userRole)) {
        if (!isAssignedUser) {
          const allowed = await verifyTaskApplicationAccess(storage, task.applicationId, userId, userRole);
          if (!allowed) {
            return res.status(403).json({ error: "Unauthorized" });
          }
        }
      }

      const { documentId } = req.body;

      const doc = await storage.getDocument(documentId);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
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

      // Internal staff: unrestricted; partner roles: must have referral; others: must own or be assignee
      if (!isInternalStaff(userRole)) {
        if (task.assignedToUserId !== userId) {
          const allowed = await verifyTaskApplicationAccess(storage, task.applicationId, userId, userRole);
          if (!allowed) {
            return res.status(403).json({ error: "Unauthorized" });
          }
        }
      }

      const taskDocs = await storage.getTaskDocuments(taskId);
      res.json(taskDocs);
    } catch (error) {
      console.error("Get task documents error:", error);
      res.status(500).json({ error: "Failed to get task documents" });
    }
  });

  // Document verification is an underwriting action — restricted to internal staff only
  app.patch("/api/tasks/:taskId/documents/:docId/verify", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role || "";
      if (!isInternalStaff(userRole)) {
        return res.status(403).json({ error: "Only internal staff can verify documents" });
      }

      const { taskId, docId } = req.params;
      const { isVerified, verificationNotes } = req.body;

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
  const { taskEngine } = await import("../services/taskEngine");

  // Get SLA class configurations
  app.get("/api/task-engine/sla-classes", isAuthenticated, async (req, res) => {
    try {
      const configs = await taskEngine.getAllSlaClassConfigs();
      res.json(configs);
    } catch (error) {
      console.error("Get SLA classes error:", error);
      res.status(500).json({ error: "Failed to get SLA configurations" });
    }
  });

  // Get task type SLA mappings
  app.get("/api/task-engine/task-type-mappings", isAuthenticated, async (req, res) => {
    try {
      const mappings = await taskEngine.getAllTaskTypeSlaMappings();
      res.json(mappings);
    } catch (error) {
      console.error("Get task type mappings error:", error);
      res.status(500).json({ error: "Failed to get task type mappings" });
    }
  });

  // Get task dashboard metrics (staff only)
  app.get("/api/task-engine/metrics", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role || "";
      if (!isStaffRole(userRole)) {
        return res.status(403).json({ error: "Staff access required" });
      }
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
      if (!isStaffRole(userRole)) {
        return res.status(403).json({ error: "Staff access required for full task list" });
      }
      const { applicationId } = req.params;
      // Partner staff (broker/lender) must have a referral on this application
      if (!isInternalStaff(userRole)) {
        const allowed = await verifyTaskApplicationAccess(storage, applicationId, userId, userRole);
        if (!allowed) {
          return res.status(403).json({ error: "Access denied to this application" });
        }
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

  // Get tasks by owner role (internal staff only — returns cross-application results)
  app.get("/api/task-engine/tasks/by-role/:role", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role || "";
      if (!isInternalStaff(userRole)) {
        return res.status(403).json({ error: "Internal staff access required" });
      }
      const { role } = req.params;
      const status = req.query.status as string | undefined;
      const tasks = await taskEngine.getTasksByOwnerRole(role.toUpperCase(), status);
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
      if (!isStaffRole(userRole)) {
        return res.status(403).json({ error: "Staff access required" });
      }

      const { title, description, applicationId, taskType, taskTypeCode, ownerRole, assignedToUserId } = req.body;

      if (!title || !applicationId || !taskType) {
        return res.status(400).json({ error: "Title, applicationId, and taskType are required" });
      }

      // Partner roles (broker/lender) must have a referral on the target application
      if (!isInternalStaff(userRole)) {
        const allowed = await verifyTaskApplicationAccess(storage, applicationId, userId, userRole);
        if (!allowed) {
          return res.status(403).json({ error: "Access denied to this application" });
        }
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

      if (isStaffRole(userRole)) {
        // Partner roles (broker/lender) must have a referral on the application
        if (!isInternalStaff(userRole)) {
          const allowed = await verifyTaskApplicationAccess(storage, existingTask.applicationId, userId, userRole);
          if (!allowed) {
            return res.status(403).json({ error: "Access denied to this application" });
          }
        }
      } else {
        // Non-staff can only update tasks assigned to them
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

  // Escalate a task (internal staff only)
  app.post("/api/task-engine/tasks/:taskId/escalate", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role || "";
      if (!isInternalStaff(userRole)) {
        return res.status(403).json({ error: "Internal staff access required" });
      }

      const { taskId } = req.params;
      const { reason } = req.body;

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

  // Get task audit trail (internal staff only)
  app.get("/api/task-engine/tasks/:taskId/audit", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role || "";
      if (!isInternalStaff(userRole)) {
        return res.status(403).json({ error: "Internal staff access required" });
      }

      const { taskId } = req.params;
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
