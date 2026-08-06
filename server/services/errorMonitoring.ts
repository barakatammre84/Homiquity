import { randomUUID } from "crypto";

/**
 * Dependency-free error monitoring.
 *
 * Sends events to Sentry's HTTP ingest endpoint when SENTRY_DSN is set, using
 * only fetch — no SDK dependency (the shared node_modules can't take new
 * packages here, and this keeps the serverless bundle lean). When no DSN is
 * configured it's a silent no-op, so local dev and un-provisioned environments
 * are unaffected.
 *
 * Provision: create a Sentry project, set SENTRY_DSN (server) in the host env.
 * Uptime: point a free monitor (e.g. UptimeRobot) at GET /api/health.
 */

interface ParsedDsn {
  ingestUrl: string; // https://<host>/api/<projectId>/store/
  publicKey: string;
}

function parseDsn(dsn: string | undefined): ParsedDsn | null {
  if (!dsn) return null;
  try {
    // DSN form: https://<publicKey>@<host>[/<path>]/<projectId>
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\/+/, "");
    if (!publicKey || !projectId) return null;
    const host = url.host;
    const proto = url.protocol.replace(":", "");
    return {
      ingestUrl: `${proto}://${host}/api/${projectId}/store/`,
      publicKey,
    };
  } catch {
    return null;
  }
}

const dsn = parseDsn(process.env.SENTRY_DSN);
const environment = process.env.NODE_ENV || "development";
const release = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.SENTRY_RELEASE || undefined;

export function isErrorMonitoringEnabled(): boolean {
  return dsn !== null;
}

/** Log once at boot whether monitoring is active. */
export function initErrorMonitoring(): void {
  if (dsn) {
    console.log(`[Monitoring] Sentry enabled (${environment}${release ? ` @ ${release.slice(0, 7)}` : ""})`);
  } else {
    console.log("[Monitoring] SENTRY_DSN not set — error reporting disabled (uptime: GET /api/health)");
  }
}

type Level = "fatal" | "error" | "warning" | "info";

async function send(event: Record<string, unknown>): Promise<void> {
  if (!dsn) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    await fetch(dsn.ingestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=homiquity/1.0, sentry_key=${dsn.publicKey}`,
      },
      body: JSON.stringify({
        event_id: randomUUID().replace(/-/g, ""),
        timestamp: new Date().toISOString(),
        platform: "node",
        environment,
        release,
        server_name: process.env.RAILWAY_REPLICA_REGION || undefined,
        ...event,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
  } catch (err) {
    // Never let telemetry failures affect the request path.
    console.error("[Monitoring] Failed to report event:", err instanceof Error ? err.message : err);
  }
}

/** Report an exception. Fire-and-forget; safe to call without awaiting. */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!dsn) return;
  const err = error instanceof Error ? error : new Error(String(error));
  void send({
    level: "error" as Level,
    exception: {
      values: [
        {
          type: err.name || "Error",
          value: err.message,
        },
      ],
    },
    extra: { ...context, stack: err.stack },
  });
}

/** Report a message at a given level. */
export function captureMessage(message: string, level: Level = "info", context?: Record<string, unknown>): void {
  if (!dsn) return;
  void send({ level, message, extra: context });
}
