#!/usr/bin/env node
/**
 * Resolve the Neon DIRECT (unpooled) connection URI for the prod database and
 * print ONLY that URI to stdout, so a caller can capture it with `$( )` and hand
 * it straight to migrate-prod without the value ever reaching a log:
 *
 *   DATABASE_URL="$(node scripts/neon-connection-uri.cjs)" node scripts/migrate-prod.cjs
 *
 * Why this exists: migrate-prod needs a Postgres connection string. Storing a
 * long-lived prod password as its own GitHub secret means a second copy of the
 * credential that silently breaks CI on every rotation. The Neon↔GitHub
 * integration already provisions NEON_API_KEY, so we mint a fresh connection
 * string at run time instead and keep no DB password in GitHub at all.
 *
 * Env:
 *   NEON_API_KEY    (required) — from the Neon↔GitHub integration.
 *   NEON_PROJECT_ID (optional) — only needed when the key sees >1 project.
 *   NEON_DATABASE   (optional) — override the discovered database name.
 *   NEON_ROLE       (optional) — override the discovered role name.
 *
 * API: GET /projects/{project_id}/connection_uri
 *      (query: database_name, role_name required; branch_id optional — defaults
 *      to the project's default branch; `pooled=false` REQUIRED for the direct
 *      host — omitting it returns the -pooler host, and the pooler does not
 *      migrate reliably.)
 *
 * Everything except the URI goes to stderr.
 */
const API = "https://console.neon.tech/api/v2";

function fail(msg) {
  console.error(`neon-connection-uri: ${msg}`);
  process.exit(1);
}

async function api(path) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.NEON_API_KEY}`,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Neon API ${res.status} on ${path}${body ? ` — ${body.slice(0, 200)}` : ""}`);
  }
  return res.json();
}

async function main() {
  if (!process.env.NEON_API_KEY) fail("NEON_API_KEY is not set — refusing to run.");

  // 1. Project — explicit wins; otherwise only auto-pick when it's unambiguous.
  let projectId = process.env.NEON_PROJECT_ID;
  if (!projectId) {
    const { projects = [] } = await api("/projects");
    if (projects.length === 1) {
      projectId = projects[0].id;
    } else if (projects.length === 0) {
      fail("no Neon projects are visible to this API key.");
    } else {
      fail(
        `${projects.length} Neon projects visible — set the NEON_PROJECT_ID repo variable to one of: ` +
          projects.map((p) => `${p.id} (${p.name})`).join(", "),
      );
    }
  }

  // 2. Default branch = prod. Neon marks it `default`; tolerate the older `primary`.
  const { branches = [] } = await api(`/projects/${projectId}/branches`);
  const branch =
    branches.find((b) => b.default === true) ??
    branches.find((b) => b.primary === true) ??
    (branches.length === 1 ? branches[0] : null);
  if (!branch) fail(`could not identify the default branch among ${branches.length} branch(es).`);

  // 3. Database + owning role on that branch.
  let dbName = process.env.NEON_DATABASE;
  let roleName = process.env.NEON_ROLE;
  if (!dbName || !roleName) {
    const { databases = [] } = await api(`/projects/${projectId}/branches/${branch.id}/databases`);
    if (databases.length === 0) fail(`no databases on branch ${branch.id}.`);
    dbName = dbName || databases[0].name;
    roleName = roleName || databases[0].owner_name;
  }
  if (!dbName || !roleName) {
    fail("could not resolve the database/role name — set NEON_DATABASE and NEON_ROLE.");
  }

  // 4. Mint the URI. `pooled=false` must be explicit: omitting it yields the
  // -pooler host, which migrate-prod cannot use (CI run 29542431438).
  const q = new URLSearchParams({
    database_name: dbName,
    role_name: roleName,
    branch_id: branch.id,
    pooled: "false",
  });
  const payload = await api(`/projects/${projectId}/connection_uri?${q}`);

  // Take the documented field, tolerate known variants, and fail loudly with the
  // keys we actually got rather than emitting something wrong.
  const uri =
    payload.uri ||
    payload.connection_uri ||
    (Array.isArray(payload.connection_uris) ? payload.connection_uris[0]?.connection_uri : null);
  if (typeof uri !== "string" || !uri.startsWith("postgres")) {
    fail(
      "unexpected connection_uri response shape — top-level keys: " +
        (Object.keys(payload).join(", ") || "(none)"),
    );
  }
  if (uri.includes("-pooler")) {
    fail("Neon returned a POOLED uri; migrate-prod needs the direct one (pooler gotcha).");
  }
  if (!/sslmode=require/.test(uri)) {
    console.error("neon-connection-uri: warning — the uri has no sslmode=require.");
  }

  // Identifiers only — never the uri.
  console.error(
    `neon-connection-uri: project=${projectId} branch=${branch.id} db=${dbName} role=${roleName} (direct)`,
  );
  process.stdout.write(uri);
}

main().catch((err) => fail(err.message));
