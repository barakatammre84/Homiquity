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

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
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

app.use("/api/login", authLimiter);
app.use("/api/callback", authLimiter);
app.use("/api/test-login", authLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/uploads", uploadLimiter);
app.use("/api/documents/upload", uploadLimiter);
app.use("/api/documents/extract-tax-return", extractionLimiter);
app.use("/api/documents/extract-paystub", extractionLimiter);
app.use("/api/documents/extract-bank-statement", extractionLimiter);
app.use("/api/calculators/extract-lease", extractionLimiter);
app.use("/api/track", trackLimiter);
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

const SUPPRESS_RESPONSE_BODY_PATTERNS: RegExp[] = [
  /^\/api\/staff-invites(\/|$)/,
  /^\/api\/auth\/user$/,
  // Document extraction routes return full OCR/AI-extracted borrower financial data
  // (income, account balances, tax figures, employer details). Suppress to keep
  // sensitive PII out of deployment logs.
  /^\/api\/documents\/[^/]+\/extract$/,
  /^\/api\/documents\/extract-tax-return$/,
  /^\/api\/documents\/extract-paystub$/,
  /^\/api\/documents\/extract-bank-statement$/,
  // Loan application detail includes embedded documents and activities arrays
  // that can carry document metadata and extraction-derived records.
  /^\/api\/loan-applications\/[^/]+$/,
];

function sanitizePathForLog(path: string): string {
  for (const [pattern, replacement] of SENSITIVE_PATH_PATTERNS) {
    if (pattern.test(path)) {
      return path.replace(pattern, replacement);
    }
  }
  return path;
}

function shouldSuppressResponseBody(path: string): boolean {
  return SUPPRESS_RESPONSE_BODY_PATTERNS.some((p) => p.test(path));
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
      if (capturedJsonResponse && !shouldSuppressResponseBody(path)) {
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

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    log(`Express error: ${status} ${message}`, "error");
    if (!res.headersSent) {
      res.status(status).json({ message });
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
  process.on("uncaughtException", (err) => {
    log(`Uncaught Exception: ${err.message}`, "error");
    console.error(err.stack);
  });

  process.on("unhandledRejection", (reason) => {
    log(`Unhandled Rejection: ${reason}`, "error");
    if (reason instanceof Error) {
      console.error(reason.stack);
    }
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
