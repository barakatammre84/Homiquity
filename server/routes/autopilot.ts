import type { Express } from "express";
import type { User } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { beginSse, writeSse } from "../sse";
import {
  buildAutopilotStatus,
  subscribeAutopilot,
  statusFingerprint,
  type AutopilotStatus,
} from "../services/autopilot/events";
import { routeParams } from "../http/routeParams";

/**
 * Autopilot real-time surfacing routes (Phase 4).
 *
 *   GET /api/autopilot/status/:applicationId  → current snapshot (JSON)
 *   GET /api/autopilot/stream/:applicationId  → live SSE of status transitions
 *
 * Both are read-only and access-gated (the borrower who owns the file, or staff
 * on the deal team). The SSE pushes in-process transitions immediately AND
 * re-derives from the DB on an interval, so it's correct across serverless
 * instances; the connection is bounded so a serverless function isn't held open
 * indefinitely (the client's EventSource auto-reconnects).
 */

const POLL_INTERVAL_MS = 5_000;
// Bound the connection under typical serverless max-duration; the browser
// EventSource transparently reconnects, re-sending a fresh snapshot each time.
const MAX_CONNECTION_MS = 55_000;

export function registerAutopilotRoutes(app: Express) {
  app.get("/api/autopilot/status/:applicationId", isAuthenticated, async (req, res) => {
    const user = req.user as User;
    const { applicationId } = routeParams(req);
    const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
    if (!application) return res.status(404).json({ error: "Application not found" });
    return res.json(await buildAutopilotStatus(applicationId));
  });

  app.get("/api/autopilot/stream/:applicationId", isAuthenticated, async (req, res) => {
    const user = req.user as User;
    const { applicationId } = routeParams(req);
    const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
    if (!application) return res.status(404).json({ error: "Application not found" });

    beginSse(res);

    const send = (status: AutopilotStatus) => {
      writeSse(res, "status", status);
      lastFingerprint = statusFingerprint(status);
    };

    // Initial snapshot so the banner paints immediately.
    const initial = await buildAutopilotStatus(applicationId);
    let lastFingerprint = statusFingerprint(initial);
    writeSse(res, "status", initial);

    // Immediate push for transitions that happen in THIS process.
    const unsubscribe = subscribeAutopilot(applicationId, send);

    // Cross-instance safety net + keepalive: re-derive from the DB; push on
    // change, otherwise emit a comment frame to keep the connection warm.
    const poll = setInterval(async () => {
      try {
        const snapshot = await buildAutopilotStatus(applicationId);
        if (statusFingerprint(snapshot) !== lastFingerprint) send(snapshot);
        else res.write(": keepalive\n\n");
      } catch {
        /* transient DB error — try again next tick */
      }
    }, POLL_INTERVAL_MS);

    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(poll);
      clearTimeout(maxTimer);
      unsubscribe();
      if (!res.writableEnded) res.end();
    };
    const maxTimer = setTimeout(cleanup, MAX_CONNECTION_MS);
    req.on("close", cleanup);
  });
}
