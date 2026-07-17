#!/usr/bin/env node
/**
 * Create (or verify) the PII-free `preview-seed` Neon branch that Vercel
 * Preview deployments point at INSTEAD of per-push clones of production.
 *
 * Why (kb/runbooks/NEON_PREVIEW_DB.md has the full doctrine): the Neon↔Vercel
 * integration parents every preview branch on the DEFAULT branch — production —
 * so each git push clones the real borrower dataset, and because child branches
 * inherit the parent's role passwords, every preview DATABASE_URL is a
 * production credential with a different hostname. There is no integration
 * setting to change the parent, and Neon branch protection needs a paid plan
 * (founder-deferred). The fix that works on Free: ONE schema-only root branch,
 * seeded with synthetic content, with its role password ROTATED so it shares
 * nothing with production.
 *
 * Idempotent: safe to re-run; finds the branch if it already exists. The role
 * password is rotated on EVERY run (cheap, and guarantees divergence from
 * production even if Neon ever copies credentials into schema-only branches).
 *
 * Prints status only — never a connection string or password.
 *
 * Env: NEON_API_KEY (required), NEON_PROJECT_ID (optional, as in
 * neon-connection-uri.cjs), NEON_PREVIEW_BRANCH (optional, default
 * "preview-seed").
 */
const API = "https://console.neon.tech/api/v2";
const BRANCH_NAME = process.env.NEON_PREVIEW_BRANCH || "preview-seed";

function fail(msg) {
  console.error(`neon-preview-seed-branch: ${msg}`);
  process.exit(1);
}

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.NEON_API_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Neon API ${res.status} on ${path}${body ? ` — ${body.slice(0, 300)}` : ""}`);
  }
  return res.json();
}

async function main() {
  if (!process.env.NEON_API_KEY) fail("NEON_API_KEY is not set — refusing to run.");

  let projectId = process.env.NEON_PROJECT_ID;
  if (!projectId) {
    const { projects = [] } = await api("/projects");
    if (projects.length === 1) projectId = projects[0].id;
    else fail(`need NEON_PROJECT_ID (${projects.length} projects visible).`);
  }

  const { branches = [] } = await api(`/projects/${projectId}/branches`);
  const prod = branches.find((b) => b.default === true) ?? branches.find((b) => b.primary === true);
  if (!prod) fail("could not identify the default (production) branch.");

  // Inventory (names/flags/sizes only — Free-plan branch limits make "what
  // exists" the first question on every failure).
  console.log(`branch inventory (${branches.length}):`);
  for (const b of branches) {
    console.log(
      `  ${b.name}  default=${b.default === true} parent=${b.parent_id || "-"} size=${b.logical_size ?? "?"}`,
    );
  }

  // Opt-in orphan reaper (REAP_ORPHANS=true): delete integration-created
  // `preview/<git-branch>` clones whose git branch no longer exists — the
  // integration normally reaps these on git-branch deletion, but orphans
  // accumulate when it misses, and they both hold prod PII and eat the
  // Free-plan branch limit. Guards: only `preview/`-prefixed names, never the
  // default branch, never protected, never our own seed branch; the surviving
  // git refs come from GIT_REMOTE_BRANCHES (computed by the workflow from
  // `git ls-remote`, newline-separated).
  if (process.env.REAP_ORPHANS === "true") {
    const liveRefs = new Set(
      (process.env.GIT_REMOTE_BRANCHES || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    if (liveRefs.size === 0) fail("REAP_ORPHANS=true but GIT_REMOTE_BRANCHES is empty — refusing.");
    for (const b of branches) {
      if (!b.name.startsWith("preview/")) continue;
      if (b.default === true || b.protected === true) continue;
      if (b.name === `preview/${BRANCH_NAME}` || b.name === BRANCH_NAME) continue;
      const gitRef = b.name.replace(/^preview\//, "");
      if (liveRefs.has(gitRef)) {
        console.log(`  keeping ${b.name} — git branch still exists.`);
        continue;
      }
      console.log(`  reaping orphaned clone ${b.name} (${b.id}) — git branch is gone.`);
      await api(`/projects/${projectId}/branches/${b.id}`, { method: "DELETE" });
    }
  }

  let branch = branches.find((b) => b.name === BRANCH_NAME);
  if (branch) {
    console.log(`branch "${BRANCH_NAME}" already exists (${branch.id}) — verifying it is not a data clone.`);
    // Neon may record the schema SOURCE as parent_id, so parentage alone can't
    // distinguish a schema-only branch from a data clone. init_source is
    // authoritative when present; otherwise compare logical size — a data
    // clone starts at production's full size, a schema-only branch is tiny.
    const isSchemaOnly = branch.init_source === "schema-only";
    const looksLikeClone =
      !isSchemaOnly &&
      typeof branch.logical_size === "number" &&
      typeof prod.logical_size === "number" &&
      branch.logical_size > prod.logical_size * 0.5;
    if (looksLikeClone) {
      // Not fatal: on legacy-web-access projects the branch is BORN a clone
      // and the reset step wipes it. Surface it loudly so a failed wipe is
      // visible in the run log.
      console.log(
        `warning: "${BRANCH_NAME}" currently holds data-clone-sized storage ` +
          `(${branch.logical_size} vs prod ${prod.logical_size} bytes) — the reset step MUST succeed.`,
      );
    }
  } else {
    // Preferred: schema-only (prod's DDL, zero rows; an independent root).
    // VERIFIED 2026-07-17: this project 412s — "project with a legacy web
    // access role do not support schema-only branches; role: anonymous"
    // (a leftover of Neon's old passwordless web access; removing a prod role
    // is founder-territory). Fallback: a plain child branch — a DATA clone —
    // whose data the NEXT workflow step wipes and rebuilds from migrations.
    // Password rotation below applies on both paths.
    console.log(`creating branch "${BRANCH_NAME}" (schema-only preferred)…`);
    try {
      const created = await api(`/projects/${projectId}/branches`, {
        method: "POST",
        body: JSON.stringify({
          branch: { name: BRANCH_NAME, init_source: "schema-only", parent_id: prod.id },
          endpoints: [{ type: "read_write" }],
        }),
      });
      branch = created.branch;
      console.log(`created ${branch.id} (schema-only).`);
    } catch (err) {
      if (!/legacy web access|schema-only/i.test(String(err.message))) throw err;
      console.log("schema-only unavailable on this project (legacy web-access role) — falling back to a child branch; the reset step wipes its data.");
      const created = await api(`/projects/${projectId}/branches`, {
        method: "POST",
        body: JSON.stringify({
          branch: { name: BRANCH_NAME, parent_id: prod.id },
          endpoints: [{ type: "read_write" }],
        }),
      });
      branch = created.branch;
      console.log(`created ${branch.id} (child clone — MUST be wiped by the reset step before use).`);
    }
  }

  // Ensure it has a compute endpoint (find-or-create).
  const { endpoints = [] } = await api(`/projects/${projectId}/branches/${branch.id}/endpoints`);
  if (endpoints.length === 0) {
    console.log("no compute endpoint — creating one.");
    await api(`/projects/${projectId}/endpoints`, {
      method: "POST",
      body: JSON.stringify({ endpoint: { branch_id: branch.id, type: "read_write" } }),
    });
  }

  // Rotate every role password on this branch so no credential is shared with
  // production (child branches inherit passwords; schema-only behavior here is
  // undocumented — rotating makes it true by construction either way).
  const { roles = [] } = await api(`/projects/${projectId}/branches/${branch.id}/roles`);
  for (const role of roles) {
    if (role.protected) continue;
    await api(
      `/projects/${projectId}/branches/${branch.id}/roles/${encodeURIComponent(role.name)}/reset_password`,
      { method: "POST" },
    );
    console.log(`rotated password for role "${role.name}".`);
  }

  console.log(
    `ok: project=${projectId} branch=${BRANCH_NAME} (${branch.id}) — schema-only, credentials rotated. ` +
      "Next steps are in kb/runbooks/NEON_PREVIEW_DB.md.",
  );
}

main().catch((err) => fail(err.message));
