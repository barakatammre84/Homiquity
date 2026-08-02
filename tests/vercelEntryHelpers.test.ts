import { describe, it, expect } from "vitest";
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import express, { type Express } from "express";

import { undoVercelHelpers } from "../api/index";

// Vercel's Node runtime invokes api/index.ts with "Node.js helpers" enabled:
// before our handler runs, the platform launcher attaches req.query (a flat
// URLSearchParams parse), req.cookies, req.body, and its own
// res.status/send/json/redirect as OWN properties. Express only swaps
// prototypes per request, so those own properties shadow Express's methods
// and its query middleware skips qs parsing (`if (!req.query)`).
// undoVercelHelpers() in api/index.ts strips exactly the shadowing properties
// so the deployed app keeps the Express semantics every local server and test
// exercises. These tests reproduce the helper attachment verbatim from
// @vercel/node@5.8.23 (src/serverless-functions/helpers.ts) and assert both
// the divergence it causes and that undoVercelHelpers restores parity.

// --- verbatim helper attachment from @vercel/node@5.8.23 ---

function setLazyProp<T>(req: any, prop: string, getter: () => T) {
  const opts = { configurable: true, enumerable: true };
  const optsReset = { ...opts, writable: true };
  Object.defineProperty(req, prop, {
    ...opts,
    get: () => {
      const value = getter();
      Object.defineProperty(req, prop, { ...optsReset, value });
      return value;
    },
    set: (value) => {
      Object.defineProperty(req, prop, { ...optsReset, value });
    },
  });
}

function getQueryParser({ url = "/" }: { url?: string }) {
  return function parseQuery() {
    const urlObj = new URL(url, "http://localhost");
    const query: Record<string, string | string[]> = {};
    urlObj.searchParams.forEach((value, key) => {
      const existing = query[key];
      if (existing !== undefined) {
        query[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
      } else {
        query[key] = value;
      }
    });
    return query;
  };
}

// The res side of addHelpers(): status/redirect/send/json become own
// properties. Only the behavior the assertions rely on is reproduced —
// notably redirect's 307 default (Express's default is 302).
function attachVercelHelpers(req: any, res: any) {
  setLazyProp(req, "cookies", () => ({}));
  setLazyProp(req, "query", getQueryParser(req));
  setLazyProp(req, "body", () => undefined);
  res.status = (statusCode: number) => {
    res.statusCode = statusCode;
    return res;
  };
  res.redirect = (statusOrUrl: number | string, url?: string) => {
    if (typeof statusOrUrl === "string") {
      url = statusOrUrl;
      statusOrUrl = 307;
    }
    res.writeHead(statusOrUrl, { Location: url }).end();
    return res;
  };
  res.send = (body: unknown) => {
    res.end(typeof body === "string" ? body : JSON.stringify(body));
    return res;
  };
  res.json = (jsonBody: unknown) => {
    if (!res.getHeader("content-type")) {
      res.setHeader("content-type", "application/json; charset=utf-8");
    }
    res.end(JSON.stringify(jsonBody));
    return res;
  };
}

// --- minimal in-process request driver (no sockets, no listening server) ---

interface Outcome {
  status: number;
  location: string | undefined;
  body: string;
}

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
  return { req, res, headers };
}

function run(
  app: Express,
  url: string,
  prepare?: (req: any, res: any) => void,
): Promise<Outcome> {
  return new Promise((resolve, reject) => {
    const { req, res, headers } = makeReqRes(url);
    let body = "";
    res.end = (chunk?: unknown) => {
      res.headersSent = true;
      if (chunk !== undefined && chunk !== null) body += String(chunk);
      resolve({
        status: res.statusCode,
        location: headers["location"] as string | undefined,
        body,
      });
      return res;
    };
    prepare?.(req, res);
    try {
      (app as unknown as (rq: unknown, rs: unknown) => void)(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

function buildApp(): Express {
  const app = express();
  // Mirror server/app.ts. Express 4 defaulted `query parser` to "extended", so
  // a bare app nested brackets for free; Express 5 defaults to "simple". The
  // real app now sets this explicitly, and this fixture stands in for the real
  // app — without it these tests would assert against a framework default the
  // production server no longer uses.
  app.set("query parser", "extended");
  app.get("/echo", (req, res) => res.json({ query: req.query }));
  app.get("/redir", (req, res) => res.redirect("/target"));
  // Mirrors server/routes/geocode.ts:27 — the live probe used to confirm the
  // divergence in prod (input[]=chicago → 200 [] on Vercel, qs array locally).
  app.get("/geocode-sim", (req, res) => {
    const input = ((req.query.input as string) || "").trim();
    if (input.length < 3) return res.json([]);
    return res.json({ input });
  });
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ error: String(err?.message) });
  });
  return app;
}

const vercelWrapped = (req: any, res: any) => attachVercelHelpers(req, res);
const vercelWrappedFixed = (req: any, res: any) => {
  attachVercelHelpers(req, res);
  undoVercelHelpers(req as IncomingMessage, res as ServerResponse);
};

describe("Vercel Node-helpers divergence (premise)", () => {
  it("pre-attached req.query makes Express skip qs parsing: bracket keys stay flat", async () => {
    const app = buildApp();
    const out = await run(app, "/echo?arr[]=a&arr[]=b&obj[k]=v", vercelWrapped);
    expect(JSON.parse(out.body).query).toEqual({ "arr[]": ["a", "b"], "obj[k]": "v" });
  });

  it("geocode-style scalar read sees undefined for bracket params (prod probe shape)", async () => {
    const app = buildApp();
    const out = await run(app, "/geocode-sim?input[]=chicago", vercelWrapped);
    expect(out.status).toBe(200);
    expect(JSON.parse(out.body)).toEqual([]);
  });

  it("own-property res.redirect shadows Express and defaults to 307", async () => {
    const app = buildApp();
    const out = await run(app, "/redir", vercelWrapped);
    expect(out.status).toBe(307);
    expect(out.location).toBe("/target");
  });
});

describe("undoVercelHelpers restores Express semantics", () => {
  it("qs query parsing applies again: brackets nest, geocode sees the array", async () => {
    const app = buildApp();
    const echo = await run(app, "/echo?arr[]=a&arr[]=b&obj[k]=v", vercelWrappedFixed);
    expect(JSON.parse(echo.body).query).toEqual({ arr: ["a", "b"], obj: { k: "v" } });

    // Same request as the prod probe: with qs semantics the scalar cast meets
    // an array (surfaced as the handler error instead of a silent empty hit).
    const geo = await run(app, "/geocode-sim?input[]=chicago", vercelWrappedFixed);
    expect(geo.status).toBe(500);
  });

  it("res.redirect is Express's again (302)", async () => {
    const app = buildApp();
    const out = await run(app, "/redir", vercelWrappedFixed);
    expect(out.status).toBe(302);
    expect(out.location).toBe("/target");
  });

  it("matches plain-Express behavior exactly (parity with local servers)", async () => {
    const cases = ["/echo?flat=1", "/echo?rep=1&rep=2", "/echo?idx[0]=a&idx[1]=b", "/redir"];
    for (const url of cases) {
      const plain = await run(buildApp(), url);
      const fixed = await run(buildApp(), url, vercelWrappedFixed);
      expect(fixed).toEqual(plain);
    }
  });

  it("leaves the helper body/cookies properties in place (body path untouched)", async () => {
    const { req, res } = makeReqRes("/echo");
    attachVercelHelpers(req, res);
    undoVercelHelpers(req, res);
    expect(Object.getOwnPropertyDescriptor(req, "body")).toBeDefined();
    expect(Object.getOwnPropertyDescriptor(req, "cookies")).toBeDefined();
    expect(Object.getOwnPropertyDescriptor(req, "query")).toBeUndefined();
  });

  it("is a no-op on a bare request (helpers disabled or absent)", async () => {
    const app = buildApp();
    const out = await run(app, "/echo?arr[]=a", (rq, rs) =>
      undoVercelHelpers(rq as IncomingMessage, rs as ServerResponse),
    );
    expect(JSON.parse(out.body).query).toEqual({ arr: ["a"] });
  });
});
