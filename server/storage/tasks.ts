// Storage domain: Tasks, task documents, document packages + items.
// One link in the DatabaseStorage inheritance chain — see ./index.ts.
import { db } from "../db";
import { eq, desc, asc } from "drizzle-orm";
// SSN uses ssnVault (canonical, from main); account numbers use piiVault (this
// branch — main leaves account numbers plaintext).

import {
  documents,
  tasks,
  taskDocuments,
  documentPackages,
  documentPackageItems,
  type Document,
  type Task,
  type InsertTask,
  type TaskDocument,
  type InsertTaskDocument,
  type DocumentPackage,
  type InsertDocumentPackage,
  type DocumentPackageItem,
  type InsertDocumentPackageItem,
} from "@shared/schema";
import { StatsStorage } from "./stats";
export class TasksStorage extends StatsStorage {
  // Tasks
  async createTask(data: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(data).returning();
    return task;
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return task;
  }

  async getTasksByApplication(applicationId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.applicationId, applicationId))
      .orderBy(desc(tasks.createdAt));
  }

  async getTasksByUser(userId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.assignedToUserId, userId))
      .orderBy(desc(tasks.createdAt));
  }

  async getAllTasks(limit: number = 500): Promise<Task[]> {
    return await db.select().from(tasks).orderBy(desc(tasks.createdAt)).limit(limit);
  }

  async updateTask(id: string, data: Partial<Task>): Promise<Task | undefined> {
    const { createdAt, updatedAt, id: taskId, ...cleanData } = data as any;
    const [updated] = await db
      .update(tasks)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  // No deleteTask: tasks are never hard-deleted. task_audit_log (immutable
  // compliance trail) carries a NOT NULL FK into tasks from the moment the
  // engine creates one, and task_events/underwriting_conditions reference
  // tasks as loan-record history — a bare DELETE FROM tasks violates FK 23503.
  // Removal is taskEngine.cancelTask (terminal EXPIRED status, audited).

  // Task Documents
  async createTaskDocument(data: InsertTaskDocument): Promise<TaskDocument> {
    const [record] = await db.insert(taskDocuments).values(data).returning();
    return record;
  }

  async getTaskDocuments(taskId: string): Promise<(TaskDocument & { document: Document })[]> {
    const results = await db
      .select({
        taskDocument: taskDocuments,
        document: documents,
      })
      .from(taskDocuments)
      .innerJoin(documents, eq(taskDocuments.documentId, documents.id))
      .where(eq(taskDocuments.taskId, taskId))
      .orderBy(desc(taskDocuments.createdAt));
    
    return results.map(r => ({
      ...r.taskDocument,
      document: r.document,
    }));
  }

  async updateTaskDocument(id: string, data: Partial<TaskDocument>): Promise<TaskDocument | undefined> {
    const { createdAt, id: docId, ...cleanData } = data as any;
    const [updated] = await db
      .update(taskDocuments)
      .set(cleanData)
      .where(eq(taskDocuments.id, id))
      .returning();
    return updated;
  }

  async deleteTaskDocument(id: string): Promise<void> {
    await db.delete(taskDocuments).where(eq(taskDocuments.id, id));
  }

  // Document Packages - lender-ready document organization
  async createDocumentPackage(data: InsertDocumentPackage): Promise<DocumentPackage> {
    const [pkg] = await db.insert(documentPackages).values(data).returning();
    return pkg;
  }

  async getDocumentPackage(id: string): Promise<DocumentPackage | undefined> {
    const [pkg] = await db.select().from(documentPackages).where(eq(documentPackages.id, id));
    return pkg;
  }

  async getDocumentPackagesByApplication(applicationId: string): Promise<DocumentPackage[]> {
    return await db
      .select()
      .from(documentPackages)
      .where(eq(documentPackages.applicationId, applicationId))
      .orderBy(desc(documentPackages.createdAt));
  }

  async updateDocumentPackage(id: string, data: Partial<DocumentPackage>): Promise<DocumentPackage | undefined> {
    const [pkg] = await db
      .update(documentPackages)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documentPackages.id, id))
      .returning();
    return pkg;
  }

  async deleteDocumentPackage(id: string): Promise<void> {
    // First delete all items in the package
    await db.delete(documentPackageItems).where(eq(documentPackageItems.packageId, id));
    await db.delete(documentPackages).where(eq(documentPackages.id, id));
  }

  // Document Package Items
  async addDocumentToPackage(data: InsertDocumentPackageItem): Promise<DocumentPackageItem> {
    const [item] = await db.insert(documentPackageItems).values(data).returning();
    return item;
  }

  async getDocumentPackageItem(id: string): Promise<DocumentPackageItem | undefined> {
    const [item] = await db.select().from(documentPackageItems).where(eq(documentPackageItems.id, id));
    return item;
  }

  async getDocumentPackageItems(packageId: string): Promise<(DocumentPackageItem & { document: Document })[]> {
    const items = await db
      .select()
      .from(documentPackageItems)
      .innerJoin(documents, eq(documentPackageItems.documentId, documents.id))
      .where(eq(documentPackageItems.packageId, packageId))
      .orderBy(asc(documentPackageItems.displayOrder));
    
    return items.map(item => ({
      ...item.document_package_items,
      document: item.documents,
    }));
  }

  async updateDocumentPackageItem(id: string, data: Partial<DocumentPackageItem>): Promise<DocumentPackageItem | undefined> {
    const [item] = await db
      .update(documentPackageItems)
      .set(data)
      .where(eq(documentPackageItems.id, id))
      .returning();
    return item;
  }

  async removeDocumentFromPackage(id: string): Promise<void> {
    await db.delete(documentPackageItems).where(eq(documentPackageItems.id, id));
  }

}
