import type { Express } from "express";
import type { IStorage } from "../storage";
import type { User } from "@shared/schema";
import { isAuthenticated } from "../auth";

export function registerNotificationRoutes(app: Express, storage: IStorage) {
  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const notifications = await storage.getNotificationsByUser(user.id);
      res.json({ notifications });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const count = await storage.getUnreadNotificationCount(user.id);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching notification count:", error);
      res.status(500).json({ error: "Failed to fetch notification count" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const notifications = await storage.getNotificationsByUser(user.id);
      const owns = notifications.some(n => String(n.id) === req.params.id);
      if (!owns) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      await storage.markNotificationRead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification read:", error);
      res.status(500).json({ error: "Failed to mark notification read" });
    }
  });

  app.patch("/api/notifications/read-all", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      await storage.markAllNotificationsRead(user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notifications read:", error);
      res.status(500).json({ error: "Failed to mark notifications read" });
    }
  });
}
