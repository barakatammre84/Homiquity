import type { Express } from "express";
import type { IStorage } from "../storage";
import { isAuthenticated } from "../auth";

/**
 * Consolidated badge counts for the authenticated app shell.
 *
 * The sidebar, mobile nav, and notifications bell each need a small unread/
 * pending count. Previously those were three separate polling endpoints
 * (messages 10s, notifications 15s, pending tasks 30s), so an active user's
 * shell fired three requests per cycle. This returns all three in one call,
 * computed in parallel, so the shell polls once. The old endpoints remain for
 * their non-shell callers (e.g. the messages and notifications pages).
 */
export function registerShellRoutes(app: Express, storage: IStorage) {
  app.get("/api/shell/badges", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { taskEngine } = await import("../services/taskEngine");

      const [unreadMessages, unreadNotifications, openTasks] = await Promise.all([
        storage.getUnreadMessageCount(userId),
        storage.getUnreadNotificationCount(userId),
        taskEngine.getTasksForUser(userId, "OPEN"),
      ]);

      const pendingTasks = openTasks.filter((t) => t.ownerRole === "BORROWER").length;

      // getUnreadMessageCount resolves to a Postgres count() which arrives as a
      // string; coerce so the JSON contract is numeric (the badge math in the
      // notifications bell adds these together).
      res.json({
        unreadMessages: Number(unreadMessages) || 0,
        unreadNotifications: Number(unreadNotifications) || 0,
        pendingTasks,
      });
    } catch (error) {
      console.error("Get shell badges error:", error);
      res.status(500).json({ error: "Failed to get shell badges" });
    }
  });
}
