import { db } from "../db";
import { 
  tasks, 
  taskEvents, 
  taskAuditLog, 
  slaClassConfigs,
  taskTypeSlaMapping,
  escalationActions,
  users,
  loanApplications,
  type Task,
  type InsertTask,
  type TaskEvent,
  type InsertTaskEvent,
  type TaskAuditLog,
  type SlaClassConfig,
  type TaskTypeSlaMapping,
} from "@shared/schema";
import { eq, and, isNull, lt, desc, asc, inArray, sql, isNotNull } from "drizzle-orm";

// Role mapping between user roles (lowercase) and task owner roles (uppercase)
const USER_ROLE_TO_OWNER_ROLE: Record<string, string> = {
  "admin": "ADMIN",
  "lo": "LO",
  "loa": "LOA",
  "processor": "PROCESSOR",
  "underwriter": "UW",
  "closer": "CLOSER",
};

const OWNER_ROLE_TO_USER_ROLE: Record<string, string> = {
  "ADMIN": "admin",
  "LO": "lo",
  "LOA": "loa",
  "PROCESSOR": "processor",
  "UW": "underwriter",
  "CLOSER": "closer",
};

// Convert user role to task owner role (uppercase)
export function userRoleToOwnerRole(userRole: string): string {
  return USER_ROLE_TO_OWNER_ROLE[userRole.toLowerCase()] || userRole.toUpperCase();
}

// Convert task owner role to user role (lowercase)
export function ownerRoleToUserRole(ownerRole: string): string {
  return OWNER_ROLE_TO_USER_ROLE[ownerRole.toUpperCase()] || ownerRole.toLowerCase();
}

// SLA Status computation
export type SlaStatus = "green" | "amber" | "red";

export interface TaskWithSlaStatus extends Task {
  slaStatus: SlaStatus;
  timeRemaining: number | null; // minutes remaining
  percentageElapsed: number | null;
}

// Task Engine Service
export class TaskEngineService {
  
  // Get SLA class configuration
  async getSlaClassConfig(slaClass: string): Promise<SlaClassConfig | null> {
    const [config] = await db
      .select()
      .from(slaClassConfigs)
      .where(eq(slaClassConfigs.slaClass, slaClass));
    return config || null;
  }

  // Get all SLA class configurations
  async getAllSlaClassConfigs(): Promise<SlaClassConfig[]> {
    return db
      .select()
      .from(slaClassConfigs)
      .where(eq(slaClassConfigs.isActive, true))
      .orderBy(asc(slaClassConfigs.displayOrder));
  }

  // Get task type SLA mapping
  async getTaskTypeSlaMapping(taskTypeCode: string): Promise<TaskTypeSlaMapping | null> {
    const [mapping] = await db
      .select()
      .from(taskTypeSlaMapping)
      .where(eq(taskTypeSlaMapping.taskTypeCode, taskTypeCode));
    return mapping || null;
  }

  // Get all task type SLA mappings
  async getAllTaskTypeSlaMappings(): Promise<TaskTypeSlaMapping[]> {
    return db
      .select()
      .from(taskTypeSlaMapping)
      .where(eq(taskTypeSlaMapping.isActive, true))
      .orderBy(asc(taskTypeSlaMapping.category), asc(taskTypeSlaMapping.taskTypeName));
  }

  // Compute SLA due date based on task type and creation time
  async computeSlaDueAt(taskTypeCode: string, createdAt: Date = new Date()): Promise<{ slaDueAt: Date | null; slaClass: string }> {
    const mapping = await this.getTaskTypeSlaMapping(taskTypeCode);
    if (!mapping) {
      return { slaDueAt: null, slaClass: "S3" }; // Default to S3
    }

    const config = await this.getSlaClassConfig(mapping.slaClass);
    if (!config || !config.targetResolutionMinutes) {
      return { slaDueAt: null, slaClass: mapping.slaClass };
    }

    const slaDueAt = new Date(createdAt.getTime() + config.targetResolutionMinutes * 60 * 1000);
    return { slaDueAt, slaClass: mapping.slaClass };
  }

  // Compute SLA status for a task
  computeSlaStatus(task: Task): { slaStatus: SlaStatus; timeRemaining: number | null; percentageElapsed: number | null } {
    if (!task.slaDueAt || task.slaClass === "S5") {
      return { slaStatus: "green", timeRemaining: null, percentageElapsed: null };
    }

    if (task.status === "COMPLETED" || task.status === "EXPIRED") {
      return { slaStatus: "green", timeRemaining: null, percentageElapsed: null };
    }

    const now = new Date();
    const dueAt = new Date(task.slaDueAt);
    const createdAt = task.createdAt ? new Date(task.createdAt) : now;
    
    const totalDuration = dueAt.getTime() - createdAt.getTime();
    const elapsed = now.getTime() - createdAt.getTime();
    const remaining = dueAt.getTime() - now.getTime();
    
    const timeRemaining = Math.max(0, Math.round(remaining / (1000 * 60))); // minutes
    const percentageElapsed = Math.min(100, Math.round((elapsed / totalDuration) * 100));

    // Determine status
    if (remaining <= 0) {
      return { slaStatus: "red", timeRemaining: 0, percentageElapsed: 100 };
    } else if (percentageElapsed >= 75) {
      return { slaStatus: "amber", timeRemaining, percentageElapsed };
    } else {
      return { slaStatus: "green", timeRemaining, percentageElapsed };
    }
  }

  // Create a task with SLA computation and audit logging
  async createTask(
    taskData: Partial<InsertTask> & { title: string; applicationId: string; taskType: string },
    createdByUserId?: string,
    triggerSource: string = "MANUAL",
    triggerMetadata?: Record<string, unknown>
  ): Promise<Task> {
    // Get task type mapping if available
    let slaClass = "S3";
    let slaDueAt: Date | null = null;
    let ownerRole = taskData.ownerRole || "PROCESSOR";

    if (taskData.taskTypeCode) {
      const mapping = await this.getTaskTypeSlaMapping(taskData.taskTypeCode);
      if (mapping) {
        slaClass = mapping.slaClass;
        ownerRole = mapping.defaultOwnerRole;
        const slaResult = await this.computeSlaDueAt(taskData.taskTypeCode);
        slaDueAt = slaResult.slaDueAt;
      }
    }

    // Create the task
    const [newTask] = await db
      .insert(tasks)
      .values({
        ...taskData,
        triggerSource,
        ownerRole,
        slaClass,
        slaDueAt,
        escalationLevel: 0,
        status: "OPEN",
        priority: taskData.priority || "NORMAL",
        triggerMetadata: triggerMetadata as Record<string, unknown>,
        createdByUserId,
      })
      .returning();

    // Log the creation in audit
    await this.logTaskAction(newTask.id, "created", null, newTask, createdByUserId, "Task created");

    return newTask;
  }

  // Create task from event (event-driven creation)
  async createTaskFromEvent(event: InsertTaskEvent): Promise<{ task: Task | null; event: TaskEvent }> {
    // Check idempotency
    if (event.idempotencyKey) {
      const [existing] = await db
        .select()
        .from(taskEvents)
        .where(eq(taskEvents.idempotencyKey, event.idempotencyKey));
      
      if (existing && existing.resultingTaskId) {
        const [existingTask] = await db.select().from(tasks).where(eq(tasks.id, existing.resultingTaskId));
        return { task: existingTask || null, event: existing };
      }
    }

    // Create the event record
    const [taskEvent] = await db
      .insert(taskEvents)
      .values(event)
      .returning();

    // Determine task type and create task
    const payload = event.eventPayload as Record<string, unknown>;
    const taskTypeCode = payload.taskTypeCode as string || "DOCUMENT_REQUEST";
    const title = payload.title as string || "New Task";
    const description = payload.description as string || "";

    if (!event.applicationId) {
      return { task: null, event: taskEvent };
    }

    const task = await this.createTask(
      {
        applicationId: event.applicationId,
        title,
        description,
        taskType: payload.taskType as string || "review",
        taskTypeCode,
      },
      undefined,
      event.eventSource,
      payload
    );

    // Update event with resulting task
    await db
      .update(taskEvents)
      .set({ 
        processed: true, 
        processedAt: new Date(),
        resultingTaskId: task.id 
      })
      .where(eq(taskEvents.id, taskEvent.id));

    return { task, event: { ...taskEvent, resultingTaskId: task.id } };
  }

  // Update task status
  async updateTaskStatus(
    taskId: string, 
    newStatus: string, 
    userId?: string, 
    notes?: string
  ): Promise<Task | null> {
    const [currentTask] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!currentTask) return null;

    const updateData: Partial<Task> = {
      status: newStatus,
      updatedAt: new Date(),
    };

    if (newStatus === "COMPLETED") {
      updateData.completedAt = new Date();
      updateData.resolvedByUserId = userId;
      updateData.resolutionNotes = notes;
    }

    const [updatedTask] = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, taskId))
      .returning();

    // Log the status change
    await this.logTaskAction(
      taskId, 
      "status_change", 
      { status: currentTask.status },
      { status: newStatus },
      userId,
      notes
    );

    return updatedTask;
  }

  // Auto-resolve a task
  async autoResolveTask(taskId: string, condition: string): Promise<Task | null> {
    const [currentTask] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!currentTask) return null;
    if (currentTask.status === "COMPLETED") return currentTask;

    const [updatedTask] = await db
      .update(tasks)
      .set({
        status: "COMPLETED",
        completedAt: new Date(),
        autoResolved: true,
        autoResolveCondition: condition,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    // Log the auto-resolution
    await this.logTaskAction(
      taskId,
      "auto_resolved",
      { status: currentTask.status },
      { status: "COMPLETED", autoResolveCondition: condition },
      undefined,
      `Auto-resolved: ${condition}`
    );

    return updatedTask;
  }

  // Escalate a task
  async escalateTask(taskId: string, reason?: string): Promise<Task | null> {
    const [currentTask] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!currentTask) return null;

    const newLevel = Math.min((currentTask.escalationLevel || 0) + 1, 4);

    const [updatedTask] = await db
      .update(tasks)
      .set({
        escalationLevel: newLevel,
        escalatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    // Log the escalation
    await this.logTaskAction(
      taskId,
      "escalated",
      { escalationLevel: currentTask.escalationLevel },
      { escalationLevel: newLevel },
      undefined,
      reason || `Escalated to level ${newLevel}`
    );

    // Execute escalation actions
    await this.executeEscalationActions(updatedTask, newLevel);

    return updatedTask;
  }

  // Execute escalation actions for a given level
  private async executeEscalationActions(task: Task, level: number): Promise<void> {
    // Get actions for this level (task-specific or global)
    const actions = await db
      .select()
      .from(escalationActions)
      .where(
        and(
          eq(escalationActions.escalationLevel, level),
          eq(escalationActions.isActive, true)
        )
      );

    for (const action of actions) {
      // Skip if task-specific action doesn't match
      if (action.taskTypeCode && action.taskTypeCode !== task.taskTypeCode) {
        continue;
      }

      const config = action.actionConfig as Record<string, unknown>;
      
      switch (action.actionType) {
        case "notify":
          // In a real system, this would send notifications
          console.log(`[Task Engine] Notify action for task ${task.id}:`, config);
          break;
        case "reassign":
          // Would reassign the task
          console.log(`[Task Engine] Reassign action for task ${task.id}:`, config);
          break;
        case "freeze":
          // Would freeze the loan state
          console.log(`[Task Engine] Freeze action for task ${task.id}:`, config);
          break;
        case "alert":
          // Would create compliance alert
          console.log(`[Task Engine] Alert action for task ${task.id}:`, config);
          break;
      }
    }
  }

  // Log task action to audit trail
  async logTaskAction(
    taskId: string,
    action: string,
    previousValue: unknown,
    newValue: unknown,
    actorUserId?: string,
    reason?: string
  ): Promise<TaskAuditLog> {
    const [log] = await db
      .insert(taskAuditLog)
      .values({
        taskId,
        action,
        previousValue: previousValue as Record<string, unknown>,
        newValue: newValue as Record<string, unknown>,
        actorUserId,
        actorType: actorUserId ? "user" : "system",
        reason,
      })
      .returning();
    return log;
  }

  // Get tasks for an application with SLA status
  async getTasksForApplication(applicationId: string): Promise<TaskWithSlaStatus[]> {
    const applicationTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.applicationId, applicationId))
      .orderBy(desc(tasks.createdAt));

    return applicationTasks.map(task => ({
      ...task,
      ...this.computeSlaStatus(task),
    }));
  }

  // Get tasks by owner role (accepts both uppercase and lowercase roles)
  async getTasksByOwnerRole(ownerRole: string, status?: string): Promise<TaskWithSlaStatus[]> {
    // Normalize to uppercase owner role format
    const normalizedRole = userRoleToOwnerRole(ownerRole);
    const conditions = [eq(tasks.ownerRole, normalizedRole)];
    if (status) {
      conditions.push(eq(tasks.status, status));
    }

    const roleTasks = await db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(asc(tasks.slaDueAt));

    return roleTasks.map(task => ({
      ...task,
      ...this.computeSlaStatus(task),
    }));
  }

  // Get tasks assigned to a user
  async getTasksForUser(userId: string, status?: string): Promise<TaskWithSlaStatus[]> {
    const conditions = [eq(tasks.assignedToUserId, userId)];
    if (status) {
      conditions.push(eq(tasks.status, status));
    }

    const userTasks = await db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(asc(tasks.slaDueAt));

    return userTasks.map(task => ({
      ...task,
      ...this.computeSlaStatus(task),
    }));
  }

  // Get borrower-visible tasks (simplified view)
  async getBorrowerTasks(applicationId: string): Promise<TaskWithSlaStatus[]> {
    // Get tasks that are visible to borrowers
    const visibleMappings = await db
      .select()
      .from(taskTypeSlaMapping)
      .where(eq(taskTypeSlaMapping.visibleToBorrower, true));

    const visibleCodes = visibleMappings.map(m => m.taskTypeCode);

    if (visibleCodes.length === 0) {
      // Return tasks with BORROWER owner role
      const borrowerTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.applicationId, applicationId),
            eq(tasks.ownerRole, "BORROWER")
          )
        )
        .orderBy(asc(tasks.slaDueAt));

      return borrowerTasks.map(task => ({
        ...task,
        ...this.computeSlaStatus(task),
      }));
    }

    const borrowerTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.applicationId, applicationId),
          inArray(tasks.taskTypeCode, visibleCodes)
        )
      )
      .orderBy(asc(tasks.slaDueAt));

    return borrowerTasks.map(task => ({
      ...task,
      ...this.computeSlaStatus(task),
    }));
  }

  // Get task audit trail
  async getTaskAuditTrail(taskId: string): Promise<TaskAuditLog[]> {
    return db
      .select()
      .from(taskAuditLog)
      .where(eq(taskAuditLog.taskId, taskId))
      .orderBy(desc(taskAuditLog.createdAt));
  }

  // Get tasks due for escalation (for scheduled job)
  async getTasksDueForEscalation(): Promise<Task[]> {
    const now = new Date();
    
    // Get tasks where SLA is breached but not yet fully escalated
    return db
      .select()
      .from(tasks)
      .where(
        and(
          inArray(tasks.status, ["OPEN", "IN_PROGRESS", "BLOCKED"]),
          lt(tasks.slaDueAt, now),
          lt(tasks.escalationLevel, 4)
        )
      )
      .orderBy(asc(tasks.slaDueAt));
  }

  // Run escalation check (for scheduled job)
  async runEscalationCheck(): Promise<number> {
    const tasksDue = await this.getTasksDueForEscalation();
    let escalatedCount = 0;

    for (const task of tasksDue) {
      await this.escalateTask(task.id, "SLA breach auto-escalation");
      escalatedCount++;
    }

    return escalatedCount;
  }

  // Get task dashboard metrics
  async getTaskDashboardMetrics(): Promise<{
    total: number;
    open: number;
    inProgress: number;
    completed: number;
    breached: number;
    byRole: Record<string, number>;
    bySlaClass: Record<string, number>;
    byStatus: Record<string, { green: number; amber: number; red: number }>;
  }> {
    // Get all active tasks
    const allTasks = await db
      .select()
      .from(tasks)
      .where(inArray(tasks.status, ["OPEN", "IN_PROGRESS", "BLOCKED"]));

    const tasksWithStatus = allTasks.map(task => ({
      ...task,
      ...this.computeSlaStatus(task),
    }));

    // Compute metrics
    const metrics = {
      total: tasksWithStatus.length,
      open: tasksWithStatus.filter(t => t.status === "OPEN").length,
      inProgress: tasksWithStatus.filter(t => t.status === "IN_PROGRESS").length,
      completed: 0,
      breached: tasksWithStatus.filter(t => t.slaStatus === "red").length,
      byRole: {} as Record<string, number>,
      bySlaClass: {} as Record<string, number>,
      byStatus: {} as Record<string, { green: number; amber: number; red: number }>,
    };

    // Get completed count
    const [completedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(eq(tasks.status, "COMPLETED"));
    metrics.completed = Number(completedResult?.count || 0);

    // By role
    for (const task of tasksWithStatus) {
      const role = task.ownerRole || "UNKNOWN";
      metrics.byRole[role] = (metrics.byRole[role] || 0) + 1;
    }

    // By SLA class
    for (const task of tasksWithStatus) {
      const slaClass = task.slaClass || "S3";
      metrics.bySlaClass[slaClass] = (metrics.bySlaClass[slaClass] || 0) + 1;
    }

    // By role with SLA status breakdown
    for (const task of tasksWithStatus) {
      const role = task.ownerRole || "UNKNOWN";
      if (!metrics.byStatus[role]) {
        metrics.byStatus[role] = { green: 0, amber: 0, red: 0 };
      }
      metrics.byStatus[role][task.slaStatus]++;
    }

    return metrics;
  }
}

// Export singleton instance
export const taskEngine = new TaskEngineService();
