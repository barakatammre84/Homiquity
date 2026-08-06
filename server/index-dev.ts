import "./load-env"; // load .env (project-root, cwd-independent) — must stay first
import fs from "node:fs";
import path from "node:path";
import { type Server } from "node:http";

import { nanoid } from "nanoid";
import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";

import viteConfig from "../vite.config";
import runApp from "./app";
import { prerenderMiddleware } from "./routes/seo";
import { SPA_CATCH_ALL_PATTERN } from "./spaCatchAll";

export async function setupVite(app: Express, server: Server) {
  const viteLogger = createLogger();
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  // Same mount contract as serveStatic (server/index-prod.ts): the bot
  // prerender must see document requests before Vite's middleware — mounted
  // after, Vite's HTML fallback would answer crawlers with the raw shell.
  // Dev-only Vite paths without a dot (/@vite/client, /@react-refresh) are
  // only ever requested by a browser running the SPA, so the middleware's
  // bot-UA guard keeps them on Vite's path.
  app.use(prerenderMiddleware);

  app.use(vite.middlewares);
  app.use(SPA_CATCH_ALL_PATTERN, async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

(async () => {
  await runApp(setupVite);
})();
