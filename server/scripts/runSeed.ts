/**
 * Run the boot-time content seed against whatever DATABASE_URL points at, then
 * exit. Used by .github/workflows/preview-seed.yml to pre-populate the
 * PII-free `preview-seed` Neon branch (the seed is idempotent — the server
 * also runs it on boot, so this is a warm-up, not a requirement).
 *
 *   DATABASE_URL="$(node scripts/neon-connection-uri.cjs)" \
 *     ./node_modules/.bin/tsx server/scripts/runSeed.ts
 */
// Load .env before "../seed" pulls in "../db", which throws at import time when
// DATABASE_URL is unset. Without this the script only works when the variable is
// exported inline (the CI invocation above) and fails from a local .env — the same
// reason server/scripts/markMigrationsApplied.ts does this.
import "dotenv/config";
import { seedDatabase } from "../seed";

seedDatabase()
  .then(() => {
    console.log("runSeed: done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("runSeed: failed —", err);
    process.exit(1);
  });
