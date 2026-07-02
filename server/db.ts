import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import pg from 'pg'; // pg is CommonJS — default-import then destructure (named ESM import fails)
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

const { Pool: PgPool } = pg;
type PgPoolInstance = InstanceType<typeof PgPool>;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const url = process.env.DATABASE_URL;

// Fully-local dev uses the standard node-postgres driver; everything else
// (Neon / production) uses Neon's serverless WebSocket driver — which
// keeps its original behavior exactly. A localhost URL (or USE_LOCAL_PG=true)
// switches to the local driver.
const useLocalPg =
  process.env.USE_LOCAL_PG === "true" || /@(localhost|127\.0\.0\.1)[:/]/.test(url);

let poolInstance: NeonPool | PgPoolInstance;
let dbInstance: NeonDatabase<typeof schema>;

if (useLocalPg) {
  poolInstance = new PgPool({ connectionString: url });
  // node-postgres drizzle exposes the same query API; cast to one stable type
  // so the ~hundreds of `db.select()/insert()` call sites don't see a union.
  dbInstance = pgDrizzle(poolInstance as PgPoolInstance, { schema }) as unknown as NeonDatabase<typeof schema>;
} else {
  neonConfig.webSocketConstructor = ws;
  poolInstance = new NeonPool({ connectionString: url });
  dbInstance = neonDrizzle({ client: poolInstance as NeonPool, schema });
}

// The only consumer of `pool` calls pool.query(); both drivers support it.
export const pool = poolInstance as NeonPool;
export const db = dbInstance;
