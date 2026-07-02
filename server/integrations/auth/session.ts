import passport from "passport";
import session from "express-session";
import type { Express } from "express";
import connectPg from "connect-pg-simple";

export function getSession() {
  // Lending sessions handle sensitive PII/credit data, so a 7-day fixed window is
  // too long. Use a 12-hour idle timeout (rolling: the cookie's maxAge is refreshed
  // on each response, so an active user stays logged in but an abandoned session
  // expires within 12h). sameSite stays "lax" because OAuth provider redirects must
  // carry the session cookie back to the callback.
  const sessionTtl = 12 * 60 * 60 * 1000; // 12 hours
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      // Local dev runs plain http; a secure-only cookie would never be stored
      // and every login would silently fail. Production (Vercel) is https
      // behind a trusted proxy, so the cookie is secure there.
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

// Installs the session + Passport middleware. This must run in EVERY
// environment before any auth route or isAuthenticated check — it is what
// makes req.isAuthenticated / req.login / req.logout / req.user exist.
export function setupSessionAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // The whole user object lives in the session row (no per-request DB lookup
  // here; role is re-verified from the DB in the isAuthenticated middleware).
  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));
}
