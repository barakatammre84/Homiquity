// Dev-only env loader. Loads `.env` from the project root resolved RELATIVE TO
// THIS FILE, not process.cwd(), so the dev server boots no matter which
// directory it is spawned from. In particular, `npm --prefix <dir> run dev`
// (used by some tooling / git worktrees) sets the package root for script
// resolution but keeps the *caller's* cwd — under which `dotenv/config`'s
// cwd-based lookup would miss this worktree's `.env` and DATABASE_URL would be
// unset. Import this as the very first import in the dev entry so the side
// effect runs before db.ts reads process.env.
import { config, parse } from "dotenv";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url)); // .../server
config({ path: path.resolve(here, "../.env") }); // project-root/.env

// A git worktree doesn't get the main checkout's git-ignored `.env`, so a fresh
// worktree would crash on boot with "DATABASE_URL must be set". If the local
// `.env` didn't supply it, fall back to the MAIN working tree's `.env` for
// secrets — but never inherit PORT, so a worktree can't collide on the main dev
// server's port (it keeps whatever the tooling/launch config assigns, or the
// app's default). This keeps `npm run dev` working from a worktree with zero
// hand-copying of secrets.
if (!process.env.DATABASE_URL) {
  const mainEnv = mainWorktreeEnvPath(here);
  if (mainEnv && fs.existsSync(mainEnv)) {
    const parsed = parse(fs.readFileSync(mainEnv));
    for (const [key, value] of Object.entries(parsed)) {
      if (key !== "PORT" && process.env[key] === undefined) process.env[key] = value;
    }
  }
}

/**
 * Resolve the MAIN working tree's `.env` path from a linked worktree's `.git`
 * pointer file. Returns null for a normal checkout (where `.git` is a directory)
 * or if anything about the pointer can't be read.
 */
function mainWorktreeEnvPath(serverDir: string): string | null {
  try {
    const dotGit = path.resolve(serverDir, "../.git");
    if (!fs.statSync(dotGit).isFile()) return null; // normal checkout: `.git` is a dir
    const gitdir = fs.readFileSync(dotGit, "utf8").replace(/^gitdir:\s*/, "").trim();
    // gitdir = <main>/.git/worktrees/<name>; commondir points back at <main>/.git
    const commonRel = fs.readFileSync(path.join(gitdir, "commondir"), "utf8").trim();
    const commonDir = path.resolve(gitdir, commonRel); // <main>/.git
    return path.resolve(path.dirname(commonDir), ".env"); // <main>/.env
  } catch {
    return null;
  }
}
