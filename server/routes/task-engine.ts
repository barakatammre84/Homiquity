import type { Express } from "express";
import type { IStorage } from "../storage";
import { isAuthenticated, requireRole } from "../auth";
import { isStaffRole } from "@shared/schema";

export async function registerTaskEngineRoutes(
  app: Express,
  storage: IStorage,
) {
  // Task Routes - Admin/Staff can create and manage tasks
  app.post("/api/tasks", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const taskData = {
        ...req.body,
        createdByUserId: req.user!.id,
      };

      const task = await storage.createTask(taskData);

      await storage.createDealActivity({
        applicationId: task.applicationId,
        activityType: "note",
        title: "Task Created",
        description: `New task: ${task.title}`,
        performedBy: req.user!.id,
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
      if (isStaffRole(userRole || "")) {
        tasks = await storage.getAllTasks();
      } else {
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

      if (userId !== requestingUserId && !isStaffRole(userRole || "")) {
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

      if (!isStaffRole(userRole)) {
        const app = await storage.getLoanApplication(applicationId);
        if (!app || app.userId !== userId) {
          return res.status(403).json({ error: "Unauthorized" });
        }
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
      if (!isStaffRole(userRole) && task.assignedToUserId !== userId) {
        const app = task.applicationId ? await storage.getLoanApplication(task.applicationId) : null;
        if (!app || app.userId !== userId) {
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

      const updateData = req.body;
      if (updateData.verificationStatus && isStaff) {
        updateData.verifiedByUserId = userId;
        updateData.verifiedAt = new Date();
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
      if (task.assignedToUserId !== userId && !isStaffRole(req.user?.role || "")) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { documentId } = req.body;

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
      const taskDocs = await storage.getTaskDocuments(taskId);
      res.json(taskDocs);
    } catch (error) {
      console.error("Get task documents error:", error);
      res.status(500).json({ error: "Failed to get task documents" });
    }
  });

  app.patch("/api/tasks/:taskId/documents/:docId/verify", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role || "";
      if (!isStaffRole(userRole || "")) {
        return res.status(403).json({ error: "Only staff can verify documents" });
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
      if (!isStaffRole(userRole)) {
        return res.status(403).json({ error: "Staff access required for full task list" });
      }
      const { applicationId } = req.params;
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
      
      // Staff can access any application's borrower tasks
      if (!isStaffRole(userRole)) {
        // Borrowers must own the application
        const application = await storage.getLoanApplicationWithAccess(applicationId, userId, userRole || "borrower");
        if (!application) {
          return res.status(403).json({ error: "Access denied to this application" });
        }
      }
      
      const tasks = await taskEngine.getBorrowerTasks(applicationId);
      res.json(tasks);
    } catch (error) {
      console.error("Get borrower tasks error:", error);
      res.status(500).json({ error: "Failed to get borrower tasks" });
    }
  });

  // Get tasks by owner role (staff only)
  app.get("/api/task-engine/tasks/by-role/:role", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role || "";
      if (!isStaffRole(userRole)) {
        return res.status(403).json({ error: "Staff access required" });
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
      if (!isStaffRole(userRole)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      
      const { title, description, applicationId, taskType, taskTypeCode, ownerRole, assignedToUserId } = req.body;
      
      if (!title || !applicationId || !taskType) {
        return res.status(400).json({ error: "Title, applicationId, and taskType are required" });
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
        req.user!.id,
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

      // Staff can update any task
      // Non-staff can only update tasks assigned to them
      if (!isStaffRole(userRole)) {
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

  // Escalate a task (staff only)
  app.post("/api/task-engine/tasks/:taskId/escalate", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role || "";
      if (!isStaffRole(userRole)) {
        return res.status(403).json({ error: "Staff access required" });
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

  // Get task audit trail
  app.get("/api/task-engine/tasks/:taskId/audit", isAuthenticated, async (req, res) => {
    try {
      const userRole = req.user?.role || "";
      if (!isStaffRole(userRole)) {
        return res.status(403).json({ error: "Staff access required" });
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
