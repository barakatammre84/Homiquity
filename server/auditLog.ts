import type { Request } from "express";
import { storage } from "./storage";
import { clientIpForRecord } from "./clientIp";

export async function logAudit(
  req: Request,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata?: Record<string, unknown>,
) {
  try {
    const user = req.user as any;
    await storage.createAuditLog({
      actorUserId: user?.id || null,
      action,
      targetType: targetType || null,
      targetId: targetId || null,
      metadata: metadata || null,
      ipAddress: clientIpForRecord(req),
      userAgent: req.headers["user-agent"] || null,
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
