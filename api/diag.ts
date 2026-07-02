import type { IncomingMessage, ServerResponse } from "node:http";

// Standalone diagnostic — imports NOTHING from the app, so it works even when
// the main function's module graph crashes at load. Reports which env vars
// exist (booleans only, never values). Remove once production is stable.
export default function handler(_req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      ok: true,
      nodeVersion: process.version,
      env: {
        DATABASE_URL: !!process.env.DATABASE_URL,
        SESSION_SECRET: !!process.env.SESSION_SECRET,
        CREDIT_ENCRYPTION_KEY: !!process.env.CREDIT_ENCRYPTION_KEY,
        PII_HASH_SALT: !!process.env.PII_HASH_SALT,
        NODE_ENV: process.env.NODE_ENV ?? null,
      },
    }),
  );
}
