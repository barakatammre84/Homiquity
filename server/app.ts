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

app.use("/api/login", authLimiter);
app.use("/api/callback", authLimiter);
app.use("/api/test-login", authLimiter);
app.use("/api/uploads", uploadLimiter);
app.use("/api/documents/upload", uploadLimiter);
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

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  const isDev = process.env.NODE_ENV === 'development';

  const allowedDomains = new Set<string>();
  const hostName = host?.split(':')[0];
  if (hostName) allowedDomains.add(hostName);
  if (process.env.REPLIT_DOMAINS) {
    for (const d of process.env.REPLIT_DOMAINS.split(',')) {
      const trimmed = d.trim();
      if (trimmed) allowedDomains.add(trimmed);
    }
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    allowedDomains.add(process.env.REPLIT_DEV_DOMAIN.trim());
  }
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
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
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

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
}
