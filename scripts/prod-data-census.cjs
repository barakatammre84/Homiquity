#!/usr/bin/env node
/**
 * THROWAWAY, READ-ONLY. Counts rows in the tables that would hold real people, so a
 * decision to let production lapse is made against numbers instead of a guess.
 *
 * SELECT only. No DDL, no DML, no transaction that writes. Lives on a probe branch and
 * is never merged to `main` (DB_MIGRATIONS.md § "The read-only prod probe").
 */
const { Client } = require("pg");

const TABLES = [
  "users", "leads", "email_captures", "partner_waitlist",
  "loan_applications", "properties", "coach_conversations",
  "credit_consents", "credit_pulls", "documents_uploads",
  "leases", "rent_payments", "partner_profiles", "audit_logs",
];

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const rows = [];
  for (const t of TABLES) {
    try {
      const r = await client.query(`SELECT count(*)::int AS n FROM "${t}"`);
      rows.push([t, r.rows[0].n]);
    } catch (e) {
      rows.push([t, `— (${String(e.message).split("\n")[0].slice(0, 60)})`]);
    }
  }
  // Newest human signal, if any users exist at all.
  let newest = "n/a";
  try {
    const r = await client.query(`SELECT max(created_at) AS m FROM users`);
    newest = r.rows[0].m ? new Date(r.rows[0].m).toISOString() : "no rows";
  } catch { /* table shape differs; the counts above still stand */ }

  console.log("\n=== PROD DATA CENSUS (read-only) ===");
  for (const [t, n] of rows) console.log(String(t).padEnd(24) + n);
  console.log("-".repeat(36));
  console.log("newest user created_at:  " + newest);
  console.log("=== END CENSUS ===\n");
  await client.end();
})().catch((e) => { console.error("census failed: " + e.message); process.exit(1); });
