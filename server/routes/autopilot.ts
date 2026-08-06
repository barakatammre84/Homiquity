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
 * re-derives from the DB on an interval, so it stays correct even when another
 * instance/process performs the transition; the connection is bounded (see
 * MAX_CONNECTION_MS) so no stream is held open indefinitely (the client's
 * EventSource auto-reconnects).
 */

const POLL_INTERVAL_MS = 5_000;
// LB-idle safety bound, not a serverless ceiling: keepalive comment frames
// flow every poll tick so an idle-timeout never fires mid-stream, and the
// periodic teardown just forces a clean re-handshake (the browser EventSource
// transparently reconnects, re-sending a fresh snapshot) so a dead client the
// close event missed can never hold a subscription forever.
const MAX_CONNECTION_MS = 300_000;

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
