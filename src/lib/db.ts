// Postgres persistence for the dashboard's application state.
//
// The whole store is kept as a single JSON snapshot in one row of the
// `app_state` table. That's deliberately simple: the data set is tiny
// (a handful of clients/users/instances) and a single self-hosted
// container is the expected topology, so a JSON document avoids a big
// relational schema while still surviving redeploys/restarts.
//
// Enabled by setting DATABASE_URL. Without it the store falls back to
// pure in-memory mode (demo seed) — see store.ts.
//
// Limitation: the in-memory working copy is cached per process, so
// running multiple replicas would let their caches drift. Run a single
// replica (the default on Coolify) or move to a relational schema if you
// need to scale out.

import { Pool } from "pg";

export const USE_PG = !!process.env.DATABASE_URL;

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Managed Postgres (and most external providers) require TLS.
      // Coolify's internal Postgres usually doesn't — leave DATABASE_SSL
      // unset for that. rejectUnauthorized:false accepts self-signed certs.
      ssl:
        process.env.DATABASE_SSL === "true"
          ? { rejectUnauthorized: false }
          : undefined,
      max: 5,
    });
  }
  return pool;
}

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(
        `CREATE TABLE IF NOT EXISTS app_state (
           id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
           version integer NOT NULL,
           data jsonb NOT NULL,
           updated_at timestamptz NOT NULL DEFAULT now()
         )`
      )
      .then(() => undefined)
      .catch((e) => {
        // Reset so a transient failure can be retried on the next call.
        schemaReady = null;
        throw e;
      });
  }
  return schemaReady;
}

export async function loadSnapshot(): Promise<{
  version: number;
  data: unknown;
} | null> {
  await ensureSchema();
  const r = await getPool().query<{ version: number; data: unknown }>(
    "SELECT version, data FROM app_state WHERE id = 1"
  );
  return r.rows[0] ?? null;
}

export async function saveSnapshot(
  version: number,
  data: unknown
): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `INSERT INTO app_state (id, version, data, updated_at)
       VALUES (1, $1, $2, now())
     ON CONFLICT (id) DO UPDATE
       SET version = EXCLUDED.version,
           data = EXCLUDED.data,
           updated_at = now()`,
    [version, JSON.stringify(data)]
  );
}
