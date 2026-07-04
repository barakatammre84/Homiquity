// Dev-only env loader. Loads `.env` from the project root resolved RELATIVE TO
// THIS FILE, not process.cwd(), so the dev server boots no matter which
// directory it is spawned from. In particular, `npm --prefix <dir> run dev`
// (used by some tooling / git worktrees) sets the package root for script
// resolution but keeps the *caller's* cwd — under which `dotenv/config`'s
// cwd-based lookup would miss this worktree's `.env` and DATABASE_URL would be
// unset. Import this as the very first import in the dev entry so the side
// effect runs before db.ts reads process.env.
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url)); // .../server
config({ path: path.resolve(here, "../.env") }); // project-root/.env
