import type { Request } from "express";
import { storage } from "./storage";

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
      ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null,
      userAgent: req.headers["user-agent"] || null,
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
