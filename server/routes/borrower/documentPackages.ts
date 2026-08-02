// Borrower routes: Lender-ready document packages + items + application documents.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import { type IStorage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { insertDocumentPackageSchema, insertDocumentPackageItemSchema, isStaffRole, type User } from "@shared/schema";
import { routeParams } from "../../http/routeParams";

// Verify that an internal staff user is actually assigned to the given application.
// Returns true for admin (unrestricted), checks LO assignment for lo/loa, and
// deal-team membership for processor/underwriter/closer.
// External partner roles (broker, lender) are NOT permitted by this helper.
// Exported: the LO-2 scenario route reuses this gate (one access model, no forks).

export function registerDocumentPackageRoutes(
  app: Express,
  storage: IStorage,
) {
  // DOCUMENT PACKAGES - Lender-Ready Document Organization
  // ============================================================================

  // Validation schemas for document packages - using drizzle-zod schemas from shared/schema.ts
  const createPackageValidation = insertDocumentPackageSchema.omit({ createdByUserId: true });
  const updatePackageValidation = insertDocumentPackageSchema.partial().omit({ 
    createdByUserId: true, 
    applicationId: true 
  });
  const addPackageItemValidation = insertDocumentPackageItemSchema.omit({ packageId: true });
  const updatePackageItemValidation = insertDocumentPackageItemSchema.partial().omit({ 
    packageId: true, 
    documentId: true 
  });

  // Create document package
  app.post("/api/document-packages", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const parsed = createPackageValidation.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid package data", details: parsed.error.flatten() });
      }

      // Verify the caller has authorized access to this loan file
      const application = await storage.getLoanApplicationWithAccess(parsed.data.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      const packageData = {
        ...parsed.data,
        createdByUserId: user.id,
      };

      const pkg = await storage.createDocumentPackage(packageData);

      await storage.createDealActivity({
        applicationId: pkg.applicationId,
        activityType: "note",
        title: "Document Package Created",
        description: `Created package: ${pkg.name}`,
        performedBy: user.id,
      });

      res.status(201).json(pkg);
    } catch (error) {
      console.error("Create document package error:", error);
      res.status(500).json({ error: "Failed to create document package" });
    }
  });

  // Get document packages for application
  app.get("/api/applications/:applicationId/document-packages", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = routeParams(req);
      const user = req.user as User;

      const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      const packages = await storage.getDocumentPackagesByApplication(applicationId);
      res.json(packages);
    } catch (error) {
      console.error("Get document packages error:", error);
      res.status(500).json({ error: "Failed to get document packages" });
    }
  });

  // Get single document package with items
  app.get("/api/document-packages/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = routeParams(req);
      const user = req.user as User;

      const pkg = await storage.getDocumentPackage(id);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }

      const application = await storage.getLoanApplicationWithAccess(pkg.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      const items = await storage.getDocumentPackageItems(id);
      res.json({ ...pkg, items });
    } catch (error) {
      console.error("Get document package error:", error);
      res.status(500).json({ error: "Failed to get document package" });
    }
  });

  // Update document package
  app.patch("/api/document-packages/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = routeParams(req);
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      // Verify package exists
      const existingPkg = await storage.getDocumentPackage(id);
      if (!existingPkg) {
        return res.status(404).json({ error: "Package not found" });
      }

      // Verify the caller has authorized access to the parent loan file
      const application = await storage.getLoanApplicationWithAccess(existingPkg.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      const parsed = updatePackageValidation.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid update data", details: parsed.error.flatten() });
      }

      // Handle status transitions and set timestamps
      const updateData: any = { ...parsed.data };
      if (parsed.data.status === "sent" && existingPkg.status !== "sent") {
        updateData.sentAt = new Date();
      }
      if (parsed.data.status === "acknowledged" && existingPkg.status !== "acknowledged") {
        updateData.acknowledgedAt = new Date();
      }

      const pkg = await storage.updateDocumentPackage(id, updateData);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }

      res.json(pkg);
    } catch (error) {
      console.error("Update document package error:", error);
      res.status(500).json({ error: "Failed to update document package" });
    }
  });

  // Delete document package
  app.delete("/api/document-packages/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = routeParams(req);
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      // Verify package exists before deleting
      const pkg = await storage.getDocumentPackage(id);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }

      // Verify the caller has authorized access to the parent loan file
      const application = await storage.getLoanApplicationWithAccess(pkg.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteDocumentPackage(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete document package error:", error);
      res.status(500).json({ error: "Failed to delete document package" });
    }
  });

  // Add document to package
  app.post("/api/document-packages/:packageId/items", isAuthenticated, async (req, res) => {
    try {
      const { packageId } = routeParams(req);
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      // Verify package exists
      const pkg = await storage.getDocumentPackage(packageId);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }

      // Verify the caller has authorized access to the parent loan file
      const application = await storage.getLoanApplicationWithAccess(pkg.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      const parsed = addPackageItemValidation.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid item data", details: parsed.error.flatten() });
      }

      // Verify that the referenced document belongs to the same loan file as the package.
      // Without this check a staff member who has access to two loan files can inject
      // a document from file B into a package that belongs to file A.
      const referencedDoc = await storage.getDocument(parsed.data.documentId);
      if (!referencedDoc) {
        return res.status(404).json({ error: "Document not found" });
      }
      if (referencedDoc.applicationId !== pkg.applicationId) {
        return res.status(403).json({ error: "Document does not belong to this loan file" });
      }

      const item = await storage.addDocumentToPackage({
        ...parsed.data,
        packageId,
      });

      res.status(201).json(item);
    } catch (error) {
      console.error("Add document to package error:", error);
      res.status(500).json({ error: "Failed to add document to package" });
    }
  });

  // Update package item
  app.patch("/api/document-package-items/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = routeParams(req);
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      // Resolve item → package → application to enforce file-level access
      const existingItem = await storage.getDocumentPackageItem(id);
      if (!existingItem) {
        return res.status(404).json({ error: "Item not found" });
      }
      const pkg = await storage.getDocumentPackage(existingItem.packageId);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }
      const application = await storage.getLoanApplicationWithAccess(pkg.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      const parsed = updatePackageItemValidation.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid update data", details: parsed.error.flatten() });
      }

      const item = await storage.updateDocumentPackageItem(id, parsed.data);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }

      res.json(item);
    } catch (error) {
      console.error("Update package item error:", error);
      res.status(500).json({ error: "Failed to update package item" });
    }
  });

  // Remove document from package
  app.delete("/api/document-package-items/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = routeParams(req);
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      // Resolve item → package → application to enforce file-level access
      const existingItem = await storage.getDocumentPackageItem(id);
      if (!existingItem) {
        return res.status(404).json({ error: "Item not found" });
      }
      const pkg = await storage.getDocumentPackage(existingItem.packageId);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }
      const application = await storage.getLoanApplicationWithAccess(pkg.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.removeDocumentFromPackage(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Remove document from package error:", error);
      res.status(500).json({ error: "Failed to remove document from package" });
    }
  });

  // Get documents for application (for package builder)
  app.get("/api/applications/:applicationId/documents", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = routeParams(req);
      const user = req.user as User;

      // Use getLoanApplicationWithAccess so broker/lender are checked against deal-team
      // membership rather than being granted blanket staff access.
      const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      const docs = await storage.getDocumentsByApplication(applicationId);
      res.json(docs);
    } catch (error) {
      console.error("Get application documents error:", error);
      res.status(500).json({ error: "Failed to get documents" });
    }
  });

  // ============================================
}
