/**
 * Run the boot-time content seed against whatever DATABASE_URL points at, then
 * exit. Used by .github/workflows/preview-seed.yml to pre-populate the
 * PII-free `preview-seed` Neon branch (the seed is idempotent — the server
 * also runs it on boot, so this is a warm-up, not a requirement).
 *
 *   DATABASE_URL="$(node scripts/neon-connection-uri.cjs)" \
 *     ./node_modules/.bin/tsx server/scripts/runSeed.ts
 */
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
