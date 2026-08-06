import fs from "node:fs";
import path from "node:path";
import { type Server } from "node:http";

import express, { type Express } from "express";
import runApp from "./app";
import { prerenderMiddleware } from "./routes/seo";
import { SPA_CATCH_ALL_PATTERN } from "./spaCatchAll";

export async function serveStatic(app: Express, _server: Server) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Bot prerender sits directly ahead of the static layer: mounted any
  // earlier it swallows requests the API surface owns; any later and
  // express.static / the SPA catch-all answer crawlers with the raw shell.
  // Its own guards (GET + non-/api + undotted path + bot UA) keep humans
  // and asset requests on the static path below.
  app.use(prerenderMiddleware);

  // Vite emits content-hashed asset filenames, so assets are immutable by
  // construction. index.html is the one mutable document — it must
  // revalidate on every navigation or a deploy strands clients on a stale
  // asset graph (AppErrorBoundary's reload-on-chunk-error is the backstop,
  // not the plan). `index: false` keeps "/" out of express.static so the
  // catch-all below owns the no-cache document response.
  app.use(
    express.static(distPath, {
      maxAge: "1y",
      immutable: true,
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );

  // fall through to index.html if the file doesn't exist.
  // root-relative, NOT an absolute path: send() applies its dotfile-segment
  // check to the whole path when no root is given, so an install living under
  // a dotted directory (a .claude/worktrees checkout — how this surfaced)
  // 404s every document. With `root`, the check covers only "index.html",
  // matching express.static's semantics above.
  app.use(SPA_CATCH_ALL_PATTERN, (_req, res) => {
    res.sendFile("index.html", {
      root: distPath,
      cacheControl: false,
      headers: { "Cache-Control": "no-cache" },
    });
  });
}

(async () => {
  await runApp(serveStatic);
})();
