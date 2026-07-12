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

// Vercel's Node runtime invokes this function with "Node.js helpers" enabled
// (default when neither NODEJS_HELPERS=0 nor a helpers:false builder config is
// set). Before calling the handler it attaches OWN properties to req/res:
// req.query (a flat URLSearchParams parse), req.cookies, req.body, and its own
// res.status/send/json/redirect. Express only swaps prototypes per request
// (middleware/init.js), and own properties shadow prototype methods, so
// without intervention the deployed app diverges from every local/test server:
//   - Express 4's query middleware skips parsing when req.query is already
//     set, so qs semantics (bracket arrays `a[]=x`, nested `a[b]=c`) never
//     apply in prod — verified live: /api/geocode/autocomplete?input[]=chicago
//     returns 200 [] on Vercel but is a qs array (TypeError) locally.
//   - Vercel's res.redirect(url) defaults to 307 where Express sends 302; a
//     307 re-sends the METHOD, which breaks redirects out of form_post OAuth
//     callbacks (Apple) by re-POSTing the browser into the static layer.
// Deleting the own properties restores Express's prototype methods and lets
// its query middleware re-parse from req.url. req.body and req.cookies are
// deliberately NOT touched: the helper pre-reads the body stream and restores
// it, and that restored stream is what body-parser/multer consume in prod —
// removing it is a body-handling change that would need multipart re-testing.
export function undoVercelHelpers(req: IncomingMessage, res: ServerResponse) {
  delete (req as IncomingMessage & { query?: unknown }).query;
  const r = res as ServerResponse & {
    status?: unknown;
    send?: unknown;
    json?: unknown;
    redirect?: unknown;
  };
  delete r.status;
  delete r.send;
  delete r.json;
  delete r.redirect;
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
  undoVercelHelpers(req, res);
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(
    req,
    res,
  );
}
