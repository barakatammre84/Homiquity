import { describe, it, expect } from "vitest";
import { EventEmitter } from "node:events";
import express, { type Express } from "express";

import { BOT_UA_REGEX } from "../shared/seo/botUserAgents";
import { makePrerenderMiddleware } from "../server/prerender";

// The self-host bot prerender replaces vercel.json's rewrite
// `/((?!api/|.*\.).*)` + user-agent matcher, and the failure modes are
// asymmetric: an over-broad match swallows static assets as injected HTML
// (the ordering trap that kept the old catch-all gated to process.env.VERCEL),
// while an under-broad one silently turns SEO prerendering off with humans
// noticing nothing. These tests pin both edges — the ported regex against
// representative real UA strings, and the middleware's four guards
// (GET + non-/api + undotted path + bot UA) over a live Express dispatch.

// --- minimal in-process request driver (no sockets, no listening server) ---
// Mirrors tests/spaCatchAll.test.ts / tests/vercelEntryHelpers.test.ts, plus
// method/headers control and a stub socket (req.protocol reads socket.encrypted).

function makeReqRes(url: string, opts: { method?: string; headers?: Record<string, string> } = {}) {
  const req: any = new EventEmitter();
  req.url = url;
  req.method = opts.method ?? "GET";
  req.headers = { host: "x.test", ...(opts.headers ?? {}) };
  req.socket = {};

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
  res.headers = headers;
  return { req, res };
}

function run(
  app: Express,
  url: string,
  opts: { method?: string; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: string; headers: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const { req, res } = makeReqRes(url, opts);
    let body = "";
    res.end = (chunk?: unknown) => {
      res.headersSent = true;
      if (chunk !== undefined && chunk !== null) body += String(chunk);
      resolve({ status: res.statusCode, body, headers: res.headers });
      return res;
    };
    try {
      (app as unknown as (rq: unknown, rs: unknown) => void)(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

const GOOGLEBOT =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/126.0.0.0 Safari/537.36";
const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

describe("BOT_UA_REGEX (verbatim port of the vercel.json user-agent matcher)", () => {
  it.each([
    ["Googlebot", GOOGLEBOT],
    ["bingbot", "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"],
    ["Slackbot link expander", "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)"],
    ["facebookexternalhit", "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"],
    ["Twitterbot", "Twitterbot/1.0"],
    ["LinkedInBot", "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)"],
    ["WhatsApp", "WhatsApp/2.23.20.0"],
    ["Discordbot", "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"],
    ["Applebot (iMessage previews)", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Applebot/0.1"],
    ["DuckDuckBot", "DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)"],
    ["Baiduspider", "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)"],
    ["Yandex", "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)"],
    ["TelegramBot", "TelegramBot (like TwitterBot)"],
    ["generic *bot* (AhrefsBot — admitted by design)", "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)"],
    ["generic *crawler*", "SomeVendor-crawler/1.2"],
    ["generic *spider*", "Sogou web spider/4.0"],
  ])("matches %s", (_name, ua) => {
    expect(BOT_UA_REGEX.test(ua)).toBe(true);
  });

  it.each([
    ["Chrome on macOS", CHROME_MAC],
    ["Safari on iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"],
    ["Firefox", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0"],
    ["Edge", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0"],
    ["Android Chrome (Build/ token is not Bot)", "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AD1A.240530.030) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"],
    ["curl", "curl/8.6.0"],
    ["empty string", ""],
  ])("does not match %s", (_name, ua) => {
    expect(BOT_UA_REGEX.test(ua)).toBe(false);
  });
});

// The middleware under a stubbed renderer (the factory seam exists for exactly
// this — no built dist/ template needed). The downstream sentinel stands in
// for express.static + the SPA catch-all: reaching it proves fall-through.
function buildApp(render?: Parameters<typeof makePrerenderMiddleware>[0]): Express {
  const app = express();
  app.use(
    makePrerenderMiddleware(
      render ??
        (async (pathname) => ({
          html: `<!doctype html><html><head><title>injected:${pathname}</title></head></html>`,
          status: 200,
        })),
    ),
  );
  app.use((_req, res) => {
    res.status(200).type("html").end("<!doctype html><html>SPA</html>");
  });
  return app;
}

describe("prerender middleware", () => {
  it("serves injected HTML to a bot on an undotted document path", async () => {
    const got = await run(buildApp(), "/rates", { headers: { "user-agent": GOOGLEBOT } });
    expect(got.status).toBe(200);
    expect(got.body).toContain("injected:/rates");
    expect(String(got.headers["content-type"])).toContain("text/html");
    expect(String(got.headers["cache-control"])).toBe("public, max-age=300");
  });

  it("passes the request path and derived origin to the renderer", async () => {
    const calls: Array<[string, string | undefined]> = [];
    const app = buildApp(async (pathname, origin) => {
      calls.push([pathname, origin]);
      return { html: "<!doctype html><html></html>", status: 200 };
    });
    await run(app, "/calculators", { headers: { "user-agent": GOOGLEBOT } });
    expect(calls).toEqual([["/calculators", "http://x.test"]]);
  });

  it("sets X-Robots-Tag: noindex when the renderer says so (gated prelaunch routes)", async () => {
    const app = buildApp(async () => ({ html: "<!doctype html><html></html>", status: 200, noindex: true }));
    const got = await run(app, "/rates", { headers: { "user-agent": GOOGLEBOT } });
    expect(String(got.headers["x-robots-tag"])).toBe("noindex");
  });

  it("passes the renderer's status through (unknown article slug → 404 + shell)", async () => {
    const app = buildApp(async () => ({ html: "<!doctype html><html>404 shell</html>", status: 404 }));
    const got = await run(app, "/learn/nope", { headers: { "user-agent": GOOGLEBOT } });
    expect(got.status).toBe(404);
    expect(got.body).toContain("404 shell");
  });

  it("answers 502 when no template is available, mirroring /api/seo/render", async () => {
    const app = buildApp(async () => ({ html: null, status: 502 }));
    const got = await run(app, "/rates", { headers: { "user-agent": GOOGLEBOT } });
    expect(got.status).toBe(502);
    expect(got.body).toContain("SEO render unavailable");
  });

  it("answers 500 when the renderer throws, never hanging the request", async () => {
    const app = buildApp(async () => {
      throw new Error("boom");
    });
    const got = await run(app, "/rates", { headers: { "user-agent": GOOGLEBOT } });
    expect(got.status).toBe(500);
    expect(got.body).toContain("SEO render error");
  });

  it("never intercepts asset requests, even from bots — the ordering trap", async () => {
    for (const url of ["/assets/index-abc123.js", "/favicon.png", "/robots.txt", "/sitemap.xml"]) {
      const got = await run(buildApp(), url, { headers: { "user-agent": GOOGLEBOT } });
      expect(got.body, url).toContain("SPA");
      expect(got.body, url).not.toContain("injected");
    }
  });

  it("treats ANY dotted path as a file request, mirroring the rewrite's (?!.*\\.)", async () => {
    const got = await run(buildApp(), "/some.dir/page", { headers: { "user-agent": GOOGLEBOT } });
    expect(got.body).toContain("SPA");
  });

  it("never intercepts /api/*", async () => {
    const got = await run(buildApp(), "/api/seo/render", { headers: { "user-agent": GOOGLEBOT } });
    expect(got.body).toContain("SPA");
  });

  it("never intercepts non-GET requests", async () => {
    const got = await run(buildApp(), "/rates", {
      method: "POST",
      headers: { "user-agent": GOOGLEBOT },
    });
    expect(got.body).toContain("SPA");
  });

  it("lets human browsers straight through to the SPA", async () => {
    const got = await run(buildApp(), "/rates", { headers: { "user-agent": CHROME_MAC } });
    expect(got.body).toContain("SPA");
    expect(got.body).not.toContain("injected");
  });

  it("lets UA-less requests straight through", async () => {
    const got = await run(buildApp(), "/rates");
    expect(got.body).toContain("SPA");
  });
});
