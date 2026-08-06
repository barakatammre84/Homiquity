import { describe, it, expect } from "vitest";
import { EventEmitter } from "node:events";
import express, { type Express } from "express";

import { SPA_CATCH_ALL_PATTERN } from "../server/spaCatchAll";

// Regression guard for the Express 5 migration (commit 25796b3). Both server
// entrypoints mount the SPA HTML catch-all on SPA_CATCH_ALL_PATTERN so a
// non-API URL renders the client bundle. Under Express 5 / path-to-regexp v8 a
// bare `/*splat` requires at least one path segment, so it matched `/login` but
// NOT `/` — `pnpm dev` served a 404 for the homepage while every deep link
// worked. Prod was masked by a platform static `/(.*)` → `/index.html` rewrite,
// which answers `/` before Express ever sees it, so this only bit dev.
//
// These tests assert the behavior of the real exported constant, not a copy of
// the string, so reverting either entrypoint to a segment-requiring pattern
// fails here.

// --- minimal in-process request driver (no sockets, no listening server) ---
// Mirrors tests/seoPrerender.test.ts.

function makeReqRes(url: string) {
  const req: any = new EventEmitter();
  req.url = url;
  req.method = "GET";
  req.headers = {};

  const headers: Record<string, unknown> = {};
  const res: any = new EventEmitter();
  res.statusCode = 200;
  res.headersSent = false;
  res.setHeader = (k: string, v: unknown) => {
    headers[k.toLowerCase()] = v;
    return res;
  };
  res.getHeader = (k: string) => headers[k.toLowerCase()];
  res.removeHeader = (k: string) => {
    delete headers[k.toLowerCase()];
  };
  res.writeHead = (code: number, hs?: Record<string, unknown>) => {
    res.statusCode = code;
    for (const [k, v] of Object.entries(hs ?? {})) headers[k.toLowerCase()] = v;
    return res;
  };
  return { req, res };
}

function run(app: Express, url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const { req, res } = makeReqRes(url);
    let body = "";
    res.end = (chunk?: unknown) => {
      res.headersSent = true;
      if (chunk !== undefined && chunk !== null) body += String(chunk);
      resolve({ status: res.statusCode, body });
      return res;
    };
    try {
      (app as unknown as (rq: unknown, rs: unknown) => void)(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

// Stands in for server/index-dev.ts + server/index-prod.ts: an API route and
// the shared SPA catch-all mounted after it, in the same order as the real app.
function buildApp(): Express {
  const app = express();
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.all("/api/*splat", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  app.use(SPA_CATCH_ALL_PATTERN, (_req, res) => {
    res.status(200).type("html").end("<!doctype html><html></html>");
  });
  return app;
}

describe("SPA catch-all pattern", () => {
  it("serves the HTML shell for the bare root — the Express 5 regression", async () => {
    const res = await run(buildApp(), "/");
    expect(res.status).toBe(200);
    expect(res.body).toContain("<!doctype html>");
  });

  it("serves the HTML shell for single-segment and deep client routes", async () => {
    const app = buildApp();
    for (const url of [
      "/login",
      "/dashboard",
      "/loan-application/123/documents",
      "/?next=%2Fdashboard",
    ]) {
      const res = await run(app, url);
      expect(res.status, `expected HTML shell for ${url}`).toBe(200);
      expect(res.body).toContain("<!doctype html>");
    }
  });

  it("does not shadow the API — real routes and the API 404 still win", async () => {
    const app = buildApp();

    const health = await run(app, "/api/health");
    expect(health.status).toBe(200);
    expect(JSON.parse(health.body)).toEqual({ ok: true });

    // Unknown API paths get the JSON 404 from routes.ts, never the HTML shell.
    const missing = await run(app, "/api/nope");
    expect(missing.status).toBe(404);
    expect(JSON.parse(missing.body)).toEqual({ error: "Not found" });
  });
});
