import type { Express } from "express";
import { z } from "zod";
import { captureMessage } from "../services/errorMonitoring";

// Client-side errors are forwarded here and reported to Sentry server-side, so
// the browser never needs the DSN. Keeps all telemetry flowing through one
// (dependency-free) reporter.
const clientErrorSchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(10000).optional(),
  url: z.string().max(2000).optional(),
  userAgent: z.string().max(500).optional(),
});

export function registerMonitoringRoutes(app: Express) {
  app.post("/api/client-errors", (req, res) => {
    const parsed = clientErrorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid error report" });
    }
    const { message, stack, url, userAgent } = parsed.data;
    captureMessage(`[client] ${message}`, "error", { source: "client", stack, url, userAgent });
    // 204: accepted, nothing to return. Never surfaces to the user.
    res.status(204).end();
  });
}
