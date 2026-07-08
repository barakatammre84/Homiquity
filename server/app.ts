import { type Server } from "node:http";

import express, {
  type Express,
  type Request,
  Response,
  NextFunction,
} from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { registerRoutes } from "./routes";
import { isRateLimitRelaxed } from "./services/rateLimitPolicy";
import { captureException, initErrorMonitoring } from "./services/errorMonitoring";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export const app = express();

app.set("trust proxy", 1);

// Content Security Policy — the authorized-script control for PCI DSS 4.0.1
// Req 6.4.3 / 11.6.1. Every third-party origin listed here is a deliberate,
// documented authorization (script inventory lives in knowledge-base/handbook/app-guide/06):
//   - maps.googleapis.com  : Google Maps JS API + Street View (PropertyMap/StreetView)
//   - cdn.plaid.com        : Plaid Link (react-plaid-link script + iframe)
//   - fonts.googleapis.com / fonts.gstatic.com : Google Fonts (until self-hosted)
//   - storage.googleapis.com : direct-to-GCS document uploads (presigned PUT)
//   - images.unsplash.com  : marketing/property imagery
// Rollout: report-only by default so violations surface in logs without breaking
// pages; set CSP_ENFORCE=true to switch the browser to blocking mode.
// Dev is exempt — Vite HMR needs inline scripts and websockets.
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "https://maps.googleapis.com", "https://cdn.plaid.com"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
  imgSrc: [
    "'self'",
    "data:",
    "blob:",
    "https://maps.googleapis.com",
    "https://maps.gstatic.com",
    "https://*.googleapis.com",
    "https://images.unsplash.com",
  ],
  connectSrc: ["'self'", "https://maps.googleapis.com", "https://storage.googleapis.com"],
  frameSrc: ["https://cdn.plaid.com"],
  workerSrc: ["'self'", "blob:"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  reportUri: ["/api/csp-report"],
};

app.use(helmet({
  contentSecurityPolicy:
    process.env.NODE_ENV === "production"
      ? {
          directives: cspDirectives,
          reportOnly: process.env.CSP_ENFORCE !== "true",
        }
      : false,
  crossOriginEmbedderPolicy: false, // Google Maps tiles are not CORP-tagged
}));


const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
  skip: (req) => !req.path.startsWith("/api"),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later" },
  skip: () => isRateLimitRelaxed(),
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many upload requests, please try again later" },
});

const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many tracking requests" },
});

const emailCaptureLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

// Strict limiter for expensive AI document-extraction endpoints. These invoke a
// paid LLM per request, so they are a cost-DoS vector and need a tighter cap than
// the general 500/15min limiter.
const extractionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many document extraction requests, please try again later" },
});

// Unauthenticated proxies to paid third-party APIs (Google geocoding, live
// property/listing data vendors). Tighter than the general limiter because
// each request is billable and requires no login — a cheap cost-DoS vector.
const vendorProxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

// Public, unauthenticated lead intake. Aggregators post server-to-server so a
// modest per-IP ceiling still admits legitimate bursts while blunting spam.
const leadsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many lead submissions, please try again later" },
});

app.use("/api/login", authLimiter);
app.use("/api/callback", authLimiter);
app.use("/api/test-login", authLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
app.use("/api/auth/verify-email", authLimiter);
app.use("/api/auth/resend-verification", authLimiter);
app.use("/api/uploads", uploadLimiter);
app.use("/api/documents/upload", uploadLimiter);
app.use("/api/documents/extract-tax-return", extractionLimiter);
app.use("/api/documents/extract-paystub", extractionLimiter);
app.use("/api/documents/extract-bank-statement", extractionLimiter);
app.use("/api/calculators/extract-lease", extractionLimiter);
app.use("/api/geocode", vendorProxyLimiter);
app.use("/api/properties/auto-complete", vendorProxyLimiter);
app.use("/api/properties/search-live", vendorProxyLimiter);
app.use("/api/properties/detail-live", vendorProxyLimiter);
app.use("/api/properties/similar-homes", vendorProxyLimiter);
app.use("/api/properties/search-sold", vendorProxyLimiter);
app.use("/api/listings/search", vendorProxyLimiter);
app.use("/api/listings/nearby", vendorProxyLimiter);
app.use("/api/track", trackLimiter);
// Only the public POST intake is throttled; the authenticated staff GET list
// and detail views under /api/leads are left to the general limiter.
app.use("/api/leads", (req, res, next) => (req.method === "POST" ? leadsLimiter(req, res, next) : next()));
// Inbound SMS provider webhook — modest ceiling; a provider retries transiently.
app.use("/api/webhooks/sms", rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many webhook requests" },
}));
// Client error telemetry — cap so a looping browser can't flood the reporter.
app.use("/api/client-errors", rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many error reports" },
}));
app.use("/api/email-capture", emailCaptureLimiter);
app.use(generalLimiter);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Browser-generated CSP violation reports. Registered after the rate limiters
// but before the CSRF check (reports are cross-context POSTs with no Origin
// header) and parsed with the report-specific content types express.json()
// ignores by default.
app.post(
  "/api/csp-report",
  express.json({ type: ["application/json", "application/csp-report", "application/reports+json"], limit: "50kb" }),
  (req, res) => {
    const report = (req.body && (req.body["csp-report"] || req.body)) || {};
    log(
      `CSP violation: directive=${report["violated-directive"] || report.violatedDirective || "?"} ` +
        `blocked=${report["blocked-uri"] || report.blockedURI || "?"} page=${report["document-uri"] || report.documentURI || "?"}`,
      "csp",
    );
    res.status(204).end();
  },
);

// CSRF Protection for session-based routes
// Check Origin/Referer headers for state-changing requests
app.use((req, res, next) => {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  if (!req.path.startsWith('/api')) {
    return next();
  }

  // OAuth provider callbacks (e.g. Apple's form_post) arrive as cross-origin
  // POSTs from the provider's domain. They are protected by the OAuth `state`
  // parameter (validated against the session), so exempt them from the
  // Origin/Referer CSRF check which would otherwise reject them.
  if (/^\/api\/auth\/[^/]+\/callback$/.test(req.path)) {
    return next();
  }

  // Vendor webhooks (Plaid, etc.) are server-to-server posts with no Origin
  // header and no session — CSRF does not apply. Each webhook route does its
  // own verification (shared secret / signature).
  if (req.path.startsWith("/api/webhooks/")) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  const isDev = process.env.NODE_ENV === 'development';

  const allowedDomains = new Set<string>();
  const hostName = host?.split(':')[0];
  if (hostName) allowedDomains.add(hostName);
  if (isDev) {
    allowedDomains.add('localhost');
    allowedDomains.add('127.0.0.1');
  }

  const isAllowed = (headerValue: string | undefined): boolean => {
    if (!headerValue) return false;
    try {
      const url = new URL(headerValue);
      return allowedDomains.has(url.hostname);
    } catch {
      return false;
    }
  };

  if (isAllowed(origin) || isAllowed(referer)) {
    return next();
  }

  if (isDev) {
    return next();
  }

  if (!origin && !referer) {
    log(`CSRF check failed: no origin or referer header, host=${host}`);
    return res.status(403).json({ error: 'CSRF validation failed' });
  }

  log(`CSRF check failed: origin=${origin}, referer=${referer}, host=${host}, allowed=${Array.from(allowedDomains).join(',')}`);
  return res.status(403).json({ error: 'CSRF validation failed' });
});

const SENSITIVE_PATH_PATTERNS: Array<[RegExp, string]> = [
  [/^(\/api\/staff-invites\/validate\/)([^/]+)/, "$1[REDACTED]"],
];

// Response bodies are logged ONLY for paths on this allowlist. Almost every
// endpoint in this app can carry borrower PII (SSNs, income, account data), so
// the safe default is to log status/duration only. A denylist was the previous
// approach and it silently missed new PII routes (e.g. /api/urla/* responses
// contain the borrower's SSN) — do not revert to one. Add a path here only if
// its response can never contain personal or credential data.
const RESPONSE_BODY_LOG_ALLOWLIST: RegExp[] = [
  /^\/api\/health$/,
  /^\/api\/track$/, // responds { ok: true } only
  /^\/api\/csp-report$/,
];

function sanitizePathForLog(path: string): string {
  for (const [pattern, replacement] of SENSITIVE_PATH_PATTERNS) {
    if (pattern.test(path)) {
      return path.replace(pattern, replacement);
    }
  }
  return path;
}

function mayLogResponseBody(path: string): boolean {
  return RESPONSE_BODY_LOG_ALLOWLIST.some((p) => p.test(path));
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const safePath = sanitizePathForLog(path);
      let logLine = `${req.method} ${safePath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && mayLogResponseBody(path)) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Builds the fully-wired Express app (routes, error handler, and the provided
// setup step) WITHOUT binding a port. Persistent hosts call runApp() below,
// which listens; serverless targets (e.g. Vercel) import createApp() and hand
// the returned app to the platform's request handler instead of listening.
export async function createApp(
  setup: (app: Express, server: Server) => Promise<void>,
): Promise<{ app: Express; server: Server }> {
  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Report server errors (5xx) to monitoring; 4xx are expected client-contract
    // responses and would be noise.
    if (status >= 500) {
      captureException(err, { path: sanitizePathForLog(req.path), method: req.method, status });
    }

    log(`Express error: ${status} ${message}`, "error");
    if (!res.headersSent) {
      // 5xx messages are internal detail (driver errors, stack fragments,
      // connection strings in pg errors) — log them, but never send them to
      // the client in production. 4xx messages are intentional client-facing
      // contract and pass through.
      const isServerError = status >= 500;
      const clientMessage =
        isServerError && process.env.NODE_ENV === "production"
          ? "Internal Server Error"
          : message;
      res.status(status).json({ message: clientMessage });
    }
  });

  // importantly run the final setup after setting up all the other routes so
  // the catch-all route doesn't interfere with the other routes
  await setup(app, server);

  return { app, server };
}

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
) {
  initErrorMonitoring();

  process.on("uncaughtException", (err) => {
    log(`Uncaught Exception: ${err.message}`, "error");
    console.error(err.stack);
    captureException(err, { kind: "uncaughtException" });
  });

  process.on("unhandledRejection", (reason) => {
    log(`Unhandled Rejection: ${reason}`, "error");
    if (reason instanceof Error) {
      console.error(reason.stack);
    }
    captureException(reason, { kind: "unhandledRejection" });
  });

  const { server } = await createApp(setup);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({ port, host: "0.0.0.0" }, () => {
    log(`serving on port ${port}`);
  });
}
