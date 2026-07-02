import type { IncomingMessage, ServerResponse } from "node:http";
import type { Express } from "express";

// Vercel serverless entry point.
//
// This function handles ONLY /api/* requests (see the routes in vercel.json).
// The built client (dist/public) is served directly by Vercel's static/CDN
// layer, so we pass a no-op setup — no express.static / SPA fallback here.
//
// The Express app is built once per warm instance and reused across
// invocations. Because the app never calls server.listen(), it works as a
// plain (req, res) handler that Vercel's Node runtime can invoke.
const noopSetup = async () => {};

let appPromise: Promise<Express> | null = null;

async function getApp(): Promise<Express> {
  if (!appPromise) {
    // The app is imported from api/_app.mjs — a single esbuild bundle produced
    // by `vercel-build`. Importing the raw TS graph (../server/app) fails on
    // Vercel because server code uses the `@shared/*` tsconfig path alias,
    // which the function's file tracer / Node runtime can't resolve; esbuild
    // resolves the alias at build time (same as the local prod build).
    // Imported dynamically INSIDE the handler so a module-load failure lands
    // in the catch below with a real message instead of an uncatchable
    // FUNCTION_INVOCATION_FAILED.
    // @ts-ignore -- built at deploy time by vercel-build; not present for tsc
    appPromise = import("./_app.mjs")
      .then(({ createApp }) => createApp(noopSetup))
      .then(({ app }: { app: Express }) => app);
    // A failed bootstrap must not be cached, or every later request keeps
    // replaying the same stale rejection even after the cause is fixed.
    appPromise.catch(() => {
      appPromise = null;
    });
  }
  return appPromise;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  let app: Express;
  try {
    app = await getApp();
  } catch (err) {
    // Surface the bootstrap failure instead of an opaque
    // FUNCTION_INVOCATION_FAILED — message only, no stack, no env values.
    console.error("App bootstrap failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Server failed to start", bootError: message }));
    return;
  }
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(
    req,
    res,
  );
}
