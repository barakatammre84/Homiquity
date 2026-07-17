#!/usr/bin/env node
/**
 * Wipe the `preview-seed` branch's database back to an empty schema so the
 * next steps (full `db:migrate` + `db:seed`) rebuild it from scratch —
 * PII-free regardless of how the branch was created (schema-only projects get
 * an already-empty DB; legacy-web-access projects get a data clone that this
 * step erases).
 *
 * SAFETY: this script resolves its own connection from the Neon API and
 * HARD-REFUSES to run against the default (production) branch or any branch
 * not named by NEON_PREVIEW_BRANCH. It never accepts a raw DATABASE_URL, so
 * it cannot be mis-aimed by a stray env var.
 *
 * Residual note (documented in kb/runbooks/NEON_PREVIEW_DB.md): on the clone
 * path, Neon's time-travel history retains the pre-wipe state for the plan's
 * retention window; after that expires the branch holds no borrower data
 * anywhere.
 *
 * Env: NEON_API_KEY (required), NEON_PROJECT_ID (optional),
 * NEON_PREVIEW_BRANCH (optional, default "preview-seed").
 */
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { Client } = require("pg");

const BRANCH_NAME = process.env.NEON_PREVIEW_BRANCH || "preview-seed";

function fail(msg) {
  console.error(`reset-preview-seed-db: ${msg}`);
  process.exit(1);
}

async function main() {
  if (!process.env.NEON_API_KEY) fail("NEON_API_KEY is not set — refusing to run.");
  if (BRANCH_NAME === "production" || BRANCH_NAME === "main") {
    fail(`refusing to reset a branch named "${BRANCH_NAME}".`);
  }

  // Resolve the branch's DIRECT uri via the shared resolver. It fails loudly
  // if the named branch does not exist, and because we pass NEON_BRANCH_NAME
  // explicitly it can never fall back to the default (production) branch.
  const uri = execFileSync(
    process.execPath,
    [path.join(__dirname, "neon-connection-uri.cjs")],
    {
      env: { ...process.env, NEON_BRANCH_NAME: BRANCH_NAME },
      encoding: "utf8",
    },
  ).trim();

  // Belt and braces: verify via the API that the resolved branch is NOT the
  // default branch before touching anything.
  const headers = { Authorization: `Bearer ${process.env.NEON_API_KEY}` };
  let projectId = process.env.NEON_PROJECT_ID;
  if (!projectId) {
    const res = await fetch("https://console.neon.tech/api/v2/projects", { headers });
    const { projects = [] } = await res.json();
    if (projects.length !== 1) fail("need NEON_PROJECT_ID.");
    projectId = projects[0].id;
  }
  const bres = await fetch(`https://console.neon.tech/api/v2/projects/${projectId}/branches`, { headers });
  const { branches = [] } = await bres.json();
  const target = branches.find((b) => b.name === BRANCH_NAME);
  if (!target) fail(`branch "${BRANCH_NAME}" not found.`);
  if (target.default === true || target.primary === true) {
    fail(`branch "${BRANCH_NAME}" is the DEFAULT branch — refusing to wipe it.`);
  }

  const client = new Client({ connectionString: uri });
  await client.connect();
  try {
    console.log(`wiping schema on branch "${BRANCH_NAME}" (${target.id})…`);
    // public: all app tables. drizzle: the migration journal, so db:migrate
    // runs the full chain from zero instead of thinking it is applied.
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await client.query("CREATE SCHEMA public");
    console.log("schema wiped — ready for db:migrate + db:seed.");
  } finally {
    await client.end();
  }
}

main().catch((err) => fail(err.message));
