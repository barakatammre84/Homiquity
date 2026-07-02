import type { IncomingMessage, ServerResponse } from "node:http";
import type { Express } from "express";

import { createApp } from "../server/app";

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
    appPromise = createApp(noopSetup).then(({ app }) => app);
  }
  return appPromise;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const app = await getApp();
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(
    req,
    res,
  );
}
